import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { runDiscovery, runAnalysis } from "@/lib/workflow";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "discover") {
    const res = await runDiscovery(id, session.user.id);
    await audit({ userId: session.user.id, action: "source.discover", category: "manual_override", targetType: "source", targetId: id, detail: res });
    return NextResponse.json(res);
  }

  if (body.action === "analyze" && body.assetId) {
    const res = await runAnalysis(body.assetId, session.user.id);
    await audit({ userId: session.user.id, action: "source.analyze", category: "manual_override", targetType: "source_asset", targetId: body.assetId, detail: res });
    return NextResponse.json(res);
  }

  if (body.action === "delete") {
    await prisma.source.delete({ where: { id } });
    await audit({ userId: session.user.id, action: "source.delete", category: "config", targetType: "source", targetId: id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
