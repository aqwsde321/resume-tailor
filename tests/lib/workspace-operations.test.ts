import { describe, expect, it } from "vitest";
import { createCompanyWork, publishMasterResume, refreshCompanySource } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, type ReviewDocument } from "@/entities/workspace/model/workspace";
import { ResumeSchema } from "@/shared/lib/schemas";
const document: ReviewDocument = { id: "11111111-1111-4111-8111-111111111111", kind: "resume", title: "이력서", source: { type: "text", originalText: "원문", pages: [] }, text: "원문", annotations: [], proposal: null, history: [], updatedAt: new Date().toISOString() };
describe("workspace resume versions", () => {
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
