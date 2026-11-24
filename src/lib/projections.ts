// Convex-style normalized state projections used by the realtime dashboard.
// These are pure functions over Prisma records — the UI subscribes to their results
// via the /api/stream SSE endpoint and the /api/dashboard aggregate endpoint.
import type { ClipCandidate, PipelineEvent, PublishTask, Source, SourceAsset } from "@prisma/client";

export type StageCounts = Record<string, number>;

export function stageCounts(clips: ClipCandidate[]): StageCounts {
  return clips.reduce<StageCounts>((acc, c) => {
    acc[c.stage] = (acc[c.stage] ?? 0) + 1;
    return acc;
  }, {});
}

export function avgVirality(clips: ClipCandidate[]): number {
  if (clips.length === 0) return 0;
  return clips.reduce((s, c) => s + c.viralityScore, 0) / clips.length;
}

export function throughput(events: PipelineEvent[], sinceMs: number): number {
  const cutoff = Date.now() - sinceMs;
  return events.filter((e) => e.createdAt.getTime() >= cutoff && e.eventType === "stage.transition").length;
}

export function queueHealth(stage: StageCounts) {
  const approval = stage["APPROVAL"] ?? 0;
  const flagged = stage["COMPLIANCE_FLAG"] ?? 0;
  const failed = stage["FAILED"] ?? 0;
  const rendering = stage["RENDERING"] ?? 0;
  const score = Math.max(0, 100 - (flagged * 8 + failed * 5));
  return { approval, flagged, failed, rendering, score };
}

export function topClips(clips: ClipCandidate[], n = 5) {
  return [...clips].sort((a, b) => b.viralityScore - a.viralityScore).slice(0, n);
}

export function sourcesSummary(sources: (Source & { assets: SourceAsset[] })[]) {
  return sources.map((s) => ({
    id: s.id,
    label: s.label,
    platform: s.platform,
    rightsStatus: s.rightsStatus,
    live: s.assets.some((a) => a.isLive),
    assets: s.assets.length,
  }));
}

export function publishingSummary(tasks: PublishTask[]) {
  return {
    queued: tasks.filter((t) => t.status === "queued").length,
    scheduled: tasks.filter((t) => t.status === "scheduled").length,
    published: tasks.filter((t) => t.status === "published").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };
}
