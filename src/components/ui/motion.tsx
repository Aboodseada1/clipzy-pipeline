"use client";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import * as React from "react";

// Centralized motion tokens so all dashboard surfaces animate consistently.
export const easeOut = [0.22, 1, 0.36, 1] as const;
export const spring = { type: "spring" as const, stiffness: 280, damping: 28 };

export function FadeIn(props: HTMLMotionProps<"div">) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.32, ease: easeOut }} {...props} />;
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } } }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = React.useState(value);
  React.useEffect(() => {
    const controls = { current: display };
    const start = performance.now();
    const from = display;
    const to = value;
    const dur = 600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

export { AnimatePresence, motion };
