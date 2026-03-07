import { describe, expect, it } from "vitest";

import {
  getIntroRefreshReasons,
  isIntroFresh,
  type PipelineState
} from "@/lib/pipeline-context";

const baseState: PipelineState = {
  agentSettings: {
    model: "",
    modelReasoningEffort: "medium"
  },
  introTone: "balanced",
  resumeInputMode: "text",
  companyInputMode: "text",
  resumeText: "",
  companyUrl: "",
  companyText: "",
  resumeJsonText: "",
  companyJsonText: "",
  resumeConfirmedJson: null,
  companyConfirmedJson: null,
  intro: null,
  previousIntro: null,
  introSource: null,
  currentTask: null,
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
});
