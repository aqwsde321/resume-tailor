import type { Company } from "@/lib/types";

export type CompanyNormalizationGoldenCase = {
  name: string;
  input: Company;
  expected: {
    requirements?: string[];
    requirementsExcludes?: string[];
    preferredSkills?: string[];
    preferredExcludes?: string[];
    techStack?: string[];
    companyDescriptionIncludes?: string[];
    companyDescriptionExcludes?: string[];
    jobDescriptionIncludes?: string[];
    jobDescriptionExcludes?: string[];
  };
};

export const companyNormalizationCases: CompanyNormalizationGoldenCase[] = [
  {
    name: "혜택과 중복을 제거하고 기술 스택을 분리한다",
    input: {
      companyName: "  Alpha Pay  ",
      companyDescription: "결제 플랫폼을 운영합니다.",
      jobTitle: " 백엔드 개발자 ",
      jobDescription: "PG 시스템을 개발합니다.",
      requirements: [
        "- Java 기반 서버 개발 경험",
        "필수 조건: Java 기반 서버 개발 경험",
        "식대 지원",
        "유연근무제 운영"
      ],
      preferredSkills: ["우대 사항: Spring Boot 경험", "복지 포인트 지급"],
      techStack: ["Java, Spring Boot, Oracle", "Java", " Oracle "]
    },
    expected: {
      requirements: ["Java 기반 서버 개발 경험"],
      requirementsExcludes: ["식대 지원", "유연근무제 운영"],
      preferredSkills: ["Spring Boot 경험"],
      preferredExcludes: ["복지 포인트 지급"],
      techStack: ["Java", "Spring Boot", "Oracle"]
    }
  },
  {
    name: "필수와 우대가 잘못 들어가면 다시 분류한다",
    input: {
      companyName: "Infra Works",
      companyDescription: "B2B SaaS 회사",
      jobTitle: "Backend Engineer",
      jobDescription: "API를 운영합니다.",
      requirements: ["우대 사항: Kafka 운영 경험", "Node.js API 개발 경험"],
      preferredSkills: ["필수 조건: AWS 운영 경험", "Docker 경험"],
      techStack: ["Node.js / TypeScript", "AWS"]
    },
    expected: {
      requirements: ["Node.js API 개발 경험", "AWS 운영 경험"],
      preferredSkills: ["Kafka 운영 경험", "Docker 경험"],
      techStack: ["Node.js", "TypeScript", "AWS"]
    }
  },
  {
    name: "잡음이 섞인 설명문을 잘라낸다",
    input: {
      companyName: "Hiring Cloud",
      companyDescription:
        "채용 SaaS를 운영합니다. 로그인하고 비슷한 조건의 AI추천공고를 확인해 보세요!",
      jobTitle: "Frontend Engineer",
      jobDescription:
        "모집요강 채용 운영 제품을 개선합니다. 본 채용정보는 잡코리아의 동의없이 무단전재할 수 없습니다.",
      requirements: ["React 기반 서비스 개발 경험"],
      preferredSkills: ["Next.js 경험"],
      techStack: ["React", "Next.js"]
    },
    expected: {
      companyDescriptionIncludes: ["채용 SaaS를 운영합니다."],
      companyDescriptionExcludes: ["AI추천공고"],
      jobDescriptionIncludes: ["채용 운영 제품을 개선합니다."],
      jobDescriptionExcludes: ["무단전재"]
    }
  },
  {
    name: "마크다운 불릿과 줄바꿈을 정리한다",
    input: {
      companyName: "Data Loop",
      companyDescription: "데이터 분석 플랫폼",
      jobTitle: "Data Engineer",
      jobDescription: "지표 파이프라인을 운영합니다.",
      requirements: [
        "* Python 기반 데이터 파이프라인 구축 경험\n* SQL 최적화 경험",
        "• Airflow 운영 경험"
      ],
      preferredSkills: ["- dbt 경험\n- Snowflake 사용 경험"],
      techStack: ["Python\nSQL\nAirflow", "dbt | Snowflake"]
    },
    expected: {
      requirements: [
        "Python 기반 데이터 파이프라인 구축 경험",
        "SQL 최적화 경험",
        "Airflow 운영 경험"
      ],
      preferredSkills: ["dbt 경험", "Snowflake 사용 경험"],
      techStack: ["Python", "SQL", "Airflow", "dbt", "Snowflake"]
    }
  },
  {
    name: "채용 사이트 잔여 문구를 배열에서 제거한다",
    input: {
      companyName: "Pocket Retail",
      companyDescription: "모바일 커머스 팀",
      jobTitle: "Mobile Engineer",
      jobDescription: "모바일 제품을 개선합니다.",
      requirements: [
        "React Native 기반 앱 개발 경험",
        "마감일은 기업의 사정으로 인해 조기 마감 또는 변경될 수 있습니다"
      ],
      preferredSkills: [
        "Firebase 활용 경험",
        "로그인하고 비슷한 조건의 AI추천공고를 확인해 보세요!"
      ],
      techStack: ["React Native", "TypeScript", "홈페이지 지원"]
    },
    expected: {
      requirements: ["React Native 기반 앱 개발 경험"],
      requirementsExcludes: ["마감일은 기업의 사정으로 인해 조기 마감 또는 변경될 수 있습니다"],
      preferredSkills: ["Firebase 활용 경험"],
      preferredExcludes: ["AI추천공고"],
      techStack: ["React Native", "TypeScript"]
    }
  }
];
