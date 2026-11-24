"use client";
import { useState, useEffect } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { formatRelative, formatDuration } from "@/lib/utils";
import Link from "next/link";
import { Zap, Play, Loader2, CheckCircle2, XCircle, RefreshCw, Film, TrendingUp, ExternalLink, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TriggerLog = { step: string; message: string; level: string; ts: number; payload?: any };

type TriggerRun = {
  id: string;
  triggeredBy: string;
  status: "running" | "completed" | "failed";
  trendTopic: string | null;
  sourceVideoUrl: string | null;
  sourceVideoTitle: string | null;
  outputClipId: string | null;
  logs: TriggerLog[] | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export default function TriggersPage() {
  const { data, loading, refetch } = useFetch<{ runs: TriggerRun[] }>("/api/triggers", 4000);
  const runs = data?.runs ?? [];
  const activeRun = runs.find((r) => r.status === "running") || runs[0];
  const { push } = useToast();
  const [triggering, setTriggering] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState("manual");

  async function triggerRun() {
    setTriggering(true);
    try {
      const r = await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "manual" }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed to launch trigger");
      push({
        title: "Automation Trigger Started!",
        description: "Pipeline is discovering trends and rendering your reel...",
        variant: "success",
      });
      refetch();
    } catch (e: any) {
      push({ title: "Trigger failed", description: e.message, variant: "danger" });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-[var(--color-brand)]" /> Automation Triggers
          </h1>
          <p className="text-sm text-[var(--color-muted)]">
            Trigger on-demand trends discovery, intelligent 9:16 re-framing, Whisper captions, and local rendering.
          </p>
        </div>
        <Button
          size="lg"
          className="bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-2)] text-white shadow-lg font-semibold hover:opacity-90 transition-all"
          disabled={triggering || runs.some((r) => r.status === "running")}
          onClick={triggerRun}
        >
          {triggering || runs.some((r) => r.status === "running") ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Pipeline Running...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2 fill-current" />
              Run Pipeline Now
            </>
          )}
        </Button>
      </FadeIn>

      {/* Active / Latest Execution Banner */}
      {activeRun ? (
        <Card className={activeRun.status === "running" ? "glow-border" : ""}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[var(--color-brand)]" />
                  {activeRun.trendTopic ? `Trend: "${activeRun.trendTopic}"` : "Executing Trigger..."}
                </CardTitle>
                <Badge variant={activeRun.status === "completed" ? "success" : activeRun.status === "failed" ? "danger" : "warn"}>
                  {activeRun.status === "running" ? "In Progress" : activeRun.status}
                </Badge>
              </div>
              <span className="text-xs text-[var(--color-muted)]">{formatRelative(activeRun.createdAt)}</span>
            </div>
            {activeRun.sourceVideoTitle ? (
              <CardDescription className="text-xs">
                Source Video: <span className="font-medium text-[var(--color-text)]">{activeRun.sourceVideoTitle}</span>
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Steps & Live Logs */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-base)]/60 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                <span>Execution Steps & Logs</span>
                {activeRun.status === "running" ? <span className="animate-pulse text-[var(--color-brand)]">Live</span> : null}
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                <AnimatePresence initial={false}>
                  {(activeRun.logs ?? []).map((log, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2.5 text-xs border-l-2 border-[var(--color-brand)]/40 pl-3 py-1"
                    >
                      <span className="font-mono text-[10px] text-[var(--color-muted)] shrink-0">
                        {new Date(log.ts).toLocaleTimeString()}
                      </span>
                      <span className="font-semibold capitalize text-[var(--color-brand)] shrink-0">{log.step}:</span>
                      <span className="text-[var(--color-text)]">{log.message}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {(activeRun.logs ?? []).length === 0 ? <p className="text-xs text-[var(--color-muted)]">Initializing trigger logs...</p> : null}
              </div>
            </div>

            {/* Generated Clip Preview if Completed */}
            {activeRun.outputClipId ? (
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-panel-2)] p-4 border border-[var(--color-brand)]/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/20 text-[var(--color-brand)]">
                    <Film className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">Vertical Reel Rendered & Ready</div>
                    <div className="text-xs text-[var(--color-muted)]">Saved locally at /storage/renders/{activeRun.outputClipId}.mp4</div>
                  </div>
                </div>
                <Link href={`/clips/${activeRun.outputClipId}`}>
                  <Button size="sm" variant="success" className="gap-1.5">
                    <Play className="h-4 w-4" /> Watch Reel Preview
                  </Button>
                </Link>
              </div>
            ) : null}

            {activeRun.error ? (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                <span className="font-semibold">Execution Error:</span> {activeRun.error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trigger History */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-brand)]" /> Execution History
              </span>
              <Button size="icon" variant="ghost" onClick={refetch}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && runs.length === 0 ? (
              <div className="space-y-2">
                <div className="shimmer h-14 rounded-lg" />
                <div className="shimmer h-14 rounded-lg" />
              </div>
            ) : runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-muted)]">No trigger runs executed yet. Click "Run Pipeline Now" to start.</p>
            ) : (
              <Stagger className="space-y-2">
                {runs.map((r) => (
                  <StaggerItem key={r.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-base)]/40 p-3.5 transition hover:bg-[var(--color-panel-2)]/60">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{r.trendTopic ?? "On-demand Pipeline Run"}</span>
                          <Badge variant={r.status === "completed" ? "success" : r.status === "failed" ? "danger" : "warn"}>
                            {r.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-[var(--color-muted)] mt-0.5">
                          {r.sourceVideoTitle ?? "Video Search"} · Triggered {formatRelative(r.createdAt)} ({r.triggeredBy})
                        </div>
                      </div>
                      {r.outputClipId ? (
                        <Link href={`/clips/${r.outputClipId}`}>
                          <Button size="sm" variant="ghost" className="text-xs text-[var(--color-brand)] hover:underline">
                            View Clip <ExternalLink className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </CardContent>
        </Card>

        {/* Schedule & Trigger Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[var(--color-brand)]" /> Schedule & Triggers
            </CardTitle>
            <CardDescription>Configure auto-trigger frequency for trends discovery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">Trigger Mode</label>
              <div className="flex flex-col gap-2">
                {[
                  { key: "manual", label: "Manual 1-Click Trigger", desc: "Run anytime on demand via dashboard button" },
                  { key: "6h", label: "Every 6 Hours", desc: "Scan trends and auto-render 4 reels daily" },
                  { key: "12h", label: "Every 12 Hours", desc: "Scan trends and auto-render 2 reels daily" },
                  { key: "24h", label: "Every 24 Hours (Daily)", desc: "Daily prime time trend discovery" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setScheduleInterval(opt.key)}
                    className={`flex flex-col items-start rounded-xl p-3 text-left transition border ${
                      scheduleInterval === opt.key
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 ring-1 ring-[var(--color-brand)]/30"
                        : "border-[var(--color-border)] bg-[var(--color-base)]/40 hover:bg-[var(--color-panel-2)]"
                    }`}
                  >
                    <span className="text-xs font-semibold text-[var(--color-text)]">{opt.label}</span>
                    <span className="text-[11px] text-[var(--color-muted)]">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--color-panel-2)] p-3 text-xs text-[var(--color-muted)]">
              <span className="font-semibold text-[var(--color-text)]">Publishing Integration:</span>
              <p className="mt-1">
                Auto-publishing to YouTube Shorts & TikTok is currently paused. Clips generated by triggers are rendered, captioned, and saved locally for your review.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
