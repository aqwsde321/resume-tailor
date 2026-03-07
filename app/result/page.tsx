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
      kicker: introInsights ? "AI 생성 근거" : "매칭 분석",
      title: introInsights ? "자기소개가 참조한 지원 근거" : "지원 근거 미리보기",
      description: introInsights
        ? "자기소개 생성과 함께 모델이 구조화한 근거입니다. 공고를 다시 생성하면 이 내용도 함께 갱신됩니다."
        : "자기소개 생성 전에, 확정된 이력서와 채용공고가 어디서 맞물리는지 자동으로 요약합니다.",
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
      setError("STEP 1/2에서 정보 확정을 완료하세요.");
      return;
    }

    let resumeRaw: unknown;
    let companyRaw: unknown;

    try {
      resumeRaw = JSON.parse(state.resumeConfirmedJson ?? "{}");
      companyRaw = JSON.parse(state.companyConfirmedJson ?? "{}");
    } catch {
      setError("확정 정보를 읽지 못했습니다. STEP 1/2를 다시 확인해주세요.");
      return;
    }

    const resume = ResumeSchema.safeParse(resumeRaw);
    if (!resume.success) {
      setError("확정된 이력서 정보 검증에 실패했습니다. STEP 1에서 다시 확정하세요.");
      return;
    }

    const company = CompanySchema.safeParse(companyRaw);
    if (!company.success) {
      setError("확정된 채용공고 정보 검증에 실패했습니다. STEP 2에서 다시 확정하세요.");
      return;
    }

    clearLogs();
    startTask("intro", "자기소개 생성을 시작했습니다.");

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

      setMessage("자기소개 생성 완료.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "자기소개 생성 중 오류가 발생했습니다.");
    } finally {
      finishTask();
    }
  };

  const copyText = async (value: string, label: string) => {
    clearStatus();

    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label}를 클립보드에 복사했습니다.`);
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  return (
    <AppFrame
      step="result"
      title="STEP 3 결과 생성"
      description="확정된 이력서/채용공고 정보를 바탕으로 자기소개를 생성합니다."
    >
      {!canGenerate && (
        <section className="card">
          <h2>정보 확정이 필요합니다.</h2>
          <p>STEP 1에서 이력서, STEP 2에서 채용공고 정보를 먼저 확정하세요.</p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              STEP 1로 이동
            </Link>
            <Link href={"/company" as Route} className="nav-btn">
              STEP 2로 이동
            </Link>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">결과 출력</p>
            <h2>자기소개 생성</h2>
          </div>
          <button type="button" className="primary" onClick={handleGenerate} disabled={isBusy || !canGenerate}>
            {state.currentTask === "intro" ? "생성 중..." : introFresh ? "다시 생성" : "자기소개 생성"}
          </button>
        </div>

        <p className="card-copy">
          확정된 이력서와 채용공고를 조합해 회사 맞춤 자기소개를 만듭니다. 공고만 다시 바꾼 뒤 재생성하는
          흐름을 기준으로 설계되어 있습니다.
        </p>

        <p className={`fresh-badge ${introFresh ? "ok" : "warn"}`}>
          {introFresh ? "현재 결과는 최신입니다." : "확정 정보가 변경되어 재생성이 필요합니다."}
        </p>

        <div className="action-row">
          <Link href={"/company" as Route} className="nav-btn">
            회사 공고 수정으로 이동
          </Link>
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
              <h3>매칭 근거</h3>
              <ul className="insight-list">
                {insightView.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="insight-card warn">
              <h3>보완 포인트</h3>
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
            <p className="card-kicker">생성 결과</p>
            <h2>복사하기 전에 문장을 빠르게 검토하세요</h2>
          </div>
          <p className="card-copy">
            한 줄 소개와 짧은 자기소개를 세로로 배치해 문장 흐름을 바로 비교할 수 있게 정리했습니다.
          </p>
        </div>

        <div className="result-card">
          <article className="result-block">
            <div className="result-head">
              <h3>한 줄 소개</h3>
              <button
                type="button"
                className="secondary"
                onClick={() => void copyText(state.intro?.oneLineIntro ?? "", "한 줄 소개")}
                disabled={isBusy || !state.intro}
              >
                복사
              </button>
            </div>
            <p>{state.intro?.oneLineIntro ?? "아직 생성되지 않았습니다."}</p>
          </article>

          <article className="result-block">
            <div className="result-head">
              <h3>짧은 자기소개</h3>
              <button
                type="button"
                className="secondary"
                onClick={() => void copyText(state.intro?.shortIntro ?? "", "짧은 자기소개")}
                disabled={isBusy || !state.intro}
              >
                복사
              </button>
            </div>
            <p>{state.intro?.shortIntro ?? "아직 생성되지 않았습니다."}</p>
          </article>
        </div>
      </section>

      {state.previousIntro && state.intro && (
        <section className="card">
          <div className="card-head">
            <h2>이전 결과 비교</h2>
          </div>

          <div className="compare-grid">
            <article className="result-block compare-old">
              <div className="result-head">
                <h3>직전 한 줄 소개</h3>
              </div>
              <p>{state.previousIntro.oneLineIntro}</p>
            </article>

            <article className="result-block compare-new">
              <div className="result-head">
                <h3>현재 한 줄 소개</h3>
              </div>
              <p>{state.intro.oneLineIntro}</p>
            </article>

            <article className="result-block compare-old">
              <div className="result-head">
                <h3>직전 짧은 자기소개</h3>
              </div>
              <p>{state.previousIntro.shortIntro}</p>
            </article>

            <article className="result-block compare-new">
              <div className="result-head">
                <h3>현재 짧은 자기소개</h3>
              </div>
              <p>{state.intro.shortIntro}</p>
            </article>
          </div>
        </section>
      )}
    </AppFrame>
  );
}
