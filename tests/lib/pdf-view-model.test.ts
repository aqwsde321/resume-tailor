import { describe, expect, it } from "vitest";

import { buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import type { Company, Intro, Resume } from "@/shared/lib/types";

const resumeFixture: Resume = {
  name: "홍길동",
  headline: "",
  summary: "Node.js와 TypeScript 기반 API를 설계해 온 백엔드 개발자입니다.\n\n장애 원인을 추적하고 재발 방지 기준을 정리해 왔습니다.",
  desiredPosition: "Backend Engineer",
  careerYears: 4,
  careerDurationText: "",
  contacts: [
    { label: "Email", value: "hong@example.com", url: "mailto:hong@example.com" },
    { label: "GitHub", value: "", url: "https://github.com/example" }
  ],
  techStack: ["Node.js", "PostgreSQL", "Docker", "Redis"],
  experience: [
    {
      company: "Acme",
      role: "Backend Engineer",
      period: "2022-2026",
      description: "정산 API와 배치 시스템을 운영했습니다."
    }
  ],
  projects: [
    {
      name: "정산 API 리뉴얼",
      description: "TypeScript 기반으로 정산 API를 재구성했습니다.",
      subtitle: "정산 플랫폼",
      link: "https://github.com/example/settlement",
      linkLabel: "",
      techStack: ["TypeScript", "Node.js", "PostgreSQL"],
      highlights: []
    }
  ],
  achievements: ["API 응답 시간을 40% 줄였습니다."],
  pdfHighlights: [],
  strengths: ["운영 이슈를 구조적으로 분석합니다."],
  pdfStrengths: []
};

const introFixture: Intro = {
  oneLineIntro: "문제 해결 중심의 백엔드 개발자",
  shortIntro: "짧은 소개",
  longIntro: "이번 공고에서 요구하는 API 안정성과 운영 경험에 직접 기여할 수 있습니다.",
  fitReasons: [],
  matchedSkills: [],
  gapNotes: [],
  missingButRelevant: []
};

const companyFixture: Company = {
  companyName: "Scale Infra",
  companyDescription: "B2B 인프라 팀",
  jobTitle: "Backend Engineer",
  jobDescription: "대규모 API를 운영합니다.",
  requirements: ["Node.js"],
  preferredSkills: ["Kafka"],
  techStack: ["Node.js", "PostgreSQL", "Docker"]
};

describe("buildTypstResumeDocument", () => {
  it("긴 소개글은 원문을 보존하면서 문단으로 나누고 웹 링크는 연락처와 분리한다", () => {
    const sentences = ["Node.js로 API를 개발했습니다.", "서비스 구조를 개선했습니다.", "배포를 자동화했습니다.", "운영 로그를 분석했습니다.", "성능을 검증했습니다."];
    const link = { label: "프로젝트", value: "API 도구", url: "https://example.com/api" };
    const document = buildTypstResumeDocument(
      { ...resumeFixture, contacts: [...resumeFixture.contacts, link] },
      { ...introFixture, longIntro: sentences.join(" ") },
      companyFixture
    );
    expect(document.sections[0]?.paragraphs).toEqual([
      sentences.slice(0, 2).join(" "), sentences.slice(2, 4).join(" "), sentences[4]
    ]);
    expect(document.primaryContacts.map(({ label }) => label)).toEqual(["Email"]);
    expect(document.contactLinks).toEqual([{ ...link, display: "프로젝트: API 도구" }]);
  });

  it("경력 설명의 문단과 프로젝트 목록을 분리하고 수동 줄바꿈을 유지한다", () => {
    const resume = {
      ...resumeFixture,
      experience: [{
        ...resumeFixture.experience[0],
        description: "API 설계\r\n배포 운영\r\n  \r\n운영 지표 검토"
      }],
      projects: [{
        ...resumeFixture.projects[0],
        description: "기능 구현\n- 데이터 수집\n* 오류 분석\n\n1. 시스템 검증\n2. 결과 정리"
      }]
    };
    const { experience, projects, sections } = buildTypstResumeDocument(
      resume,
      { ...introFixture, longIntro: "첫 줄\r\n둘째 줄\r\n\r\n다음 문단" },
      companyFixture
    );
    expect(experience[0]?.description).toEqual([
      { kind: "paragraph", lines: ["API 설계", "배포 운영"] },
      { kind: "paragraph", lines: ["운영 지표 검토"] }
    ]);
    expect(projects[0]?.description).toEqual([
      { kind: "paragraph", lines: ["기능 구현"] },
      { kind: "list", lines: ["데이터 수집", "오류 분석"] },
      { kind: "paragraph", lines: ["1. 시스템 검증", "2. 결과 정리"] }
    ]);
    expect(sections[0]?.paragraphs).toEqual(["첫 줄\n둘째 줄", "다음 문단"]);
  });

  it("PDF fallback 규칙을 적용해 문서를 만든다", () => {
    const document = buildTypstResumeDocument(resumeFixture, introFixture, companyFixture);

    expect(document.headline).toBe("문제 해결 중심의 백엔드 개발자");
    expect(document.careerDuration).toBe("4년");
    expect(document.contacts).toEqual([
      {
        label: "Email",
        value: "hong@example.com",
        url: "mailto:hong@example.com",
        display: "Email: hong@example.com"
      }
    ]);
    expect(document.sections).toHaveLength(1);
    expect(document.sections[0]).toMatchObject({
      id: "tailored-intro",
      title: "About Me"
    });
    expect(document.projects[0]?.linkLabel).toBe("https://github.com/example/settlement");
    expect(document.projects[0]?.meta).toBe("TypeScript · Node.js · PostgreSQL");
  });

  it("기술 스택을 PDF 그룹으로 자동 분류한다", () => {
    const document = buildTypstResumeDocument(resumeFixture, introFixture, companyFixture);

    expect(document.techGroups).toEqual([
      {
        label: "Frontend",
        items: []
      },
      {
        label: "Backend",
        items: ["Node.js"]
      },
      {
        label: "Database",
        items: ["PostgreSQL", "Redis"]
      },
      {
        label: "DevOps / Tool",
        items: ["Docker"]
      }
    ]);
  });

  it("프론트엔드 스택이 있으면 Frontend 그룹으로 자동 분류한다", () => {
    const document = buildTypstResumeDocument(
      {
        ...resumeFixture,
        techStack: ["React", "TypeScript", "Next.js", "Tailwind CSS", "PostgreSQL", "Docker"]
      },
      introFixture,
      companyFixture
    );

    expect(document.techGroups).toEqual([
      {
        label: "Frontend",
        items: ["React", "TypeScript", "Next.js", "Tailwind CSS"]
      },
      {
        label: "Backend",
        items: []
      },
      {
        label: "Database",
        items: ["PostgreSQL"]
      },
      {
        label: "DevOps / Tool",
        items: ["Docker"]
      }
    ]);
  });

  it("긴 소개가 비면 짧은 소개와 한 줄 소개로 순서대로 대체한다", () => {
    const shortFallback = buildTypstResumeDocument(
      resumeFixture,
      {
        ...introFixture,
        longIntro: "",
        shortIntro: "짧은 소개 fallback",
        oneLineIntro: "한 줄 소개 fallback"
      },
      companyFixture
    );

    const oneLineFallback = buildTypstResumeDocument(
      resumeFixture,
      {
        ...introFixture,
        longIntro: "",
        shortIntro: "",
        oneLineIntro: "한 줄 소개 fallback"
      },
      companyFixture
    );

    expect(shortFallback.sections[0]?.paragraphs).toEqual(["짧은 소개 fallback"]);
    expect(oneLineFallback.sections[0]?.paragraphs).toEqual(["한 줄 소개 fallback"]);
  });

  it("PDF override가 있으면 기본 성과와 강점 대신 우선 사용한다", () => {
    const document = buildTypstResumeDocument(
      {
        ...resumeFixture,
        pdfHighlights: ["PDF용 Highlights"],
        pdfStrengths: ["PDF용 Strengths"]
      },
      introFixture,
      companyFixture
    );

    expect(document.achievements).toEqual(["PDF용 Highlights"]);
    expect(document.strengths).toEqual(["PDF용 Strengths"]);
  });

  it("프로필 이미지가 있으면 PDF 전용 이미지 필드를 문서에 반영한다", () => {
    const document = buildTypstResumeDocument(
      {
        ...resumeFixture,
        pdfProfileImageDataUrl: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
        pdfProfileImageVisible: true
      },
      introFixture,
      companyFixture
    );

    expect(document.showProfileImage).toBe(true);
    expect(document.profileImageDataUrl).toBe("data:image/jpeg;base64,ZmFrZS1pbWFnZQ==");
    expect(document.profileImagePath).toBe("");
  });
});
