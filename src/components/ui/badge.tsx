import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-panel-2)] text-[var(--color-text)] ring-[var(--color-border)]",
        brand: "bg-[var(--color-brand)]/15 text-[var(--color-brand)] ring-[var(--color-brand)]/30",
        success: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
        warn: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
        danger: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
        muted: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
