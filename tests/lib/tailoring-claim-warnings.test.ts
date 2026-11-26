import { describe, expect, it } from "vitest";
import { applyResumeTailoringPlan, reviseTailoringPlan, type ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";
import { buildTailoringClaimWarnings } from "@/entities/resume/model/tailoring-claim-warnings";
import { ResumeSchema } from "@/shared/lib/schemas";

const source = ResumeSchema.parse({
  headline: "백엔드 개발자",
  summary: "응답 시간을 개선하고 40건을 처리했습니다.",
  techStack: ["JavaScript", "Frappe"],
  experience: [{ company: "Acme", description: "Spring으로 API를 개발했습니다." }],
  projects: [{
    name: "대시보드",
    techStack: ["Kubernetes", "C++"],
    description: "요청 1,000건 처리 및 응답 시간 20.0% 개선",
  }],
});
const plan: ResumeTailoringPlan = {
  headline: { text: source.headline, evidenceIds: ["headline"] },
  summary: { text: source.summary, evidenceIds: ["summary"] },
  experience: [],
  projects: [],
  requirementMatches: [],
  skillIds: [],
  highlightIds: [],
  strengthIds: [],
};

describe("맞춤 이력서 문구의 근거 경고", () => {
  it("공고에만 있는 기술과 단위가 다른 수치를 해당 제안에 표시한다", () => {
    const warnings = buildTailoringClaimWarnings(source, {
      ...plan,
      summary: {
        text: "Frappe로 응답 시간을 40% 개선하고 140건을 처리했습니다.",
        evidenceIds: ["summary"],
      },
      experience: [{
        sourceId: "experience-1",
        description: "Spring Boot와 Temporal로 API를 개발했습니다.",
        evidenceIds: ["experience-1"],
      }],
    }, ["Temporal", "Frappe"]);

    expect([...warnings]).toEqual([
      ["summary", { numbers: ["40%", "140건"], technologies: ["Frappe"] }],
      ["experience-1", { numbers: [], technologies: ["Spring Boot", "Temporal"] }],
    ]);
  });

  it("원본에서 확인되는 기술 별칭·한국어 조사·수치 표기를 허용한다", () => {
    const warnings = buildTailoringClaimWarnings(source, {
      ...plan,
      projects: [{
        sourceId: "project-1",
        description: "K8s와 C++로 1000 건을 처리하고 응답 시간을 ２０ % 개선했습니다.",
        evidenceIds: ["project-1"],
      }],
    });
    expect(warnings.size).toBe(0);
  });

  it("영문 단위를 비교하고 같은 백분율의 한영 표기를 인식한다", () => {
    const bilingualSource = { ...source, summary: "4 months of maintenance and a 20 percent reduction in latency" };
    const warnings = buildTailoringClaimWarnings(bilingualSource, {
      ...plan,
      summary: { text: "4 years of maintenance, 응답 시간 20% 개선", evidenceIds: ["summary"] },
    });
    expect(warnings.get("summary")).toEqual({ numbers: ["4 years"], technologies: [] });
  });

  it("비슷한 이름과 근거 ID의 번호가 추가 사실을 뒷받침하지 않는다", () => {
    const warnings = buildTailoringClaimWarnings(source, {
      ...plan,
      headline: { text: "Java 개발자", evidenceIds: ["skill-1"] },
      summary: { text: "1 건 처리", evidenceIds: ["skill-1"] },
    });
    expect([...warnings]).toEqual([
      ["headline", { technologies: ["Java"], numbers: [] }],
      ["summary", { technologies: [], numbers: ["1 건"] }],
    ]);
  });

  it("AI가 문구에서 추출한 기술도 대조하고 문구에 없는 이름은 무시한다", () => {
    const warnings = buildTailoringClaimWarnings(source, {
      ...plan,
      summary: {
        text: "QuickLoom과 Frappe로 개발했습니다. QuickLoom을 운영했습니다.",
        evidenceIds: ["skill-2"],
        technologies: ["QuickLoom", "Frappe", "ImaginaryDB"],
      },
    });
    expect(warnings.get("summary")).toEqual({ numbers: [], technologies: ["QuickLoom"] });
  });

  it("수정한 제목·요약·경력·프로젝트를 기존 근거와 대조하고 이력서에 반영한다", () => {
    const original: ResumeTailoringPlan = {
      ...plan,
      headline: { text: "AWS 개발자", evidenceIds: ["headline"] },
      summary: { text: "QuickLoom으로 40% 개선", evidenceIds: ["summary"], technologies: ["QuickLoom"] },
      experience: [{ sourceId: "experience-1", description: "Docker로 개발", evidenceIds: ["experience-1"] }],
      projects: [{ sourceId: "project-1", description: "요청 2000건 처리", evidenceIds: ["project-1"] }],
    };
    const revised = reviseTailoringPlan(original, new Map([
      ["headline", "서버 개발자"],
      ["summary", "응답 시간을 개선하고 QuickLoom을 검증했습니다."],
      ["experience-1", "Spring으로 API를 구현했습니다."],
      ["project-1", "요청 1,000건을 처리했습니다."],
      ["skill-1", "Docker"],
    ]));

    expect(revised.summary.evidenceIds).toEqual(["summary"]);
    expect(original.headline.text).toBe("AWS 개발자");
    expect([...buildTailoringClaimWarnings(source, revised)]).toEqual([
      ["summary", { numbers: [], technologies: ["QuickLoom"] }],
    ]);
    expect(applyResumeTailoringPlan(source, revised)).toMatchObject({
      headline: "서버 개발자",
      summary: "응답 시간을 개선하고 QuickLoom을 검증했습니다.",
      experience: [{ description: "Spring으로 API를 구현했습니다." }],
      projects: [{ description: "요청 1,000건을 처리했습니다." }],
      techStack: [],
    });
  });
});
