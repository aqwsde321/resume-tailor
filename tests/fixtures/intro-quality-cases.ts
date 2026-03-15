import type { Company, Intro, IntroTone, Resume } from "@/shared/lib/types";

import {
  aiCompanyFixture,
  aiResumeFixture,
  backendCompanyFixture,
  backendResumeFixture,
  dataCompanyFixture,
  dataResumeFixture,
  frontendCompanyFixture,
  frontendMetricsCompanyFixture,
  frontendResumeFixture
} from "./intro-cases";

export type IntroQualityPassCase = {
  name: string;
  tone: IntroTone;
  toneCue: string;
  resume: Resume;
  company: Company;
  intro: Intro;
  mustMentionInShort: string[];
  mustMentionInLong: string[];
  forbiddenPhrases: string[];
};

export type IntroQualityFailCase = {
  name: string;
  resume: Resume;
  company: Company;
  intro: Intro;
  expectedIssueCodes: string[];
};

export const introQualityPassCases: IntroQualityPassCase[] = [
  {
    name: "frontend-saas-balanced",
    tone: "balanced",
    toneCue: "담백하고 사실 중심",
    resume: frontendResumeFixture,
    company: frontendCompanyFixture,
    intro: {
      oneLineIntro: "React 기반 SaaS 프론트엔드 엔지니어",
      shortIntro:
        "React 기반 서비스 개발 경험과 TypeScript 활용 능력을 바탕으로 채용 SaaS 화면을 개선해 온 프론트엔드 엔지니어입니다. 실제 프로젝트에서 운영 화면을 빠르게 구조화하고 사용자 흐름을 정리해 왔습니다.",
      longIntro:
        "React 기반 서비스 개발 경험과 TypeScript 활용 능력을 바탕으로 채용 SaaS 운영 화면을 개선해 온 프론트엔드 엔지니어입니다. Alpha SaaS에서 기획, 디자인과 함께 채용 운영 대시보드를 개발하며 협업 중심 개발 문화 적응이 필요한 환경에서도 요구사항을 빠르게 화면 구조로 옮겼습니다. 또한 Next.js와 TanStack Query로 관리자 도구를 구축하며 데이터 흐름을 정리했고, 초기 로딩 시간을 35% 줄여 제품 사용성을 개선했습니다. 이런 경험을 바탕으로 입사 후에도 채용 운영 제품의 복잡한 요구사항을 빠르게 이해하고, React 기반 서비스 개발 경험이 필요한 화면 개선 과제를 안정적으로 추진하겠습니다.",
      fitReasons: [
        "React 기반 서비스 개발 경험을 실제 운영 화면 개선 프로젝트로 설명할 수 있습니다.",
        "TypeScript 활용 능력을 Next.js 관리자 도구 개발 경험으로 연결할 수 있습니다."
      ],
      matchedSkills: ["React", "TypeScript", "Next.js"],
      gapNotes: ["GraphQL 사용 경험은 이력서에서 직접 확인되지 않습니다."],
      missingButRelevant: []
    },
    mustMentionInShort: ["React 기반 서비스 개발 경험", "TypeScript 활용 능력"],
    mustMentionInLong: ["React 기반 서비스 개발 경험", "TypeScript 활용 능력", "협업 중심 개발 문화 적응"],
    forbiddenPhrases: ["세계 최고", "모든 기술을 완벽하게"]
  },
  {
    name: "frontend-metrics-collaborative",
    tone: "collaborative",
    toneCue: "협업, 조율, 커뮤니케이션",
    resume: frontendResumeFixture,
    company: frontendMetricsCompanyFixture,
    intro: {
      oneLineIntro: "지표 기반 협업에 강한 프론트엔드 엔지니어",
      shortIntro:
        "대시보드 성능 개선 경험과 TypeScript 활용 능력을 바탕으로 기획, 디자인과 함께 제품 화면을 개선해 온 프론트엔드 엔지니어입니다. 지표를 함께 해석하며 화면 구조를 빠르게 조정하는 협업에 익숙합니다.",
      longIntro:
        "대시보드 성능 개선 경험과 TypeScript 활용 능력을 바탕으로 제품 지표를 빠르게 실험해 온 프론트엔드 엔지니어입니다. Alpha SaaS에서 기획, 디자인과 함께 채용 운영 대시보드를 개발하며 기획/디자인 협업 경험이 필요한 환경에서도 요구사항을 빠르게 정리하고 화면 구조를 조정했습니다. 또한 Next.js와 TanStack Query 기반 관리자 도구를 운영하며 데이터 흐름을 단순화했고, 초기 로딩 시간을 35% 줄여 대시보드 성능 개선 경험을 실제 수치로 만들었습니다. 이런 협업 경험을 바탕으로 입사 후에도 실험과 전환 지표를 함께 해석하면서 TypeScript 기반 제품 화면 개선을 안정적으로 이어가겠습니다.",
      fitReasons: [
        "대시보드 성능 개선 경험을 실제 로딩 시간 개선 성과로 설명할 수 있습니다.",
        "기획/디자인 협업 경험을 운영 대시보드 개발 사례와 함께 제시할 수 있습니다."
      ],
      matchedSkills: ["React", "TypeScript", "TanStack Query"],
      gapNotes: ["A/B 테스트 경험은 이력서에서 직접 확인되지 않습니다."],
      missingButRelevant: []
    },
    mustMentionInShort: ["대시보드 성능 개선 경험", "TypeScript 활용 능력"],
    mustMentionInLong: ["대시보드 성능 개선 경험", "기획/디자인 협업 경험"],
    forbiddenPhrases: ["무조건", "압도적으로"]
  },
  {
    name: "backend-api-confident",
    tone: "confident",
    toneCue: "성과와 강점을 분명하게",
    resume: backendResumeFixture,
    company: backendCompanyFixture,
    intro: {
      oneLineIntro: "문제 해결에 강한 백엔드 엔지니어",
      shortIntro:
        "Node.js 기반 API 개발 경험과 문제 해결 역량을 바탕으로 운영 API를 안정적으로 개선해 온 백엔드 엔지니어입니다. 실제 서비스에서 장애 원인을 추적하고 재발 방지 기준을 남겨 왔습니다.",
      longIntro:
        "Node.js 기반 API 개발 경험과 문제 해결 역량을 바탕으로 운영 API를 안정적으로 개선해 온 백엔드 엔지니어입니다. Data Loop에서 Node.js API와 배치 작업을 운영하며 장애 원인을 추적했고, 문제 해결 역량이 필요한 이슈를 재현과 문서화로 정리해 평균 응답 시간을 40% 개선했습니다. 또한 TypeScript와 PostgreSQL로 정산 API를 재구성하고 Docker 배포 흐름을 정리하며 운영 기준을 다시 세웠습니다. AWS 운영 경험은 직접적인 강점으로 말할 수 없지만, 입사 후에는 이미 익숙한 Node.js 기반 API 개발 경험과 구조적인 문제 해결 방식으로 대규모 API 운영 안정화에 빠르게 기여하겠습니다.",
      fitReasons: [
        "Node.js 기반 API 개발 경험을 실제 운영 API 개선 성과로 설명할 수 있습니다.",
        "문제 해결 역량을 장애 재현과 재발 방지 문서화 경험으로 연결할 수 있습니다."
      ],
      matchedSkills: ["Node.js", "TypeScript"],
      gapNotes: ["AWS 운영 경험은 이력서에서 직접 확인되지 않습니다."],
      missingButRelevant: []
    },
    mustMentionInShort: ["Node.js 기반 API 개발 경험"],
    mustMentionInLong: ["Node.js 기반 API 개발 경험"],
    forbiddenPhrases: ["완벽하게 모든", "무한하게"]
  },
  {
    name: "data-pipeline-problem-solving",
    tone: "problemSolving",
    toneCue: "문제를 구조화하고 개선한 경험",
    resume: dataResumeFixture,
    company: dataCompanyFixture,
    intro: {
      oneLineIntro: "데이터 파이프라인 문제 해결형 엔지니어",
      shortIntro:
        "Python 기반 데이터 파이프라인 구축 경험과 SQL 성능 최적화 경험을 바탕으로 지표 신뢰도를 높여 온 데이터 엔지니어입니다. 배치 실패 원인을 구조적으로 정리하고 데이터 조직과 협업해 개선해 왔습니다.",
      longIntro:
        "Python 기반 데이터 파이프라인 구축 경험과 SQL 성능 최적화 경험을 바탕으로 지표 신뢰도를 높여 온 데이터 엔지니어입니다. Metric Lab에서 마케팅 팀과 함께 Airflow 배치를 운영하며 데이터 조직 협업 능력이 필요한 환경에서 요구사항을 정리했고, Python과 Airflow로 적재 DAG를 재구성해 배치 실패율을 60% 줄였습니다. 또 BigQuery 스키마를 표준화하고 SQL 기반 리포팅 병목을 정리해 SQL 성능 최적화 경험을 실제 운영 지표 개선으로 연결했습니다. 입사 후에도 데이터 파이프라인 문제를 구조화해 원인을 빠르게 좁히고, 데이터 조직 협업 능력을 바탕으로 지표 신뢰도를 높이는 개선을 이어가겠습니다.",
      fitReasons: [
        "Python 기반 데이터 파이프라인 구축 경험을 Airflow 적재 자동화 사례로 설명할 수 있습니다.",
        "SQL 성능 최적화 경험을 리포팅 병목 개선 사례와 직접 연결할 수 있습니다."
      ],
      matchedSkills: ["Python", "SQL", "Airflow"],
      gapNotes: ["dbt 경험은 이력서에서 직접 확인되지 않습니다."],
      missingButRelevant: []
    },
    mustMentionInShort: ["Python 기반 데이터 파이프라인 구축 경험", "SQL 성능 최적화 경험"],
    mustMentionInLong: ["Python 기반 데이터 파이프라인 구축 경험", "SQL 성능 최적화 경험", "데이터 조직 협업 능력"],
    forbiddenPhrases: ["마법처럼", "무조건 해결"]
  },
  {
    name: "ai-product-balanced",
    tone: "balanced",
    toneCue: "담백하고 사실 중심",
    resume: aiResumeFixture,
    company: aiCompanyFixture,
    intro: {
      oneLineIntro: "LLM 기능을 제품으로 연결해 온 엔지니어",
      shortIntro:
        "LLM 기능을 제품에 적용한 경험과 Next.js 기반 서비스 개발 경험을 바탕으로 업무 자동화 제품을 만들어 온 엔지니어입니다. 기획, 디자인과 함께 모호한 요구사항을 빠르게 기능으로 바꿔 왔습니다.",
      longIntro:
        "LLM 기능을 제품에 적용한 경험과 Next.js 기반 서비스 개발 경험을 바탕으로 업무 자동화 제품을 만들어 온 엔지니어입니다. Workflow Lab에서 사내 문서 요약 기능을 제품에 붙이며 LLM 기능을 제품에 적용한 경험이 필요한 환경에서 프롬프트 실험 로그를 관리했고, 기획/디자인 협업 경험이 필요한 과정에서도 요구사항을 빠르게 실험 가능한 기능으로 정리했습니다. 또한 Next.js와 OpenAI API로 자기소개 초안을 생성하는 내부 도구를 만들며 반복 문서 작업 시간을 주당 8시간 줄였습니다. 이런 경험을 바탕으로 입사 후에도 Next.js 기반 서비스 개발 경험과 제품 실험 흐름을 활용해 LLM 기능을 실제 사용자 경험으로 안정적으로 연결하겠습니다.",
      fitReasons: [
        "LLM 기능을 제품에 적용한 경험을 문서 요약 기능과 내부 도구 사례로 설명할 수 있습니다.",
        "Next.js 기반 서비스 개발 경험을 OpenAI API 제품 개발 경험과 함께 연결할 수 있습니다."
      ],
      matchedSkills: ["Next.js", "TypeScript", "OpenAI API"],
      gapNotes: ["Python 경험은 이력서에서 직접 확인되지 않습니다."],
      missingButRelevant: []
    },
    mustMentionInShort: ["LLM 기능을 제품에 적용한 경험", "Next.js 기반 서비스 개발 경험"],
    mustMentionInLong: ["LLM 기능을 제품에 적용한 경험", "Next.js 기반 서비스 개발 경험", "기획/디자인 협업 경험"],
    forbiddenPhrases: ["혁명적으로", "무한한"]
  }
];

export const introQualityFailCases: IntroQualityFailCase[] = [
  {
    name: "short-does-not-mention-requirement",
    resume: frontendResumeFixture,
    company: frontendCompanyFixture,
    intro: {
      oneLineIntro: "프론트엔드 엔지니어",
      shortIntro: "제품 화면을 개선해 온 프론트엔드 엔지니어입니다.",
      longIntro:
        "React 기반 서비스 개발 경험을 바탕으로 제품 화면을 개선해 왔습니다. TypeScript 활용 능력을 관리자 도구 개발 경험으로 연결할 수 있습니다. 협업 중심 개발 문화 적응이 필요한 환경에서도 요구사항을 빠르게 정리해 왔습니다.",
      fitReasons: [],
      matchedSkills: ["React"],
      gapNotes: [],
      missingButRelevant: []
    },
    expectedIssueCodes: ["short_missing_requirement_reference"]
  },
  {
    name: "long-does-not-cover-two-anchors",
    resume: frontendResumeFixture,
    company: frontendCompanyFixture,
    intro: {
      oneLineIntro: "프론트엔드 엔지니어",
      shortIntro:
        "React 기반 서비스 개발 경험을 바탕으로 제품 화면을 개선해 왔습니다.",
      longIntro:
        "React 기반 서비스 개발 경험을 바탕으로 제품 화면을 개선해 왔습니다. 운영 화면을 안정적으로 구현해 왔습니다.",
      fitReasons: [],
      matchedSkills: ["React", "TypeScript"],
      gapNotes: [],
      missingButRelevant: []
    },
    expectedIssueCodes: ["long_missing_anchor_coverage"]
  },
  {
    name: "long-repeats-same-sentence",
    resume: backendResumeFixture,
    company: backendCompanyFixture,
    intro: {
      oneLineIntro: "백엔드 엔지니어",
      shortIntro:
        "Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 온 백엔드 엔지니어입니다.",
      longIntro:
        "Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 온 백엔드 엔지니어입니다. Node.js 기반 API 개발 경험을 바탕으로 운영 API를 개선해 온 백엔드 엔지니어입니다. 문제 해결 역량을 바탕으로 장애 원인을 추적해 왔습니다.",
      fitReasons: [],
      matchedSkills: ["Node.js"],
      gapNotes: [],
      missingButRelevant: []
    },
    expectedIssueCodes: ["long_has_duplicate_sentence"]
  },
  {
    name: "long-is-not-richer-than-short",
    resume: aiResumeFixture,
    company: aiCompanyFixture,
    intro: {
      oneLineIntro: "AI 제품 엔지니어",
      shortIntro:
        "LLM 기능을 제품에 적용한 경험과 Next.js 기반 서비스 개발 경험을 가진 엔지니어입니다.",
      longIntro:
        "LLM 기능을 제품에 적용한 경험과 Next.js 기반 서비스 개발 경험을 가진 엔지니어입니다.",
      fitReasons: [],
      matchedSkills: ["Next.js", "OpenAI API"],
      gapNotes: [],
      missingButRelevant: []
    },
    expectedIssueCodes: ["long_not_richer_than_short"]
  },
  {
    name: "supplementary-fields-escape-guidance",
    resume: frontendResumeFixture,
    company: frontendCompanyFixture,
    intro: {
      oneLineIntro: "프론트엔드 엔지니어",
      shortIntro:
        "React 기반 서비스 개발 경험과 TypeScript 활용 능력을 바탕으로 제품 화면을 개선해 왔습니다.",
      longIntro:
        "React 기반 서비스 개발 경험과 TypeScript 활용 능력을 바탕으로 제품 화면을 개선해 왔습니다. 협업 중심 개발 문화 적응이 필요한 과정에서도 기획, 디자인과 함께 요구사항을 정리했습니다.",
      fitReasons: ["Rust 기반 인프라 개발 경험이 있어 적합합니다."],
      matchedSkills: ["React", "TypeScript"],
      gapNotes: ["Kubernetes 운영 경험이 필요합니다."],
      missingButRelevant: ["Rust 경험을 한 문장 더 넣어도 좋습니다."]
    },
    expectedIssueCodes: [
      "fit_reason_out_of_guidance",
      "gap_note_out_of_guidance",
      "missing_relevant_out_of_guidance"
    ]
  }
];
