import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewDocumentSchema } from "@/entities/workspace/model/workspace";
import { validateDocumentChanges } from "@/entities/workspace/model/document-review";
import { AgentRunOptionsSchema } from "@/shared/lib/schemas";
import { runSkillJson } from "@/server/codex-client";
import { apiErrorResponse, HttpError, parseJsonBody } from "@/server/http";
export const runtime = "nodejs";
const GeneratedSchema = z.object({
  changes: z.array(z.object({ blockId: z.string(), after: z.string(), reason: z.string(), commentIds: z.array(z.string()).min(1) }).strict()).max(200),
  unresolved: z.array(z.object({ commentId: z.string(), message: z.string() }).strict()),
}).strict();
const outputSchema = {
  type: "object", additionalProperties: false, required: ["changes", "unresolved"], properties: {
    changes: { type: "array", items: { type: "object", additionalProperties: false, required: ["blockId", "after", "reason", "commentIds"], properties: {
      blockId: { type: "string" }, after: { type: "string" }, reason: { type: "string" }, commentIds: { type: "array", items: { type: "string" } },
    } } },
    unresolved: { type: "array", items: { type: "object", additionalProperties: false, required: ["commentId", "message"], properties: { commentId: { type: "string" }, message: { type: "string" } } } },
  },
};
export async function POST(request: Request) {
  try {
    const { document, agent } = await parseJsonBody(request, z.object({ document: ReviewDocumentSchema, agent: AgentRunOptionsSchema.optional() }).strict());
    const comments = document.annotations.filter((comment) => comment.status === "pending");
    if (!comments.length) throw new HttpError(400, "수정 댓글을 먼저 작성해 주세요.");
    for (const comment of comments) {
      const anchor = comment.anchor;
      if (anchor.type === "text" && (anchor.end <= anchor.start || document.text.slice(anchor.start, anchor.end) !== anchor.quote)) {
        throw new HttpError(409, "댓글의 선택 영역이 현재 문서와 다릅니다. 다시 선택해 주세요.");
      }
      if (anchor.type === "region" && !document.source.pages.some((page) => page.page === anchor.page)) throw new HttpError(400, "선택한 원본 페이지가 없습니다.");
    }
    const blocks = [...document.text.matchAll(/[^\n]+(?:\n[^\n]+)*/g)].map((match, index) => ({ id: `block-${index}`, start: match.index!, end: match.index! + match[0].length, text: match[0] }));
    blocks.push({ id: "document", start: 0, end: document.text.length, text: document.text });
    const generated = GeneratedSchema.parse(await runSkillJson({ skillName: "review-document", inputText: JSON.stringify({ source: document.source, blocks, comments }), outputSchema, ...agent }));
    const commentIds = new Set(comments.map((comment) => comment.id));
    const changes = generated.changes.map((change) => {
      const block = blocks.find((candidate) => candidate.id === change.blockId);
      if (!block || change.commentIds.some((id) => !commentIds.has(id))) throw new HttpError(502, "수정 제안의 문단이나 댓글 근거가 올바르지 않습니다.");
      return { id: change.blockId, start: block.start, end: block.end, before: block.text, after: change.after, reason: change.reason, commentIds: change.commentIds };
    });
    if (!validateDocumentChanges(document.text, changes) || generated.unresolved.some((item) => !commentIds.has(item.commentId))) throw new HttpError(502, "수정 제안이 서로 겹치거나 댓글 근거가 올바르지 않습니다.");
    const handled = new Set([...changes.flatMap((change) => change.commentIds), ...generated.unresolved.map((item) => item.commentId)]);
    if (comments.some((comment) => !handled.has(comment.id))) throw new HttpError(502, "일부 댓글의 처리 결과가 누락됐습니다. 다시 요청해 주세요.");
    return NextResponse.json({ ok: true, data: { sourceText: document.text, changes, unresolved: generated.unresolved } });
  } catch (error) { return apiErrorResponse(error); }
}
