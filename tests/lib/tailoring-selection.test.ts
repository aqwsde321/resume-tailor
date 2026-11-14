import { describe, expect, it } from "vitest";
import { mergeTailoringSelection } from "@/entities/workspace/model/tailoring-selection";
import { ResumeSchema } from "@/shared/lib/schemas";
import type { ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";
describe("selective resume tailoring", () => {
  it("공통 원본으로 제안받아도 선택하지 않은 회사별 수정과 순서를 유지한다", () => {
    const source = ResumeSchema.parse({ summary: "원본", projects: [{ name: "프로젝트 A", description: "원문" }] });
    const current = ResumeSchema.parse({ summary: "내가 수정한 소개", projects: [{ name: "추가 프로젝트", description: "유지" }, { name: "프로젝트 A", description: "수정한 내용" }] });
    const plan = { projects: [{ sourceId: "project-1", description: "맞춤 표현" }], experience: [] } as unknown as ResumeTailoringPlan;
    const result = mergeTailoringSelection(current, source, plan, ["project-1"]);
    expect(result.summary).toBe("내가 수정한 소개");
    expect(result.projects.map((project) => project.name)).toEqual(["추가 프로젝트", "프로젝트 A"]);
    expect(result.projects[1].description).toBe("맞춤 표현");
  });
});
