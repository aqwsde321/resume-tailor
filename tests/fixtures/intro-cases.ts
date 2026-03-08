import type { Company, Resume } from "@/lib/types";

type IntroGuidanceExpectation = {
  roleOverlap?: string[];
  matchedSkills: string[];
  requiredTargets: string[];
  preferredTargets?: string[];
  gapCandidates?: string[];
};

export type IntroGuidanceGoldenCase = {
  name: string;
  resume: Resume;
  company: Company;
  expected: IntroGuidanceExpectation;
};

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

export const frontendMetricsCompanyFixture: Company = {
  companyName: "Product Metrics",
  companyDescription: "실험 기반 B2B SaaS 팀",
  jobTitle: "Frontend Engineer",
  jobDescription: "전환 지표를 빠르게 실험하고 제품 화면 성능을 개선합니다.",
  requirements: [
    "대시보드 성능 개선 경험",
    "TypeScript 활용 능력",
    "기획/디자인 협업 경험"
  ],
  preferredSkills: ["TanStack Query 경험", "A/B 테스트 경험"],
  techStack: ["React", "TypeScript", "TanStack Query", "Amplitude"]
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

export const dataResumeFixture: Resume = {
  name: "이데이터",
  summary: "Python, SQL, Airflow 기반 데이터 파이프라인을 설계해 온 데이터 엔지니어",
  desiredPosition: "Data Engineer",
  careerYears: 6,
  techStack: ["Python", "SQL", "Airflow", "BigQuery"],
  experience: [
    {
      company: "Metric Lab",
      role: "Data Engineer",
      period: "2020-2026",
      description:
        "마케팅 팀과 협업하며 Airflow 배치를 운영했고 SQL 기반 리포팅 파이프라인을 개선했습니다."
    }
  ],
  projects: [
    {
      name: "광고 데이터 적재 자동화",
      description: "Python과 Airflow로 적재 DAG를 구축하고 BigQuery 스키마를 표준화했습니다.",
      techStack: ["Python", "SQL", "Airflow", "BigQuery"]
    }
  ],
  achievements: ["배치 실패율을 60% 줄였습니다."],
  strengths: ["데이터 요구사항을 비기술 조직과 정리하는 데 익숙합니다."]
};

export const dataCompanyFixture: Company = {
  companyName: "Insight Flow",
  companyDescription: "광고 성과 분석 플랫폼",
  jobTitle: "Data Engineer",
  jobDescription: "지표 신뢰도를 높이는 데이터 플랫폼을 운영합니다.",
  requirements: [
    "Python 기반 데이터 파이프라인 구축 경험",
    "SQL 성능 최적화 경험",
    "데이터 조직 협업 능력"
  ],
  preferredSkills: ["dbt 경험", "Snowflake 사용 경험"],
  techStack: ["Python", "SQL", "Airflow", "dbt", "Snowflake"]
};

export const mobileResumeFixture: Resume = {
  name: "최모바일",
  summary: "React Native와 Firebase로 모바일 제품을 개선해 온 모바일 엔지니어",
  desiredPosition: "Mobile Engineer",
  careerYears: 3,
  techStack: ["React Native", "TypeScript", "Firebase", "Amplitude"],
  experience: [
    {
      company: "Commerce One",
      role: "Mobile Engineer",
      period: "2023-2026",
      description:
        "앱 출시 프로세스를 정리했고 Firebase 푸시와 Amplitude 이벤트 분석으로 리텐션 개선 실험을 진행했습니다."
    }
  ],
  projects: [
    {
      name: "커머스 앱 리뉴얼",
      description: "React Native와 TypeScript로 앱 구조를 재정리하고 Firebase 인증 흐름을 정비했습니다.",
      techStack: ["React Native", "TypeScript", "Firebase", "Amplitude"]
    }
  ],
  achievements: ["앱 이탈률을 18% 줄였습니다."],
  strengths: ["릴리즈 이후 사용자 이벤트를 빠르게 분석하고 후속 실험으로 연결합니다."]
};

export const mobileCompanyFixture: Company = {
  companyName: "Pocket Retail",
  companyDescription: "모바일 커머스 팀",
  jobTitle: "Mobile Engineer",
  jobDescription: "구매 전환을 높이는 앱 기능을 개선합니다.",
  requirements: [
    "React Native 기반 앱 개발 경험",
    "사용자 이벤트 분석 경험",
    "앱 출시 프로세스 개선 경험"
  ],
  preferredSkills: ["Fastlane 경험", "Firebase 활용 경험"],
  techStack: ["React Native", "TypeScript", "Firebase", "Fastlane"]
};

export const aiResumeFixture: Resume = {
  name: "정에이아이",
  summary: "Next.js와 OpenAI API를 활용한 업무 자동화 제품을 만들어 온 엔지니어",
  desiredPosition: "AI Product Engineer",
  careerYears: 4,
  techStack: ["Next.js", "TypeScript", "Node.js", "OpenAI API"],
  experience: [
    {
      company: "Workflow Lab",
      role: "Fullstack Engineer",
      period: "2022-2026",
      description:
        "사내 문서 요약 기능을 제품에 붙였고 기획, 디자인과 협업하며 프롬프트 실험 로그를 관리했습니다."
    }
  ],
  projects: [
    {
      name: "지원서 코파일럿",
      description: "Next.js와 OpenAI API로 자기소개 초안을 생성하는 내부 도구를 개발했습니다.",
      techStack: ["Next.js", "TypeScript", "Node.js", "OpenAI API"]
    }
  ],
  achievements: ["반복 문서 작업 시간을 주당 8시간 절감했습니다."],
  strengths: ["모호한 제품 요구사항을 빠르게 실험 가능한 기능으로 바꿉니다."]
};

export const aiCompanyFixture: Company = {
  companyName: "Agent Works",
  companyDescription: "업무 자동화 SaaS를 만드는 팀",
  jobTitle: "AI Product Engineer",
  jobDescription: "LLM 기능을 제품 경험으로 연결합니다.",
  requirements: [
    "LLM 기능을 제품에 적용한 경험",
    "Next.js 기반 서비스 개발 경험",
    "기획/디자인 협업 경험"
  ],
  preferredSkills: ["Python 경험", "프롬프트 실험 경험"],
  techStack: ["Next.js", "TypeScript", "Python", "OpenAI API"]
};

export const introGuidanceCases: IntroGuidanceGoldenCase[] = [
  {
    name: "frontend-saas",
    resume: frontendResumeFixture,
    company: frontendCompanyFixture,
    expected: {
      roleOverlap: ["frontend"],
      matchedSkills: ["React", "TypeScript", "Next.js"],
      requiredTargets: ["React 기반 서비스 개발 경험", "TypeScript 활용 능력", "협업 중심 개발 문화 적응"],
      preferredTargets: ["Next.js 경험"],
      gapCandidates: ["GraphQL"]
    }
  },
  {
    name: "frontend-metrics",
    resume: frontendResumeFixture,
    company: frontendMetricsCompanyFixture,
    expected: {
      roleOverlap: ["frontend"],
      matchedSkills: ["React", "TypeScript", "TanStack Query"],
      requiredTargets: ["대시보드 성능 개선 경험", "TypeScript 활용 능력", "기획/디자인 협업 경험"],
      preferredTargets: ["TanStack Query 경험"],
      gapCandidates: ["Amplitude", "A/B 테스트 경험"]
    }
  },
  {
    name: "backend-platform",
    resume: backendResumeFixture,
    company: backendCompanyFixture,
    expected: {
      roleOverlap: ["backend", "engineer"],
      matchedSkills: ["Node.js", "TypeScript"],
      requiredTargets: ["Node.js 기반 API 개발 경험"],
      gapCandidates: ["AWS", "Kafka", "AWS 운영 경험"]
    }
  },
  {
    name: "data-pipeline",
    resume: dataResumeFixture,
    company: dataCompanyFixture,
    expected: {
      roleOverlap: ["data", "engineer"],
      matchedSkills: ["Python", "SQL", "Airflow"],
      requiredTargets: [
        "Python 기반 데이터 파이프라인 구축 경험",
        "SQL 성능 최적화 경험",
        "데이터 조직 협업 능력"
      ],
      gapCandidates: ["dbt", "Snowflake"]
    }
  },
  {
    name: "mobile-commerce",
    resume: mobileResumeFixture,
    company: mobileCompanyFixture,
    expected: {
      roleOverlap: ["mobile", "engineer"],
      matchedSkills: ["React Native", "TypeScript", "Firebase"],
      requiredTargets: ["React Native 기반 앱 개발 경험", "사용자 이벤트 분석 경험", "앱 출시 프로세스 개선 경험"],
      preferredTargets: ["Firebase 활용 경험"],
      gapCandidates: ["Fastlane"]
    }
  },
  {
    name: "ai-product",
    resume: aiResumeFixture,
    company: aiCompanyFixture,
    expected: {
      roleOverlap: ["engineer"],
      matchedSkills: ["Next.js", "TypeScript", "OpenAI API"],
      requiredTargets: ["LLM 기능을 제품에 적용한 경험", "Next.js 기반 서비스 개발 경험", "기획/디자인 협업 경험"],
      preferredTargets: ["프롬프트 실험 경험"],
      gapCandidates: ["Python"]
    }
  }
];
