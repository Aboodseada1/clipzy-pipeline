import { ClipStage } from "@prisma/client";

// The canonical pipeline. Each stage knows its allowed forward transitions and
// whether it blocks on human approval.
export const STAGE_ORDER: ClipStage[] = [
  "DETECTED",
  "SELECTED",
  "RENDERING",
  "RENDERED",
  "COMPLIANCE",
  "COMPLIANCE_FLAG",
  "APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
];

export const TERMINAL_STAGES: ClipStage[] = ["PUBLISHED", "REJECTED", "FAILED", "HELD"];

const TRANSITIONS: Record<ClipStage, ClipStage[]> = {
  DETECTED: ["SELECTED", "HELD", "FAILED"],
  SELECTED: ["RENDERING", "HELD", "FAILED"],
  RENDERING: ["RENDERED", "COMPLIANCE_FLAG", "FAILED", "HELD"],
  RENDERED: ["COMPLIANCE", "FAILED", "HELD"],
  COMPLIANCE: ["APPROVAL", "COMPLIANCE_FLAG", "FAILED"],
  COMPLIANCE_FLAG: ["APPROVAL", "REJECTED", "HELD"],
  APPROVAL: ["APPROVED", "REJECTED", "HELD"],
  APPROVED: ["SCHEDULED"],
  SCHEDULED: ["PUBLISHING", "HELD"],
  PUBLISHING: ["PUBLISHED", "FAILED", "SCHEDULED"],
  PUBLISHED: [],
  REJECTED: ["DETECTED"],
  FAILED: ["DETECTED", "RENDERING"],
  HELD: ["DETECTED", "RENDERING", "APPROVAL"],
};

export function canTransition(from: ClipStage, to: ClipStage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStage(stage: ClipStage): ClipStage | null {
  if (stage === "COMPLIANCE_FLAG") return "APPROVAL";
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export const STAGE_LABEL: Record<ClipStage, string> = {
  DETECTED: "Detected",
  SELECTED: "Selected",
  RENDERING: "Rendering",
  RENDERED: "Rendered",
  COMPLIANCE: "Compliance",
  COMPLIANCE_FLAG: "Flagged",
  APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  REJECTED: "Rejected",
  FAILED: "Failed",
  HELD: "Held",
};

export const STAGE_COLOR: Record<ClipStage, string> = {
  DETECTED: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  SELECTED: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  RENDERING: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  RENDERED: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  COMPLIANCE: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  COMPLIANCE_FLAG: "bg-orange-500/15 text-orange-300 ring-orange-400/30",
  APPROVAL: "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30",
  APPROVED: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  SCHEDULED: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30",
  PUBLISHING: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  PUBLISHED: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  REJECTED: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  FAILED: "bg-red-500/15 text-red-300 ring-red-400/30",
  HELD: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30",
};
