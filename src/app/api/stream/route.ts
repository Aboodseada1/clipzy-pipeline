import { NextRequest } from "next/server";
import { bus } from "@/lib/realtime";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      // initial hello + heartbeat loop
      send({ kind: "heartbeat", ts: Date.now() });

      const unsub = bus.subscribe((m) => send(m));
      const heartbeat = setInterval(() => send({ kind: "heartbeat", ts: Date.now() }), 15000);

      const close = () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      _req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
