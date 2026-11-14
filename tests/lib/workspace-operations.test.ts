import { describe, expect, it } from "vitest";
import { createCompanyWork, publishMasterResume, refreshCompanySource, sortResumeChronologically } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, type ReviewDocument } from "@/entities/workspace/model/workspace";
import { ResumeSchema } from "@/shared/lib/schemas";
const document: ReviewDocument = { id: "11111111-1111-4111-8111-111111111111", kind: "resume", title: "이력서", source: { type: "text", originalText: "원문", pages: [] }, text: "원문", annotations: [], proposal: null, history: [], updatedAt: new Date().toISOString() };
describe("workspace resume versions", () => {
  it("경력과 프로젝트를 종료일이 아닌 시작일 최신순으로 정리한다", () => {
    const resume = ResumeSchema.parse({ experience: [{ company: "이전 회사", period: "2023.01–2025.01" }, { company: "최근 회사", period: "2025.08–현재" }], projects: [{ name: "먼저 시작", period: "2026.01–2026.11" }, { name: "나중 시작", period: "2026.06–2026.07" }] });
    const sorted = sortResumeChronologically(resume);
    expect(sorted.experience[0].company).toBe("최근 회사");
    expect(sorted.projects[0].name).toBe("나중 시작");
    expect(resume.projects[0].name).toBe("먼저 시작");
  });
  it("공통 원본을 고쳐도 회사별 편집본과 기준 원본은 바뀌지 않는다", () => {
    const first = publishMasterResume(createEmptyWorkspace(), document, ResumeSchema.parse({ summary: "원본" }));
    const work = createCompanyWork(first.master!, { ...document, kind: "job" });
    const next = publishMasterResume({ ...first, works: [{ ...work, resume: ResumeSchema.parse({ summary: "회사별 수정" }) }] }, document, ResumeSchema.parse({ summary: "새 원본" }));
    expect(next.master?.version).toBe(2);
    expect(next.works[0].sourceResume?.summary).toBe("원본");
    expect(next.works[0].resume?.summary).toBe("회사별 수정");
    expect(refreshCompanySource(next.works[0], next.master!).sourceResume?.summary).toBe("새 원본");
    expect(refreshCompanySource(next.works[0], next.master!).resume?.summary).toBe("회사별 수정");
  });
  it("같은 회사 공고도 각각 별도 작업으로 만든다", () => {
    const workspace = publishMasterResume(createEmptyWorkspace(), document, ResumeSchema.parse({}));
    const first = createCompanyWork(workspace.master!, { ...document, kind: "job" });
    const second = createCompanyWork(workspace.master!, { ...document, kind: "job" });
    expect(first.id).not.toBe(second.id);
    expect(first.intro).toBeNull();
    expect(first.resume).toEqual(workspace.master?.resume);
  });
});
