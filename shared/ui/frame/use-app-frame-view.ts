"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { type FrameStepItem } from "@/shared/ui/frame/frame-shell";
import {
  type BusyStageKey,
  getBusyProgressValue,
  getBusyStage,
  LIVE_MODAL_CLOSE_MS,
  type StepKey,
  type StepRoute,
  type StepStatus,
  TASK_LABEL,
  TASK_PROGRESS_LABELS
} from "@/shared/ui/frame/frame-meta";
import { formatSavedAt } from "@/shared/lib/date-format";
import { getIntroRefreshReasons, isIntroFresh, usePipeline } from "@/entities/pipeline/model/pipeline-context";
import type { TaskKind } from "@/shared/lib/types";

interface LiveModalState {
  isClosing: boolean;
  task: TaskKind | null;
}

type LiveModalAction =
  | { type: "show"; task: TaskKind }
  | { type: "start-closing" }
  | { type: "reset" };

function liveModalReducer(state: LiveModalState, action: LiveModalAction): LiveModalState {
  switch (action.type) {
    case "show":
      return {
        isClosing: false,
        task: action.task
      };
    case "start-closing":
      if (!state.task) {
        return state;
      }

      return {
        ...state,
        isClosing: true
      };
    case "reset":
      return {
        isClosing: false,
        task: null
      };
    default:
      return state;
  }
}

export function useAppFrameView(step: StepKey) {
  const { hydrated, state, cancelCurrentTask, clearStatus } = usePipeline();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logExpanded, setLogExpanded] = useState(false);
  const [liveModal, dispatchLiveModal] = useReducer(liveModalReducer, {
    isClosing: false,
    task: null
  });
  const statusTimerRef = useRef<number | null>(null);
  const liveModalTimerRef = useRef<number | null>(null);
  const activeLiveTask = state.currentTask ?? liveModal.task;
  const showLiveModal = Boolean(activeLiveTask);
  const isWorking = Boolean(state.currentTask);

  useEffect(() => {
    const startedAt = state.taskStartedAt;
    if (!state.currentTask || !startedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.currentTask, state.taskStartedAt]);

  useEffect(() => {
    if (liveModalTimerRef.current !== null) {
      window.clearTimeout(liveModalTimerRef.current);
      liveModalTimerRef.current = null;
    }

    if (state.currentTask) {
      dispatchLiveModal({ type: "show", task: state.currentTask });
      return;
    }

    if (!liveModal.task) {
      return;
    }

    dispatchLiveModal({ type: "start-closing" });
    liveModalTimerRef.current = window.setTimeout(() => {
      dispatchLiveModal({ type: "reset" });
      liveModalTimerRef.current = null;
    }, LIVE_MODAL_CLOSE_MS);

    return () => {
      if (liveModalTimerRef.current !== null) {
        window.clearTimeout(liveModalTimerRef.current);
        liveModalTimerRef.current = null;
      }
    };
  }, [liveModal.task, state.currentTask]);

  useEffect(() => {
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }

    const currentStatus = state.error || state.message;
    if (!currentStatus) {
      return;
    }

    statusTimerRef.current = window.setTimeout(() => {
      clearStatus();
      statusTimerRef.current = null;
    }, state.error ? 5200 : 2400);

    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };
  }, [clearStatus, state.error, state.message]);

  const introFresh = isIntroFresh(state);
  const introRefreshReasons = getIntroRefreshReasons(state);
  const hasResume = Boolean(state.resumeConfirmedJson);
  const hasCompany = Boolean(state.companyConfirmedJson);
  const hasIntro = Boolean(state.intro);
  const saveSummaryItems = [
    state.resumeSavedAt ? `이력서 ${formatSavedAt(state.resumeSavedAt)}` : null,
    state.companySavedAt ? `공고 ${formatSavedAt(state.companySavedAt)}` : null,
    state.introSavedAt ? `소개글 ${formatSavedAt(state.introSavedAt)}` : null
  ].filter((item): item is string => Boolean(item));

  const steps = useMemo<FrameStepItem[]>(() => {
    const stepStatusLabel = (key: StepKey, status: StepStatus): string => {
      if (key === "result") {
        switch (status) {
          case "done":
            return "최신";
          case "working":
            return "만드는 중";
          case "locked":
            return "잠김";
          case "blocked":
            return step === "result" ? "대기" : "먼저 완료";
          default:
            if (!hasIntro) {
              return "만들기";
            }

            if (introRefreshReasons.length > 0) {
              return "다시 만들기";
            }

            return "준비됨";
        }
      }

      if (key === "pdf") {
        switch (status) {
          case "working":
            return "수정 중";
          case "blocked":
            return "최신 필요";
          case "locked":
            return "잠김";
          default:
            return "내보내기";
        }
      }

      switch (status) {
        case "done":
          return "완료";
        case "working":
          return "지금";
        case "locked":
          return "잠김";
        case "blocked":
          return key === step ? "대기" : "먼저 완료";
        default:
          return "준비됨";
      }
    };

    const resumeStatus: StepStatus = hasResume ? "done" : step === "resume" ? "working" : "ready";
    const companyStatus: StepStatus = !hasResume
      ? step === "company"
        ? "blocked"
        : "locked"
      : hasCompany
        ? "done"
        : step === "company"
          ? "working"
          : "ready";
    const resultStatus: StepStatus = !hasResume || !hasCompany
      ? step === "result"
        ? "blocked"
        : "locked"
      : state.currentTask === "intro"
        ? "working"
      : introFresh
        ? "done"
        : "ready";
    const pdfStatus: StepStatus = !hasResume || !hasCompany || !hasIntro
      ? step === "pdf"
        ? "blocked"
        : "locked"
      : !introFresh
        ? step === "pdf"
          ? "blocked"
          : "locked"
        : step === "pdf"
          ? "working"
          : "ready";

    return [
      {
        key: "resume" as const,
        label: "이력서",
        href: "/resume" as StepRoute,
        active: step === "resume",
        enabled: true,
        status: resumeStatus,
        statusLabel: stepStatusLabel("resume", resumeStatus)
      },
      {
        key: "company" as const,
        label: "공고",
        href: "/company" as StepRoute,
        active: step === "company",
        enabled: companyStatus !== "locked",
        status: companyStatus,
        statusLabel: stepStatusLabel("company", companyStatus)
      },
      {
        key: "result" as const,
        label: "소개글",
        href: "/result" as StepRoute,
        active: step === "result",
        enabled: resultStatus !== "locked",
        status: resultStatus,
        statusLabel: stepStatusLabel("result", resultStatus)
      },
      {
        key: "pdf" as const,
        label: "PDF",
        href: "/pdf" as StepRoute,
        active: step === "pdf",
        enabled: pdfStatus !== "locked",
        status: pdfStatus,
        statusLabel: stepStatusLabel("pdf", pdfStatus)
      }
    ];
  }, [hasResume, hasCompany, hasIntro, introFresh, introRefreshReasons.length, state.currentTask, step]);

  const logs = useMemo(() => [...state.logs].slice(-100).reverse(), [state.logs]);
  const liveLogs = useMemo(
    () => (activeLiveTask ? logs.filter((log) => log.task === activeLiveTask).slice(0, 2) : []),
    [activeLiveTask, logs]
  );
  const latestLog = logs[0] ?? null;
  const busyStage = activeLiveTask ? getBusyStage(activeLiveTask, state.logs) : null;
  const busyStageLabels = activeLiveTask ? TASK_PROGRESS_LABELS[activeLiveTask] : null;
  const busyStageOrder: BusyStageKey[] = ["prepare", "analyze", "finalize"];
  const busyProgressValue = busyStage ? getBusyProgressValue(busyStage) : 0;

  const formatLogTime = (value: string) =>
    new Date(value).toLocaleTimeString("ko-KR", {
      hour12: false
    });

  const latestSummary = latestLog
    ? {
        taskLabel: TASK_LABEL[latestLog.task],
        time: formatLogTime(latestLog.at),
        message: latestLog.message
      }
    : null;
  const statusTone: "error" | "success" | null = state.error
    ? "error"
    : state.message
      ? "success"
      : null;

  return {
    activeLiveTask,
    busyProgressValue,
    busyStage,
    busyStageLabels,
    busyStageOrder,
    cancelCurrentTask,
    clearStatus,
    elapsedSeconds,
    formatLogTime,
    hydrated,
    isWorking,
    liveMessage: state.isCancellingTask
      ? "현재 실행을 중단하고 있어요."
      : liveLogs[0]?.message ?? "결과를 준비하고 있어요.",
    liveModal,
    liveSubMessage: !state.isCancellingTask ? liveLogs[1]?.message : undefined,
    logExpanded,
    logs,
    latestSummary,
    saveSummaryItems,
    setLogExpanded,
    showLiveModal,
    state,
    statusTone,
    statusValue: state.error || state.message,
    steps,
    taskLabel: activeLiveTask ? TASK_LABEL[activeLiveTask] : null
  };
}
