"use client";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";
import { BarChart3, Eye, Heart, Clock, ExternalLink, RefreshCw, Brain, Loader2, Check } from "lucide-react";
import { formatRelative, pct } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type Post = { id: string; platform: string; postUrl: string; views: number; likes: number; watchThrough: number; clipTitle: string | null; source: string; createdAt: string };
type Analytics = { posts: Post[]; totals: { views: number; likes: number; avgWatchThrough: number; count: number } };
type Suggestion = { currentWeights: Record<string, number>; suggestedWeights: Record<string, number>; reasoning: string[]; samples: number; confidence: number };

export default function AnalyticsPage() {
  const { data, loading, refetch } = useFetch<Analytics>("/api/analytics");
  const posts = data?.posts ?? [];
  const { push } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [applying, setApplying] = useState(false);
  const { data: feedback, refetch: refetchFeedback } = useFetch<Suggestion>("/api/feedback");

  async function sync() {
    setSyncing(true);
    try {
      const r = await fetch("/api/metrics/sync", { method: "POST" });
      const json = await r.json();
      if (!r.ok) throw new Error();
      push({ title: "Metrics synced", description: `${json.updated} posts updated`, variant: "success" });
      refetch();
      refetchFeedback();
    } catch {
      push({ title: "Sync failed", variant: "danger" });
    } finally {
      setSyncing(false);
    }
  }

  async function applyWeights() {
    setApplying(true);
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply: true }) });
      if (!r.ok) throw new Error();
      push({ title: "Scoring weights updated", description: "Future selections will use the new weights.", variant: "success" });
      refetchFeedback();
    } catch {
      push({ title: "Failed to apply weights", variant: "danger" });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--color-muted)]">Published post performance feeds back into clip selection.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={sync} disabled={syncing}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sync metrics</Button>
      </FadeIn>

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Published posts" value={data?.totals.count ?? 0} icon={BarChart3} />
        <Stat label="Total views" value={data?.totals.views ?? 0} icon={Eye} />
        <Stat label="Total likes" value={data?.totals.likes ?? 0} icon={Heart} />
        <Stat label="Avg watch-through" value={(data?.totals.avgWatchThrough ?? 0) * 100} suffix="%" decimals={0} icon={Clock} />
      </Stagger>

      {/* Learning loop */}
      {feedback ? (
        <Card className="glow-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-4 w-4 text-[var(--color-brand)]" /> Scoring feedback loop</CardTitle>
            <CardDescription>
              {feedback.samples} published posts analyzed · confidence <Badge variant={feedback.confidence > 0.5 ? "success" : "warn"} className="ml-1">{pct(feedback.confidence)}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Weight deltas</div>
              {Object.keys(feedback.currentWeights).map((dim) => {
                const cur = feedback.currentWeights[dim];
                const sug = feedback.suggestedWeights[dim];
                const delta = sug - cur;
                return (
                  <div key={dim} className="flex items-center gap-2">
                    <span className="w-24 text-xs capitalize text-[var(--color-muted)]">{dim}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-base)]">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${cur * 100}%` }} transition={{ duration: 0.5 }} className="h-full bg-[var(--color-border)]" />
                      <motion.div initial={{ width: 0 }} animate={{ width: `${sug * 100}%` }} transition={{ duration: 0.6, delay: 0.2 }} className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-2)]" />
                    </div>
                    <span className={`w-16 text-right text-xs tabular-nums ${delta > 0.005 ? "text-emerald-300" : delta < -0.005 ? "text-rose-300" : "text-[var(--color-muted)]"}`}>
                      {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">Reasoning</div>
              <ul className="space-y-1.5">
                {feedback.reasoning.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-muted)]"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-brand)]" />{r}</li>
                ))}
              </ul>
              <Button size="sm" variant="success" onClick={applyWeights} disabled={applying || feedback.samples < 3} className="mt-2">
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Apply suggested weights
              </Button>
              {feedback.samples < 3 ? <p className="text-xs text-[var(--color-muted)]">Need at least 3 published posts with metrics before applying.</p> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Posts</CardTitle></CardHeader>
        <CardContent>
          {loading && posts.length === 0 ? <div className="shimmer h-24 rounded-lg" /> : posts.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">No published posts yet. Performance data will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted)]">
                  <th className="py-2 pr-3">Clip</th><th className="px-3">Platform</th><th className="px-3">Views</th><th className="px-3">Likes</th><th className="px-3">Watch</th><th className="px-3">Posted</th><th></th>
                </tr></thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-panel-2)]/40">
                      <td className="py-2 pr-3"><span className="font-medium">{p.clipTitle ?? "—"}</span><div className="text-xs text-[var(--color-muted)]">{p.source}</div></td>
                      <td className="px-3"><Badge variant="brand" className="capitalize">{p.platform}</Badge></td>
                      <td className="px-3 tabular-nums"><AnimatedNumber value={p.views} /></td>
                      <td className="px-3 tabular-nums"><AnimatedNumber value={p.likes} /></td>
                      <td className="px-3 tabular-nums">{pct(p.watchThrough)}</td>
                      <td className="px-3 text-xs text-[var(--color-muted)]">{formatRelative(p.createdAt)}</td>
                      <td className="px-3"><a href={p.postUrl} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /></a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, suffix, decimals = 0, icon: Icon }: { label: string; value: number; suffix?: string; decimals?: number; icon: any }) {
  return (
    <StaggerItem><Card>
      <div className="flex items-start justify-between">
        <div><div className="text-xs text-[var(--color-muted)]">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight"><AnimatedNumber value={value} decimals={decimals} />{suffix}</div></div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand)]/15 ring-1 ring-inset ring-[var(--color-brand)]/30"><Icon className="h-4 w-4 text-[var(--color-brand)]" /></div>
      </div>
    </Card></StaggerItem>
  );
}
