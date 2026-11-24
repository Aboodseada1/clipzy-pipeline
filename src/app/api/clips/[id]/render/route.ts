import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runRender } from "@/lib/workflow";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const res = await runRender(id, session.user.id);
  await audit({ userId: session.user.id, action: "clip.render", category: "manual_override", targetType: "clip", targetId: id, detail: res });
  if (res.skipped) return NextResponse.json({ ok: false, skipped: true, reason: res.reason });
  return NextResponse.json(res);
}
