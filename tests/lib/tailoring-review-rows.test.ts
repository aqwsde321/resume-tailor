import { describe, expect, it } from "vitest";
import { buildTailoringReviewRows, mergeTailoringSelection } from "@/entities/workspace/model/tailoring-selection";
import { ResumeSchema } from "@/shared/lib/schemas";
import type { ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";

const plan: ResumeTailoringPlan = {
  headline: { text: "백엔드 개발자", evidenceIds: ["headline"] },
  summary: { text: "맞춤 소개", evidenceIds: ["summary"] },
  experience: [],
  projects: [{ sourceId: "project-1", description: "맞춤 프로젝트", evidenceIds: ["project-1"] }],
  skillIds: [], highlightIds: [], strengthIds: [], requirementMatches: [],
};

describe("회사별 이력서 변경 비교", () => {
  it("공통 원본 대신 실제 편집본을 반영 전으로 표시하고 순서가 달라도 같은 항목을 비교한다", () => {
    const source = ResumeSchema.parse({ summary: "공통 소개", projects: [{ name: "A", description: "공통 내용" }] });
    const current = ResumeSchema.parse({ summary: "직접 고친 소개", projects: [{ name: "B", description: "유지" }, { name: "A", description: "직접 고친 내용" }] });
    const rows = buildTailoringReviewRows(current, source, plan);
    expect(rows.find((row) => row.id === "summary")?.before).toBe("직접 고친 소개");
    expect(rows.find((row) => row.id === "project-1")).toMatchObject({ before: "직접 고친 내용", after: "맞춤 프로젝트", changed: true, addsItem: false });
    const applied = mergeTailoringSelection(current, source, plan, ["project-1"]);
    expect(applied.projects.map((item) => item.name)).toEqual(["B", "A"]);
    expect(applied.summary).toBe("직접 고친 소개");
  });

  it("현재 내용과 같은 제안을 변경 없음으로 구분하고 아무것도 선택하지 않으면 유지한다", () => {
    const current = ResumeSchema.parse({ headline: "백엔드 개발자", summary: "맞춤 소개", projects: [{ name: "A", description: "맞춤 프로젝트" }] });
    expect(buildTailoringReviewRows(current, current, plan).every((row) => !row.changed)).toBe(true);
    expect(mergeTailoringSelection(current, current, plan, [])).toEqual(current);
  });

  it("편집본에 없는 원본 항목은 빈 반영 전과 추가 예정 표시로 구분한다", () => {
    const source = ResumeSchema.parse({ projects: [{ name: "A", description: "공통 내용" }] });
    const current = ResumeSchema.parse({ projects: [{ name: "B", description: "유지" }] });
    expect(buildTailoringReviewRows(current, source, plan).find((row) => row.id === "project-1"))
      .toMatchObject({ before: "", after: "맞춤 프로젝트", addsItem: true, changed: true });
  });

  it("같은 식별 정보의 항목이 여러 개면 임의 비교하거나 선택하게 하지 않는다", () => {
    const source = ResumeSchema.parse({ projects: [{ name: "A", description: "공통 내용" }] });
    const current = ResumeSchema.parse({ projects: [{ name: "A", description: "첫째" }, { name: "A", description: "둘째" }] });
    const row = buildTailoringReviewRows(current, source, plan).find((item) => item.id === "project-1");
    expect(row?.unavailableReason).toContain("여러 개");
    expect(row?.before).toBe("");
  });
});
