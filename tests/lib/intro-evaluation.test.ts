import { describe, expect, it } from "vitest";
import { ResumeSchema } from "@/shared/lib/schemas";
import { evaluateIntroSample } from "@/server/intro-evaluation";
import { introQualityPassCases } from "../fixtures/intro-quality-cases";

describe("intro evaluation samples", () => {
  it("원본 실패가 정규화로 가려져도 두 결과를 별도로 보존한다", () => {
    const fixture = introQualityPassCases[0]!;
    const sample = evaluateIntroSample({ ...fixture.intro, matchedSkills: ["Rust"] }, fixture.resume, fixture.company);
    expect(sample.rawQuality?.issues.map((issue) => issue.code)).toContain("matched_skill_out_of_guidance");
    expect(sample.normalized?.matchedSkills).not.toContain("Rust");
    expect(sample.normalizedQuality?.issues.map((issue) => issue.code)).not.toContain("matched_skill_out_of_guidance");
    expect(sample.raw).toMatchObject({ matchedSkills: ["Rust"] });
  });

  it("필드가 누락된 출력은 기본값으로 복구하기 전에 스키마 실패로 기록한다", () => {
    const fixture = introQualityPassCases[0]!;
    const sample = evaluateIntroSample({ shortIntro: "짧은 소개" }, fixture.resume, fixture.company);
    expect(sample.schemaValid).toBe(false);
    expect(sample.schemaIssues.length).toBeGreaterThan(0);
    expect(sample.rawQuality).toBeNull();
  });
});

it("근거가 요약 한 문장뿐이면 긴 글 분량을 채우도록 요구하지 않는다", () => {
  const fixture = introQualityPassCases[0]!;
  const resume = {
    ...fixture.resume,
    summary: "React로 개인 프로젝트 화면을 구현했습니다.",
    experience: [], projects: [], achievements: [], strengths: []
  };
  const sample = evaluateIntroSample({
    ...fixture.intro,
    shortIntro: resume.summary,
    longIntro: resume.summary
  }, resume, fixture.company);
  expect(sample.rawQuality?.issues.map((issue) => issue.code)).not.toContain("long_not_richer_than_short");
});

it("프로젝트 성과가 여러 개면 긴 소개의 근거 확장 검사를 생략하지 않는다", () => {
  const fixture = introQualityPassCases[0]!;
  const resume = ResumeSchema.parse({
    ...fixture.resume,
    summary: "React 화면을 구현했습니다.",
    experience: [], achievements: [], strengths: [],
    projects: [{ name: "서비스", subtitle: "", description: "", techStack: ["React"], highlights: ["접근성을 개선했습니다.", "공통 컴포넌트를 구현했습니다."] }]
  });
  const sample = evaluateIntroSample({ ...fixture.intro, shortIntro: resume.summary, longIntro: resume.summary }, resume, fixture.company);
  expect(sample.rawQuality?.issues.map((issue) => issue.code)).toContain("long_not_richer_than_short");
});
