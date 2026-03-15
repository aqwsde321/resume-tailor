"use client";

import type { PipelineLog } from "@/lib/types";

export type StepKey = "resume" | "company" | "result" | "pdf";
export type StepRoute = "/resume" | "/company" | "/result" | "/pdf";
export type StepStatus = "blocked" | "locked" | "ready" | "working" | "done";
export type BusyStageKey = "prepare" | "analyze" | "finalize";

export const LIVE_MODAL_CLOSE_MS = 220;

export const TASK_LABEL: Record<"resume" | "company" | "intro", string> = {
  resume: "이력서 정리",
  company: "공고 정리",
  intro: "소개글 만들기"
};

export const PHASE_LABEL: Record<string, string> = {
  start: "준비",
  config: "설정",
  thread: "세션",
  turn: "분석",
  reasoning: "해석",
  command: "명령",
  mcp: "도구",
  search: "검색",
  plan: "계획",
  patch: "산출물",
  response: "응답",
  error: "오류",
  unknown: "기타"
};

export const LEVEL_LABEL: Record<PipelineLog["level"], string> = {
  info: "진행",
  success: "완료",
  error: "오류"
};

const ANALYSIS_PHASES = new Set(["turn", "reasoning", "command", "mcp", "search", "plan"]);
const FINALIZE_PHASES = new Set(["patch", "response"]);

export const TASK_PROGRESS_LABELS: Record<
  "resume" | "company" | "intro",
  Record<BusyStageKey, string>
> = {
  resume: {
    prepare: "입력 준비",
    analyze: "이력서 분석",
    finalize: "결과 준비"
  },
  company: {
    prepare: "입력 준비",
    analyze: "공고 분석",
    finalize: "결과 준비"
  },
  intro: {
    prepare: "입력 준비",
    analyze: "근거 연결",
    finalize: "소개글 생성"
  }
};

export function getBusyStage(task: "resume" | "company" | "intro", logs: PipelineLog[]): BusyStageKey {
  const taskLogs = logs.filter((log) => log.task === task);

  if (taskLogs.some((log) => FINALIZE_PHASES.has(log.phase))) {
    return "finalize";
  }

  if (taskLogs.some((log) => ANALYSIS_PHASES.has(log.phase))) {
    return "analyze";
  }

  return "prepare";
}

export function getBusyProgressValue(stage: BusyStageKey): number {
  switch (stage) {
    case "analyze":
      return 58;
    case "finalize":
      return 88;
    default:
      return 22;
  }
}
