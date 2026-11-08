import { describe, expect, it } from "vitest";

import {
  addDiscoveredExperienceToResume,
  isExperienceDiscoverySessionCurrent,
  normalizeExperienceDiscoverySession
} from "@/entities/intro/model/experience-discovery";
import type { Resume } from "@/shared/lib/types";

const baseResume: Resume = {
  name: "홍길동",
  headline: "Backend Engineer",
  summary: "백엔드 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 3,
  careerDurationText: "3년",
  contacts: [],
  techStack: ["TypeScript"],
  experience: [],
  projects: [],
  achievements: [],
  pdfHighlights: [],
  strengths: [],
  pdfStrengths: []
};

describe("addDiscoveredExperienceToResume", () => {
  it("사용자가 승인한 경력 경험을 이력서 경력에 추가한다", () => {
    const updated = addDiscoveredExperienceToResume(baseResume, {
      category: "experience",
      title: "결제 서비스 개선",
      organization: "Acme",
      role: "Backend Engineer",
      period: "2024",
      description: "결제 API의 재시도 흐름을 개선해 실패 요청을 줄였습니다.",
      techStack: ["Node.js"]
    });

    expect(updated.experience).toEqual([
      {
        company: "Acme",
        role: "Backend Engineer",
        period: "2024",
        description: "결제 API의 재시도 흐름을 개선해 실패 요청을 줄였습니다."
      }
    ]);
    expect(updated.techStack).toEqual(["TypeScript", "Node.js"]);
    expect(baseResume.experience).toEqual([]);
  });

  it("사용자가 승인한 개인 프로젝트를 프로젝트 항목으로 추가한다", () => {
    const updated = addDiscoveredExperienceToResume(baseResume, {
      category: "project",
      title: "개인 데이터 대시보드",
      organization: "",
      role: "개인 프로젝트",
      period: "2025",
      description: "사용 로그를 정리해 주간 활성 사용자 변화를 보여주는 대시보드를 만들었습니다.",
      techStack: ["Next.js", "PostgreSQL"]
    });

    expect(updated.projects).toEqual([
      {
        name: "개인 데이터 대시보드",
        description: "사용 로그를 정리해 주간 활성 사용자 변화를 보여주는 대시보드를 만들었습니다.",
        subtitle: "개인 프로젝트 · 2025",
        link: "",
        linkLabel: "",
        techStack: ["Next.js", "PostgreSQL"],
        highlights: []
      }
    ]);
    expect(updated.techStack).toEqual(["TypeScript", "Next.js", "PostgreSQL"]);
  });

  it("공백 항목과 중복 기술은 반영하지 않는다", () => {
    const updated = addDiscoveredExperienceToResume(baseResume, {
      category: "experience",
      title: "",
      organization: "",
      role: "",
      period: "",
      description: "  ",
      techStack: ["TypeScript", "  "]
    });

    expect(updated.experience).toHaveLength(0);
    expect(updated.techStack).toEqual(["TypeScript"]);
  });

  it("제목이나 설명이 없는 초안은 이력서에 추가하지 않는다", () => {
    const updated = addDiscoveredExperienceToResume(baseResume, {
      category: "experience",
      title: "지원 경험",
      organization: "Acme",
      role: "",
      period: "",
      description: "",
      techStack: ["Node.js"]
    });

    expect(updated).toBe(baseResume);
  });
});

describe("experience discovery session helpers", () => {
  const session = {
    requirement: "운영 환경의 장애 대응 경험",
    messages: [{ role: "assistant" as const, content: "관련 경험이 있나요?" }],
    status: "question" as const,
    message: "관련 경험이 있나요?",
    draft: null,
    sourceResumeSnapshot: "resume snapshot",
    sourceCompanyJson: "company snapshot"
  };

  it("기준 이력서와 공고가 그대로일 때만 대화를 계속할 수 있다", () => {
    expect(isExperienceDiscoverySessionCurrent(session, "resume snapshot", "company snapshot")).toBe(true);
    expect(isExperienceDiscoverySessionCurrent(session, "updated resume", "company snapshot")).toBe(false);
    expect(isExperienceDiscoverySessionCurrent(session, "resume snapshot", "updated company")).toBe(false);
  });

  it("저장된 대화를 검증하고 손상된 값은 폐기한다", () => {
    expect(normalizeExperienceDiscoverySession(session)).toEqual(session);
    expect(normalizeExperienceDiscoverySession({ ...session, status: "invalid" })).toBeNull();
  });
});
