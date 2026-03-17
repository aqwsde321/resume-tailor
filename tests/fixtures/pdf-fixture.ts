import { readFileSync } from "node:fs";
import path from "node:path";

import type { Company, Intro, Resume } from "@/shared/lib/types";

export const PROFILE_IMAGE_DATA_URL = `data:image/png;base64,${readFileSync(
  path.join(process.cwd(), "docs", "images", "app-flow-overview.png")
).toString("base64")}`;

export function createPdfResumeFixture(overrides: Partial<Resume> = {}): Resume {
  return {
    name: "홍길동",
    headline: "문제 해결형 백엔드 개발자",
    summary: "Java와 Spring Boot 기반으로 서비스를 개발합니다.",
    desiredPosition: "Backend Engineer",
    careerYears: 3,
    careerDurationText: "3년",
    contacts: [
      {
        label: "GitHub",
        value: "github.com/qrqr",
        url: "https://github.com/qrqr"
      }
    ],
    techStack: ["Java", "Spring Boot", "PostgreSQL", "Docker"],
    experience: [
      {
        company: "Acme",
        role: "Backend Engineer",
        period: "2023.01 - 2026.03",
        description: "주문 API와 운영 도구를 개발했습니다."
      }
    ],
    projects: [
      {
        name: "Admin Console",
        subtitle: "운영 도구",
        description: "관리자 화면과 API를 설계했습니다.",
        link: "https://github.com/qrqr/admin-console",
        linkLabel: "GitHub",
        techStack: ["Java", "Spring Boot", "PostgreSQL"],
        highlights: ["관리자 대시보드 설계", "조회 응답 속도 개선"]
      }
    ],
    achievements: ["조회 성능 개선"],
    pdfHighlights: ["주문 API 응답 속도 개선", "운영 대시보드 구축"],
    strengths: ["협업", "문제 해결"],
    pdfStrengths: ["문제 해결", "운영 안정성"],
    pdfProfileImageDataUrl: "",
    pdfProfileImageVisible: false,
    ...overrides
  };
}

export const companyFixture: Company = {
  companyName: "Beta Corp",
  companyDescription: "B2B SaaS 제품을 만드는 팀",
  jobTitle: "Backend Engineer",
  jobDescription: "주문 API와 운영 시스템을 개발합니다.",
  requirements: ["Java", "Spring Boot", "RDB 경험"],
  preferredSkills: ["Docker", "대시보드 경험"],
  techStack: ["Java", "Spring Boot", "PostgreSQL"]
};

export const introFixture: Intro = {
  oneLineIntro: "운영 API 경험을 가진 백엔드 개발자",
  shortIntro:
    "Java와 Spring Boot 기반 API를 개발하며 운영 도구와 데이터 구조 개선을 함께 경험했습니다. 주문 API와 대시보드 개발 경험이 Beta Corp 요구사항과 직접 맞닿아 있습니다.",
  longIntro:
    "Java와 Spring Boot 기반으로 운영 API와 관리자 도구를 꾸준히 개발해 왔습니다. 주문 API 구조를 설계하고 조회 성능을 개선했으며, 운영 대시보드를 만들어 데이터 흐름을 사용자 관점에서 다시 정리한 경험이 있습니다. 이러한 이력은 Beta Corp의 주문 API와 운영 시스템 개발 요구사항과 직접 연결되며, 입사 후에도 안정성과 유지보수성을 함께 고려한 구현에 기여할 수 있습니다.",
  fitReasons: ["Java/Spring Boot 기반 API 경험이 직접 연결됩니다."],
  matchedSkills: ["Java", "Spring Boot", "PostgreSQL"],
  gapNotes: [],
  missingButRelevant: []
};

export const PDF_VISUAL_CASES = [
  { id: "classic-cobalt", templateId: "classic", themeId: "cobalt", withProfileImage: false },
  { id: "classic-onyx", templateId: "classic", themeId: "onyx", withProfileImage: false },
  { id: "sidebar-cobalt", templateId: "compact", themeId: "cobalt", withProfileImage: false },
  { id: "sidebar-onyx", templateId: "compact", themeId: "onyx", withProfileImage: false },
  { id: "modern-cobalt", templateId: "modern", themeId: "cobalt", withProfileImage: false },
  { id: "modern-onyx", templateId: "modern", themeId: "onyx", withProfileImage: false },
  { id: "typographic-cobalt", templateId: "typographic", themeId: "cobalt", withProfileImage: false },
  { id: "typographic-onyx", templateId: "typographic", themeId: "onyx", withProfileImage: false },
  { id: "classic-profile-cobalt", templateId: "classic", themeId: "cobalt", withProfileImage: true }
] as const;
