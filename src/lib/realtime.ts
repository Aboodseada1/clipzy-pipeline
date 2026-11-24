// In-process pub/sub used by the SSE endpoint to fan out pipeline events to
// connected operator dashboards. Replaced by Redis/Postgres LISTEN in a
// multi-instance deployment; the contract (RealtimeMessage) stays the same.
export type RealtimeMessage =
  | { kind: "stage"; clipId: string; stage: string; from?: string; to: string; message?: string; ts: number }
  | { kind: "approval"; clipId: string; decision: string; ts: number }
  | { kind: "publish"; clipId: string; platform: string; status: string; ts: number }
  | { kind: "metric"; key: string; value: number; ts: number }
  | { kind: "source"; sourceId: string; live?: boolean; ts: number }
  | { kind: "flag"; key: string; value: boolean; ts: number }
  | { kind: "heartbeat"; ts: number };

type Listener = (m: RealtimeMessage) => void;

class RealtimeBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(m: RealtimeMessage) {
    for (const l of this.listeners) {
      try {
        l(m);
      } catch {
        // listener failures must not block the bus
      }
    }
  }
}

const globalForBus = globalThis as unknown as { __clipzyBus?: RealtimeBus };
export const bus: RealtimeBus = globalForBus.__clipzyBus ?? new RealtimeBus();
if (process.env.NODE_ENV !== "production") globalForBus.__clipzyBus = bus;
