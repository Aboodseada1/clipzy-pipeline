"use client";
import { useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { formatRelative } from "@/lib/utils";
import { ScrollText } from "lucide-react";

const CATEGORIES = ["all", "auth", "approval", "config", "publish", "system", "manual_override"];

export default function AuditPage() {
  const [cat, setCat] = useState("all");
  const url = cat === "all" ? "/api/audit" : `/api/audit?category=${cat}`;
  const { data, loading } = useFetch<{ logs: any[] }>(url);
  const logs = data?.logs ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-[var(--color-muted)]">Every operator action, signed into history.</p>
      </FadeIn>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs capitalize transition ${cat === c ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-panel-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}>{c}</button>
        ))}
      </div>

      {loading && logs.length === 0 ? <div className="shimmer h-32 rounded-xl" /> : (
        <Card>
          <CardContent>
            <Stagger className="flex flex-col gap-1.5">
              {logs.map((l) => (
                <StaggerItem key={l.id.toString()}>
                  <div className="flex items-start gap-3 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-base)]/40 p-3">
                    <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted" className="font-mono text-[10px]">{l.action}</Badge>
                        <Badge variant="brand" className="text-[10px]">{l.category}</Badge>
                        {l.user ? <span className="text-xs text-[var(--color-muted)]">{l.user.email}</span> : null}
                        <span className="ml-auto text-[10px] text-[var(--color-muted)]">{formatRelative(l.createdAt)}</span>
                      </div>
                      {l.detail ? <pre className="mt-1 overflow-x-auto rounded bg-[var(--color-panel-2)] p-2 text-[10px] text-[var(--color-muted)]">{JSON.stringify(l.detail, null, 2)}</pre> : null}
                    </div>
                  </div>
                </StaggerItem>
              ))}
              {logs.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-muted)]">No audit entries in this category.</p> : null}
            </Stagger>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
