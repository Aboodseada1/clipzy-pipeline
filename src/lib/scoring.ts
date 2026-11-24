import { ClipStage, ClipStatus, type ClipCandidate } from "@prisma/client";

// Stage 2 — Virality scoring model. Pure function so it can be re-run on any
// candidate when config weights change, and feed the learning loop in Stage 7.
export type ScoringWeights = {
  hook: number;
  narrative: number;
  emotion: number;
  quotability: number;
  novelty: number;
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
  hook: 0.35,
  narrative: 0.2,
  emotion: 0.2,
  quotability: 0.15,
  novelty: 0.1,
};

export function scoreVirality(clip: {
  hookScore: number;
  narrativeScore: number;
  emotionScore: number;
  quotabilityScore: number;
  noveltyScore: number;
}, weights: ScoringWeights = DEFAULT_WEIGHTS): number {
  const w = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const raw =
    clip.hookScore * weights.hook +
    clip.narrativeScore * weights.narrative +
    clip.emotionScore * weights.emotion +
    clip.quotabilityScore * weights.quotability +
    clip.noveltyScore * weights.novelty;
  return Math.min(1, Math.max(0, raw / w));
}

export function withinDurationBounds(sec: number, min: number, max: number) {
  return sec >= min && sec <= max;
}

export function selectTopN(clips: ClipCandidate[], n: number, minSec: number, maxSec: number): ClipCandidate[] {
  return clips
    .filter((c) => withinDurationBounds(c.durationSec, minSec, maxSec))
    .sort((a, b) => b.viralityScore - a.viralityScore)
    .slice(0, n);
}

export function shouldAutoRouteToReview(clip: ClipCandidate): boolean {
  return (
    clip.viralityScore < 0.4 ||
    clip.durationSec < 5 ||
    (clip.stage === ClipStage.COMPLIANCE && clip.status === ClipStatus.ACTIVE && clip.lastError != null)
  );
}
