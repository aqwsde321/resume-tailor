import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { WorkspaceSchema, type Workspace } from "@/entities/workspace/model/workspace";
import { createWorkspaceStore, WORKSPACE_DIRECTORY } from "@/server/workspace-store";
import { readAttachment, saveAttachment } from "@/server/workspace-attachments";
import { apiErrorResponse, HttpError, parseJsonBody } from "@/server/http";
export const runtime = "nodejs";
const store = createWorkspaceStore();
const BundleSchema = z.object({
  format: z.literal("resume-workspace-backup-v1"), workspace: WorkspaceSchema,
  attachments: z.array(z.object({ id: z.string().uuid(), name: z.string().max(300), mime: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]), data: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/).max(28 * 1024 * 1024) }).strict()).max(1000),
}).strict();
function referencedAttachments(workspace: Workspace): string[] {
  const ids = new Set<string>();
  const documents = [workspace.master?.document, ...workspace.works.flatMap((work) => [work.document, work.resumeDocument])];
  for (const document of documents) {
    if (document?.source.attachmentId) ids.add(document.source.attachmentId);
    for (const page of document?.source.pages ?? []) if (page.imageId) ids.add(page.imageId);
  }
  for (const work of workspace.works) for (const artifact of work.artifacts ?? []) ids.add(artifact.id);
  return [...ids];
}
export async function GET() {
  try {
    const workspace = await store.read();
    const attachments = []; let total = 0;
    for (const id of referencedAttachments(workspace)) {
      const attachment = await readAttachment(id); total += attachment.buffer.length;
      if (total > 100 * 1024 * 1024) throw new HttpError(413, "첨부자료가 100MB를 초과했습니다. 로컬 private-data/workspace 폴더를 직접 백업해 주세요.");
      attachments.push({ id, name: attachment.name, mime: attachment.mime, data: attachment.buffer.toString("base64") });
    }
    return NextResponse.json({ format: "resume-workspace-backup-v1", workspace, attachments }, { headers: { "Content-Disposition": "attachment; filename=resume-workspace-backup.json", "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) throw new HttpError(403, "이 앱에서 복원해 주세요.");
    if (Number(request.headers.get("content-length") ?? 0) > 150 * 1024 * 1024) throw new HttpError(413, "백업 파일은 150MB 이하만 가져올 수 있습니다.");
    const bundle = await parseJsonBody(request, BundleSchema);
    const expectedRevision = Number(request.headers.get("if-match"));
    if (!request.headers.has("if-match") || !Number.isInteger(expectedRevision) || expectedRevision < 0) throw new HttpError(400, "현재 작업의 저장 버전이 필요합니다.");
    const attachedIds = new Set(bundle.attachments.map((attachment) => attachment.id));
    if (attachedIds.size !== bundle.attachments.length || referencedAttachments(bundle.workspace).some((id) => !attachedIds.has(id))) throw new HttpError(400, "백업의 원본 파일이나 출력물이 누락됐습니다.");
    const map = new Map<string, string>();
    for (const attachment of bundle.attachments) map.set(attachment.id, await saveAttachment(Buffer.from(attachment.data, "base64"), attachment.name, attachment.mime));
    const imported = WorkspaceSchema.parse(JSON.parse(JSON.stringify(bundle.workspace, (_key, value) => typeof value === "string" ? map.get(value) ?? value : value)));
    const current = await store.read();
    if (current.revision !== expectedRevision) throw new HttpError(409, "다른 창에서 작업이 변경됐습니다. 다시 불러온 뒤 복원해 주세요.");
    const backupDirectory = path.join(WORKSPACE_DIRECTORY, "before-restore");
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(backupDirectory, `${randomUUID()}.json`), JSON.stringify(current, null, 2), { mode: 0o600, flag: "wx" });
    const saved = await store.save({ ...imported, revision: current.revision }, current.revision);
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) { return apiErrorResponse(error); }
}
