import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const runs = await prisma.triggerRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const triggeredBy = body.triggeredBy || "manual";

  // Create TriggerRun entry
  const run = await prisma.triggerRun.create({
    data: {
      triggeredBy,
      status: "running",
      logs: [
        {
          step: "init",
          message: `Trigger run created by ${session.user.email ?? "operator"}`,
          level: "info",
          ts: Date.now(),
        },
      ],
    },
  });

  // Spawn Python automation script asynchronously
  const child = spawn("python3", ["scripts/run_automation_pipeline.py", run.id], {
    cwd: "/var/www/clipzy.aaseada.com",
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return NextResponse.json({ ok: true, run });
}
