// Adapter contracts for each pipeline stage. These are intentionally interfaces
// so production providers can be swapped without touching orchestration code.
// Phase 1 ships stubbed/mock implementations that exercise the full state flow.

export type DiscoveryResult = {
  sourceId: string;
  externalId: string;
  title?: string;
  url?: string;
  kind: "live" | "vod" | "clip_candidate" | "trend";
  durationSec?: number;
  isLive?: boolean;
  engagement?: Record<string, number>;
};

export interface SourceDiscoveryAdapter {
  name: string;
  discover(source: { id: string; platform: string; externalId?: string | null }): Promise<DiscoveryResult[]>;
}

export type MomentSegment = {
  startSec: number;
  endSec: number;
  hookScore: number;
  narrativeScore: number;
  emotionScore: number;
  quotabilityScore: number;
  noveltyScore: number;
  rationale?: Record<string, unknown>;
};

export interface MomentDetectionAdapter {
  name: string;
  analyze(asset: { id: string; url?: string | null; durationSec?: number | null }): Promise<MomentSegment[]>;
}

export interface RenderAdapter {
  name: string;
  render(clip: { id: string; sourceAssetId: string; startSec: number; endSec: number }): Promise<{
    filePath?: string;
    previewUrl?: string;
    durationSec?: number;
    width?: number;
    height?: number;
    aspectRatio?: string;
  }>;
}

export type CaptionCue = { t0: number; t1: number; text: string; emphasis?: boolean };

export interface CaptionAdapter {
  name: string;
  generate(clip: { id: string; durationSec: number }): Promise<{
    cues: CaptionCue[];
    postCopy: string;
    hashtags: string[];
    confidence: number;
  }>;
}

export interface ComplianceAdapter {
  name: string;
  review(clip: { id: string }): Promise<{
    avSyncOk: boolean;
    captionAccuracy: number;
    aspectOk: boolean;
    policyFlags: string[];
    status: "pass" | "flag" | "fail";
    notes?: string;
  }>;
}

export interface PublishAdapter {
  name: string;
  platform: string;
  publish(clip: { id: string; filePath?: string; postCopy?: string; hashtags?: string[] }): Promise<{
    postUrl: string;
  }>;
}

export interface MetricsAdapter {
  name: string;
  fetch(post: { id: string; platform: string; postUrl: string }): Promise<{
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    watchThrough?: number;
  }>;
}

// ─── Phase 1 stubbed adapters ───────────────────────────────────────────────
// Deterministic, no external deps. They let the full state machine run.

export const stubDiscovery: SourceDiscoveryAdapter = {
  name: "stub.discovery",
  async discover(source) {
    return [
      {
        sourceId: source.id,
        externalId: `${source.externalId ?? source.id}-vod-${Date.now()}`,
        title: `Discovered VOD from ${source.externalId ?? source.id}`,
        url: `https://example.com/vod/${source.id}-${Date.now()}`,
        kind: "vod" as const,
        durationSec: 5400,
        isLive: false,
        engagement: { viewers: 1500, likes: 220, comments: 64 },
      },
    ];
  },
};

export const stubMoment: MomentDetectionAdapter = {
  name: "stub.moment",
  async analyze(asset) {
    const dur = asset.durationSec ?? 3600;
    const out: MomentSegment[] = [];
    for (let i = 0; i < 3; i++) {
      const start = Math.floor(Math.random() * (dur - 60));
      const end = start + 20 + Math.floor(Math.random() * 50);
      out.push({
        startSec: start,
        endSec: end,
        hookScore: 0.6 + Math.random() * 0.35,
        narrativeScore: 0.55 + Math.random() * 0.35,
        emotionScore: 0.5 + Math.random() * 0.4,
        quotabilityScore: 0.55 + Math.random() * 0.4,
        noveltyScore: 0.45 + Math.random() * 0.4,
        rationale: { signals: ["chat_velocity", "laughter"], note: "stub" },
      });
    }
    return out;
  },
};

export const stubRender: RenderAdapter = {
  name: "stub.render",
  async render(clip) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      filePath: `/storage/renders/${clip.id}.mp4`,
      previewUrl: `/storage/renders/${clip.id}.preview.mp4`,
      durationSec: clip.endSec - clip.startSec,
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
    };
  },
};

export const stubCaption: CaptionAdapter = {
  name: "stub.caption",
  async generate(clip) {
    const cues: CaptionCue[] = [
      { t0: 0, t1: 1.5, text: "Check this out", emphasis: true },
      { t0: 1.6, t1: 3.2, text: "this is wild", emphasis: false },
    ];
    return {
      cues,
      postCopy: `New clip from the stream — clip ${clip.id.slice(0, 6)}`,
      hashtags: ["#shorts", "#streamclips", "#viral"],
      confidence: 0.94,
    };
  },
};

export const stubCompliance: ComplianceAdapter = {
  name: "stub.compliance",
  async review() {
    return { avSyncOk: true, captionAccuracy: 0.95, aspectOk: true, policyFlags: [], status: "pass" };
  },
};

export const stubPublish: PublishAdapter = {
  name: "stub.publish",
  platform: "youtube",
  async publish(clip) {
    return { postUrl: `https://youtube.com/shorts/${clip.id.slice(0, 8)}` };
  },
};

export const stubMetrics: MetricsAdapter = {
  name: "stub.metrics",
  async fetch() {
    return {
      views: Math.floor(Math.random() * 5000),
      likes: Math.floor(Math.random() * 400),
      comments: Math.floor(Math.random() * 80),
      shares: Math.floor(Math.random() * 60),
      watchThrough: 0.4 + Math.random() * 0.5,
    };
  },
};

export const adapters = {
  discovery: stubDiscovery,
  moment: stubMoment,
  render: stubRender,
  caption: stubCaption,
  compliance: stubCompliance,
  publish: stubPublish,
  metrics: stubMetrics,
};
