"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  formatReasoningEffortValue,
  isModelReasoningEffort,
  MODEL_REASONING_EFFORT_LABELS,
  MODEL_REASONING_EFFORT_VALUES
} from "@/lib/agent-settings";
import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";

type StepKey = "resume" | "company" | "result";
type StepRoute = "/resume" | "/company" | "/result";
type StepStatus = "blocked" | "locked" | "ready" | "working" | "done";

const STEP_META: Record<
  StepKey,
  {
    eyebrow: string;
    detail: string;
  }
> = {
  resume: {
    eyebrow: "이력서",
    detail: "내용을 확인하고 저장하면 다음 단계로 넘어갈 수 있어요."
  },
  company: {
    eyebrow: "공고",
    detail: "공고를 저장하면 소개글을 만들 수 있어요."
  },
  result: {
    eyebrow: "소개글",
    detail: "공고를 바꾼 뒤 다시 만들면 새 결과로 바로 바뀝니다."
  }
};

const TASK_LABEL: Record<"resume" | "company" | "intro", string> = {
  resume: "이력서 정리",
  company: "공고 정리",
  intro: "소개글 만들기"
};

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  children: ReactNode;
}

export function AppFrame({ step, title, description, children }: AppFrameProps) {
  const { hydrated, state, patch, clearLogs } = usePipeline();
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
  const hasResume = Boolean(state.resumeConfirmedJson);
  const hasCompany = Boolean(state.companyConfirmedJson);
  const stepMeta = STEP_META[step];
  const selectedReasoningLabel = formatReasoningEffortValue(state.agentSettings.modelReasoningEffort);

  const steps = useMemo(() => {
    const stepStatusLabel = (key: StepKey, status: StepStatus): string => {
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
      : introFresh
        ? "done"
        : step === "result"
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
      }
    ];
  }, [hasResume, hasCompany, introFresh, step]);

  const logs = useMemo(() => [...state.logs].slice(-100).reverse(), [state.logs]);
  const visibleLogs = logExpanded ? logs : logs.slice(0, 5);
  const hiddenLogCount = logs.length - visibleLogs.length;

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
        <header className="hero">
          <p className="eyebrow">ResumeMake</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <p className="hero-note">
            <strong>{stepMeta.eyebrow}</strong> {stepMeta.detail}
          </p>
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
        </section>

        <section className="support-shell">
          <section className="agent-config-panel">
            <div>
              <p className="card-kicker">설정</p>
              <h2>생각 깊이</h2>
              <p className="agent-config-copy">
                기본은 {selectedReasoningLabel}이에요. 필요할 때만 바꿔 주세요.
              </p>
            </div>

            <div className="agent-config-grid">
              <label className="field">
                <span>생각 깊이</span>
                <select
                  className="form-select"
                  value={state.agentSettings.modelReasoningEffort}
                  onChange={(event) =>
                    patch((prev) => ({
                      ...prev,
                      agentSettings: {
                        ...prev.agentSettings,
                        modelReasoningEffort: isModelReasoningEffort(event.target.value)
                          ? event.target.value
                          : ""
                      }
                    }))
                  }
                  disabled={Boolean(state.currentTask)}
                >
                  {MODEL_REASONING_EFFORT_VALUES.map((item) => (
                    <option key={item} value={item}>
                      {MODEL_REASONING_EFFORT_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </section>

        {children}

        <section className="card">
          <div className="card-head">
            <h2>작업 기록</h2>
            <div className="log-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setLogExpanded((prev) => !prev)}
                disabled={logs.length === 0}
              >
                {logExpanded ? "접기" : "더 보기"}
              </button>
              <button type="button" className="secondary" onClick={clearLogs}>
                비우기
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="log-empty">아직 기록이 없어요.</p>
          ) : (
            <>
              {!logExpanded && hiddenLogCount > 0 && (
                <p className="muted-help">최근 5개만 보여주고 있어요 ({hiddenLogCount}개 더 있음)</p>
              )}
              <ul className="log-list">
                {visibleLogs.map((log) => {
                  const at = new Date(log.at).toLocaleTimeString("ko-KR", {
                    hour12: false
                  });

                  return (
                    <li key={log.id} className={`log-item ${log.level}`}>
                      <div className="log-meta">
                        <span>{at}</span>
                        <span>{TASK_LABEL[log.task]}</span>
                      </div>
                      <p>{log.message}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {state.error && <p className="status error">{state.error}</p>}
        {state.message && <p className="status success">{state.message}</p>}
      </div>
    </main>
  );
}
