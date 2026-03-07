"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { getIntroRefreshReasons, isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import type { PipelineLog } from "@/lib/types";

type StepKey = "resume" | "company" | "result";
type StepRoute = "/resume" | "/company" | "/result";
type StepStatus = "blocked" | "locked" | "ready" | "working" | "done";

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

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  children: ReactNode;
}

export function AppFrame({ step, title, description, children }: AppFrameProps) {
  const { hydrated, state } = usePipeline();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [logExpanded, setLogExpanded] = useState(false);

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

  const introFresh = isIntroFresh(state);
  const introRefreshReasons = getIntroRefreshReasons(state);
  const hasResume = Boolean(state.resumeConfirmedJson);
  const hasCompany = Boolean(state.companyConfirmedJson);
  const hasIntro = Boolean(state.intro);
  const refreshSummary = introRefreshReasons
    .map((reason) => {
      if (reason.key === "resume") {
        return state.resumeConfirmedJson ? "이력서 변경" : "이력서 다시 저장";
      }

      return state.companyConfirmedJson ? "공고 변경" : "공고 다시 저장";
    })
    .join(" · ");

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
      }
    ];
  }, [hasResume, hasCompany, hasIntro, introFresh, introRefreshReasons.length, state.currentTask, step]);

  const logs = useMemo(() => [...state.logs].slice(-100).reverse(), [state.logs]);
  const liveLogs = logs.slice(0, 6);
  const latestLog = logs[0] ?? null;

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
      <main className="page">
        <div className="backdrop" />
        <div className="container">
          <section className="card">
            <h2>불러오는 중...</h2>
            <p>저장된 내용을 읽고 있어요.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="backdrop" />
      <div className="container">
        {state.currentTask && (
          <section className="live-log-modal" aria-live="polite" role="status">
            <div className="live-log-head">
              <div>
                <p className="card-kicker">실행 중</p>
                <h2>{TASK_LABEL[state.currentTask]}</h2>
              </div>
              <span className="live-log-timer">{elapsedSeconds}초</span>
            </div>

            {liveLogs.length > 0 ? (
              <ul className="log-list compact">
                {liveLogs.map((log) => renderLogItem(log))}
              </ul>
            ) : (
              <p className="log-empty">실행 준비를 마치고 있어요.</p>
            )}
          </section>
        )}

        <header className="hero">
          <p className="eyebrow">ResumeMake</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        <section className="sticky-shell">
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

        {state.currentTask && (
          <section className="busy-banner" aria-live="polite">
            <span className="spinner" />
            <strong>{TASK_LABEL[state.currentTask]} 중</strong>
            <span>{elapsedSeconds}초 지남</span>
          </section>
        )}

        {!state.currentTask && introRefreshReasons.length > 0 && (
          <p className="sticky-note warn">
            <strong>소개글 다시 만들기 필요</strong>
            <span>{refreshSummary} 반영이 아직 남아 있어요.</span>
          </p>
        )}
      </section>

        {state.error && <p className="status error">{state.error}</p>}
        {state.message && <p className="status success">{state.message}</p>}

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
                className="secondary"
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
    </main>
  );
}
