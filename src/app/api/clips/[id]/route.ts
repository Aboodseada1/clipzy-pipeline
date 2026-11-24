import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const clip = await prisma.clipCandidate.findUnique({
    where: { id },
    include: {
      sourceAsset: { include: { source: true } },
      rendered: true,
      captions: true,
      compliance: true,
      approval: { include: { decider: true } },
      publishTasks: true,
      comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      events: { take: 50, orderBy: { createdAt: "desc" } },
    },
  });
  if (!clip) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ clip });
}
