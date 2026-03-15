"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  const [liveTask, setLiveTask] = useState<TaskKind | null>(null);
  const [isLiveModalClosing, setIsLiveModalClosing] = useState(false);
  const statusTimerRef = useRef<number | null>(null);
  const liveModalTimerRef = useRef<number | null>(null);
  const activeLiveTask = state.currentTask ?? liveTask;
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
      setLiveTask(state.currentTask);
      setIsLiveModalClosing(false);
      return;
    }

    if (!liveTask) {
      return;
    }

    setIsLiveModalClosing(true);
    liveModalTimerRef.current = window.setTimeout(() => {
      setIsLiveModalClosing(false);
      setLiveTask(null);
      liveModalTimerRef.current = null;
    }, LIVE_MODAL_CLOSE_MS);

    return () => {
      if (liveModalTimerRef.current !== null) {
        window.clearTimeout(liveModalTimerRef.current);
        liveModalTimerRef.current = null;
      }
    };
  }, [liveTask, state.currentTask]);

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

  const steps = useMemo(() => {
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
        enabled: true,
        status: resumeStatus,
        statusLabel: stepStatusLabel("resume", resumeStatus)
      },
      {
        key: "company" as const,
        label: "공고",
        href: "/company" as StepRoute,
        enabled: companyStatus !== "locked",
        status: companyStatus,
        statusLabel: stepStatusLabel("company", companyStatus)
      },
      {
        key: "result" as const,
        label: "소개글",
        href: "/result" as StepRoute,
        enabled: resultStatus !== "locked",
        status: resultStatus,
        statusLabel: stepStatusLabel("result", resultStatus)
      },
      {
        key: "pdf" as const,
        label: "PDF",
        href: "/pdf" as StepRoute,
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
        <div className={`busy-overlay ${isLiveModalClosing ? "closing" : ""}`} aria-hidden="true" />
      )}
      <div className={`container ${layout === "wide" ? "container-wide" : ""}`}>
        <header className="hero">
          <p className="eyebrow">ResumeTailor</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        <section className={`sticky-shell ${stickyShell ? "" : "static-shell"}`.trim()}>
          <ol className="steps">
            {steps.map((item) => (
              <li
                key={item.key}
                className={`step-item ${step === item.key ? "active" : ""} ${item.status}`}
              >
                {item.enabled ? (
                  <Link href={item.href as Route} className="step-link step-content">
                    <span>{item.label}</span>
                    <span className={`step-state ${item.status}`}>{item.statusLabel}</span>
                  </Link>
                ) : (
                  <span className="step-link step-content disabled">
                    <span>{item.label}</span>
                    <span className={`step-state ${item.status}`}>{item.statusLabel}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>

          {showSaveSummary && saveSummaryItems.length > 0 && (
            <details className="sticky-meta-disclosure">
              <summary>
                <span>최근 저장 {saveSummaryItems.length}건</span>
              </summary>
              <div className="sticky-meta-body" aria-label="마지막 저장 시각">
                {saveSummaryItems.map((item) => (
                  <span key={item} className="save-meta-chip subtle">
                    {item}
                  </span>
                ))}
              </div>
            </details>
          )}
        </section>

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
          <section className={`card log-drawer ${logExpanded ? "open" : ""}`}>
            <div className="card-head">
              <div>
                <p className="card-kicker">기록</p>
                <h2>지난 작업 기록</h2>
              </div>
              <button
                type="button"
                className="tertiary"
                onClick={() => setLogExpanded((prev) => !prev)}
              >
                {logExpanded ? "접기" : "기록 보기"}
              </button>
            </div>

            {!logExpanded && latestLog ? (
              <p className="log-summary">
                <strong>{TASK_LABEL[latestLog.task]}</strong>
                <span>{formatLogTime(latestLog.at)}</span>
                <span>{latestLog.message}</span>
              </p>
            ) : (
              <ul className="log-list">{logs.map((log) => renderLogItem(log))}</ul>
            )}
          </section>
        )}
      </div>

      {activeLiveTask && (
        <section
          className={`live-log-modal ${isLiveModalClosing ? "closing" : ""}`}
          aria-live="polite"
          role="dialog"
          aria-modal="true"
        >
          <div className="live-log-head">
            <div>
              <div className="live-log-title-row">
                <span className="live-log-spinner" aria-hidden="true" />
                <h2>{TASK_LABEL[activeLiveTask]}</h2>
                {busyStage && busyStageLabels && (
                  <span className="live-log-phase-pill">{busyStageLabels[busyStage]}</span>
                )}
              </div>
              <p className="live-log-copy">
                {state.isCancellingTask
                  ? "현재 실행을 중단하고 있어요."
                  : liveLogs[0]?.message ?? "결과를 준비하고 있어요."}
              </p>
              {!state.isCancellingTask && liveLogs[1]?.message && (
                <p className="live-log-subcopy">{liveLogs[1].message}</p>
              )}
            </div>
            <div className="live-log-actions">
              <span className="live-log-timer">{elapsedSeconds}초</span>
              <button
                type="button"
                className="secondary"
                onClick={cancelCurrentTask}
                disabled={!state.currentTask || state.isCancellingTask}
              >
                {state.isCancellingTask ? "중단 중..." : "작업 중지"}
              </button>
            </div>
          </div>

          {busyStage && busyStageLabels && (
            <div className="live-progress" aria-label="작업 진행 상태">
              <div className="live-progress-track" aria-hidden="true">
                <div className="live-progress-fill" style={{ width: `${busyProgressValue}%` }} />
              </div>
              <ol className="live-progress-steps">
                {busyStageOrder.map((stage, index) => {
                  const currentIndex = busyStageOrder.indexOf(busyStage);
                  const status =
                    index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";

                  return (
                    <li key={stage} className={`live-progress-step ${status}`}>
                      <span className="live-progress-dot" aria-hidden="true" />
                      <span>{busyStageLabels[stage]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
