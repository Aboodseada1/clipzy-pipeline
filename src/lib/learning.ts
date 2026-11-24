import { prisma } from "@/lib/prisma";
import { DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/scoring";

// Stage 7 feedback loop. Compares the virality scores we assigned at selection
// time against actual published performance, then nudges scoring weights in the
// direction that would have ranked performers higher. Pure + explainable so a
// human can review before applying.

export type FeedbackSuggestion = {
  currentWeights: ScoringWeights;
  suggestedWeights: ScoringWeights;
  reasoning: string[];
  samples: number;
  confidence: number;
};

const DIMENSIONS: (keyof ScoringWeights)[] = ["hook", "narrative", "emotion", "quotability", "novelty"];

export async function computeFeedback(): Promise<FeedbackSuggestion> {
  const current = ((await prisma.runtimeConfig.findUnique({ where: { key: "scoring.weights" } }))?.value as ScoringWeights) ?? DEFAULT_WEIGHTS;

  // Join published posts back to their clip's per-dimension scores.
  const posts = await prisma.publishedPost.findMany({
    include: { publishTask: { include: { clip: true } } },
    take: 200,
  });

  type Row = { dim: keyof ScoringWeights; score: number; normalizedViews: number };
  const rows: Row[] = [];
  let totalViews = 0;
  for (const p of posts) {
    const m = (p.metricsLast ?? {}) as Record<string, number>;
    const views = Number(m.views ?? 0);
    if (!p.metricsLast || views === 0) continue;
    totalViews += views;
    const clip = p.publishTask?.clip;
    if (!clip) continue;
    const scoreMap: Record<keyof ScoringWeights, number> = {
      hook: clip.hookScore,
      narrative: clip.narrativeScore,
      emotion: clip.emotionScore,
      quotability: clip.quotabilityScore,
      novelty: clip.noveltyScore,
    };
    const norm = totalViews > 0 ? views / totalViews : 0;
    for (const dim of DIMENSIONS) rows.push({ dim, score: scoreMap[dim], normalizedViews: norm });
  }

  // Per-dimension correlation between score and normalized views.
  const reasoning: string[] = [];
  const suggested: ScoringWeights = { ...current };
  const adjustments: Record<keyof ScoringWeights, number> = { hook: 0, narrative: 0, emotion: 0, quotability: 0, novelty: 0 };

  for (const dim of DIMENSIONS) {
    const dimRows = rows.filter((r) => r.dim === dim);
    if (dimRows.length < 3) continue;
    const corr = pearson(dimRows.map((r) => r.score), dimRows.map((r) => r.normalizedViews));
    adjustments[dim] = corr;
    if (Math.abs(corr) > 0.15) {
      const dir = corr > 0 ? "up" : "down";
      reasoning.push(`${dim}: correlation ${corr.toFixed(2)} with views → nudge weight ${dir}.`);
    }
  }

  // Apply a gentle nudge (max 20% relative change per cycle) then renormalize.
  const nudge = 0.2;
  for (const dim of DIMENSIONS) {
    const delta = adjustments[dim] * nudge * current[dim];
    suggested[dim] = Math.max(0.02, current[dim] + delta);
  }
  const sum = DIMENSIONS.reduce((s, d) => s + suggested[d], 0) || 1;
  for (const dim of DIMENSIONS) suggested[dim] = suggested[dim] / sum;

  const confidence = Math.min(1, posts.length / 30);

  if (reasoning.length === 0) {
    reasoning.push(`No strong signal yet across ${posts.length} published posts. Keep publishing to feed the loop.`);
  }

  return { currentWeights: current, suggestedWeights: suggested, reasoning, samples: posts.length, confidence };
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;
  const sx = x.reduce((a, b) => a + b, 0) / n;
  const sy = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - sx) * (y[i] - sy);
    dx += (x[i] - sx) ** 2;
    dy += (y[i] - sy) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}
