import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runCompliance } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const res = await runCompliance(id, session.user.id);
  return NextResponse.json(res);
}
