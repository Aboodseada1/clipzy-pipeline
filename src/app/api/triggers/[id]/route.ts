import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.triggerRun.findUnique({
    where: { id },
  });

  if (!run) return NextResponse.json({ error: "Trigger run not found" }, { status: 404 });

  return NextResponse.json({ run });
}
