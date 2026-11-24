import { prisma } from "@/lib/prisma";
import { bus } from "@/lib/realtime";
import type { PipelineEvent } from "@prisma/client";

// Append-only event log. Every state change goes through here so the dashboard
// can answer "what happened to clip X" and the SSE stream can fan it out live.
export async function emitEvent(input: {
  clipId?: string;
  sourceId?: string;
  userId?: string;
  stage?: string;
  level?: string;
  eventType: string;
  message: string;
  payload?: any;
}): Promise<PipelineEvent> {
  const ev = await prisma.pipelineEvent.create({
    data: {
      clipId: input.clipId,
      sourceId: input.sourceId,
      userId: input.userId,
      stage: input.stage,
      level: input.level ?? "info",
      eventType: input.eventType,
      message: input.message,
      payload: input.payload ?? undefined,
    },
  });

  // Project to realtime contract
  const payload = (ev.payload ?? {}) as Record<string, any>;
  if (ev.eventType === "stage.transition" && ev.clipId) {
    bus.publish({ kind: "stage", clipId: ev.clipId, stage: ev.stage ?? "", from: payload.from, to: payload.to ?? ev.stage ?? "", message: ev.message, ts: ev.createdAt.getTime() });
  } else if (ev.eventType === "approval.decided" && ev.clipId) {
    bus.publish({ kind: "approval", clipId: ev.clipId, decision: payload.decision ?? "PENDING", ts: ev.createdAt.getTime() });
  } else if (ev.eventType === "publish.attempt" && ev.clipId) {
    bus.publish({ kind: "publish", clipId: ev.clipId, platform: payload.platform ?? "", status: payload.status ?? "", ts: ev.createdAt.getTime() });
  } else if (ev.eventType === "source.live" && ev.sourceId) {
    bus.publish({ kind: "source", sourceId: ev.sourceId, live: true, ts: ev.createdAt.getTime() });
  } else if (ev.eventType === "system.flag" && payload?.key) {
    bus.publish({ kind: "flag", key: payload.key, value: !!payload.value, ts: ev.createdAt.getTime() });
  }

  return ev;
}

export async function isPaused(): Promise<boolean> {
  const flag = await prisma.systemFlag.findUnique({ where: { key: "pipeline.paused" } });
  return !!flag?.value;
}
