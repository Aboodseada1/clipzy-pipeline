import { ClipStage, ClipStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emitEvent, isPaused } from "@/lib/events";
import { canTransition } from "@/lib/stages";
import { scoreVirality, type ScoringWeights } from "@/lib/scoring";
import { adapters } from "@/lib/adapters";
import { getConfig } from "@/lib/config";

// Idempotency: each forward transition keyed by clip+target stage+attempt so
// retries never double-advance a clip.

export async function transitionClip(input: {
  clipId: string;
  to: ClipStage;
  userId?: string;
  reason?: string;
  payload?: any;
}): Promise<{ ok: boolean; clip?: any; error?: string }> {
  const clip = await prisma.clipCandidate.findUnique({ where: { id: input.clipId } });
  if (!clip) return { ok: false, error: "Clip not found" };

  if (clip.status === ClipStatus.HELD && input.to !== ClipStage.DETECTED) {
    return { ok: false, error: "Clip is held by an operator" };
  }
  if (!canTransition(clip.stage, input.to)) {
    return { ok: false, error: `Invalid transition ${clip.stage} -> ${input.to}` };
  }

  const updated = await prisma.clipCandidate.update({
    where: { id: clip.id },
    data: { stage: input.to, status: stageToStatus(input.to) },
  });

  await emitEvent({
    clipId: clip.id,
    userId: input.userId,
    stage: input.to,
    eventType: "stage.transition",
    message: input.reason ?? `Moved ${clip.stage} -> ${input.to}`,
    payload: { ...input.payload, from: clip.stage, to: input.to },
  });

  return { ok: true, clip: updated };
}

function stageToStatus(stage: ClipStage): ClipStatus {
  if (stage === "PUBLISHED") return ClipStatus.COMPLETED;
  if (stage === "FAILED" || stage === "REJECTED") return ClipStatus.FAILED;
  if (stage === "HELD") return ClipStatus.HELD;
  return ClipStatus.ACTIVE;
}

// ─── Discovery → Candidates ─────────────────────────────────────────────────

export async function runDiscovery(sourceId: string, userId?: string) {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found");
  if (await isPaused()) return { skipped: true, reason: "paused" };

  const discovered = await adapters.discovery.discover(source);
  const created = [];
  for (const d of discovered) {
    const asset = await prisma.sourceAsset.upsert({
      where: { id: `${source.id}:${d.externalId}` },
      update: { engagement: d.engagement as any, isLive: d.isLive ?? false },
      create: {
        id: `${source.id}:${d.externalId}`,
        sourceId: source.id,
        externalId: d.externalId,
        title: d.title,
        kind: d.kind,
        url: d.url,
        durationSec: d.durationSec,
        isLive: d.isLive ?? false,
        rightsStatus: source.rightsStatus,
        engagement: d.engagement as any,
      },
    });
    created.push(asset);
    await emitEvent({
      sourceId: source.id,
      eventType: "source.asset_discovered",
      message: `New asset discovered: ${asset.title ?? asset.id}`,
      payload: { assetId: asset.id, kind: asset.kind },
    });
  }
  return { created };
}

// ─── Analysis → Candidates ──────────────────────────────────────────────────

export async function runAnalysis(assetId: string, userId?: string) {
  const asset = await prisma.sourceAsset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Asset not found");
  if (await isPaused()) return { skipped: true, reason: "paused" };

  const segments = await adapters.moment.analyze(asset);
  const weightsCfg = await getConfig<ScoringWeights>("scoring.weights");
  const weights = weightsCfg ?? { hook: 0.35, narrative: 0.2, emotion: 0.2, quotability: 0.15, novelty: 0.1 };
  const topNCfg = await getConfig<number>("clip.topNPerAsset") ?? 3;
  const minDur = await getConfig<number>("clip.minDurationSec") ?? 15;
  const maxDur = await getConfig<number>("clip.maxDurationSec") ?? 90;

  const created = [];
  for (const seg of segments) {
    const duration = seg.endSec - seg.startSec;
    if (duration < minDur || duration > maxDur) continue;
    const virality = scoreVirality(seg, weights);
    const idempotencyKey = `analysis:${asset.id}:${Math.floor(seg.startSec)}:${Math.floor(seg.endSec)}`;
    const clip = await prisma.clipCandidate.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        sourceAssetId: asset.id,
        title: `Clip @ ${Math.floor(seg.startSec)}s`,
        summary: seg.rationale?.note as string | undefined,
        startSec: seg.startSec,
        endSec: seg.endSec,
        durationSec: duration,
        hookScore: seg.hookScore,
        narrativeScore: seg.narrativeScore,
        emotionScore: seg.emotionScore,
        quotabilityScore: seg.quotabilityScore,
        noveltyScore: seg.noveltyScore,
        viralityScore: virality,
        rationale: seg.rationale as any,
        stage: ClipStage.DETECTED,
        status: ClipStatus.ACTIVE,
        priority: Math.round(virality * 100),
        idempotencyKey,
      },
    });
    created.push(clip);
    await emitEvent({
      clipId: clip.id,
      sourceId: asset.sourceId,
      eventType: "analysis.candidate",
      message: `Candidate detected with virality ${(virality * 100).toFixed(0)}%`,
      payload: { virality, scores: seg },
    });
  }

  // Auto-promote top N to SELECTED
  const sorted = created.sort((a, b) => b.viralityScore - a.viralityScore).slice(0, topNCfg);
  for (const c of sorted) {
    await transitionClip({ clipId: c.id, to: ClipStage.SELECTED, userId, reason: "Auto-promoted by analysis" });
  }

  return { created: created.length, selected: sorted.length };
}

// ─── Render + Caption ───────────────────────────────────────────────────────

export async function runRender(clipId: string, userId?: string) {
  const clip = await prisma.clipCandidate.findUnique({ where: { id: clipId } });
  if (!clip) throw new Error("Clip not found");
  if (await isPaused()) return { skipped: true, reason: "paused" };

  try {
    const r = await adapters.render.render(clip);
    await prisma.renderedClip.upsert({
      where: { clipId: clip.id },
      update: { filePath: r.filePath, previewUrl: r.previewUrl, durationSec: r.durationSec, width: r.width, height: r.height, aspectRatio: r.aspectRatio, completedAt: new Date() },
      create: { clipId: clip.id, filePath: r.filePath, previewUrl: r.previewUrl, durationSec: r.durationSec, width: r.width, height: r.height, aspectRatio: r.aspectRatio, completedAt: new Date() },
    });
    const cap = await adapters.caption.generate({ id: clip.id, durationSec: clip.durationSec });
    await prisma.captionTrack.create({
      data: {
        clipId: clip.id,
        kind: "onscreen",
        platform: "universal",
        language: "en",
        content: cap.postCopy,
        cues: cap.cues as any,
        confidence: cap.confidence,
      },
    });
    await transitionClip({ clipId: clip.id, to: ClipStage.COMPLIANCE, userId, reason: "Render + captions complete" });
    return { ok: true };
  } catch (e: any) {
    await prisma.clipCandidate.update({ where: { id: clip.id }, data: { lastError: e.message } });
    await emitEvent({ clipId: clip.id, eventType: "render.failed", message: e.message, level: "error" });
    return { ok: false, error: e.message };
  }
}

// ─── Compliance ─────────────────────────────────────────────────────────────

export async function runCompliance(clipId: string, userId?: string) {
  const clip = await prisma.clipCandidate.findUnique({ where: { id: clipId } });
  if (!clip) throw new Error("Clip not found");

  const r = await adapters.compliance.review(clip);
  await prisma.complianceReview.upsert({
    where: { clipId: clip.id },
    update: { status: r.status, avSyncOk: r.avSyncOk, captionAccuracy: r.captionAccuracy, aspectOk: r.aspectOk, policyFlags: r.policyFlags, notes: r.notes, reviewedAt: new Date() },
    create: { clipId: clip.id, status: r.status, avSyncOk: r.avSyncOk, captionAccuracy: r.captionAccuracy, aspectOk: r.aspectOk, policyFlags: r.policyFlags, notes: r.notes, reviewedAt: new Date() },
  });

  if (r.status === "fail") {
    await transitionClip({ clipId: clip.id, to: ClipStage.FAILED, userId, reason: "Compliance failed" });
    return { ok: false, failed: true };
  }
  if (r.status === "flag" || r.policyFlags.length > 0) {
    await transitionClip({ clipId: clip.id, to: ClipStage.COMPLIANCE_FLAG, userId, reason: "Compliance flagged for review" });
    return { ok: false, flagged: true };
  }
  await transitionClip({ clipId: clip.id, to: ClipStage.APPROVAL, userId, reason: "Compliance passed" });
  await prisma.approvalTask.upsert({
    where: { clipId: clip.id },
    update: { decision: "PENDING" },
    create: { clipId: clip.id, decision: "PENDING" },
  });
  return { ok: true };
}

// ─── Approval (human gate) ─────────────────────────────────────────────────

export async function decideApproval(input: { clipId: string; decision: "APPROVED" | "REJECTED" | "HELD"; userId: string; reason?: string }) {
  const clip = await prisma.clipCandidate.findUnique({ where: { id: input.clipId } });
  if (!clip) throw new Error("Clip not found");

  await prisma.approvalTask.upsert({
    where: { clipId: clip.id },
    update: { decision: input.decision, decisionBy: input.userId, reason: input.reason, decidedAt: new Date() },
    create: { clipId: clip.id, decision: input.decision, decisionBy: input.userId, reason: input.reason, decidedAt: new Date() },
  });

  const target = input.decision === "APPROVED" ? ClipStage.APPROVED : input.decision === "REJECTED" ? ClipStage.REJECTED : ClipStage.HELD;
  const res = await transitionClip({ clipId: clip.id, to: target, userId: input.userId, reason: `Operator ${input.decision.toLowerCase()}: ${input.reason ?? ""}` });
  await emitEvent({ clipId: clip.id, userId: input.userId, eventType: "approval.decided", message: `Approval: ${input.decision}`, payload: { decision: input.decision, reason: input.reason } });
  return res;
}

// ─── Schedule + Publish ─────────────────────────────────────────────────────

export async function scheduleClip(input: { clipId: string; platform: string; scheduledFor?: Date; userId?: string }) {
  const spacing = await getConfig<number>("publish.minSpacingMin") ?? 90;
  const when = input.scheduledFor ?? new Date(Date.now() + spacing * 60_000);
  const task = await prisma.publishTask.create({
    data: { clipId: input.clipId, platform: input.platform, status: "scheduled", scheduledFor: when },
  });
  await transitionClip({ clipId: input.clipId, to: ClipStage.SCHEDULED, userId: input.userId, reason: `Scheduled on ${input.platform}` });
  return task;
}

export async function runPublish(taskId: string, userId?: string) {
  const task = await prisma.publishTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  if (await isPaused()) return { skipped: true, reason: "paused" };

  await prisma.publishTask.update({ where: { id: task.id }, data: { status: "publishing" } });
  await transitionClip({ clipId: task.clipId, to: ClipStage.PUBLISHING, userId, reason: `Publishing to ${task.platform}` });

  try {
    const result = await adapters.publish.publish({ id: task.clipId, filePath: undefined, postCopy: task.postCopy ?? undefined, hashtags: task.hashtags });
    await prisma.publishTask.update({ where: { id: task.id }, data: { status: "published", postUrl: result.postUrl, publishedAt: new Date() } });
    await prisma.publishedPost.create({
      data: { publishTaskId: task.id, platform: task.platform, postUrl: result.postUrl },
    }).catch(() => {}); // unique may exist if retried
    await transitionClip({ clipId: task.clipId, to: ClipStage.PUBLISHED, userId, reason: `Published to ${task.platform}` });
    return { ok: true, postUrl: result.postUrl };
  } catch (e: any) {
    await prisma.publishTask.update({ where: { id: task.id }, data: { status: "failed", lastError: e.message, attemptCount: { increment: 1 } } });
    await emitEvent({ clipId: task.clipId, userId, eventType: "publish.failed", message: e.message, level: "error", payload: { platform: task.platform } });
    return { ok: false, error: e.message };
  }
}

// ─── Metrics feedback loop ──────────────────────────────────────────────────

export async function syncMetrics(postId: string) {
  const post = await prisma.publishedPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error("Post not found");
  const m = await adapters.metrics.fetch(post);
  const hist = Array.isArray((post.metricsHist as any[]) ?? []) ? [...((post.metricsHist as any[]) ?? []), { at: new Date(), ...m }] : [{ at: new Date(), ...m }];
  await prisma.publishedPost.update({ where: { id: post.id }, data: { metricsLast: m as any, metricsHist: hist as any } });
  return m;
}
