import { describe, expect, it } from "vitest";

import {
  getIntroRefreshReasons,
  isIntroFresh,
  type PipelineState
} from "@/entities/pipeline/model/pipeline-context";
import { serializeResume, serializeResumeIntroSnapshot } from "@/entities/resume/model/resume-utils";

const baseState: PipelineState = {
  agentSettings: {
    model: "",
    modelReasoningEffort: "medium"
  },
  introTone: "balanced",
  pdfTemplateId: "classic",
  pdfThemeId: "cobalt",
  pdfCustomAccentHex: "",
  resumeInputMode: "text",
  companyInputMode: "text",
  resumeText: "",
  resumeUrl: "",
  companyUrl: "",
  companyText: "",
  resumeJsonText: "",
  companyJsonText: "",
  resumeConfirmedJson: null,
  companyConfirmedJson: null,
  resumeSavedAt: null,
  companySavedAt: null,
  introSavedAt: null,
  intro: null,
  previousIntro: null,
  introSource: null,
  currentTask: null,
  isCancellingTask: false,
  taskStartedAt: null,
  message: "",
  error: "",
  logs: []
};

describe("pipeline intro freshness helpers", () => {
  it("소개글이 없으면 stale 이유를 만들지 않는다", () => {
    expect(getIntroRefreshReasons(baseState)).toEqual([]);
    expect(isIntroFresh(baseState)).toBe(false);
  });

  it("이력서와 공고가 바뀌면 각각 이유를 돌려준다", () => {
    const state: PipelineState = {
      ...baseState,
      resumeConfirmedJson: '{"name":"new"}',
      companyConfirmedJson: '{"companyName":"new"}',
      intro: {
        oneLineIntro: "한 줄",
        shortIntro: "짧은 소개",
        longIntro: "긴 소개",
        fitReasons: [],
        matchedSkills: [],
        gapNotes: [],
        missingButRelevant: []
      },
      introSource: {
        resumeConfirmedJson: '{"name":"old"}',
        companyConfirmedJson: '{"companyName":"old"}'
      }
    };

    expect(isIntroFresh(state)).toBe(false);
    expect(getIntroRefreshReasons(state)).toEqual([
      {
        key: "resume",
        message: "이력서가 바뀌었어요."
      },
      {
        key: "company",
        message: "공고가 바뀌었어요."
      }
    ]);
  });

  it("확정 JSON이 사라지면 다시 저장 안내를 돌려준다", () => {
    const state: PipelineState = {
      ...baseState,
      intro: {
        oneLineIntro: "한 줄",
        shortIntro: "짧은 소개",
        longIntro: "긴 소개",
        fitReasons: [],
        matchedSkills: [],
        gapNotes: [],
        missingButRelevant: []
      },
      introSource: {
        resumeConfirmedJson: '{"name":"saved"}',
        companyConfirmedJson: '{"companyName":"saved"}'
      }
    };

    expect(getIntroRefreshReasons(state)).toEqual([
      {
        key: "resume",
        message: "이력서를 다시 저장해 주세요."
      },
      {
        key: "company",
        message: "공고를 다시 저장해 주세요."
      }
    ]);
  });

  it("PDF 전용 이력서 필드만 바뀌면 소개글은 여전히 최신으로 본다", () => {
    const baseResume = {
      name: "홍길동",
      headline: "",
      summary: "백엔드 개발자",
      desiredPosition: "Backend Engineer",
      careerYears: 3,
      careerDurationText: "",
      contacts: [],
      techStack: ["TypeScript", "Node.js"],
      experience: [],
      projects: [
        {
          name: "프로젝트",
          description: "설명",
          subtitle: "",
          link: "",
          linkLabel: "",
          techStack: ["TypeScript"],
          highlights: []
        }
      ],
      achievements: [],
      pdfHighlights: [],
      strengths: [],
      pdfStrengths: []
    };

    const pdfEditedResume = {
      ...baseResume,
      headline: "원인을 구조적으로 해결하는 개발자",
      contacts: [{ label: "GitHub", value: "github.com/example", url: "https://github.com/example" }],
      projects: [
        {
          ...baseResume.projects[0],
          subtitle: "채용 공고 통합 플랫폼",
          link: "https://github.com/example/project",
          linkLabel: "github.com/example/project",
          highlights: ["확장 가능한 구조로 크롤러를 분리했습니다."]
        }
      ]
    };

    const state: PipelineState = {
      ...baseState,
      resumeConfirmedJson: serializeResume(pdfEditedResume),
      companyConfirmedJson: '{"companyName":"saved"}',
      intro: {
        oneLineIntro: "한 줄",
        shortIntro: "짧은 소개",
        longIntro: "긴 소개",
        fitReasons: [],
        matchedSkills: [],
        gapNotes: [],
        missingButRelevant: []
      },
      introSource: {
        resumeConfirmedJson: serializeResumeIntroSnapshot(baseResume),
        companyConfirmedJson: '{"companyName":"saved"}'
      }
    };

    expect(isIntroFresh(state)).toBe(true);
    expect(getIntroRefreshReasons(state)).toEqual([]);
  });
});
