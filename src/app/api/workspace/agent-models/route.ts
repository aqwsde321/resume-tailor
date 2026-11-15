import { NextResponse } from "next/server";
import { getAgentModelCatalog } from "@/server/agent-model-catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ok: true, data: await getAgentModelCatalog() }, { headers: { "Cache-Control": "no-store" } });
}
