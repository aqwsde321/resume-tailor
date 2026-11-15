import { describe, expect, it } from "vitest";
import { ResumeSchema } from "@/shared/lib/schemas";
import { createResultDraft, changeDraftSkills, resumeToReviewText } from "@/entities/workspace/model/resume-result-draft";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
import { newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";

describe("정리 결과 편집 초안", () => {
  const resume = ResumeSchema.parse({ name: "예시", techStack: ["Java", "Spring"], projects: [{ name: "서비스", techStack: ["PostgreSQL", "java"] }] });
  it("핵심 기술과 프로젝트 기술을 후보로 보존하고 원본과 별도 문서를 만든다", () => {
    const draft = createResultDraft(resume, "PDF 원문");
    expect(draft.skillCatalog).toEqual(["Java", "Spring", "PostgreSQL"]);
    expect(draft.document.text).toBe(resumeToReviewText(resume));
    expect(draft.sourceText).toBe("PDF 원문");
  });
  it("새 정리 결과는 기술 후보를 모두 보관하고 상단에는 처음 6개만 초기 선택한다", () => {
    const many = ResumeSchema.parse({ techStack: Array.from({ length: 10 }, (_, index) => `기술${index}`) });
    const draft = createResultDraft(many, "원문");
    expect(draft.skillCatalog).toHaveLength(10);
    expect(draft.resume.techStack).toHaveLength(6);
    expect(createResultDraft(many, "원문", [], true).resume.techStack).toHaveLength(10);
  });
  it("선택·순서를 바꿔도 후보와 프로젝트 기술은 유지한다", () => {
    const draft = changeDraftSkills(createResultDraft(resume, "원문"), ["PostgreSQL", "Java"], ["Java", "Spring", "PostgreSQL"]);
    expect(draft.resume.techStack).toEqual(["PostgreSQL", "Java"]);
    expect(draft.resume.projects[0].techStack).toEqual(["PostgreSQL", "java"]);
    expect(draft.skillCatalog).toContain("Spring");
    expect(draft.document.text).toBe(draft.structuredText);
  });
  it("미처리 댓글이 있으면 기술 편집으로 댓글 위치를 덮어쓰지 않는다", () => {
    const draft = createResultDraft(resume, "원문");
    draft.document.annotations.push({ id: crypto.randomUUID(), anchor: { type: "document" }, instruction: "소개 수정", status: "pending", createdAt: new Date().toISOString() });
    expect(() => changeDraftSkills(draft, ["Java"], draft.skillCatalog)).toThrow();
  });
  it("사용자가 후보에서 삭제한 기술은 확정 뒤 다시 나타나지 않는다", () => {
    const original = newTextDocument("resume", "원본", "원문");
    const initial = publishMasterResume(createEmptyWorkspace(), original, resume);
    const draft = changeDraftSkills(createResultDraft(resume, "원문"), ["Java"], ["Java"]);
    const next = publishMasterResume({ ...initial, master: { ...initial.master!, skillCatalog: ["Java", "Spring"], resultDraft: draft } }, original, draft.resume);
    expect(next.master?.skillCatalog).not.toContain("Spring");
  });
  it("확정 시 원본과 미선택 후보를 보존하고 편집 초안만 정리한다", () => {
    const original = newTextDocument("resume", "원본", "PDF 원문");
    const initial = publishMasterResume(createEmptyWorkspace(), original, resume);
    const draft = createResultDraft(resume, original.text);
    draft.resume.techStack = ["Java"];
    const next = publishMasterResume({ ...initial, master: { ...initial.master!, resultDraft: draft } }, original, draft.resume);
    expect(next.master?.document).toEqual(original);
    expect(next.master?.skillCatalog).toContain("Spring");
    expect(next.master?.resultDraft).toBeNull();
  });
});
