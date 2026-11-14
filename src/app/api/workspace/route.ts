import { NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { apiErrorResponse, HttpError, parseJsonBody } from "@/server/http";
import { createWorkspaceStore } from "@/server/workspace-store";

export const runtime = "nodejs";
const store = createWorkspaceStore();
export async function GET() {
  try { return NextResponse.json({ ok: true, data: await store.read() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
      throw new HttpError(403, "이 앱에서 작업을 저장해 주세요.");
    }
    const body = await parseJsonBody(request, z.object({ workspace: WorkspaceSchema, expectedRevision: z.number().int().nonnegative() }).strict());
    return NextResponse.json({ ok: true, data: await store.save(body.workspace, body.expectedRevision) });
  } catch (error) { return apiErrorResponse(error); }
}
