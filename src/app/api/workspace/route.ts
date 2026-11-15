import { NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { assertWorkspaceSameOrigin } from "@/server/workspace-origin";
import { createWorkspaceStore } from "@/server/workspace-store";

export const runtime = "nodejs";
const store = createWorkspaceStore();
export async function GET() {
  try { return NextResponse.json({ ok: true, data: await store.read() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    assertWorkspaceSameOrigin(request);
    const body = await parseJsonBody(request, z.object({ workspace: WorkspaceSchema, expectedRevision: z.number().int().nonnegative() }).strict());
    return NextResponse.json({ ok: true, data: await store.save(body.workspace, body.expectedRevision) });
  } catch (error) { return apiErrorResponse(error); }
}
