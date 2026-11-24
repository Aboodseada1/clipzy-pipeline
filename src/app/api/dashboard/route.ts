import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stageCounts, avgVirality, topClips, queueHealth, sourcesSummary, publishingSummary } from "@/lib/projections";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [clips, sources, tasks, events, pausedFlag] = await Promise.all([
    prisma.clipCandidate.findMany({ include: { sourceAsset: { include: { source: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.source.findMany({ include: { assets: true } }),
    prisma.publishTask.findMany(),
    prisma.pipelineEvent.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
    prisma.systemFlag.findUnique({ where: { key: "pipeline.paused" } }),
  ]);

  const stages = stageCounts(clips);
  const since1h = Date.now() - 3_600_000;
  const recentTransitions = events.filter((e) => e.createdAt.getTime() >= since1h && e.eventType === "stage.transition").length;

  const topClipsRaw = topClips(clips as any, 6) as (typeof clips)[number][];

  return NextResponse.json({
    paused: !!pausedFlag?.value,
    counts: {
      clips: clips.length,
      sources: sources.length,
      approvalQueue: stages["APPROVAL"] ?? 0,
      flagged: stages["COMPLIANCE_FLAG"] ?? 0,
      failed: stages["FAILED"] ?? 0,
      published: stages["PUBLISHED"] ?? 0,
    },
    health: { ...queueHealth(stages), throughput1h: recentTransitions, avgVirality: avgVirality(clips) },
    stages,
    topClips: topClipsRaw.map((c) => ({
      id: c.id,
      title: c.title,
      stage: c.stage,
      virality: c.viralityScore,
      source: (c as any).sourceAsset?.source?.label ?? "—",
      duration: c.durationSec,
    })),
    sources: sourcesSummary(sources as any),
    publishing: publishingSummary(tasks),
    events: events.slice(0, 25).map((e) => ({
      id: e.id.toString(),
      clipId: e.clipId,
      sourceId: e.sourceId,
      stage: e.stage,
      level: e.level,
      eventType: e.eventType,
      message: e.message,
      createdAt: e.createdAt,
    })),
  });
}
