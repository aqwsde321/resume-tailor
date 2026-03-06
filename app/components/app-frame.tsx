"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";

type StepKey = "resume" | "company" | "result";
type StepRoute = "/resume" | "/company" | "/result";

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  children: ReactNode;
}

export function AppFrame({ step, title, description, children }: AppFrameProps) {
  const { hydrated, state, clearLogs } = usePipeline();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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

  const steps = useMemo(
    () => [
      {
        key: "resume" as const,
        label: "STEP 1 이력서",
        href: "/resume" as StepRoute,
        enabled: true
      },
      {
        key: "company" as const,
        label: "STEP 2 채용공고",
        href: "/company" as StepRoute,
        enabled: Boolean(state.resumeConfirmedJson)
      },
      {
        key: "result" as const,
        label: "STEP 3 결과",
        href: "/result" as StepRoute,
        enabled: Boolean(state.resumeConfirmedJson && state.companyConfirmedJson)
      }
    ],
    [state.resumeConfirmedJson, state.companyConfirmedJson]
  );

  const introFresh = isIntroFresh(state);

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
        <header className="hero">
          <p className="eyebrow">ResumeMake Local MVP</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>

        <ol className="steps">
          {steps.map((item) => (
            <li key={item.key} className={step === item.key ? "active" : ""}>
              {item.enabled ? (
                <Link href={item.href as Route} className="step-link">
                  {item.label}
                </Link>
              ) : (
                <span className="step-link disabled">{item.label}</span>
              )}
            </li>
          ))}
        </ol>

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
            <strong>{state.currentTask.toUpperCase()} 작업 진행 중</strong>
            <span>{elapsedSeconds}s 경과</span>
          </section>
        )}

        {children}

        <section className="card">
          <div className="card-head">
            <h2>AI 분석 로그</h2>
            <button type="button" className="secondary" onClick={clearLogs}>
              로그 비우기
            </button>
          </div>

          {state.logs.length === 0 ? (
            <p className="log-empty">아직 로그가 없습니다.</p>
          ) : (
            <ul className="log-list">
              {[...state.logs].slice(-100).reverse().map((log) => {
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
          )}
        </section>

        {state.error && <p className="status error">{state.error}</p>}
        {state.message && <p className="status success">{state.message}</p>}
      </div>
    </main>
  );
}
