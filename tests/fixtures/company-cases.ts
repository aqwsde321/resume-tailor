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

export type CompanyRouteGoldenCase = {
  name: string;
  sourceText: string;
  generated: Company;
  expected: {
    companyName: string;
    jobTitle: string;
    requirements: string[];
    preferredSkills: string[];
    techStack: string[];
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
  },
  {
    name: "전형 절차와 근무 조건 안내를 배열에서 제거한다",
    input: {
      companyName: "Order Planet",
      companyDescription: "커머스 주문 플랫폼",
      jobTitle: "Backend Engineer",
      jobDescription: "주문 처리 API를 개발합니다.",
      requirements: [
        "지원 자격: Java 또는 Kotlin 기반 서버 개발 경험",
        "근무형태 정규직(수습 3개월)",
        "근무지 서울 강남구",
        "전형 절차 서류전형 > 1차 면접 > 최종합격"
      ],
      preferredSkills: ["우대 사항: Kafka 운영 경험", "연봉 면접 후 결정"],
      techStack: ["Java", "Kotlin", "근무지 서울", "연봉 협의"]
    },
    expected: {
      requirements: ["Java 또는 Kotlin 기반 서버 개발 경험"],
      requirementsExcludes: ["근무형태", "근무지", "전형 절차", "최종합격"],
      preferredSkills: ["Kafka 운영 경험"],
      preferredExcludes: ["연봉"],
      techStack: ["Java", "Kotlin"]
    }
  },
  {
    name: "jobDescription에서 전형과 복지 이후 문구를 제거한다",
    input: {
      companyName: "Pay Flow",
      companyDescription: "결제 인프라를 만듭니다.",
      jobTitle: "Platform Engineer",
      jobDescription:
        "서비스 백엔드 API를 개발합니다. 대용량 결제 트래픽을 안정화합니다. 채용 절차 서류전형 > 과제 > 면접 복리후생 식대 제공",
      requirements: ["Java 개발 경험"],
      preferredSkills: ["MSA 경험"],
      techStack: ["Java", "Kafka"]
    },
    expected: {
      jobDescriptionIncludes: ["서비스 백엔드 API를 개발합니다.", "대용량 결제 트래픽을 안정화합니다."],
      jobDescriptionExcludes: ["채용 절차", "복리후생", "식대"]
    }
  },
  {
    name: "영문 marker와 plus 표현을 다시 분류한다",
    input: {
      companyName: "Global Stack",
      companyDescription: "글로벌 SaaS",
      jobTitle: "Frontend Engineer",
      jobDescription: "웹 제품 화면을 개발합니다.",
      requirements: ["Nice to have: Redis 운영 경험", "Must have: TypeScript 실무 경험"],
      preferredSkills: ["Preferred: GraphQL 경험", "Required: React 서비스 개발 경험", "Plus: Storybook 사용 경험"],
      techStack: ["TypeScript", "React", "GraphQL"]
    },
    expected: {
      requirements: ["TypeScript 실무 경험", "React 서비스 개발 경험"],
      preferredSkills: ["Redis 운영 경험", "GraphQL 경험", "Storybook 사용 경험"]
    }
  },
  {
    name: "지원방법과 접수 문구를 배열과 스택에서 제거한다",
    input: {
      companyName: "Mobile Loop",
      companyDescription: "모바일 금융 서비스",
      jobTitle: "App Engineer",
      jobDescription: "모바일 앱 기능을 개발합니다.",
      requirements: [
        "React Native 앱 개발 경험",
        "접수기간 2026.03.01~2026.03.15",
        "지원방법 홈페이지 지원"
      ],
      preferredSkills: ["Firebase 경험", "채용 시 마감"],
      techStack: ["React Native", "Firebase", "즉시 지원"]
    },
    expected: {
      requirements: ["React Native 앱 개발 경험"],
      requirementsExcludes: ["접수기간", "지원방법"],
      preferredSkills: ["Firebase 경험"],
      preferredExcludes: ["채용 시 마감"],
      techStack: ["React Native", "Firebase"]
    }
  },
  {
    name: "혼합 구분자와 중복 tech stack을 정리한다",
    input: {
      companyName: "Deploy Hub",
      companyDescription: "배포 자동화 플랫폼",
      jobTitle: "DevOps Engineer",
      jobDescription: "CI/CD 파이프라인을 운영합니다.",
      requirements: ["클라우드 인프라 운영 경험"],
      preferredSkills: ["관측성 도구 운영 경험"],
      techStack: ["AWS EC2 · RDS · S3", "GitHub Actions | CodeDeploy", "Docker / Kubernetes", "AWS EC2"]
    },
    expected: {
      techStack: ["AWS EC2", "RDS", "S3", "GitHub Actions", "CodeDeploy", "Docker", "Kubernetes"]
    }
  },
  {
    name: "학력과 경력 요구는 유지하고 혜택 문구만 제거한다",
    input: {
      companyName: "Insight Labs",
      companyDescription: "B2B 데이터 제품",
      jobTitle: "Data Engineer",
      jobDescription: "분석 파이프라인을 구축합니다.",
      requirements: ["학사 이상 또는 그에 준하는 경험", "백엔드 개발 경력 3년 이상", "식대 지원"],
      preferredSkills: ["Airflow 경험", "건강검진 지원"],
      techStack: ["Python", "Airflow", "BigQuery"]
    },
    expected: {
      requirements: ["학사 이상 또는 그에 준하는 경험", "백엔드 개발 경력 3년 이상"],
      requirementsExcludes: ["식대 지원"],
      preferredSkills: ["Airflow 경험"],
      preferredExcludes: ["건강검진 지원"],
      techStack: ["Python", "Airflow", "BigQuery"]
    }
  }
];

export const companyRouteCases: CompanyRouteGoldenCase[] = [
  {
    name: "원티드 정적 HTML 기반 공고도 요건과 스택을 정리한다",
    sourceText: [
      "원티드랩 - 백엔드 엔지니어 | 원티드",
      "주요 업무",
      "Java와 Kotlin 기반 결제 API를 개발합니다.",
      "대용량 트래픽 환경에서 서비스 안정성을 개선합니다.",
      "자격 요건",
      "백엔드 개발 경력 3년 이상",
      "Spring Boot 기반 서비스 개발 경험",
      "RDBMS 설계 및 성능 최적화 경험",
      "우대 사항",
      "AWS 운영 경험",
      "MSA 환경 경험",
      "기술 스택",
      "Java, Kotlin, Spring Boot, MySQL, Redis"
    ].join("\n"),
    generated: {
      companyName: " 원티드랩 ",
      companyDescription: "채용 플랫폼을 운영합니다.",
      jobTitle: "백엔드 엔지니어",
      jobDescription:
        "Java와 Kotlin 기반 결제 API를 개발합니다. 대용량 트래픽 환경에서 서비스 안정성을 개선합니다. 지원 방법 홈페이지 지원",
      requirements: [
        "백엔드 개발 경력 3년 이상",
        "필수 조건: Spring Boot 기반 서비스 개발 경험",
        "RDBMS 설계 및 성능 최적화 경험",
        "지원방법 홈페이지 지원"
      ],
      preferredSkills: ["우대 사항: AWS 운영 경험", "MSA 환경 경험", "복지 포인트 지급"],
      techStack: ["Java, Kotlin, Spring Boot, MySQL, Redis", "Redis"]
    },
    expected: {
      companyName: "원티드랩",
      jobTitle: "백엔드 엔지니어",
      requirements: [
        "백엔드 개발 경력 3년 이상",
        "Spring Boot 기반 서비스 개발 경험",
        "RDBMS 설계 및 성능 최적화 경험"
      ],
      preferredSkills: ["AWS 운영 경험", "MSA 환경 경험"],
      techStack: ["Java", "Kotlin", "Spring Boot", "MySQL", "Redis"],
      jobDescriptionIncludes: ["Java와 Kotlin 기반 결제 API를 개발합니다.", "대용량 트래픽 환경에서 서비스 안정성을 개선합니다."],
      jobDescriptionExcludes: ["지원 방법"]
    }
  },
  {
    name: "점핏 정적 HTML 기반 공고도 오분류와 잡음을 정리한다",
    sourceText: [
      "카카오스타일 - 백엔드 개발자 | 점핏",
      "주요 업무",
      "주문/정산 도메인 백엔드 서비스를 개발합니다.",
      "자격 요건",
      "Java 또는 Kotlin 기반 서버 개발 경험",
      "RDBMS 설계 및 운영 경험",
      "우대 사항",
      "Kafka 운영 경험",
      "기술 스택",
      "Java, Kotlin, Spring Boot, MySQL, Kafka"
    ].join("\n"),
    generated: {
      companyName: "카카오스타일",
      companyDescription: "패션 플랫폼 팀입니다.",
      jobTitle: "백엔드 개발자",
      jobDescription:
        "주문/정산 도메인 백엔드 서비스를 개발합니다. 채용 절차 서류전형 > 1차 인터뷰 > 최종합격",
      requirements: ["자격 요건: Java 또는 Kotlin 기반 서버 개발 경험", "RDBMS 설계 및 운영 경험", "식대 지원"],
      preferredSkills: ["Required: Spring Boot 실무 경험", "우대 사항: Kafka 운영 경험", "채용 시 마감"],
      techStack: ["Java | Kotlin | Spring Boot | MySQL | Kafka", "즉시 지원"]
    },
    expected: {
      companyName: "카카오스타일",
      jobTitle: "백엔드 개발자",
      requirements: ["Java 또는 Kotlin 기반 서버 개발 경험", "RDBMS 설계 및 운영 경험", "Spring Boot 실무 경험"],
      preferredSkills: ["Kafka 운영 경험"],
      techStack: ["Java", "Kotlin", "Spring Boot", "MySQL", "Kafka"],
      jobDescriptionIncludes: ["주문/정산 도메인 백엔드 서비스를 개발합니다."],
      jobDescriptionExcludes: ["채용 절차", "최종합격"]
    }
  }
];
