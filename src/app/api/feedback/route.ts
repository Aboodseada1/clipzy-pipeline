import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { computeFeedback } from "@/lib/learning";
import { setConfig } from "@/lib/config";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const suggestion = await computeFeedback();
  return NextResponse.json(suggestion);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.apply) {
    const suggestion = await computeFeedback();
    await setConfig("scoring.weights", suggestion.suggestedWeights, session.user.id);
    await audit({ userId: session.user.id, action: "learning.apply_weights", category: "config", targetType: "runtime_config", targetId: "scoring.weights", detail: { from: suggestion.currentWeights, to: suggestion.suggestedWeights, reasoning: suggestion.reasoning } });
    return NextResponse.json({ ok: true, applied: suggestion.suggestedWeights });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
