import { describe, expect, it } from "vitest";

import { buildIntroGuidance, buildIntroSkillInput, buildMatchInsights } from "@/lib/intro-insights";

import {
  backendCompanyFixture,
  backendResumeFixture,
  frontendCompanyFixture,
  frontendResumeFixture
} from "../fixtures/intro-cases";

describe("intro insight helpers", () => {
  it("겹치는 기술과 요구사항 근거를 구조화한다", () => {
    const guidance = buildIntroGuidance(frontendResumeFixture, frontendCompanyFixture);
    const reactRequirement = guidance.requirementMatches.find(
      (item) => item.target === "React 기반 서비스 개발 경험"
    );

    expect(guidance.roleOverlap).toContain("frontend");
    expect(guidance.matchedSkills).toEqual(["React", "TypeScript", "Next.js"]);
    expect(guidance.requirementMatches.map((item) => item.target)).toContain("React 기반 서비스 개발 경험");
    expect(reactRequirement?.evidence.some((item) => item.includes("경력") || item.includes("프로젝트"))).toBe(
      true
    );
    expect(guidance.preferredMatches.map((item) => item.target)).toContain("Next.js 경험");
    expect(guidance.gapCandidates).toContain("GraphQL");
  });

  it("부족한 요구사항을 gap 후보로 남긴다", () => {
    const guidance = buildIntroGuidance(backendResumeFixture, backendCompanyFixture);

    expect(guidance.matchedSkills).toEqual(["Node.js", "TypeScript"]);
    expect(guidance.requirementMatches.map((item) => item.target)).toContain("Node.js 기반 API 개발 경험");
    expect(guidance.gapCandidates).toEqual(
      expect.arrayContaining(["AWS", "Kafka", "AWS 운영 경험"])
    );
  });

  it("스킬 입력 텍스트에 분석 힌트와 출력 제약을 포함한다", () => {
    const input = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture);

    expect(input).toContain("[분석 힌트]");
    expect(input).toContain("\"matchedSkills\": [");
    expect(input).toContain("React");
    expect(input).toContain("[출력 제약]");
  });

  it("결과 화면 fallback용 매칭 인사이트를 생성한다", () => {
    const insights = buildMatchInsights(frontendResumeFixture, frontendCompanyFixture);

    expect(insights.highlights.some((item) => item.includes("React"))).toBe(true);
    expect(insights.highlights.some((item) => item.includes("요구사항"))).toBe(true);
    expect(insights.gaps.some((item) => item.includes("GraphQL"))).toBe(true);
    expect(insights.keywords).toEqual(expect.arrayContaining(["frontend", "React", "TypeScript"]));
  });
});
