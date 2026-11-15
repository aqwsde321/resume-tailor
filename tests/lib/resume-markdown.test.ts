import { expect, it } from "vitest";
import { ResumeSchema } from "@/shared/lib/schemas";
import { createResultDraft, resumeToReviewText } from "@/entities/workspace/model/resume-result-draft";
import { upgradeResultDraftMarkdown } from "@/entities/workspace/model/resume-markdown";

it("정리 결과는 목차 위계와 목록이 명시된 Markdown이다", () => {
  const resume = ResumeSchema.parse({ name: "예시", techStack: ["Java"], projects: [{ name: "주문 서비스", description: "구현", highlights: ["성능 개선"] }] });
  const text = resumeToReviewText(resume);
  expect(text).toContain("# 예시\n");
  expect(text).toContain("## 프로젝트\n\n### 주문 서비스");
  expect(text).toContain("- Java");
  expect(createResultDraft(resume, "원본").document.source.type).toBe("markdown");
});

it("이전 초안을 변환해도 댓글·제안·원본과 미반영 수정이 유지된다", () => {
  const draft = createResultDraft(ResumeSchema.parse({}), "원본");
  draft.document.source.type = "text";
  const old = "예시\n\n프로젝트\n\n주문 서비스\n구현 경험";
  draft.document.text = old;
  draft.structuredText = old.replace("구현 경험", "기존 설명");
  const start = old.indexOf("구현 경험");
  draft.document.annotations = [{ id: crypto.randomUUID(), anchor: { type: "text", start, end: start + 5, quote: "구현 경험" }, instruction: "수정", status: "pending", createdAt: new Date().toISOString() }];
  draft.document.proposal = { sourceText: old, changes: [{ id: "change", start, end: start + 5, before: "구현 경험", after: "수정 경험", reason: "정리", commentIds: [draft.document.annotations[0].id] }], unresolved: [] };
  const next = upgradeResultDraftMarkdown(draft);
  const anchor = next.document.annotations[0].anchor;
  expect(anchor.type).toBe("text");
  if (anchor.type === "text") expect(next.document.text.slice(anchor.start, anchor.end)).toBe("구현 경험");
  const change = next.document.proposal!.changes[0];
  expect(next.document.text.slice(change.start, change.end)).toBe(change.before);
  expect(next.document.text).not.toBe(next.structuredText);
  expect(next.sourceText).toBe("원본");
  expect(next.document.text).toContain("### 주문 서비스");
  expect(upgradeResultDraftMarkdown(next)).toBe(next);
});

it("이전 초안의 문단 시작 삽입 제안도 유효한 빈 범위를 유지한다", () => {
  const draft = createResultDraft(ResumeSchema.parse({}), "원본");
  draft.document.source.type = "text";
  draft.document.text = draft.structuredText = "이름\n\n프로젝트\n\n서비스";
  const start = draft.document.text.indexOf("서비스");
  draft.document.proposal = { sourceText: draft.document.text, changes: [{ id: "insert", start, end: start, before: "", after: "추가", reason: "보완", commentIds: [crypto.randomUUID()] }], unresolved: [] };
  const change = upgradeResultDraftMarkdown(draft).document.proposal!.changes[0];
  expect(change.start).toBe(change.end);
  expect(change.before).toBe("");
});
