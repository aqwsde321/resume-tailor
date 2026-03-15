import { describe, expect, it } from "vitest";

import {
  buildIntroSkillInput,
  evaluateIntroQuality,
  normalizeIntroWithGuidance
} from "@/entities/intro/model/intro-insights";

import { introQualityFailCases, introQualityPassCases } from "../fixtures/intro-quality-cases";

describe("intro quality evaluator", () => {
  for (const fixture of introQualityPassCases) {
    it(`${fixture.name} 소개글은 품질 규칙을 통과한다`, () => {
      const normalized = normalizeIntroWithGuidance(fixture.intro, fixture.resume, fixture.company);
      const report = evaluateIntroQuality(normalized, fixture.resume, fixture.company);
      const inputText = buildIntroSkillInput(fixture.resume, fixture.company, fixture.tone);

      expect(report.ok).toBe(true);
      expect(report.issues).toEqual([]);
      expect(report.shortCoverageTargets).toEqual(expect.arrayContaining(fixture.mustMentionInShort));
      expect(report.longCoverageTargets).toEqual(expect.arrayContaining(fixture.mustMentionInLong));

      fixture.mustMentionInShort.forEach((phrase) => {
        expect(normalized.shortIntro).toContain(phrase);
      });
      fixture.mustMentionInLong.forEach((phrase) => {
        expect(normalized.longIntro).toContain(phrase);
      });
      fixture.forbiddenPhrases.forEach((phrase) => {
        expect(normalized.shortIntro).not.toContain(phrase);
        expect(normalized.longIntro).not.toContain(phrase);
      });

      expect(inputText).toContain(fixture.toneCue);
    });
  }

  for (const fixture of introQualityFailCases) {
    it(`${fixture.name} 소개글은 기대한 품질 위반 코드를 반환한다`, () => {
      const report = evaluateIntroQuality(fixture.intro, fixture.resume, fixture.company);

      expect(report.ok).toBe(false);
      expect(report.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(fixture.expectedIssueCodes)
      );
    });
  }

  it("정규화 단계에서 longIntro 중복 문장을 제거하고 근거 밖 fitReasons를 버린다", () => {
    const duplicateLongIntro =
      "Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 왔습니다. Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 왔습니다. 문제 해결 역량을 바탕으로 장애 원인을 추적해 왔습니다.";
    const normalized = normalizeIntroWithGuidance(
      {
        oneLineIntro: "백엔드 엔지니어",
        shortIntro:
          "Node.js 기반 API 개발 경험과 문제 해결 역량을 바탕으로 운영 API를 개선해 온 백엔드 엔지니어입니다.",
        longIntro: duplicateLongIntro,
        fitReasons: [
          "Node.js 기반 API 개발 경험을 실제 운영 API 개선 성과로 설명할 수 있습니다.",
          "Rust 기반 인프라 개발 경험이 있어 적합합니다."
        ],
        matchedSkills: ["Node.js", "TypeScript", "Rust"],
        gapNotes: ["AWS 운영 경험은 이력서에서 직접 확인되지 않습니다.", "Kafka 운영 경험이 많습니다."],
        missingButRelevant: []
      },
      introQualityPassCases[2]!.resume,
      introQualityPassCases[2]!.company
    );

    expect(normalized.longIntro).toBe(
      "Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 왔습니다. 문제 해결 역량을 바탕으로 장애 원인을 추적해 왔습니다."
    );
    expect(normalized.fitReasons).toEqual([
      "Node.js 기반 API 개발 경험을 실제 운영 API 개선 성과로 설명할 수 있습니다."
    ]);
    expect(normalized.matchedSkills).toEqual(["Node.js", "TypeScript"]);
    expect(normalized.gapNotes).toEqual(["AWS 운영 경험은 이력서에서 직접 확인되지 않습니다."]);
  });
});
