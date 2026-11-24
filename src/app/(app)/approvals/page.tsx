"use client";
import { useFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/ui/toaster";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion";
import { CheckCircle2, XCircle, Pause, Loader2, Inbox } from "lucide-react";
import { useState } from "react";
import { formatRelative, formatDuration, pct } from "@/lib/utils";

type Clip = {
  id: string;
  title: string | null;
  durationSec: number;
  viralityScore: number;
  stage: string;
  approval: { decision: string; reason: string | null } | null;
  compliance: { status: string; captionAccuracy: number | null; policyFlags: string[] } | null;
  sourceAsset: { source: { label: string; platform: string } };
};

export default function ApprovalsPage() {
  const { data, loading, refetch } = useFetch<{ clips: Clip[] }>("/api/clips?stage=APPROVAL");
  const clips = data?.clips ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <FadeIn className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approval inbox</h1>
          <p className="text-sm text-[var(--color-muted)]">Nothing publishes without a human decision here.</p>
        </div>
        <Badge variant={clips.length > 0 ? "warn" : "success"}>{clips.length} waiting</Badge>
      </FadeIn>

      {loading && clips.length === 0 ? (
        <div className="grid gap-3">
          <div className="shimmer h-24 rounded-xl" />
          <div className="shimmer h-24 rounded-xl" />
        </div>
      ) : clips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-10 w-10 text-[var(--color-muted)]" />
            <p className="mt-3 text-sm text-[var(--color-muted)]">Inbox zero. New clips will appear here automatically.</p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {clips.map((c) => (
            <StaggerItem key={c.id} className="h-full">
              <ApprovalCard clip={c} onDecided={refetch} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function ApprovalCard({ clip, onDecided }: { clip: Clip; onDecided: () => void }) {
  const { push } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "APPROVED" | "REJECTED" | "HELD">(null);

  async function decide(decision: "APPROVED" | "REJECTED" | "HELD") {
    setBusy(decision);
    try {
      const r = await fetch(`/api/clips/${clip.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      if (!r.ok) throw new Error();
      push({ title: `Clip ${decision.toLowerCase()}`, variant: decision === "APPROVED" ? "success" : decision === "REJECTED" ? "danger" : "warn" });
      onDecided();
    } catch {
      push({ title: "Failed to record decision", variant: "danger" });
    } finally {
      setBusy(null);
    }
  }

  const compliance = clip.compliance;
  const flags = compliance?.policyFlags ?? [];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <Link href={`/clips/${clip.id}`} className="hover:underline">{clip.title ?? clip.id}</Link>
            </CardTitle>
            <div className="text-xs text-[var(--color-muted)]">
              {clip.sourceAsset.source.label} · {clip.sourceAsset.source.platform} · {formatDuration(clip.durationSec)} · {formatRelative(0)}
            </div>
          </div>
          <Badge variant="brand">{pct(clip.viralityScore)} virality</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {compliance ? (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={compliance.status === "pass" ? "success" : compliance.status === "flag" ? "warn" : "danger"}>Compliance: {compliance.status}</Badge>
            {compliance.captionAccuracy != null ? <Badge variant="muted">Caption {pct(compliance.captionAccuracy)}</Badge> : null}
            {flags.map((f) => <Badge key={f} variant="warn">{f}</Badge>)}
          </div>
        ) : null}

        <Textarea placeholder="Optional note / reason (visible in audit log)" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[60px]" />

        <div className="mt-auto flex items-center gap-2">
          <Button variant="success" size="sm" onClick={() => decide("APPROVED")} disabled={busy !== null}>
            {busy === "APPROVED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve
          </Button>
          <Button variant="danger" size="sm" onClick={() => decide("REJECTED")} disabled={busy !== null}>
            {busy === "REJECTED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </Button>
          <Button variant="secondary" size="sm" onClick={() => decide("HELD")} disabled={busy !== null}>
            {busy === "HELD" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Hold
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
