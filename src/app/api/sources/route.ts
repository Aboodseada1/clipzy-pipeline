import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sources = await prisma.source.findMany({ include: { assets: { take: 1, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sources });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const source = await prisma.source.create({
    data: {
      label: body.label,
      kind: body.kind ?? "STREAMER",
      platform: body.platform,
      externalId: body.externalId,
      rightsStatus: body.rightsStatus ?? "UNKNOWN",
      attributionText: body.attributionText,
      requiresReview: body.requiresReview ?? true,
      watchlist: body.watchlist ?? true,
    },
  });
  await audit({ userId: session.user.id, action: "source.create", category: "config", targetType: "source", targetId: source.id, detail: { label: body.label } });
  return NextResponse.json({ source });
}
