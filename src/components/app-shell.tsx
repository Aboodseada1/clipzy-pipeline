"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Inbox,
  Film,
  CalendarClock,
  Radio,
  Settings,
  BarChart3,
  ScrollText,
  PauseCircle,
  PlayCircle,
  LogOut,
  Menu,
  X,
  Activity,
  Zap,
} from "lucide-react";
import { ClipzyMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState as useReactState } from "react";
import { PauseSwitch } from "@/components/pause-switch";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/triggers", label: "Triggers", icon: Zap },
  { href: "/approvals", label: "Approvals", icon: Inbox },
  { href: "/clips", label: "Clips", icon: Film },
  { href: "/publishing", label: "Publishing", icon: CalendarClock },
  { href: "/sources", label: "Sources", icon: Radio },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/config", label: "Config", icon: Settings },
  { href: "/audit", label: "Audit", icon: ScrollText },
];


type SessionLike = { user: { email: string; name?: string | null; role: string } };

export function AppShell({ session, children }: { session: SessionLike; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { connected } = useRealtime();
  const [paused, setPaused] = useReactState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/flags?key=pipeline.paused")
      .then((r) => r.json())
      .then((d) => setPaused(!!d.value))
      .catch(() => setPaused(false));
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]/80 glass transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <ClipzyMark className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">Clipzy</span>
          </Link>
          <button className="lg:hidden text-[var(--color-muted)]" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                  active ? "text-[var(--color-text)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)]"
                )}
              >
                {active ? (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-[var(--color-brand)]/20 to-[var(--color-brand-2)]/10 ring-1 ring-inset ring-[var(--color-brand)]/30"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--color-border)] p-3">
          <PauseSwitch paused={paused} onChange={setPaused} />
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--color-panel-2)] p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-2)] text-xs font-bold uppercase text-white">
              {(session.user.name ?? session.user.email)[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{session.user.name ?? session.user.email}</div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{session.user.role}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {mobileOpen ? <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} /> : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-base)]/70 glass px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--color-brand)]" />
              <span className="text-sm text-[var(--color-muted)]">Pipeline</span>
              <Badge variant={paused ? "warn" : "success"} className="ml-1">
                {paused ? "Paused" : "Live"}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-[var(--color-panel-2)] px-3 py-1 text-xs sm:flex">
              <span className={cn("relative flex h-2 w-2")}>
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-70", connected ? "animate-ping bg-emerald-400" : "bg-rose-400")} />
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", connected ? "bg-emerald-400" : "bg-rose-400")} />
              </span>
              <span className="text-[var(--color-muted)]">{connected ? "Realtime" : "Reconnecting"}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
