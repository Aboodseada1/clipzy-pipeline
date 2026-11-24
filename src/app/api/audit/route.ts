import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const category = req.nextUrl.searchParams.get("category");
  const logs = await prisma.auditLog.findMany({
    where: category ? { category } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });
  return NextResponse.json({ logs });
}
