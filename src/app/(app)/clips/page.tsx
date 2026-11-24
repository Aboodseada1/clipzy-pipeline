"use client";
import { useState } from "react";
import Link from "next/link";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { STAGE_LABEL, STAGE_COLOR } from "@/lib/stages";
import { formatDuration, formatRelative, pct } from "@/lib/utils";
import { Search } from "lucide-react";
import { ClipStage } from "@prisma/client";

const STAGE_FILTERS: { key: ClipStage | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DETECTED", label: "Detected" },
  { key: "SELECTED", label: "Selected" },
  { key: "RENDERING", label: "Rendering" },
  { key: "COMPLIANCE", label: "Compliance" },
  { key: "APPROVAL", label: "Approval" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
  { key: "FAILED", label: "Failed" },
  { key: "HELD", label: "Held" },
];

type Clip = {
  id: string;
  title: string | null;
  durationSec: number;
  viralityScore: number;
  stage: string;
  status: string;
  priority: number;
  updatedAt: string;
  sourceAsset: { source: { label: string } };
};

export default function ClipsPage() {
  const [stage, setStage] = useState<ClipStage | "ALL">("ALL");
  const [q, setQ] = useState("");
  const url = `/api/clips?${stage !== "ALL" ? `stage=${stage}&` : ""}${q ? `q=${encodeURIComponent(q)}` : ""}`;
  const { data, loading } = useFetch<{ clips: Clip[] }>(url);
  const clips = data?.clips ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Clips</h1>
        <p className="text-sm text-[var(--color-muted)]">Every candidate moving through the pipeline.</p>
      </FadeIn>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStage(f.key)}
              className={`rounded-full px-3 py-1 text-xs transition ${stage === f.key ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-panel-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
          <Input className="pl-8" placeholder="Search clips…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading && clips.length === 0 ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="shimmer h-16 rounded-lg" />
          <div className="shimmer h-16 rounded-lg" />
        </div>
      ) : clips.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-[var(--color-muted)]">No clips in this view.</CardContent></Card>
      ) : (
        <Stagger className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {clips.map((c) => (
            <StaggerItem key={c.id}>
              <Link href={`/clips/${c.id}`} className="block">
                <Card className="transition hover:border-[var(--color-brand)]/50 hover:bg-[var(--color-panel-2)]/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.title ?? c.id}</div>
                      <div className="text-xs text-[var(--color-muted)]">{c.sourceAsset.source.label} · {formatDuration(c.durationSec)} · {formatRelative(c.updatedAt)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--color-brand)]">{pct(c.viralityScore)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ring-inset ${STAGE_COLOR[c.stage as keyof typeof STAGE_COLOR] ?? ""}`}>{STAGE_LABEL[c.stage as keyof typeof STAGE_LABEL] ?? c.stage}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
