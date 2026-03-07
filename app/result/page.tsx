"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { buildMatchInsights } from "@/lib/intro-insights";
import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema, ResumeSchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Intro } from "@/lib/types";

function getIntroInsights(intro: Intro | null) {
  if (!intro) {
    return null;
  }

  const fitReasons = Array.isArray(intro.fitReasons) ? intro.fitReasons.filter(Boolean) : [];
  const matchedSkills = Array.isArray(intro.matchedSkills) ? intro.matchedSkills.filter(Boolean) : [];
  const gapNotes = Array.isArray(intro.gapNotes) ? intro.gapNotes.filter(Boolean) : [];

  if (fitReasons.length === 0 && matchedSkills.length === 0 && gapNotes.length === 0) {
    return null;
  }

  return {
    fitReasons,
    matchedSkills,
    gapNotes
  };
}

export default function ResultPage() {
  const {
    state,
    patch,
    clearStatus,
    setError,
    setMessage,
    clearLogs,
    startTask,
    finishTask,
    addLog
  } = usePipeline();

  const isBusy = state.currentTask !== null;
  const canGenerate = Boolean(state.resumeConfirmedJson && state.companyConfirmedJson);
  const introFresh = isIntroFresh(state);
  const confirmedResume = useMemo(() => {
    if (!state.resumeConfirmedJson) {
      return null;
    }

    try {
      const parsed = ResumeSchema.safeParse(JSON.parse(state.resumeConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.resumeConfirmedJson]);
  const confirmedCompany = useMemo(() => {
    if (!state.companyConfirmedJson) {
      return null;
    }

    try {
      const parsed = CompanySchema.safeParse(JSON.parse(state.companyConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.companyConfirmedJson]);
  const matchInsights = useMemo(() => {
    if (!confirmedResume || !confirmedCompany) {
      return null;
    }

    return buildMatchInsights(confirmedResume, confirmedCompany);
  }, [confirmedResume, confirmedCompany]);
  const introInsights = useMemo(() => getIntroInsights(state.intro), [state.intro]);
  const insightView = useMemo(() => {
    if (!introInsights && !matchInsights) {
      return null;
    }

    return {
      kicker: introInsights ? "근거" : "미리 보기",
      title: introInsights ? "이 소개글의 근거" : "잘 맞는 부분 미리 보기",
      description: introInsights
        ? "소개글을 만들 때 참고한 내용입니다. 공고를 다시 정리하면 함께 바뀝니다."
        : "소개글을 만들기 전에 어디가 잘 맞는지 먼저 보여줍니다.",
      highlights: introInsights?.fitReasons.length ? introInsights.fitReasons : (matchInsights?.highlights ?? []),
      gaps: introInsights?.gapNotes.length ? introInsights.gapNotes : (matchInsights?.gaps ?? []),
      keywords: introInsights?.matchedSkills.length
        ? introInsights.matchedSkills
        : (matchInsights?.keywords ?? [])
    };
  }, [introInsights, matchInsights]);

  const handleGenerate = async () => {
    clearStatus();

    if (!canGenerate) {
      setError("이력서와 공고를 먼저 저장해 주세요.");
      return;
    }

    let resumeRaw: unknown;
    let companyRaw: unknown;

    try {
      resumeRaw = JSON.parse(state.resumeConfirmedJson ?? "{}");
      companyRaw = JSON.parse(state.companyConfirmedJson ?? "{}");
    } catch {
      setError("저장된 내용을 읽지 못했어요. 다시 확인해 주세요.");
      return;
    }

    const resume = ResumeSchema.safeParse(resumeRaw);
    if (!resume.success) {
      setError("저장한 이력서 내용을 다시 확인해 주세요.");
      return;
    }

    const company = CompanySchema.safeParse(companyRaw);
    if (!company.success) {
      setError("저장한 공고 내용을 다시 확인해 주세요.");
      return;
    }

    clearLogs();
    startTask("intro", "소개글을 만들고 있어요.");

    try {
      const intro = await postSseJson<Intro>(
          "/api/intro/stream",
          {
            resume: resume.data,
            company: company.data,
            agent: toAgentRunOptions(state.agentSettings)
          },
          {
            onLog: (payload) => addLog("intro", payload)
          }
      );

      patch((prev) => ({
        ...prev,
        previousIntro: prev.intro,
        intro,
        introSource: {
          resumeConfirmedJson: prev.resumeConfirmedJson ?? "",
          companyConfirmedJson: prev.companyConfirmedJson ?? ""
        }
      }));

      setMessage("소개글이 준비됐어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "소개글을 만드는 중 문제가 생겼어요.");
    } finally {
      finishTask();
    }
  };

  const copyText = async (value: string) => {
    clearStatus();

    try {
      await navigator.clipboard.writeText(value);
      setMessage("복사했어요.");
    } catch {
      setError("복사하지 못했어요. 브라우저 권한을 확인해 주세요.");
    }
  };

  return (
    <AppFrame
      step="result"
      title="소개글 만들기"
      description="저장한 이력서와 공고로 소개글 초안을 만듭니다."
    >
      {!canGenerate && (
        <section className="card card-alert">
          <p className="card-kicker">먼저 하기</p>
          <h2>먼저 저장해 주세요.</h2>
          <p>이력서와 공고를 먼저 저장해야 소개글을 만들 수 있어요.</p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              이력서로 가기
            </Link>
            <Link href={"/company" as Route} className="nav-btn">
              공고로 가기
            </Link>
          </div>
        </section>
      )}

      <section className="card card-accent">
        <div className="card-head">
          <div>
            <p className="card-kicker">만들기</p>
            <h2>소개글 만들기</h2>
          </div>
        </div>

        <p className="card-copy">
          저장한 이력서와 공고를 바탕으로 바로 다듬어 쓸 초안을 만듭니다.
        </p>

        <p className={`fresh-badge ${introFresh ? "ok" : "warn"}`}>
          {introFresh ? "지금 결과가 최신이에요." : "내용이 바뀌어 다시 만들어야 해요."}
        </p>

        <div className="action-row">
          <Link href={"/company" as Route} className="nav-btn">
            공고 수정하기
          </Link>
        </div>

        <div className="action-panel">
          <div className="action-copy">
            <strong>{introFresh ? "필요하면 다시 만들어요" : "소개글을 만들어요"}</strong>
            <span>
              {canGenerate
                ? "저장한 이력서와 공고를 바탕으로 바로 초안을 만듭니다."
                : "이력서와 공고를 저장하면 버튼이 활성화돼요."}
            </span>
          </div>
          <button type="button" className="primary" onClick={handleGenerate} disabled={isBusy || !canGenerate}>
            {state.currentTask === "intro" ? "만드는 중..." : introFresh ? "다시 만들기" : "소개글 만들기"}
          </button>
        </div>
      </section>

      {insightView && (
        <section className="card">
          <div className="card-head">
            <div>
              <p className="card-kicker">{insightView.kicker}</p>
              <h2>{insightView.title}</h2>
            </div>
          </div>

          <p className="card-copy">{insightView.description}</p>

          <div className="insight-grid">
            <article className="insight-card ok">
              <h3>잘 맞는 점</h3>
              <ul className="insight-list">
                {insightView.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="insight-card warn">
              <h3>보완할 점</h3>
              <ul className="insight-list">
                {insightView.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          {insightView.keywords.length > 0 && (
            <div className="keyword-cloud">
              {insightView.keywords.map((item) => (
                <span key={item} className="keyword-chip">
                  {item}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card result-output-shell">
        <div className="result-output-head">
          <div>
            <p className="card-kicker">결과</p>
            <h2>복사 전에 한 번만 읽어 보세요</h2>
          </div>
          <p className="card-copy">
            짧은 소개와 긴 소개를 순서대로 볼 수 있게 정리했어요.
          </p>
        </div>

        <div className="result-card">
          <article className="result-block">
            <div className="result-head">
              <h3>한 줄 소개</h3>
              <button
                type="button"
                className="secondary"
                onClick={() => void copyText(state.intro?.oneLineIntro ?? "")}
                disabled={isBusy || !state.intro}
              >
                복사
              </button>
            </div>
            <p>{state.intro?.oneLineIntro ?? "아직 만든 소개글이 없어요."}</p>
          </article>

          <article className="result-block">
            <div className="result-head">
              <h3>짧은 소개</h3>
              <button
                type="button"
                className="secondary"
                onClick={() => void copyText(state.intro?.shortIntro ?? "")}
                disabled={isBusy || !state.intro}
              >
                복사
              </button>
            </div>
            <p>{state.intro?.shortIntro ?? "아직 만든 소개글이 없어요."}</p>
          </article>
        </div>
      </section>

      {state.previousIntro && state.intro && (
        <section className="card">
          <div className="card-head">
            <h2>이전 결과와 비교</h2>
          </div>

          <div className="compare-grid">
            <article className="result-block compare-old">
              <div className="result-head">
                <h3>이전 한 줄 소개</h3>
              </div>
              <p>{state.previousIntro.oneLineIntro}</p>
            </article>

            <article className="result-block compare-new">
              <div className="result-head">
                <h3>지금 한 줄 소개</h3>
              </div>
              <p>{state.intro.oneLineIntro}</p>
            </article>

            <article className="result-block compare-old">
              <div className="result-head">
                <h3>이전 짧은 소개</h3>
              </div>
              <p>{state.previousIntro.shortIntro}</p>
            </article>

            <article className="result-block compare-new">
              <div className="result-head">
                <h3>지금 짧은 소개</h3>
              </div>
              <p>{state.intro.shortIntro}</p>
            </article>
          </div>
        </section>
      )}
    </AppFrame>
  );
}
