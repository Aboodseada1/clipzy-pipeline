import { PrismaClient, Role, SourceKind, RightsStatus, ClipStage, ClipStatus, ApprovalDecision } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_OPERATOR_EMAIL || "ops@clipzy.aaseada.com";
  const password = process.env.SEED_OPERATOR_PASSWORD || "clipzy-launch-2026";
  const passwordHash = await bcrypt.hash(password, 12);

  const owner = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.OWNER, status: "active" },
    create: { email, name: "Pipeline Operator", passwordHash, role: Role.OWNER, status: "active" },
  });

  const friendEmail = "friend@clipzy.aaseada.com";
  const friend = await prisma.user.upsert({
    where: { email: friendEmail },
    update: {},
    create: {
      email: friendEmail,
      name: "Collaborator",
      passwordHash: await bcrypt.hash("clipzy-launch-2026", 12),
      role: Role.OPERATOR,
      status: "active",
    },
  });

  // Baseline runtime config
  const defaults = [
    { key: "clip.minDurationSec", value: 15 },
    { key: "clip.maxDurationSec", value: 90 },
    { key: "clip.topNPerAsset", value: 3 },
    { key: "scoring.weights", value: { hook: 0.35, narrative: 0.2, emotion: 0.2, quotability: 0.15, novelty: 0.1 } },
    { key: "publish.scheduleWindows", value: [{ platform: "youtube", hour: 18 }, { platform: "tiktok", hour: 12 }, { platform: "instagram", hour: 19 }] },
    { key: "publish.frequencyCapPerDay", value: 4 },
    { key: "publish.minSpacingMin", value: 90 },
    { key: "branding.watermarkText", value: "@clipzy" },
    { key: "branding.introBumper", value: false },
    { key: "rights.defaultReviewOnUnknown", value: true },
    { key: "platforms.targets", value: ["youtube", "tiktok", "instagram"] },
  ];
  for (const c of defaults) {
    await prisma.runtimeConfig.upsert({
      where: { key: c.key },
      update: {},
      create: { key: c.key, value: c.value as any },
    });
  }

  // Global pause flag (off by default)
  await prisma.systemFlag.upsert({
    where: { key: "pipeline.paused" },
    update: {},
    create: { key: "pipeline.paused", value: false, note: "Global kill switch" },
  });

  // Demo source + asset + clips across stages, so dashboard is alive on first load
  const source = await prisma.source.upsert({
    where: { id: "demo-source-twitch" },
    update: {},
    create: {
      id: "demo-source-twitch",
      label: "Demo Streamer",
      kind: SourceKind.STREAMER,
      platform: "twitch",
      externalId: "demo_streamer",
      rightsStatus: RightsStatus.CLEARED,
      attributionText: "Source: Demo Streamer (twitch.tv/demo_streamer)",
      requiresReview: false,
    },
  });

  const asset = await prisma.sourceAsset.upsert({
    where: { id: "demo-asset-1" },
    update: {},
    create: {
      id: "demo-asset-1",
      sourceId: source.id,
      title: "Demo VOD — Ranked grind highlights",
      kind: "vod",
      url: "https://example.com/vod/demo-asset-1",
      durationSec: 7200,
      rightsStatus: RightsStatus.CLEARED,
      engagement: { viewers: 4200, likes: 980, comments: 312, velocity: 1.4 },
    },
  });

  const clips = [
    { id: "demo-clip-1", title: "Insane 1v3 clutch", startSec: 1240, endSec: 1305, stage: ClipStage.APPROVAL, virality: 0.92, hook: 0.95, narrative: 0.9, emotion: 0.93, quotability: 0.85, novelty: 0.8 },
    { id: "demo-clip-2", title: "Chat melts down over bait", startSec: 3120, endSec: 3180, stage: ClipStage.RENDERING, virality: 0.81, hook: 0.88, narrative: 0.78, emotion: 0.86, quotability: 0.82, novelty: 0.7 },
    { id: "demo-clip-3", title: "Perfect one-liner reaction", startSec: 5520, endSec: 5555, stage: ClipStage.COMPLIANCE, virality: 0.76, hook: 0.8, narrative: 0.7, emotion: 0.78, quotability: 0.95, novelty: 0.6 },
    { id: "demo-clip-4", title: "Controversial take on meta", startSec: 6700, endSec: 6780, stage: ClipStage.DETECTED, virality: 0.68, hook: 0.7, narrative: 0.65, emotion: 0.72, quotability: 0.78, novelty: 0.55 },
    { id: "demo-clip-5", title: "Wholesome chat moment", startSec: 8100, endSec: 8150, stage: ClipStage.SCHEDULED, virality: 0.71, hook: 0.74, narrative: 0.8, emotion: 0.7, quotability: 0.6, novelty: 0.65 },
  ];

  for (const c of clips) {
    const dur = c.endSec - c.startSec;
    await prisma.clipCandidate.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        sourceAssetId: asset.id,
        title: c.title,
        startSec: c.startSec,
        endSec: c.endSec,
        durationSec: dur,
        hookScore: c.hook,
        narrativeScore: c.narrative,
        emotionScore: c.emotion,
        quotabilityScore: c.quotability,
        noveltyScore: c.novelty,
        viralityScore: c.virality,
        stage: c.stage,
        status: ClipStatus.ACTIVE,
        priority: Math.round(c.virality * 100),
        idempotencyKey: `seed-${c.id}`,
        rationale: { note: "Seeded demo candidate", signals: ["laughter", "chat_velocity", "punchline"] },
      },
    });

    if (c.stage === ClipStage.APPROVAL) {
      await prisma.approvalTask.upsert({
        where: { clipId: c.id },
        update: {},
        create: { clipId: c.id, decision: ApprovalDecision.PENDING },
      });
      await prisma.complianceReview.upsert({
        where: { clipId: c.id },
        update: {},
        create: { clipId: c.id, status: "pass", avSyncOk: true, captionAccuracy: 0.96, aspectOk: true, policyFlags: [] },
      });
    }
  }

  await prisma.pipelineEvent.createMany({
    data: [
      { clipId: "demo-clip-1", sourceId: source.id, stage: "APPROVAL", eventType: "stage.transition", message: "Moved to approval queue after compliance passed", payload: { from: "COMPLIANCE", to: "APPROVAL" } },
      { clipId: "demo-clip-2", sourceId: source.id, stage: "RENDERING", eventType: "stage.transition", message: "Render started: 9:16 reframe + captions", payload: { progress: 0.4 } },
      { clipId: "demo-clip-3", sourceId: source.id, stage: "COMPLIANCE", eventType: "compliance.check", message: "Caption confidence 0.96, awaiting review", level: "info" },
      { sourceId: source.id, eventType: "source.live", message: "Demo source went live", level: "info" },
      { userId: owner.id, eventType: "auth.login", message: "Seeded operator login", level: "info" },
    ].map((e) => ({ ...e, level: (e as any).level || "info" })),
    skipDuplicates: true,
  });

  console.log("Seed complete.");
  console.log("Owner login:", email);
  console.log("Operator login:", friendEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
