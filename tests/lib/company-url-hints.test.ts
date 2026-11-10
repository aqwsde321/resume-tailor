import { describe, expect, it } from "vitest";

import { applyUrlCompanyHints } from "@/features/company/model/company-url-hints";
import type { Company } from "@/shared/lib/types";

const baseCompany: Company = {
  companyName: "",
  companyDescription: "광고 플랫폼을 운영합니다.",
  jobTitle: "",
  jobDescription: "DSP 플랫폼을 설계하고 개발합니다.",
  requirements: ["Java 기반 개발 경험"],
  preferredSkills: [],
  techStack: ["Java", "Spring"]
};

describe("applyUrlCompanyHints", () => {
  it("AI 결과에 회사명이나 직무명이 없으면 URL 추출 힌트로 채운다", () => {
    const result = applyUrlCompanyHints(baseCompany, {
      companyName: " 넵튠 ",
      jobTitle: " 서버 개발자 "
    });

    expect(result.companyName).toBe("넵튠");
    expect(result.jobTitle).toBe("서버 개발자");
  });

  it("AI가 반환한 회사명과 직무명을 URL 힌트보다 우선한다", () => {
    const result = applyUrlCompanyHints(
      { ...baseCompany, companyName: "AI 회사명", jobTitle: "AI 직무명" },
      { companyName: "페이지 제목 회사", jobTitle: "페이지 제목 직무" }
    );

    expect(result.companyName).toBe("AI 회사명");
    expect(result.jobTitle).toBe("AI 직무명");
  });
});
