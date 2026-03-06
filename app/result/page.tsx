"use client";

import type { Route } from "next";
import Link from "next/link";

import { AppFrame } from "@/app/components/app-frame";
import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema, ResumeSchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Intro } from "@/lib/types";

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
          company: company.data
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

        <div className="mini-grid">
          <div className={`mini-stat ${canGenerate ? "ok" : "warn"}`}>
            <span>생성 준비</span>
            <strong>{canGenerate ? "실행 가능" : "선행 단계 필요"}</strong>
          </div>
          <div className={`mini-stat ${introFresh ? "ok" : "warn"}`}>
            <span>결과 상태</span>
            <strong>{introFresh ? "최신 유지" : state.intro ? "재생성 필요" : "아직 생성 전"}</strong>
          </div>
          <div className="mini-stat">
            <span>비교 데이터</span>
            <strong>{state.previousIntro ? "직전 결과 보유" : "첫 결과 생성 전"}</strong>
          </div>
        </div>

        <p className={`fresh-badge ${introFresh ? "ok" : "warn"}`}>
          {introFresh ? "현재 결과는 최신입니다." : "확정 정보가 변경되어 재생성이 필요합니다."}
        </p>

        <div className="action-row">
          <Link href={"/company" as Route} className="nav-btn">
            회사 공고 수정으로 이동
          </Link>
        </div>
      </section>

      <section className="card result-card">
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
