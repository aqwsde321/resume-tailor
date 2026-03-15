"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";

import { FrameShell, type FrameStepItem } from "@/app/components/frame/frame-shell";
import { LiveTaskModal } from "@/app/components/frame/live-task-modal";
import { LogDrawer } from "@/app/components/frame/log-drawer";
import { formatSavedAt } from "@/lib/date-format";
import { getIntroRefreshReasons, isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import type { PipelineLog, TaskKind } from "@/lib/types";

type StepKey = "resume" | "company" | "result" | "pdf";
type StepRoute = "/resume" | "/company" | "/result" | "/pdf";
type StepStatus = "blocked" | "locked" | "ready" | "working" | "done";
type BusyStageKey = "prepare" | "analyze" | "finalize";
const LIVE_MODAL_CLOSE_MS = 220;

const TASK_LABEL: Record<"resume" | "company" | "intro", string> = {
  resume: "이력서 정리",
  company: "공고 정리",
  intro: "소개글 만들기"
};

const PHASE_LABEL: Record<string, string> = {
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

const LEVEL_LABEL: Record<PipelineLog["level"], string> = {
  info: "진행",
  success: "완료",
  error: "오류"
};

const ANALYSIS_PHASES = new Set(["turn", "reasoning", "command", "mcp", "search", "plan"]);
const FINALIZE_PHASES = new Set(["patch", "response"]);

const TASK_PROGRESS_LABELS: Record<
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

function getBusyStage(task: "resume" | "company" | "intro", logs: PipelineLog[]): BusyStageKey {
  const taskLogs = logs.filter((log) => log.task === task);

  if (taskLogs.some((log) => FINALIZE_PHASES.has(log.phase))) {
    return "finalize";
  }

  if (taskLogs.some((log) => ANALYSIS_PHASES.has(log.phase))) {
    return "analyze";
  }

  return "prepare";
}

function getBusyProgressValue(stage: BusyStageKey): number {
  switch (stage) {
    case "analyze":
      return 58;
    case "finalize":
      return 88;
    default:
      return 22;
  }
}

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  layout?: "default" | "wide";
  stickyShell?: boolean;
  showSaveSummary?: boolean;
  children: ReactNode;
}

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

export function AppFrame({
  step,
  title,
  description,
  layout = "default",
  stickyShell = true,
  showSaveSummary = true,
  children
}: AppFrameProps) {
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

  const renderLogItem = (log: PipelineLog) => (
    <li key={log.id} className={`log-item ${log.level}`}>
      <div className="log-meta">
        <span className="log-badge task">{TASK_LABEL[log.task]}</span>
        <span className="log-badge phase">{PHASE_LABEL[log.phase] ?? PHASE_LABEL.unknown}</span>
        <span className={`log-badge level ${log.level}`}>{LEVEL_LABEL[log.level]}</span>
        <span className="log-time">{formatLogTime(log.at)}</span>
      </div>
      <p>{log.message}</p>
    </li>
  );
  const latestSummary = latestLog ? (
    <p className="log-summary">
      <strong>{TASK_LABEL[latestLog.task]}</strong>
      <span>{formatLogTime(latestLog.at)}</span>
      <span>{latestLog.message}</span>
    </p>
  ) : null;
  const logList = <ul className="log-list">{logs.map((log) => renderLogItem(log))}</ul>;

  if (!hydrated) {
    return (
      <main className="page" data-step={step}>
        <div className="backdrop" />
        <div className={`container ${layout === "wide" ? "container-wide" : ""}`}>
          <section className="card">
            <h2>불러오는 중...</h2>
            <p>저장된 내용을 읽고 있어요.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`page ${showLiveModal ? "page-busy" : ""}`}
      aria-busy={isWorking}
      data-step={step}
    >
      <div className="backdrop" />
      {showLiveModal && (
        <div className={`busy-overlay ${liveModal.isClosing ? "closing" : ""}`} aria-hidden="true" />
      )}
      <div className={`container ${layout === "wide" ? "container-wide" : ""}`}>
        <FrameShell
          description={description}
          saveSummaryItems={saveSummaryItems}
          showSaveSummary={showSaveSummary}
          steps={steps}
          stickyShell={stickyShell}
          title={title}
        />

        {(state.error || state.message) && (
          <div className="toast-stack" aria-live={state.error ? "assertive" : "polite"}>
            <p
              className={`status toast ${state.error ? "error" : "success"}`}
              role={state.error ? "alert" : "status"}
            >
              {state.error || state.message}
            </p>
          </div>
        )}

        {children}

        {logs.length > 0 && !state.currentTask && (
          <LogDrawer
            latestSummary={latestSummary}
            logExpanded={logExpanded}
            logList={logList}
            onToggle={() => setLogExpanded((prev) => !prev)}
          />
        )}
      </div>

      {activeLiveTask && (
        <LiveTaskModal
          activeTaskLabel={TASK_LABEL[activeLiveTask]}
          busyProgressValue={busyProgressValue}
          busyStage={busyStage}
          busyStageLabels={busyStageLabels}
          busyStageOrder={busyStageOrder}
          canCancel={Boolean(state.currentTask) && !state.isCancellingTask}
          elapsedSeconds={elapsedSeconds}
          isCancellingTask={Boolean(state.isCancellingTask)}
          isClosing={liveModal.isClosing}
          liveMessage={
            state.isCancellingTask
              ? "현재 실행을 중단하고 있어요."
              : liveLogs[0]?.message ?? "결과를 준비하고 있어요."
          }
          liveSubMessage={!state.isCancellingTask ? liveLogs[1]?.message : undefined}
          onCancel={cancelCurrentTask}
        />
      )}
    </main>
  );
}
