"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";

type StepKey = "resume" | "company" | "result";
type StepRoute = "/resume" | "/company" | "/result";
type StepStatus = "blocked" | "locked" | "ready" | "working" | "done";

const STEP_META: Record<
  StepKey,
  {
    eyebrow: string;
    objective: string;
    detail: string;
  }
> = {
  resume: {
    eyebrow: "Resume Intake",
    objective: "이력서 원문을 구조화하고 지원 기준이 되는 기본 프로필을 확정합니다.",
    detail: "입력 원문은 자유롭게 수정할 수 있지만, 다음 단계는 이력서 확정 후에만 열립니다."
  },
  company: {
    eyebrow: "Company Targeting",
    objective: "채용공고에서 핵심 요구사항만 분리해 회사 기준 JSON을 확정합니다.",
    detail: "이 단계에서 공고를 다시 분석하면 결과는 자동으로 재생성 필요 상태가 됩니다."
  },
  result: {
    eyebrow: "Intro Output",
    objective: "확정된 이력서와 채용공고를 조합해 회사 맞춤 자기소개를 생성합니다.",
    detail: "회사 공고만 바꿔 다시 생성하는 흐름이 자연스럽게 유지되도록 설계되어 있습니다."
  }
};

const TASK_LABEL: Record<"resume" | "company" | "intro", string> = {
  resume: "이력서 분석",
  company: "채용공고 분석",
  intro: "자기소개 생성"
};

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  children: ReactNode;
}

export function AppFrame({ step, title, description, children }: AppFrameProps) {
  const { hydrated, state, clearLogs } = usePipeline();
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
  const completedStepCount = [hasResume, hasCompany, introFresh].filter(Boolean).length;
  const stepMeta = STEP_META[step];

  const steps = useMemo(() => {
    const stepStatusLabel = (status: StepStatus): string => {
      switch (status) {
        case "done":
          return "완료";
        case "working":
          return "진행";
        case "locked":
          return "잠김";
        case "blocked":
          return "선행 필요";
        default:
          return "대기";
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
        label: "STEP 1 이력서",
        href: "/resume" as StepRoute,
        enabled: true,
        status: resumeStatus,
        statusLabel: stepStatusLabel(resumeStatus)
      },
      {
        key: "company" as const,
        label: "STEP 2 채용공고",
        href: "/company" as StepRoute,
        enabled: companyStatus !== "locked",
        status: companyStatus,
        statusLabel: stepStatusLabel(companyStatus)
      },
      {
        key: "result" as const,
        label: "STEP 3 결과",
        href: "/result" as StepRoute,
        enabled: resultStatus !== "locked",
        status: resultStatus,
        statusLabel: stepStatusLabel(resultStatus)
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
            <h2>로딩 중...</h2>
            <p>로컬 상태를 불러오고 있습니다.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="backdrop" />
      <div className="container">
        <header className="hero-grid">
          <div className="hero">
            <p className="eyebrow">ResumeMake Local MVP</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          <aside className="hero-panel">
            <p className="eyebrow">{stepMeta.eyebrow}</p>
            <h2>{stepMeta.objective}</h2>
            <p>{stepMeta.detail}</p>

            <div className="hero-metrics">
              <div className="hero-metric">
                <span>진행도</span>
                <strong>{completedStepCount}/3 단계</strong>
              </div>
              <div className="hero-metric">
                <span>로그</span>
                <strong>{state.logs.length}개</strong>
              </div>
              <div className="hero-metric">
                <span>상태</span>
                <strong>{state.currentTask ? "작업 중" : "대기 중"}</strong>
              </div>
            </div>
          </aside>
        </header>

        <section className="sticky-shell">
          <div className="sticky-topline">
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

            <div className="sticky-summary">
              <div className="summary-chip">
                <span>현재 단계</span>
                <strong>{title.replace(" 분석/확정", "").replace(" 생성", "")}</strong>
              </div>
              <div className="summary-chip">
                <span>현재 작업</span>
                <strong>{state.currentTask ? TASK_LABEL[state.currentTask] : "없음"}</strong>
              </div>
            </div>
          </div>

          <div className="badge-row">
            <span className={`badge ${state.resumeConfirmedJson ? "ok" : "warn"}`}>
              이력서 {state.resumeConfirmedJson ? "확정" : "미확정"}
            </span>
            <span className={`badge ${state.companyConfirmedJson ? "ok" : "warn"}`}>
              채용공고 {state.companyConfirmedJson ? "확정" : "미확정"}
            </span>
            <span className={`badge ${introFresh ? "ok" : "warn"}`}>
              결과 {introFresh ? "최신" : "재생성 필요"}
            </span>
          </div>

          {state.currentTask && (
            <section className="busy-banner" aria-live="polite">
              <span className="spinner" />
              <strong>{TASK_LABEL[state.currentTask]} 진행 중</strong>
              <span>{elapsedSeconds}s 경과</span>
            </section>
          )}
        </section>

        {children}

        <section className="card">
          <div className="card-head">
            <h2>AI 분석 로그</h2>
            <div className="log-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setLogExpanded((prev) => !prev)}
                disabled={logs.length === 0}
              >
                {logExpanded ? "로그 접기" : "로그 펼치기"}
              </button>
              <button type="button" className="secondary" onClick={clearLogs}>
                로그 비우기
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <p className="log-empty">아직 로그가 없습니다.</p>
          ) : (
            <>
              {!logExpanded && hiddenLogCount > 0 && (
                <p className="muted-help">최근 5개만 표시 중 ({hiddenLogCount}개 숨김)</p>
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
                        <span>{log.task}</span>
                        <span>{log.phase}</span>
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
