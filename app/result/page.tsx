"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema, ResumeSchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Company, Intro, Resume } from "@/lib/types";

const STOPWORDS = new Set([
  "및",
  "또는",
  "관련",
  "기반",
  "사용",
  "능력",
  "경험",
  "개발",
  "프로젝트",
  "업무",
  "이상",
  "이해",
  "보유",
  "우대",
  "필수",
  "가능",
  "preferred",
  "required"
]);

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function tokenize(value: string): string[] {
  return normalizePhrase(value)
    .split(/[^a-z0-9가-힣+#.]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function collectResumeKeywords(resume: Resume): Set<string> {
  const raw = [
    resume.desiredPosition,
    resume.summary,
    ...resume.techStack,
    ...resume.achievements,
    ...resume.strengths,
    ...resume.experience.flatMap((item) => [item.company, item.role, item.period, item.description]),
    ...resume.projects.flatMap((item) => [item.name, item.description, ...item.techStack])
  ];

  return new Set(unique(raw.flatMap(tokenize)));
}

function collectResumeTech(resume: Resume): Set<string> {
  return new Set(
    unique([...resume.techStack, ...resume.projects.flatMap((item) => item.techStack)].map(normalizePhrase))
  );
}

function buildMatchInsights(resume: Resume, company: Company) {
  const resumeKeywords = collectResumeKeywords(resume);
  const resumeTech = collectResumeTech(resume);
  const jobTokens = tokenize(company.jobTitle);
  const desiredTokens = tokenize(`${resume.desiredPosition} ${resume.summary}`);

  const roleOverlap = unique(desiredTokens.filter((token) => jobTokens.includes(token))).slice(0, 3);
  const matchedTech = unique(
    company.techStack.filter((skill) => {
      const normalized = normalizePhrase(skill);
      return resumeTech.has(normalized) || tokenize(skill).some((token) => resumeKeywords.has(token));
    })
  ).slice(0, 4);
  const requirementEvidence = unique(
    company.requirements.flatMap((item) => tokenize(item).filter((token) => resumeKeywords.has(token)))
  ).slice(0, 5);
  const preferredEvidence = unique(
    company.preferredSkills.flatMap((item) => tokenize(item).filter((token) => resumeKeywords.has(token)))
  ).slice(0, 4);

  const highlights: string[] = [];

  if (roleOverlap.length > 0) {
    highlights.push(`희망 직무와 공고 직무에서 ${roleOverlap.join(", ")} 키워드가 겹칩니다.`);
  }

  if (matchedTech.length > 0) {
    highlights.push(`공고 기술 스택 중 ${matchedTech.join(", ")}가 이력서에서 확인됩니다.`);
  }

  if (requirementEvidence.length > 0) {
    highlights.push(`필수 요구사항과 연결되는 이력서 키워드는 ${requirementEvidence.join(", ")}입니다.`);
  }

  if (preferredEvidence.length > 0) {
    highlights.push(`우대사항과 맞닿는 추가 키워드는 ${preferredEvidence.join(", ")}입니다.`);
  }

  const missingTech = unique(
    company.techStack.filter((skill) => !matchedTech.includes(skill))
  ).slice(0, 4);
  const missingRequirements = company.requirements
    .filter((item) => tokenize(item).every((token) => !resumeKeywords.has(token)))
    .slice(0, 3);
  const missingPreferred = company.preferredSkills
    .filter((item) => tokenize(item).every((token) => !resumeKeywords.has(token)))
    .slice(0, 2);

  const gaps: string[] = [];

  if (missingTech.length > 0) {
    gaps.push(`공고 기술 스택 중 ${missingTech.join(", ")}는 현재 이력서 근거가 약합니다.`);
  }

  missingRequirements.forEach((item) => {
    gaps.push(`필수 요구사항 보완 필요: ${item}`);
  });

  missingPreferred.forEach((item) => {
    gaps.push(`우대사항 보완 후보: ${item}`);
  });

  return {
    highlights:
      highlights.length > 0 ? highlights : ["현재 데이터 기준으로는 강한 매칭 근거가 적어, 수동 검토가 필요합니다."],
    gaps: gaps.length > 0 ? gaps : ["확인된 큰 공백은 없지만, 공고 문구와 표현 톤을 더 맞추면 결과가 좋아집니다."],
    keywords: unique([...roleOverlap, ...matchedTech, ...requirementEvidence, ...preferredEvidence]).slice(0, 10)
  };
}

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
