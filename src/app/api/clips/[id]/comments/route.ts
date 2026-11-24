import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const comment = await prisma.clipComment.create({
    data: { clipId: id, userId: session.user.id, body: String(body.body).slice(0, 2000) },
    include: { user: true },
  });
  await audit({ userId: session.user.id, action: "clip.comment", category: "manual_override", targetType: "clip", targetId: id, detail: { body } });
  return NextResponse.json({ comment });
}
