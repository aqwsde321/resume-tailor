import { describe, expect, it } from "vitest";

import {
  applyResumeTailoringPlan,
  buildResumeTailoringEvidence,
  buildResumeTailoringRequirements,
  isResumeTailoringPlanValid,
  ResumeTailoringPlanSchema,
  type ResumeTailoringPlan
} from "@/entities/resume/model/resume-tailoring";
import { companyFixture } from "../fixtures/pdf-fixture";
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
    requirementMatches: [
      {
        requirementId: "requirement-1",
        matchType: "direct",
        evidenceIds: ["skill-1"],
        reason: "이력서에 Java 사용 근거가 있습니다."
      },
      {
        requirementId: "requirement-2",
        matchType: "direct",
        evidenceIds: ["skill-2"],
        reason: "이력서에 Spring Boot 사용 근거가 있습니다."
      },
      {
        requirementId: "requirement-3",
        matchType: "adjacent",
        evidenceIds: ["project-1"],
        reason: "PostgreSQL 프로젝트 경험이 RDB 업무와 연결됩니다."
      },
      {
        requirementId: "preferred-1",
        matchType: "direct",
        evidenceIds: ["skill-4"],
        reason: "이력서에 Docker 사용 근거가 있습니다."
      },
      {
        requirementId: "preferred-2",
        matchType: "direct",
        evidenceIds: ["project-1"],
        reason: "프로젝트에 관리자 대시보드 설계 경험이 있습니다."
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

  it("creates stable IDs for every required and preferred job requirement", () => {
    expect(buildResumeTailoringRequirements(companyFixture)).toEqual([
      { id: "requirement-1", type: "required", text: "Java" },
      { id: "requirement-2", type: "required", text: "Spring Boot" },
      { id: "requirement-3", type: "required", text: "RDB 경험" },
      { id: "preferred-1", type: "preferred", text: "Docker" },
      { id: "preferred-2", type: "preferred", text: "대시보드 경험" }
    ]);
  });

  it("validates all requirement matches and allows a gap only without resume evidence", () => {
    const source = createPdfResumeFixture();
    const plan = createPlan();
    const companyWithGap = {
      ...companyFixture,
      requirements: [...companyFixture.requirements, "Kubernetes 운영 경험"]
    };
    const planWithGap = {
      ...plan,
      requirementMatches: [
        ...plan.requirementMatches,
        {
          requirementId: "requirement-4",
          matchType: "gap" as const,
          evidenceIds: [],
          reason: "이력서에서 Kubernetes 운영 근거를 찾지 못했습니다."
        }
      ]
    };

    expect(ResumeTailoringPlanSchema.safeParse(planWithGap).success).toBe(true);
    expect(isResumeTailoringPlanValid(source, companyWithGap, planWithGap)).toBe(true);
    expect(
      isResumeTailoringPlanValid(source, companyWithGap, {
        ...planWithGap,
        requirementMatches: planWithGap.requirementMatches.map((match) =>
          match.requirementId === "requirement-4"
            ? { ...match, evidenceIds: ["skill-1"] }
            : match
        )
      })
    ).toBe(false);
  });

  it("rejects missing or invented requirement and evidence references", () => {
    const source = createPdfResumeFixture();
    const plan = createPlan();

    expect(isResumeTailoringPlanValid(source, companyFixture, plan)).toBe(true);
    expect(
      isResumeTailoringPlanValid(source, companyFixture, {
        ...plan,
        requirementMatches: plan.requirementMatches.slice(1)
      })
    ).toBe(false);
    expect(
      isResumeTailoringPlanValid(source, companyFixture, {
        ...plan,
        requirementMatches: plan.requirementMatches.map((match, index) =>
          index === 0 ? { ...match, requirementId: "requirement-99" } : match
        )
      })
    ).toBe(false);
    expect(
      isResumeTailoringPlanValid(source, companyFixture, {
        ...plan,
        requirementMatches: plan.requirementMatches.map((match, index) =>
          index === 0 ? { ...match, evidenceIds: ["invented-evidence"] } : match
        )
      })
    ).toBe(false);
    expect(
      isResumeTailoringPlanValid(source, companyFixture, {
        ...plan,
        requirementMatches: plan.requirementMatches.map((match, index) =>
          index === 0 ? { ...match, matchType: "direct", evidenceIds: [] } : match
        )
      })
    ).toBe(false);
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
