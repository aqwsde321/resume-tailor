import { describe, expect, it } from "vitest";

import {
  applyResumeTailoringPlan,
  buildResumeTailoringEvidence,
  type ResumeTailoringPlan
} from "@/entities/resume/model/resume-tailoring";
import { createPdfResumeFixture } from "../fixtures/pdf-fixture";

function createPlan(): ResumeTailoringPlan {
  return {
    headline: {
      text: "운영 도구와 데이터 흐름을 개선한 프론트엔드 개발자",
      evidenceIds: ["experience-1", "project-1"]
    },
    summary: {
      text: "React 기반 관리자 도구와 운영 대시보드 개발 경험을 보유했습니다.",
      evidenceIds: ["experience-1", "project-1"]
    },
    experience: [
      {
        sourceId: "experience-1",
        description: "운영 도구와 대시보드를 개발했습니다.",
        evidenceIds: ["experience-1"]
      }
    ],
    projects: [
      {
        sourceId: "project-1",
        description: "관리자 화면과 API를 설계했습니다.",
        evidenceIds: ["project-1"]
      }
    ],
    skillIds: ["skill-2", "skill-1"],
    highlightIds: ["highlight-2"],
    strengthIds: ["strength-1"]
  };
}

describe("resume tailoring", () => {
  it("creates stable evidence references from the source resume", () => {
    const evidence = buildResumeTailoringEvidence(createPdfResumeFixture());

    expect(evidence).toContainEqual({
      id: "experience-1",
      title: "경력 · Acme / Backend Engineer",
      text: "기간: 2023.01 - 2026.03\n주문 API와 운영 도구를 개발했습니다."
    });
    expect(evidence.find((item) => item.id === "project-1")?.text).toContain(
      "관리자 화면과 API를 설계했습니다."
    );
  });

  it("applies only selected source facts while preserving original metadata", () => {
    const source = createPdfResumeFixture();
    const tailored = applyResumeTailoringPlan(source, createPlan());

    expect(tailored).toMatchObject({
      headline: "운영 도구와 데이터 흐름을 개선한 프론트엔드 개발자",
      summary: "React 기반 관리자 도구와 운영 대시보드 개발 경험을 보유했습니다.",
      experience: [
        {
          company: "Acme",
          role: "Backend Engineer",
          period: "2023.01 - 2026.03",
          description: "운영 도구와 대시보드를 개발했습니다."
        }
      ],
      projects: [
        {
          name: "Admin Console",
          description: "관리자 화면과 API를 설계했습니다.",
          link: "https://github.com/qrqr/admin-console"
        }
      ],
      techStack: ["Spring Boot", "Java"],
      achievements: ["조회 성능 개선"],
      pdfHighlights: ["운영 대시보드 구축"],
      strengths: ["협업", "문제 해결"],
      pdfStrengths: ["문제 해결"]
    });
  });
});
