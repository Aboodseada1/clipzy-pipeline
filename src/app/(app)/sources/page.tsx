"use client";
import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { formatRelative } from "@/lib/utils";
import { Plus, Radio, Loader2, Search as SearchIcon, Trash2 } from "lucide-react";

type Source = {
  id: string;
  label: string;
  kind: string;
  platform: string;
  externalId: string | null;
  rightsStatus: string;
  attributionText: string | null;
  requiresReview: boolean;
  watchlist: boolean;
  assets: { id: string }[];
  updatedAt: string;
};

export default function SourcesPage() {
  const { data, loading, refetch } = useFetch<{ sources: Source[] }>("/api/sources");
  const sources = data?.sources ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="text-sm text-[var(--color-muted)]">Watchlist of streamers, channels, and trend feeds.</p>
        </div>
        <AddSourceDialog onAdded={refetch} />
      </FadeIn>

      {loading && sources.length === 0 ? <div className="shimmer h-24 rounded-xl" /> : null}

      <Stagger className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((s) => (
          <StaggerItem key={s.id} className="h-full">
            <SourceCard source={s} onChanged={refetch} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function rightsVariant(r: string): "success" | "warn" | "danger" | "muted" {
  if (r === "CLEARED") return "success";
  if (r === "PENDING_REVIEW") return "warn";
  if (r === "DENIED") return "danger";
  return "muted";
}

function SourceCard({ source, onChanged }: { source: Source; onChanged: () => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function action(act: string, extra?: any) {
    setBusy(act);
    try {
      const r = await fetch(`/api/sources/${source.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: act, ...extra }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      push({ title: act === "delete" ? "Source removed" : `${act} done`, variant: act === "delete" ? "warn" : "success" });
      onChanged();
    } catch (e: any) {
      push({ title: `${act} failed`, description: e.message, variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 truncate"><Radio className="h-4 w-4 text-[var(--color-brand)]" />{source.label}</CardTitle>
            <div className="text-xs text-[var(--color-muted)]">{source.platform}{source.externalId ? ` · ${source.externalId}` : ""} · {source.assets.length} assets · {formatRelative(source.updatedAt)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="muted">{source.kind}</Badge>
          <Badge variant={rightsVariant(source.rightsStatus)}>{source.rightsStatus}</Badge>
          {source.watchlist ? <Badge variant="brand">watching</Badge> : null}
          {source.requiresReview ? <Badge variant="warn">requires review</Badge> : null}
        </div>
        {source.attributionText ? <p className="text-xs text-[var(--color-muted)]">{source.attributionText}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => action("discover")}>{busy === "discover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}Discover</Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => action("delete")}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddSourceDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", platform: "twitch", externalId: "", rightsStatus: "UNKNOWN", attributionText: "", requiresReview: true });
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error();
      push({ title: "Source added", variant: "success" });
      setOpen(false);
      onAdded();
    } catch {
      push({ title: "Failed to add source", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" />Add source</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a source</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-col gap-1"><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><Label>Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
            <div className="flex flex-col gap-1"><Label>External ID</Label><Input value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><Label>Rights status</Label>
              <select className="flex h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-base)]/60 px-2 text-sm" value={form.rightsStatus} onChange={(e) => setForm({ ...form, rightsStatus: e.target.value })}>
                {["UNKNOWN", "PENDING_REVIEW", "CLEARED", "DENIED"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1"><Label>Attribution</Label><Input value={form.attributionText} onChange={(e) => setForm({ ...form, attributionText: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresReview} onChange={(e) => setForm({ ...form, requiresReview: e.target.checked })} /> Requires human review before publish</label>
          <Button disabled={busy || !form.label} onClick={submit}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
