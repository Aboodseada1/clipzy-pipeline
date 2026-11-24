"use client";
import { useState } from "react";
import { PauseCircle, PlayCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export function PauseSwitch({ paused, onChange }: { paused: boolean | null; onChange: (v: boolean) => void }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !paused;
    try {
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "pipeline.paused", value: next }),
      });
      if (!res.ok) throw new Error("Failed");
      onChange(next);
      push({ title: next ? "Pipeline paused" : "Pipeline resumed", variant: next ? "warn" : "success" });
    } catch {
      push({ title: "Failed to toggle pause", variant: "danger" });
    } finally {
      setBusy(false);
    }
  }

  const isPaused = paused === true;

  return (
    <button
      onClick={toggle}
      disabled={busy || paused === null}
      className={cn(
        "group relative flex w-full items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 text-sm font-medium transition-all",
        isPaused
          ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
      )}
    >
      <motion.div layout className="flex items-center gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isPaused ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
        {isPaused ? "Resume pipeline" : "Pause pipeline"}
      </motion.div>
    </button>
  );
}
