import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const posts = await prisma.publishedPost.findMany({ include: { publishTask: { include: { clip: { include: { sourceAsset: { include: { source: true } } } } } } }, orderBy: { createdAt: "desc" }, take: 100 });

  const summarized = posts.map((p) => {
    const last = (p.metricsLast ?? {}) as Record<string, number>;
    const views = Number(last.views ?? 0);
    const likes = Number(last.likes ?? 0);
    const watchThrough = Number(last.watchThrough ?? 0);
    return {
      id: p.id,
      platform: p.platform,
      postUrl: p.postUrl,
      views,
      likes,
      watchThrough,
      clipTitle: p.publishTask.clip.title,
      source: p.publishTask.clip.sourceAsset.source.label,
      createdAt: p.createdAt,
    };
  });

  const totals = summarized.reduce(
    (acc, p) => {
      acc.views += p.views;
      acc.likes += p.likes;
      acc.watchThrough += p.watchThrough;
      return acc;
    },
    { views: 0, likes: 0, watchThrough: 0 }
  );

  const avgWatch = summarized.length ? totals.watchThrough / summarized.length : 0;

  return NextResponse.json({
    posts: summarized,
    totals: { ...totals, avgWatchThrough: avgWatch, count: summarized.length },
  });
}
