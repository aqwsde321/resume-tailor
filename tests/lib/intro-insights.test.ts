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
  frontendMetricsCompanyFixture,
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
    const input = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture, "collaborative");

    expect(input).toContain("[분석 힌트]");
    expect(input).toContain("[작성 앵커]");
    expect(input).toContain("[톤 가이드]");
    expect(input).toContain("협업 중심");
    expect(input).toContain("\"matchedSkills\": [");
    expect(input).toContain("React");
    expect(input).toContain("필수 요건");
    expect(input).toContain("공고 요건 -> 내 경험/성과/강점 -> 입사 후 기여");
    expect(input).toContain("[출력 제약]");
  });

  it("톤이 바뀌면 입력 가이드 문구도 명확히 달라진다", () => {
    const balancedInput = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture, "balanced");
    const confidentInput = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture, "confident");
    const collaborativeInput = buildIntroSkillInput(
      frontendResumeFixture,
      frontendCompanyFixture,
      "collaborative"
    );
    const problemSolvingInput = buildIntroSkillInput(
      frontendResumeFixture,
      frontendCompanyFixture,
      "problemSolving"
    );

    expect(balancedInput).toContain("담백하고 사실 중심");
    expect(confidentInput).toContain("성과와 강점을 분명하게");
    expect(collaborativeInput).toContain("협업, 조율, 커뮤니케이션");
    expect(problemSolvingInput).toContain("문제를 구조화하고 개선한 경험");
    expect(confidentInput).not.toBe(collaborativeInput);
    expect(collaborativeInput).not.toBe(problemSolvingInput);
  });

  it("작성 앵커는 요약보다 프로젝트/경력 같은 구체 근거를 우선 사용한다", () => {
    const guidance = buildIntroGuidance(frontendResumeFixture, frontendCompanyFixture);
    const reactAnchor = guidance.writingAnchors.find((item) => item.target === "React 기반 서비스 개발 경험");

    expect(reactAnchor).toBeTruthy();
    expect(reactAnchor?.type).toBe("requirement");
    expect(
      reactAnchor?.evidence.some((item) => item.startsWith("프로젝트:") || item.startsWith("경력:"))
    ).toBe(true);
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
        gapNotes: ["GraphQL 경험은 이력서에서 직접 확인되지 않습니다.", "Kubernetes 경험이 필요합니다."],
        missingButRelevant: []
      },
      frontendResumeFixture,
      frontendCompanyFixture
    );

    expect(normalized.oneLineIntro).toBe("React 기반 제품을 다뤄 온 개발자");
    expect(normalized.longIntro).toContain("TypeScript");
    expect(normalized.matchedSkills).toEqual(["React", "TypeScript"]);
    expect(normalized.fitReasons).toEqual(["React 기반 서비스 개발 경험이 있어 공고와 맞닿아 있습니다."]);
    expect(normalized.gapNotes).toEqual(["GraphQL 경험은 이력서에서 직접 확인되지 않습니다."]);
    expect(normalized.missingButRelevant).toEqual([]);
  });

  it("소개글 본문에 덜 반영된 연결 포인트를 별도로 계산한다", () => {
    const normalized = normalizeIntroWithGuidance(
      {
        oneLineIntro: "React 기반 프론트엔드 개발자",
        shortIntro:
          "React와 TypeScript 기반 관리자 도구를 개발하며 데이터 중심 화면 설계 경험을 쌓았습니다.",
        longIntro:
          "React와 TypeScript 기반 관리자 도구를 개발하며 데이터 중심 화면 설계 경험을 쌓았습니다. 공고의 React 실무 경험과 TypeScript 활용 역량은 실제 프로젝트 경험으로 확인됩니다. 입사 후에도 관리자 제품 화면을 빠르게 이해하고 개선에 기여할 수 있습니다.",
        fitReasons: [],
        matchedSkills: ["React", "TypeScript"],
        gapNotes: [],
        missingButRelevant: []
      },
      frontendResumeFixture,
      frontendCompanyFixture
    );

    expect(normalized.missingButRelevant).toEqual(
      expect.arrayContaining([
        expect.stringContaining("협업 중심 개발 문화 적응"),
        expect.stringContaining("Next.js 경험")
      ])
    );
  });

  it("같은 이력서라도 공고가 바뀌면 작성 앵커와 핵심 기술이 달라진다", () => {
    const hiringGuidance = buildIntroGuidance(frontendResumeFixture, frontendCompanyFixture);
    const metricsGuidance = buildIntroGuidance(frontendResumeFixture, frontendMetricsCompanyFixture);
    const hiringInput = buildIntroSkillInput(frontendResumeFixture, frontendCompanyFixture);
    const metricsInput = buildIntroSkillInput(frontendResumeFixture, frontendMetricsCompanyFixture);

    expect(hiringGuidance.matchedSkills).toContain("Next.js");
    expect(hiringGuidance.matchedSkills).not.toContain("TanStack Query");
    expect(metricsGuidance.matchedSkills).toContain("TanStack Query");
    expect(metricsGuidance.matchedSkills).not.toContain("Next.js");
    expect(hiringGuidance.writingAnchors.map((item) => item.target)).toContain("React 기반 서비스 개발 경험");
    expect(metricsGuidance.writingAnchors.map((item) => item.target)).toContain("대시보드 성능 개선 경험");
    expect(hiringInput).toContain("React 기반 서비스 개발 경험");
    expect(metricsInput).toContain("대시보드 성능 개선 경험");
    expect(metricsInput).toContain("TanStack Query 경험");
  });

  it("결과 화면 fallback용 매칭 인사이트를 생성한다", () => {
    const insights = buildMatchInsights(backendResumeFixture, backendCompanyFixture);

    expect(insights.highlights.some((item) => item.includes("Node.js"))).toBe(true);
    expect(insights.highlights.some((item) => item.includes("요구사항"))).toBe(true);
    expect(insights.gaps.some((item) => item.includes("AWS"))).toBe(true);
    expect(insights.opportunities).toEqual([]);
    expect(insights.keywords).toEqual(expect.arrayContaining(["backend", "Node.js", "TypeScript"]));
  });
});
