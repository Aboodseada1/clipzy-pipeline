"use client";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";
import { Loader2, RefreshCw, CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";

type Task = {
  id: string;
  clipId: string;
  platform: string;
  status: string;
  scheduledFor: string | null;
  postUrl: string | null;
  publishedAt: string | null;
  attemptCount: number;
  lastError: string | null;
  clip: { id: string; title: string | null; sourceAsset: { source: { label: string } } };
};

const GROUPS = [
  { key: "scheduled", label: "Scheduled", match: (t: Task) => t.status === "scheduled" },
  { key: "queued", label: "Queued", match: (t: Task) => t.status === "queued" || t.status === "publishing" },
  { key: "published", label: "Published", match: (t: Task) => t.status === "published" },
  { key: "failed", label: "Failed", match: (t: Task) => t.status === "failed" },
];

export default function PublishingPage() {
  const { data, loading, refetch } = useFetch<{ clips: any[] }>("/api/clips");
  const { push } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Pull publish tasks out of clips
  const tasks: Task[] = (data?.clips ?? []).flatMap((c: any) =>
    (c.publishTasks ?? []).map((t: any) => ({ ...t, clipId: c.id, clip: { id: c.id, title: c.title, sourceAsset: c.sourceAsset } }))
  );

  async function retry(taskId: string) {
    setBusyId(taskId);
    try {
      const r = await fetch(`/api/clips/${tasks.find((t) => t.id === taskId)?.clipId}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish_now", platform: tasks.find((t) => t.id === taskId)?.platform }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      push({ title: "Retried publish", variant: "success" });
      refetch();
    } catch (e: any) {
      push({ title: "Retry failed", description: e.message, variant: "danger" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Publishing</h1>
        <p className="text-sm text-[var(--color-muted)]">Scheduled and published posts across platforms.</p>
      </FadeIn>

      {loading && tasks.length === 0 ? <div className="shimmer h-40 rounded-xl" /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const group = tasks.filter(g.match);
          return (
            <Card key={g.key}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">{g.key === "published" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <CalendarClock className="h-4 w-4 text-[var(--color-brand)]" />}{g.label}</span>
                  <Badge variant="muted">{group.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Stagger className="flex flex-col gap-2">
                  {group.map((t) => (
                    <StaggerItem key={t.id}>
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-base)]/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/clips/${t.clip.id}`} className="min-w-0 truncate text-sm font-medium hover:underline">{t.clip.title ?? t.clip.id}</Link>
                          <Badge variant="brand" className="capitalize">{t.platform}</Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-[var(--color-muted)]">
                          <span>{t.clip.sourceAsset.source.label}{t.scheduledFor ? ` · ${formatRelative(t.scheduledFor)}` : ""}{t.publishedAt ? ` · published ${formatRelative(t.publishedAt)}` : ""}</span>
                          {t.postUrl ? <a href={t.postUrl} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] hover:underline">view</a> : null}
                        </div>
                        {t.lastError ? <div className="mt-1 text-xs text-rose-300">{t.lastError}</div> : null}
                        {t.status === "failed" ? <Button size="sm" variant="secondary" className="mt-2" disabled={busyId === t.id} onClick={() => retry(t.id)}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Retry</Button> : null}
                      </div>
                    </StaggerItem>
                  ))}
                  {group.length === 0 ? <p className="text-xs text-[var(--color-muted)]">Nothing here.</p> : null}
                </Stagger>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
