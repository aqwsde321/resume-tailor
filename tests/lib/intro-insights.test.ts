import { describe, expect, it } from "vitest";

import {
  buildIntroGuidance,
  buildIntroSkillInput,
  buildMatchInsights,
  normalizeIntroWithGuidance
} from "@/lib/intro-insights";

import {
  backendCompanyFixture,
  backendResumeFixture,
  frontendCompanyFixture,
  frontendResumeFixture,
  introGuidanceCases
} from "../fixtures/intro-cases";

describe("intro insight helpers", () => {
  for (const fixture of introGuidanceCases) {
    it(`${fixture.name} fixture의 매칭 근거를 안정적으로 계산한다`, () => {
      const guidance = buildIntroGuidance(fixture.resume, fixture.company);

      expect(guidance.matchedSkills).toEqual(fixture.expected.matchedSkills);
      expect(guidance.requirementMatches.map((item) => item.target)).toEqual(
        expect.arrayContaining(fixture.expected.requiredTargets)
      );

      if (fixture.expected.roleOverlap) {
        expect(guidance.roleOverlap).toEqual(expect.arrayContaining(fixture.expected.roleOverlap));
      }

      if (fixture.expected.preferredTargets) {
        expect(guidance.preferredMatches.map((item) => item.target)).toEqual(
          expect.arrayContaining(fixture.expected.preferredTargets)
        );
      }

      if (fixture.expected.gapCandidates) {
        expect(guidance.gapCandidates).toEqual(expect.arrayContaining(fixture.expected.gapCandidates));
      }
    });
  }

  it("스킬 입력 텍스트에 분석 힌트와 출력 제약을 포함한다", () => {
    const input = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture);

    expect(input).toContain("[분석 힌트]");
    expect(input).toContain("\"matchedSkills\": [");
    expect(input).toContain("React");
    expect(input).toContain("[출력 제약]");
  });

  it("AI 응답의 기술/부족 항목을 분석 힌트 범위로 정규화한다", () => {
    const normalized = normalizeIntroWithGuidance(
      {
        oneLineIntro: "  React 기반 제품을 다뤄 온 개발자  ",
        shortIntro: "Next.js 제품을 운영했습니다.",
        longIntro:
          "  React와 Next.js 기반 제품을 운영하며 관리자 화면과 서비스 개선 작업을 진행했습니다. 요구사항을 빠르게 화면 구조로 바꾸고, TypeScript 기반 코드 정리에 익숙합니다. 공고에서 요구하는 React 기반 서비스 개발 경험과 TypeScript 활용 능력은 실제 프로젝트 경험으로 확인됩니다. 협업 중심 개발 환경에서도 기획과 디자인 요구를 빠르게 반영해 제품 완성도를 높여 왔습니다.  ",
        fitReasons: [
          "React 기반 서비스 개발 경험이 있어 공고와 맞닿아 있습니다.",
          "GraphQL API를 직접 운영했습니다."
        ],
        matchedSkills: ["react", "TypeScript", "Spring Boot"],
        gapNotes: ["GraphQL 경험은 이력서에서 직접 확인되지 않습니다.", "Kubernetes 경험이 필요합니다."]
      },
      frontendResumeFixture,
      frontendCompanyFixture
    );

    expect(normalized.oneLineIntro).toBe("React 기반 제품을 다뤄 온 개발자");
    expect(normalized.longIntro).toContain("TypeScript");
    expect(normalized.matchedSkills).toEqual(["React", "TypeScript"]);
    expect(normalized.fitReasons).toEqual(["React 기반 서비스 개발 경험이 있어 공고와 맞닿아 있습니다."]);
    expect(normalized.gapNotes).toEqual(["GraphQL 경험은 이력서에서 직접 확인되지 않습니다."]);
  });

  it("결과 화면 fallback용 매칭 인사이트를 생성한다", () => {
    const insights = buildMatchInsights(backendResumeFixture, backendCompanyFixture);

    expect(insights.highlights.some((item) => item.includes("Node.js"))).toBe(true);
    expect(insights.highlights.some((item) => item.includes("요구사항"))).toBe(true);
    expect(insights.gaps.some((item) => item.includes("AWS"))).toBe(true);
    expect(insights.keywords).toEqual(expect.arrayContaining(["backend", "Node.js", "TypeScript"]));
  });
});
