import type { Company, Resume } from "@/lib/types";

export const frontendResumeFixture: Resume = {
  name: "김프론트",
  summary: "React와 Next.js로 SaaS 제품을 개발해 온 프론트엔드 엔지니어",
  desiredPosition: "Frontend Engineer",
  careerYears: 4,
  techStack: ["React", "Next.js", "TypeScript", "TanStack Query"],
  experience: [
    {
      company: "Alpha SaaS",
      role: "Frontend Engineer",
      period: "2022-2025",
      description:
        "채용 운영 대시보드를 개발했고 기획, 디자인과 협업하며 React 기반 화면 성능을 개선했습니다."
    }
  ],
  projects: [
    {
      name: "지원자 관리 어드민",
      description:
        "TypeScript와 Next.js로 관리 화면을 구축하고 TanStack Query로 데이터 흐름을 정리했습니다.",
      techStack: ["React", "Next.js", "TypeScript", "TanStack Query"]
    }
  ],
  achievements: ["대시보드 초기 로딩 시간을 35% 줄였습니다."],
  strengths: ["협업 상황에서 요구사항을 빠르게 정리하고 화면 구조로 옮깁니다."]
};

export const frontendCompanyFixture: Company = {
  companyName: "Hiring Cloud",
  companyDescription: "채용 SaaS를 만드는 팀",
  jobTitle: "Frontend Engineer",
  jobDescription: "채용 운영 제품의 사용자 경험을 개선합니다.",
  requirements: [
    "React 기반 서비스 개발 경험",
    "TypeScript 활용 능력",
    "협업 중심 개발 문화 적응"
  ],
  preferredSkills: ["Next.js 경험", "GraphQL 사용 경험"],
  techStack: ["React", "TypeScript", "Next.js", "GraphQL"]
};

export const backendResumeFixture: Resume = {
  name: "박백엔드",
  summary: "Node.js와 TypeScript 기반 API 설계 및 운영 경험이 있는 백엔드 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 5,
  techStack: ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
  experience: [
    {
      company: "Data Loop",
      role: "Backend Engineer",
      period: "2021-2025",
      description:
        "Node.js API와 배치 작업을 운영했고 장애 원인을 추적해 재발 방지 문서를 정리했습니다."
    }
  ],
  projects: [
    {
      name: "정산 API 리뉴얼",
      description: "TypeScript와 PostgreSQL로 정산 API를 재구성하고 Docker 기반 배포를 정리했습니다.",
      techStack: ["Node.js", "TypeScript", "PostgreSQL", "Docker"]
    }
  ],
  achievements: ["API 평균 응답 시간을 40% 개선했습니다."],
  strengths: ["운영 이슈를 구조적으로 분석하고 재발 방지 기준을 남깁니다."]
};

export const backendCompanyFixture: Company = {
  companyName: "Scale Infra",
  companyDescription: "트래픽이 큰 B2B 플랫폼",
  jobTitle: "Backend Engineer",
  jobDescription: "대규모 API와 데이터 파이프라인을 운영합니다.",
  requirements: ["Node.js 기반 API 개발 경험", "AWS 운영 경험", "문제 해결 역량"],
  preferredSkills: ["Kafka 경험"],
  techStack: ["Node.js", "TypeScript", "AWS", "Kafka"]
};
