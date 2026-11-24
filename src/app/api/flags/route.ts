import { NextRequest, NextResponse } from "next/server";
import { getFlag, setFlag } from "@/lib/config";
import { auth } from "@/auth";
import { emitEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  return NextResponse.json({ key, value: await getFlag(key) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const rec = await setFlag(body.key, !!body.value, session.user.id, body.note);
  await emitEvent({ userId: session.user.id, eventType: "system.flag", message: `Flag ${body.key}=${body.value}`, payload: { key: body.key, value: !!body.value } });
  return NextResponse.json({ ok: true, flag: rec });
}
