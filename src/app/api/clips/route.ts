import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ClipStage, ClipStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stage = req.nextUrl.searchParams.get("stage") as ClipStage | null;
  const status = req.nextUrl.searchParams.get("status") as ClipStatus | null;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;

  const clips = await prisma.clipCandidate.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(status ? { status } : {}),
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      sourceAsset: { include: { source: true } },
      rendered: true,
      compliance: true,
      approval: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ clips });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const clip = await prisma.clipCandidate.create({
    data: {
      sourceAssetId: body.sourceAssetId,
      title: body.title,
      startSec: body.startSec,
      endSec: body.endSec,
      durationSec: body.endSec - body.startSec,
      hookScore: body.hookScore ?? 0.5,
      narrativeScore: body.narrativeScore ?? 0.5,
      emotionScore: body.emotionScore ?? 0.5,
      quotabilityScore: body.quotabilityScore ?? 0.5,
      noveltyScore: body.noveltyScore ?? 0.5,
      idempotencyKey: `manual:${body.sourceAssetId}:${Math.floor(body.startSec)}:${Date.now()}`,
      rationale: { note: "Manually created", signals: [] },
    },
  });
  return NextResponse.json({ clip });
}
