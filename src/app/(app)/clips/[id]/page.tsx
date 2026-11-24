"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Label } from "@/components/ui/input";
import { FadeIn, Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";
import { STAGE_LABEL, STAGE_COLOR, STAGE_ORDER } from "@/lib/stages";
import { formatDuration, formatRelative, pct } from "@/lib/utils";
import { ArrowLeft, Play, RefreshCw, Send, ShieldCheck, Film, MessageSquare, Loader2, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { ClipStage } from "@prisma/client";

type ClipDetail = {
  id: string;
  title: string | null;
  summary: string | null;
  startSec: number;
  endSec: number;
  durationSec: number;
  hookScore: number;
  narrativeScore: number;
  emotionScore: number;
  quotabilityScore: number;
  noveltyScore: number;
  viralityScore: number;
  stage: string;
  status: string;
  priority: number;
  lastError: string | null;
  rationale: any;
  createdAt: string;
  updatedAt: string;
  sourceAsset: { id: string; title: string | null; url: string | null; source: { id: string; label: string; platform: string; rightsStatus: string; attributionText: string | null } };
  rendered: { filePath: string | null; previewUrl: string | null; width: number | null; height: number | null; aspectRatio: string | null } | null;
  captions: { id: string; kind: string; platform: string | null; content: string; cues: any; confidence: number | null }[];
  compliance: { status: string; avSyncOk: boolean | null; captionAccuracy: number | null; aspectOk: boolean | null; policyFlags: string[]; notes: string | null } | null;
  approval: { decision: string; reason: string | null; decidedAt: string | null; decider: { email: string; name: string | null } | null } | null;
  publishTasks: { id: string; platform: string; status: string; scheduledFor: string | null; postUrl: string | null; publishedAt: string | null }[];
  comments: { id: string; body: string; createdAt: string; user: { email: string; name: string | null } }[];
  events: { id: string; level: string; eventType: string; message: string; createdAt: string; stage: string | null }[];
};

export default function ClipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, refetch } = useFetch<{ clip: ClipDetail }>(`/api/clips/${id}`);
  const clip = data?.clip;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex items-center gap-3">
        <Link href="/clips"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{clip?.title ?? id}</h1>
          <p className="text-xs text-[var(--color-muted)]">
            {clip ? `${clip.sourceAsset.source.label} · ${formatDuration(clip.durationSec)} · ${clip.sourceAsset.source.platform}` : "Loading…"}
          </p>
        </div>
        {clip ? (
          <span className={`rounded-full px-3 py-1 text-xs ring-1 ring-inset ${STAGE_COLOR[clip.stage as keyof typeof STAGE_COLOR] ?? ""}`}>
            {STAGE_LABEL[clip.stage as keyof typeof STAGE_LABEL] ?? clip.stage}
          </span>
        ) : null}
      </FadeIn>

      {loading && !clip ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="shimmer h-96 rounded-2xl lg:col-span-2" />
          <div className="shimmer h-96 rounded-2xl" />
        </div>
      ) : clip ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <PreviewCard clip={clip} />
            <ScoringCard clip={clip} />
            <CaptionsCard clip={clip} />
            <ComplianceCard clip={clip} />
            <TimelineCard clip={clip} />
          </div>
          <div className="space-y-6">
            <ActionsCard clip={clip} onChanged={refetch} />
            <PublishCard clip={clip} onChanged={refetch} />
            <CommentsCard clip={clip} onChanged={refetch} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreviewCard({ clip }: { clip: ClipDetail }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Play className="h-4 w-4 text-[var(--color-brand)]" /> Preview</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-black" style={{ aspectRatio: clip.rendered?.aspectRatio ?? "9 / 16", maxHeight: 380 }}>
          {clip.rendered?.previewUrl ? (
            <video src={clip.rendered.previewUrl} controls className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-[var(--color-muted)]">
              <Film className="h-8 w-8 opacity-50" />
              No rendered preview yet. Trigger a render from the actions panel.
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-[var(--color-panel-2)] p-2"><div className="text-[var(--color-muted)]">In/Out</div><div className="font-medium">{Math.round(clip.startSec)}s → {Math.round(clip.endSec)}s</div></div>
          <div className="rounded-lg bg-[var(--color-panel-2)] p-2"><div className="text-[var(--color-muted)]">Duration</div><div className="font-medium">{formatDuration(clip.durationSec)}</div></div>
          <div className="rounded-lg bg-[var(--color-panel-2)] p-2"><div className="text-[var(--color-muted)]">Aspect</div><div className="font-medium">{clip.rendered?.aspectRatio ?? "9:16"}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoringCard({ clip }: { clip: ClipDetail }) {
  const scores = [
    { label: "Hook", value: clip.hookScore },
    { label: "Narrative", value: clip.narrativeScore },
    { label: "Emotion", value: clip.emotionScore },
    { label: "Quotability", value: clip.quotabilityScore },
    { label: "Novelty", value: clip.noveltyScore },
  ];
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2">Virality breakdown</span><Badge variant="brand">{pct(clip.viralityScore)}</Badge></CardTitle></CardHeader>
      <CardContent>
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {scores.map((s) => (
            <StaggerItem key={s.label}>
              <div className="flex items-center justify-between text-sm"><span className="text-[var(--color-muted)]">{s.label}</span><span className="font-semibold">{pct(s.value)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-base)]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${s.value * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="h-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-2)]" />
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        {clip.rationale?.signals ? (
          <div className="mt-4">
            <Label>Detected signals</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(clip.rationale.signals as string[]).map((s) => <Badge key={s} variant="muted">{s}</Badge>)}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CaptionsCard({ clip }: { clip: ClipDetail }) {
  const onscreen = clip.captions.find((c) => c.kind === "onscreen");
  return (
    <Card>
      <CardHeader><CardTitle>On-screen captions</CardTitle></CardHeader>
      <CardContent>
        {onscreen ? (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="muted">{onscreen.platform ?? "universal"}</Badge>
              {onscreen.confidence != null ? <Badge variant={onscreen.confidence > 0.9 ? "success" : "warn"}>Confidence {pct(onscreen.confidence)}</Badge> : null}
            </div>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--color-base)]/60 p-3 text-xs">{onscreen.content}</pre>
            {Array.isArray(onscreen.cues) ? (
              <div className="mt-3 grid grid-cols-1 gap-1">
                {(onscreen.cues as { t0: number; t1: number; text: string; emphasis?: boolean }[]).slice(0, 8).map((cue, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-[var(--color-panel-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">{formatDuration(cue.t0)}</span>
                    <span className={cue.emphasis ? "font-semibold text-[var(--color-brand)]" : ""}>{cue.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">No captions yet. Captions are generated as part of the render stage.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ComplianceCard({ clip }: { clip: ClipDetail }) {
  const c = clip.compliance;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--color-brand)]" /> Compliance</CardTitle></CardHeader>
      <CardContent>
        {c ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={c.status === "pass" ? "success" : c.status === "flag" ? "warn" : "danger"}>{c.status}</Badge>
              {c.avSyncOk != null ? <Badge variant={c.avSyncOk ? "success" : "danger"}>A/V sync</Badge> : null}
              {c.aspectOk != null ? <Badge variant={c.aspectOk ? "success" : "danger"}>Aspect ratio</Badge> : null}
              {c.policyFlags.map((f) => <Badge key={f} variant="warn">{f}</Badge>)}
            </div>
            {c.captionAccuracy != null ? <div className="text-xs text-[var(--color-muted)]">Caption accuracy: {pct(c.captionAccuracy)}</div> : null}
            {c.notes ? <p className="text-xs text-[var(--color-muted)]">{c.notes}</p> : null}
          </div>
        ) : <p className="text-sm text-[var(--color-muted)]">Not yet reviewed.</p>}
      </CardContent>
    </Card>
  );
}

function TimelineCard({ clip }: { clip: ClipDetail }) {
  const events = clip.events.slice(0, 30).reverse();
  const currentIdx = STAGE_ORDER.indexOf(clip.stage as ClipStage);
  return (
    <Card>
      <CardHeader><CardTitle>Lifecycle</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-1">
          {STAGE_ORDER.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${active ? `ring-1 ring-inset ${STAGE_COLOR[s]}` : done ? "text-[var(--color-muted)]" : "text-[var(--color-muted)]/40"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--color-brand)]" : done ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`} />
                  {STAGE_LABEL[s]}
                </div>
                {i < STAGE_ORDER.length - 1 ? <ChevronRight className="h-3 w-3 text-[var(--color-muted)]/40" /> : null}
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 rounded-lg bg-[var(--color-base)]/40 p-2 text-xs">
              <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.level === "error" ? "bg-rose-400" : e.level === "warn" ? "bg-amber-400" : "bg-[var(--color-brand)]"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.eventType}</span>
                  <span className="text-[10px] text-[var(--color-muted)]">{formatRelative(e.createdAt)}</span>
                </div>
                <p className="text-[var(--color-muted)]">{e.message}</p>
              </div>
            </div>
          ))}
          {events.length === 0 ? <p className="text-xs text-[var(--color-muted)]">No lifecycle events recorded yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionsCard({ clip, onChanged }: { clip: ClipDetail; onChanged: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function call(action: string, url: string, method = "POST", body?: any) {
    setBusy(action);
    try {
      const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "failed");
      push({ title: `${action} OK`, variant: "success" });
      onChanged();
    } catch (e: any) {
      push({ title: `${action} failed`, description: e.message, variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  const stage = clip.stage as ClipStage;
  return (
    <Card>
      <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {stage === "DETECTED" || stage === "HELD" ? <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => call("promote", `/api/clips/${clip.id}/transition`, "POST", { to: "SELECTED", reason: "Manual promote" })}>{busy === "promote" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Promote to selected</Button> : null}
        {stage === "SELECTED" ? <Button size="sm" disabled={busy !== null} onClick={() => call("render", `/api/clips/${clip.id}/render`)}>{busy === "render" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Render + caption</Button> : null}
        {stage === "RENDERED" ? <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => call("compliance", `/api/clips/${clip.id}/compliance`)}>{busy === "compliance" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Run compliance</Button> : null}
        {stage === "COMPLIANCE_FLAG" ? <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => call("send-to-approval", `/api/clips/${clip.id}/transition`, "POST", { to: "APPROVAL", reason: "Override to approval" })}>{busy === "send-to-approval" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Send to approval</Button> : null}
        {stage !== "HELD" && stage !== "PUBLISHED" && stage !== "REJECTED" && stage !== "FAILED" ? (
          <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => call("hold", `/api/clips/${clip.id}/transition`, "POST", { to: "HELD", reason: "Manual hold" })}>{busy === "hold" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Hold</Button>
        ) : null}
        {(stage === "FAILED" || stage === "HELD" || stage === "REJECTED") ? (
          <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => call("re-detect", `/api/clips/${clip.id}/transition`, "POST", { to: "DETECTED", reason: "Re-queue from detected" })}>{busy === "re-detect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Re-queue</Button>
        ) : null}
        {clip.lastError ? <div className="mt-1 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">Last error: {clip.lastError}</div> : null}
      </CardContent>
    </Card>
  );
}

function PublishCard({ clip, onChanged }: { clip: ClipDetail; onChanged: () => void }) {
  const { push } = useToast();
  const [platform, setPlatform] = useState("youtube");
  const [busy, setBusy] = useState(false);
  const canPublish = clip.stage === "APPROVED" || clip.stage === "SCHEDULED";

  async function publish(action: "schedule" | "publish_now") {
    setBusy(true);
    try {
      const r = await fetch(`/api/clips/${clip.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, platform }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "failed");
      push({ title: action === "schedule" ? "Scheduled" : "Published", variant: "success" });
      onChanged();
    } catch (e: any) {
      push({ title: "Publish failed", description: e.message, variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-[var(--color-brand)]" /> Publishing</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        {clip.approval ? (
          <div className="rounded-lg bg-[var(--color-panel-2)] p-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-[var(--color-muted)]">Approval</span><Badge variant={clip.approval.decision === "APPROVED" ? "success" : clip.approval.decision === "REJECTED" ? "danger" : "warn"}>{clip.approval.decision}</Badge></div>
            {clip.approval.decider ? <div className="mt-1 text-[var(--color-muted)]">by {clip.approval.decider.name ?? clip.approval.decider.email}</div> : null}
          </div>
        ) : null}

        {clip.publishTasks.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {clip.publishTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg bg-[var(--color-base)]/40 p-2 text-xs">
                <div>
                  <div className="font-medium capitalize">{t.platform}</div>
                  <div className="text-[var(--color-muted)]">{t.status}{t.scheduledFor ? ` · ${formatRelative(t.scheduledFor)}` : ""}</div>
                </div>
                {t.postUrl ? <a href={t.postUrl} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] hover:underline">view</a> : null}
              </div>
            ))}
          </div>
        ) : null}

        {canPublish ? (
          <>
            <div className="flex gap-1.5">
              {["youtube", "tiktok", "instagram"].map((p) => (
                <button key={p} onClick={() => setPlatform(p)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs capitalize transition ${platform === p ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-panel-2)] text-[var(--color-muted)]"}`}>{p}</button>
              ))}
            </div>
            <Button size="sm" disabled={busy} onClick={() => publish("schedule")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Schedule</Button>
            <Button variant="success" size="sm" disabled={busy} onClick={() => publish("publish_now")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Publish now</Button>
          </>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">Clips must be approved before they can be published.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CommentsCard({ clip, onChanged }: { clip: ClipDetail; onChanged: () => void }) {
  const { push } = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/clips/${clip.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      if (!r.ok) throw new Error();
      setBody("");
      onChanged();
    } catch {
      push({ title: "Comment failed", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-[var(--color-brand)]" /> Notes</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {clip.comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-[var(--color-base)]/40 p-2 text-xs">
              <div className="flex items-center justify-between"><span className="font-medium">{c.user.name ?? c.user.email}</span><span className="text-[10px] text-[var(--color-muted)]">{formatRelative(c.createdAt)}</span></div>
              <p className="mt-0.5 text-[var(--color-muted)]">{c.body}</p>
            </div>
          ))}
          {clip.comments.length === 0 ? <p className="text-xs text-[var(--color-muted)]">No notes yet.</p> : null}
        </div>
        <Textarea placeholder="Add a note for your collaborator…" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[60px]" />
        <Button size="sm" disabled={busy || !body.trim()} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Add note</Button>
      </CardContent>
    </Card>
  );
}
