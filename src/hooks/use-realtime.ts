"use client";
import { useEffect, useRef, useState } from "react";
import type { RealtimeMessage } from "@/lib/realtime";

// Subscribes to the SSE stream and exposes the latest messages plus a derived
// "live" state for the dashboard. Auto-reconnects on drop.
export function useRealtime(maxMessages = 60) {
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const evtRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let stopped = false;
    const connect = () => {
      const es = new EventSource("/api/stream");
      es.onopen = () => !stopped && setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es.close();
        if (!stopped) setTimeout(connect, 1500);
      };
      es.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data) as RealtimeMessage;
          setMessages((prev) => [...prev.slice(-maxMessages), m]);
        } catch {
          // ignore malformed frames
        }
      };
      evtRef.current = es;
    };
    connect();
    return () => {
      stopped = true;
      evtRef.current?.close();
    };
  }, [maxMessages]);

  return { messages, connected };
}
