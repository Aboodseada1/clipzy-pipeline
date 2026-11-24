import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { transitionClip } from "@/lib/workflow";
import { audit } from "@/lib/audit";
import { ClipStage } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const to = body.to as ClipStage;
  const res = await transitionClip({ clipId: id, to, userId: session.user.id, reason: body.reason });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await audit({ userId: session.user.id, action: "clip.transition", category: "manual_override", targetType: "clip", targetId: id, detail: { to, reason: body.reason } });
  return NextResponse.json({ ok: true });
}
