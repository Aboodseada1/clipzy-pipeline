import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncMetrics } from "@/lib/workflow";

export const dynamic = "force-dynamic";

// Pull fresh metrics for all published posts (Stage 7 ingestion).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const posts = await prisma.publishedPost.findMany({ take: 100 });
  let updated = 0;
  for (const p of posts) {
    try {
      await syncMetrics(p.id);
      updated++;
    } catch {
      // continue even if one fails
    }
  }
  return NextResponse.json({ ok: true, updated, total: posts.length });
}
