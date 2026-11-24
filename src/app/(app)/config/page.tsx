"use client";
import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { Loader2, Save, RotateCcw } from "lucide-react";

type Item = { id: string; key: string; value: any };

const GROUPS: { title: string; description: string; match: (k: string) => boolean }[] = [
  { title: "Clip selection", description: "Duration bounds and how many candidates per asset are promoted.", match: (k) => k.startsWith("clip.") },
  { title: "Scoring weights", description: "Virality model weights. Higher = more influence. Sums internally.", match: (k) => k.startsWith("scoring.") },
  { title: "Publishing", description: "Schedule windows, frequency caps, and minimum spacing.", match: (k) => k.startsWith("publish.") },
  { title: "Branding", description: "Watermark, intro bumpers, and visual treatment.", match: (k) => k.startsWith("branding.") },
  { title: "Rights & policy", description: "Default behavior when rights are unknown.", match: (k) => k.startsWith("rights.") },
  { title: "Platforms", description: "Target platforms for publishing.", match: (k) => k.startsWith("platforms.") },
];

export default function ConfigPage() {
  const { data, loading, refetch } = useFetch<{ items: Item[] }>("/api/config");
  const items = data?.items ?? [];
  const { push } = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function draft(key: string, value: any) {
    setDrafts((d) => ({ ...d, [key]: JSON.stringify(value, null, 2) }));
  }

  async function save(key: string) {
    setBusy(key);
    try {
      const value = JSON.parse(drafts[key]);
      const r = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
      if (!r.ok) throw new Error();
      push({ title: "Saved", description: key, variant: "success" });
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      refetch();
    } catch {
      push({ title: "Invalid JSON", description: "Check the value is valid JSON.", variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-sm text-[var(--color-muted)]">All changes apply to future runs immediately — no redeploy.</p>
      </FadeIn>

      {loading && items.length === 0 ? <div className="shimmer h-32 rounded-xl" /> : null}

      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => {
          const groupItems = items.filter((i) => g.match(i.key));
          if (groupItems.length === 0) return null;
          return (
            <StaggerItem key={g.title}>
              <Card>
                <CardHeader>
                  <CardTitle>{g.title}</CardTitle>
                  <CardDescription>{g.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {groupItems.map((item) => {
                    const draftText = drafts[item.key] ?? JSON.stringify(item.value, null, 2);
                    const dirty = drafts[item.key] !== undefined;
                    return (
                      <div key={item.key} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="font-mono text-[var(--color-text)]">{item.key}</Label>
                          {dirty ? <Button size="sm" variant="ghost" onClick={() => draft(item.key, item.value)}><RotateCcw className="h-3 w-3" /></Button> : null}
                        </div>
                        <Textarea value={draftText} onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))} className="font-mono text-xs" />
                        {dirty ? (
                          <Button size="sm" disabled={busy === item.key} onClick={() => save(item.key)}>
                            {busy === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
