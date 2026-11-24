"use client";
import { useEffect, useRef, useState } from "react";
import { useRealtime } from "@/hooks/use-realtime";

// Generic SWR-ish hook: fetches a JSON endpoint, refreshes on an interval and
// whenever a realtime message arrives, and exposes a manual refetch.
export function useFetch<T>(url: string | null, intervalMs = 8000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { messages } = useRealtime();
  const lastTs = messages.length > 0 ? messages[messages.length - 1].ts : 0;
  const stopRef = useRef(false);

  useEffect(() => {
    if (!url) return;
    stopRef.current = false;
    setLoading(true);
    const load = async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!stopRef.current) {
          setData(json);
          setError(null);
        }
      } catch (e: any) {
        if (!stopRef.current) setError(e.message ?? "error");
      } finally {
        if (!stopRef.current) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      stopRef.current = true;
      clearInterval(id);
    };
  }, [url, intervalMs, lastTs]);

  const refetch = async () => {
    if (!url) return;
    try {
      const r = await fetch(url);
      const json = await r.json();
      setData(json);
    } catch {
      // ignore
    }
  };

  return { data, error, loading, refetch };
}
