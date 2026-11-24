import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { scheduleClip, runPublish } from "@/lib/workflow";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "schedule") {
    const when = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
    const task = await scheduleClip({ clipId: id, platform: body.platform, scheduledFor: when, userId: session.user.id });
    await audit({ userId: session.user.id, action: "publish.schedule", category: "publish", targetType: "clip", targetId: id, detail: { platform: body.platform, when } });
    return NextResponse.json({ ok: true, task });
  }

  if (body.action === "publish_now") {
    const task = await scheduleClip({ clipId: id, platform: body.platform, scheduledFor: new Date(), userId: session.user.id });
    const res = await runPublish(task.id, session.user.id);
    await audit({ userId: session.user.id, action: "publish.attempt", category: "publish", targetType: "clip", targetId: id, detail: { platform: body.platform, ...res } });
    return NextResponse.json(res);
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
