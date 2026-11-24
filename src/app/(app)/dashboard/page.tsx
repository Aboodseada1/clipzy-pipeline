"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem, AnimatedNumber } from "@/components/ui/motion";
import { useRealtime } from "@/hooks/use-realtime";
import { STAGE_LABEL, STAGE_COLOR } from "@/lib/stages";
import { formatRelative, formatDuration, pct } from "@/lib/utils";
import { Inbox, Film, Radio, TrendingUp, Activity, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Dashboard = {
  paused: boolean;
  counts: { clips: number; sources: number; approvalQueue: number; flagged: number; failed: number; published: number };
  health: { score: number; throughput1h: number; avgVirality: number; rendering: number; flagged: number; failed: number; approval: number };
  stages: Record<string, number>;
  topClips: { id: string; title: string | null; stage: string; virality: number; source: string; duration: number }[];
  sources: { id: string; label: string; platform: string; rightsStatus: string; live: boolean; assets: number }[];
  publishing: { queued: number; scheduled: number; published: number; failed: number };
  events: { id: string; clipId: string | null; sourceId: string | null; stage: string | null; level: string; eventType: string; message: string; createdAt: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const { messages } = useRealtime();
  const lastEventTs = messages.length > 0 ? messages[messages.length - 1].ts : 0;

  useEffect(() => {
    let stopped = false;
    const load = () =>
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then((d) => !stopped && setData(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [lastEventTs]);

  const stageEntries = data ? Object.entries(data.stages).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-[var(--color-muted)]">Live state of the autonomous content pipeline.</p>
        </div>
        {data?.paused ? <Badge variant="warn">Pipeline paused — operators retain control</Badge> : null}
      </FadeIn>

      {/* KPI cards */}
      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Clips tracked" value={data?.counts.clips ?? 0} icon={Film} accent="brand" />
        <KpiCard label="Awaiting approval" value={data?.counts.approvalQueue ?? 0} icon={Inbox} accent="warn" link="/approvals" />
        <KpiCard label="Flagged" value={data?.counts.flagged ?? 0} icon={AlertTriangle} accent="danger" />
        <KpiCard label="Published" value={data?.counts.published ?? 0} icon={CheckCircle2} accent="success" link="/publishing" />
        <KpiCard label="Active sources" value={data?.counts.sources ?? 0} icon={Radio} accent="brand" link="/sources" />
        <KpiCard label="Throughput 1h" value={data?.health.throughput1h ?? 0} icon={Activity} accent="brand" suffix="transitions" />
      </Stagger>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Pipeline health + queue */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-[var(--color-brand)]" /> Pipeline health</CardTitle>
              <Badge variant={data && data.health.score > 80 ? "success" : "warn"}>{data ? `${Math.round(data.health.score)}% healthy` : "—"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Avg virality" value={data ? <AnimatedNumber value={data.health.avgVirality * 100} decimals={0} /> : "—"} suffix="%" />
              <Metric label="Rendering" value={data?.health.rendering ?? "—"} />
              <Metric label="In approval" value={data?.health.approval ?? "—"} />
            </div>
            <div className="mt-5">
              <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">Stage distribution</div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-base)]/60">
                <AnimatePresence>
                  {stageEntries.length === 0 ? <div className="shimmer h-full w-full" /> : null}
                </AnimatePresence>
                {stageEntries.map(([stage, count]) => {
                  const total = stageEntries.reduce((s, [, c]) => s + c, 0) || 1;
                  const w = (count / total) * 100;
                  return (
                    <motion.div
                      key={stage}
                      initial={{ width: 0 }}
                      animate={{ width: `${w}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className={STAGE_COLOR[stage as keyof typeof STAGE_COLOR]?.split(" ")[0] ?? "bg-slate-500/40"}
                      title={`${STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {stageEntries.map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between rounded-lg bg-[var(--color-panel-2)] px-2.5 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${STAGE_COLOR[stage as keyof typeof STAGE_COLOR] ?? ""}`}>
                      {STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage}
                    </span>
                    <span className="text-sm font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live event stream */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-[var(--color-brand)]" /> Event stream</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {(data?.events ?? []).map((e) => (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-base)]/40 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${levelColor(e.level)}`}>{e.eventType}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">{formatRelative(e.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text)]">{e.message}</p>
                    {e.clipId ? <Link href={`/clips/${e.clipId}`} className="text-[10px] text-[var(--color-brand)] hover:underline">view clip</Link> : null}
                  </motion.div>
                ))}
              </AnimatePresence>
              {(data?.events ?? []).length === 0 ? <div className="shimmer h-20 w-full rounded-lg" /> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top clips + sources */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[var(--color-brand)]" /> Top candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <Stagger className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(data?.topClips ?? []).map((c) => (
                <StaggerItem key={c.id}>
                  <Link href={`/clips/${c.id}`} className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-base)]/40 p-3 transition hover:border-[var(--color-brand)]/50 hover:bg-[var(--color-panel-2)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.title ?? c.id}</div>
                        <div className="text-xs text-[var(--color-muted)]">{c.source} · {formatDuration(c.duration)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${STAGE_COLOR[c.stage as keyof typeof STAGE_COLOR] ?? ""}`}>{STAGE_LABEL[c.stage as keyof typeof STAGE_LABEL] ?? c.stage}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-base)]">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${c.virality * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="h-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-2)]" />
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-brand)]">{pct(c.virality)}</span>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
              {(data?.topClips ?? []).length === 0 ? <div className="shimmer h-16 w-full rounded-xl md:col-span-2" /> : null}
            </Stagger>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4 text-[var(--color-brand)]" /> Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {(data?.sources ?? []).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-base)]/40 p-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-[var(--color-muted)]">{s.platform} · {s.assets} assets</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.live ? <Badge variant="success">live</Badge> : <Badge variant="muted">offline</Badge>}
                    <Badge variant={rightsVariant(s.rightsStatus)}>{s.rightsStatus}</Badge>
                  </div>
                </div>
              ))}
              {(data?.sources ?? []).length === 0 ? <div className="shimmer h-16 w-full rounded-lg" /> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, suffix, link }: { label: string; value: number | string; icon: any; accent: "brand" | "warn" | "danger" | "success"; suffix?: string; link?: string }) {
  const ring = { brand: "ring-[var(--color-brand)]/30", warn: "ring-amber-400/30", danger: "ring-rose-400/30", success: "ring-emerald-400/30" }[accent];
  const text = { brand: "text-[var(--color-brand)]", warn: "text-amber-300", danger: "text-rose-300", success: "text-emerald-300" }[accent];
  const content = (
    <StaggerItem className="h-full">
      <Card className={`h-full ${link ? "cursor-pointer transition hover:border-[var(--color-brand)]/50" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-[var(--color-muted)]">{label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
            </div>
            {suffix ? <div className="text-[10px] text-[var(--color-muted)]">{suffix}</div> : null}
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-panel-2)] ring-1 ring-inset ${ring}`}>
            <Icon className={`h-4 w-4 ${text}`} />
          </div>
        </div>
      </Card>
    </StaggerItem>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}

function Metric({ label, value, suffix }: { label: string; value: React.ReactNode; suffix?: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-panel-2)] p-3">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight">{value}{suffix ? <span className="ml-1 text-xs text-[var(--color-muted)]">{suffix}</span> : null}</div>
    </div>
  );
}

function levelColor(level: string) {
  if (level === "error") return "text-rose-300";
  if (level === "warn") return "text-amber-300";
  return "text-[var(--color-brand)]";
}

function rightsVariant(r: string): "success" | "warn" | "danger" | "muted" {
  if (r === "CLEARED") return "success";
  if (r === "PENDING_REVIEW") return "warn";
  if (r === "DENIED") return "danger";
  return "muted";
}
