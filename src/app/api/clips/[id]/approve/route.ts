import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { decideApproval } from "@/lib/workflow";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const decision = body.decision as "APPROVED" | "REJECTED" | "HELD";
  const res = await decideApproval({ clipId: id, decision, userId: session.user.id, reason: body.reason });
  await audit({ userId: session.user.id, action: `approval.${decision.toLowerCase()}`, category: "approval", targetType: "clip", targetId: id, detail: { reason: body.reason } });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
