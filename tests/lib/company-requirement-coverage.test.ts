import { describe, expect, it } from "vitest";
import { getCompanyRequirementCoverage } from "@/entities/workspace/model/company-requirement-coverage";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";

const resume = ResumeSchema.parse({ summary: "Java API 운영" });
const master = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "원본"), resume).master!;
const document = newTextDocument("job", "공고", "백엔드 개발자");
const work = {
  ...createCompanyWork(master, document),
  company: CompanySchema.parse({ requirements: ["Java", "API 설계", "Kubernetes", "SQL"], preferredSkills: ["운영"] }),
  companySourceText: document.text,
  knownGaps: ["Kubernetes"],
};

describe("공고 요건 현황", () => {
  it("필수·우대를 구분하고 직접 근거, 관련 경험, 미확인, 경험 없음을 요건별로 집계한다", () => {
    const result = getCompanyRequirementCoverage({
      ...work,
      requirementAssessment: {
        sourceResume: resume,
        matches: [
          { requirementId: "requirement-1", matchType: "direct", evidenceIds: ["summary"], reason: "Java 운영" },
          { requirementId: "requirement-2", matchType: "transferable", evidenceIds: ["summary"], reason: "API 운영" },
          { requirementId: "preferred-1", matchType: "adjacent", evidenceIds: ["summary"], reason: "운영" },
        ],
      },
    });
    expect(result?.groups.map(({ type, counts }) => ({ type, ...counts }))).toEqual([
      { type: "required", direct: 1, related: 1, unchecked: 1, "known-gap": 1 },
      { type: "preferred", direct: 0, related: 1, unchecked: 0, "known-gap": 0 },
    ]);
    expect(result?.groups[0].rows[0].evidence[0]?.text).toBe(resume.summary);
  });

  it("저장된 진단은 편집본과 별개로 다시 열 수 있고 공고 원문이 바뀌면 숨긴다", () => {
    const stored = WorkspaceSchema.parse({ ...createEmptyWorkspace(), works: [{
      ...work, resume: ResumeSchema.parse({ summary: "편집된 소개" }),
      requirementAssessment: { sourceResume: resume, matches: [] },
    }] }).works[0];
    expect(getCompanyRequirementCoverage(stored)?.hasAssessment).toBe(true);
    expect(getCompanyRequirementCoverage({ ...stored, document: { ...document, text: "다른 공고" } })).toBeNull();
  });

  it("첫 진단 전에도 확인한 경험 없음과 미확인 요건을 구분한다", () => {
    expect(getCompanyRequirementCoverage(work)?.groups[0].counts).toEqual({
      direct: 0, related: 0, unchecked: 3, "known-gap": 1,
    });
  });
});
