import { NextRequest, NextResponse } from "next/server";
import { listConfig, setConfig } from "@/lib/config";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await listConfig();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.key || body.value === undefined) return NextResponse.json({ error: "key/value required" }, { status: 400 });
  const rec = await setConfig(body.key, body.value, session.user.id);
  return NextResponse.json({ ok: true, item: rec });
}
