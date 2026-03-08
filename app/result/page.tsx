"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import { ToneInline } from "@/app/components/tone-inline";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { formatSavedAt } from "@/lib/date-format";
import { buildIntroGuidance, buildMatchInsights } from "@/lib/intro-insights";
import { formatIntroToneLabel } from "@/lib/intro-tone";
import { getIntroRefreshReasons, isIntroFresh, usePipeline } from "@/lib/pipeline-context";
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
  const missingButRelevant = Array.isArray(intro.missingButRelevant)
    ? intro.missingButRelevant.filter(Boolean)
    : [];

  if (
    fitReasons.length === 0 &&
    matchedSkills.length === 0 &&
    gapNotes.length === 0 &&
    missingButRelevant.length === 0
  ) {
    return null;
  }

  return {
    fitReasons,
    matchedSkills,
    gapNotes,
    missingButRelevant
  };
}

type IntroSectionKey = "oneLineIntro" | "shortIntro" | "longIntro";
type CompareChunkStatus = "same" | "added" | "removed";

interface CopyFeedback {
  key: IntroSectionKey;
  title: string;
  status: "success" | "error";
}

interface CompareChunk {
  id: string;
  text: string;
  status: CompareChunkStatus;
}

interface CompareSection {
  key: IntroSectionKey;
  title: string;
  previousTitle: string;
  currentTitle: string;
  previousChunks: CompareChunk[];
  currentChunks: CompareChunk[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  changed: boolean;
}

const SENTENCE_CHUNK_PATTERN = /[^.!?。！？\n]+[.!?。！？]?/g;

function splitCompareChunks(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return normalized.split(/\n+/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }

    const chunks = trimmed.match(SENTENCE_CHUNK_PATTERN) ?? [trimmed];
    return chunks.map((chunk) => chunk.trim()).filter(Boolean);
  });
}

function normalizeCompareChunk(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\u2022•\-*]+\s*/, "")
    .replace(/[.!?。！？]+$/g, "")
    .trim()
    .toLowerCase();
}

function countCompareSignatures(chunks: string[]) {
  const counts = new Map<string, number>();

  for (const chunk of chunks) {
    const signature = normalizeCompareChunk(chunk);
    if (!signature) {
      continue;
    }

    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

function markCompareChunks(chunks: string[], otherCounts: Map<string, number>, missingStatus: CompareChunkStatus) {
  const seen = new Map<string, number>();

  return chunks.map((chunk, index) => {
    const signature = normalizeCompareChunk(chunk);
    const seenCount = seen.get(signature) ?? 0;
    seen.set(signature, seenCount + 1);

    return {
      id: `${signature || "chunk"}-${index}`,
      text: chunk,
      status: signature && seenCount < (otherCounts.get(signature) ?? 0) ? "same" : missingStatus
    } satisfies CompareChunk;
  });
}

function buildCompareSection(
  key: IntroSectionKey,
  title: string,
  previousTitle: string,
  currentTitle: string,
  previousValue: string,
  currentValue: string
) {
  const previousSource = splitCompareChunks(previousValue);
  const currentSource = splitCompareChunks(currentValue);
  const previousCounts = countCompareSignatures(previousSource);
  const currentCounts = countCompareSignatures(currentSource);
  const previousChunks = markCompareChunks(previousSource, currentCounts, "removed");
  const currentChunks = markCompareChunks(currentSource, previousCounts, "added");
  const addedCount = currentChunks.filter((chunk) => chunk.status === "added").length;
  const removedCount = previousChunks.filter((chunk) => chunk.status === "removed").length;
  const unchangedCount = currentChunks.filter((chunk) => chunk.status === "same").length;

  return {
    key,
    title,
    previousTitle,
    currentTitle,
    previousChunks,
    currentChunks,
    addedCount,
    removedCount,
    unchangedCount,
    changed: addedCount > 0 || removedCount > 0
  } satisfies CompareSection;
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
  const refreshReasons = getIntroRefreshReasons(state);
  const isIntroWorking = state.currentTask === "intro";
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const refreshReasonBadges = useMemo(
    () =>
      refreshReasons.map((reason) => ({
        key: reason.key,
        label:
          reason.key === "resume"
            ? state.resumeConfirmedJson
              ? "이력서 변경"
              : "이력서 다시 저장"
            : state.companyConfirmedJson
              ? "공고 변경"
              : "공고 다시 저장"
      })),
    [refreshReasons, state.companyConfirmedJson, state.resumeConfirmedJson]
  );
  const freshnessTone = !state.intro ? "info" : introFresh ? "ok" : "warn";
  const freshnessHeading = !state.intro
    ? "아직 만든 소개글이 없어요."
    : introFresh
      ? "지금 결과가 최신이에요."
      : "최신 내용으로 다시 만들 차례예요.";
  const freshnessBody = !canGenerate
    ? ""
    : !state.intro
      ? ""
      : introFresh
        ? ""
        : refreshReasons.length > 0
          ? refreshReasons.map((reason) => reason.message).join(" ")
          : "";
  const actionHeading = !canGenerate
    ? "소개글 만들기"
    : !state.intro
      ? "소개글을 만들어요"
      : refreshReasons.length > 0
        ? "바뀐 내용으로 다시 만들어요"
        : "필요하면 다시 만들어요";
  const actionDescription = !canGenerate
    ? ""
    : refreshReasonBadges.length > 0
      ? `${refreshReasonBadges.map((badge) => badge.label).join(", ")} · 톤 ${formatIntroToneLabel(state.introTone)}`
      : `톤 ${formatIntroToneLabel(state.introTone)}`;
  const savedMetaItems = [
    state.resumeSavedAt ? `이력서 저장 ${formatSavedAt(state.resumeSavedAt)}` : null,
    state.companySavedAt ? `공고 저장 ${formatSavedAt(state.companySavedAt)}` : null,
    state.introSavedAt ? `소개글 생성 ${formatSavedAt(state.introSavedAt)}` : null
  ].filter((item): item is string => Boolean(item));
  // 소개글 생성은 저장 완료된 스냅샷만 기준으로 삼아, 편집 중 draft가 섞이지 않게 한다.
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
  const writingAnchorView = useMemo(() => {
    if (!confirmedResume || !confirmedCompany) {
      return null;
    }

    const guidance = buildIntroGuidance(confirmedResume, confirmedCompany);
    if (guidance.writingAnchors.length === 0) {
      return null;
    }

    return {
      kicker: state.intro ? "연결 근거" : "미리 보기",
      title: state.intro ? "공고와 연결한 내 경험" : "소개글에 반영할 연결 근거",
      description: state.intro
        ? "공고 요건과 내 경험을 이렇게 묶어 소개글에 반영했습니다."
        : "소개글을 만들 때 먼저 연결할 공고 요건과 내 경험입니다.",
      anchors: guidance.writingAnchors.slice(0, 5).map((anchor) => ({
        ...anchor,
        label: anchor.type === "requirement" ? "필수 요건" : "우대 조건"
      }))
    };
  }, [confirmedCompany, confirmedResume, state.intro]);
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
      opportunities: introInsights?.missingButRelevant.length
        ? introInsights.missingButRelevant
        : (matchInsights?.opportunities ?? []),
      keywords: introInsights?.matchedSkills.length
        ? introInsights.matchedSkills
        : (matchInsights?.keywords ?? [])
    };
  }, [introInsights, matchInsights]);
  const introSections = useMemo(
    () => [
      {
        key: "oneLineIntro" as IntroSectionKey,
        title: "한 줄 소개",
        value: state.intro?.oneLineIntro ?? "",
        emptyText: "아직 만든 소개글이 없어요."
      },
      {
        key: "shortIntro" as IntroSectionKey,
        title: "짧은 소개",
        value: state.intro?.shortIntro ?? "",
        emptyText: "아직 만든 소개글이 없어요."
      },
      {
        key: "longIntro" as IntroSectionKey,
        title: "긴 소개",
        value: state.intro?.longIntro ?? "",
        emptyText: "아직 만든 소개글이 없어요."
      }
    ],
    [state.intro]
  );

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);
  const compareSections = useMemo(
    () => [
      buildCompareSection(
        "oneLineIntro",
        "한 줄 소개",
        "이전 한 줄 소개",
        "지금 한 줄 소개",
        state.previousIntro?.oneLineIntro ?? "",
        state.intro?.oneLineIntro ?? ""
      ),
      buildCompareSection(
        "shortIntro",
        "짧은 소개",
        "이전 짧은 소개",
        "지금 짧은 소개",
        state.previousIntro?.shortIntro ?? "",
        state.intro?.shortIntro ?? ""
      ),
      buildCompareSection(
        "longIntro",
        "긴 소개",
        "이전 긴 소개",
        "지금 긴 소개",
        state.previousIntro?.longIntro ?? state.previousIntro?.shortIntro ?? "",
        state.intro?.longIntro ?? state.intro?.shortIntro ?? ""
      )
    ],
    [state.previousIntro, state.intro]
  );

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
      // 생성은 항상 현재 화면 draft가 아니라 "저장된 이력서/공고" 조합으로만 다시 돌린다.
      const intro = await postSseJson<Intro>(
          "/api/intro/stream",
          {
            resume: resume.data,
            company: company.data,
            tone: state.introTone,
            agent: toAgentRunOptions(state.agentSettings)
          },
          {
            onLog: (payload) => addLog("intro", payload)
          }
      );

      patch((prev) => ({
        ...prev,
        // 비교 패널에서 직전 결과를 보여줄 수 있도록 생성 전 결과를 따로 보관한다.
        previousIntro: prev.intro,
        intro,
        introSavedAt: new Date().toISOString(),
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

  const setCopyFeedbackWithReset = (feedback: CopyFeedback) => {
    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
    }

    setCopyFeedback(feedback);
    copyResetRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
      copyResetRef.current = null;
    }, 1800);
  };

  const copyText = async (section: { key: IntroSectionKey; title: string; value: string }) => {
    try {
      await navigator.clipboard.writeText(section.value);
      setCopyFeedbackWithReset({
        key: section.key,
        title: section.title,
        status: "success"
      });
    } catch {
      setCopyFeedbackWithReset({
        key: section.key,
        title: section.title,
        status: "error"
      });
    }
  };

  const copyAnnouncement = copyFeedback
    ? copyFeedback.status === "success"
      ? `${copyFeedback.title} 복사 완료`
      : `${copyFeedback.title} 복사 실패`
    : "";

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

      <section className={`card card-accent ${isIntroWorking ? "card-processing" : ""}`}>
        <div className="card-head">
          <div>
            <p className="card-kicker">만들기</p>
            <h2>소개글 만들기</h2>
          </div>
        </div>

        <div className={`fresh-badge ${freshnessTone}`}>
          <strong>{freshnessHeading}</strong>
          {freshnessBody && <span>{freshnessBody}</span>}
          {savedMetaItems.length > 0 && (
            <div className="save-meta-row" aria-label="마지막 저장 시각">
              {savedMetaItems.map((item) => (
                <span key={item} className="save-meta-chip">
                  {item}
                </span>
              ))}
            </div>
          )}
          {refreshReasonBadges.length > 0 && (
            <div className="reason-chip-row" aria-label="다시 만들기 이유">
              {refreshReasonBadges.map((badge) => (
                <span key={badge.key} className={`reason-chip ${badge.key}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="action-panel">
          <div className="action-copy">
            <strong>{actionHeading}</strong>
            {actionDescription && <span>{actionDescription}</span>}
          </div>
          <div className="action-controls">
            <ToneInline disabled={isBusy || !canGenerate} />
            <ReasoningInline disabled={isBusy || !canGenerate} />
            <button type="button" className="primary" onClick={handleGenerate} disabled={isBusy || !canGenerate}>
              {state.currentTask === "intro" ? "만드는 중..." : introFresh ? "다시 만들기" : "소개글 만들기"}
            </button>
          </div>
        </div>
      </section>

      {writingAnchorView && (
        <section className="card">
          <div className="card-head">
            <div>
              <p className="card-kicker">{writingAnchorView.kicker}</p>
              <h2>{writingAnchorView.title}</h2>
              <p className="anchor-note">{writingAnchorView.description}</p>
            </div>
          </div>

          <div className="anchor-grid" aria-label={writingAnchorView.title}>
            {writingAnchorView.anchors.map((anchor) => (
              <article key={`${anchor.type}-${anchor.target}`} className={`anchor-card ${anchor.type}`}>
                <div className="anchor-head">
                  <span className={`anchor-type ${anchor.type}`}>{anchor.label}</span>
                </div>
                <h3>{anchor.target}</h3>
                <ul className="anchor-evidence">
                  {anchor.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {insightView && (
        <section className="card">
          <div className="card-head">
            <div>
              <p className="card-kicker">{insightView.kicker}</p>
              <h2>{insightView.title}</h2>
            </div>
          </div>

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

            {insightView.opportunities.length > 0 && (
              <article className="insight-card info">
                <h3>더 살릴 수 있는 점</h3>
                <ul className="insight-list">
                  {insightView.opportunities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            )}
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
          <p className="sr-only" aria-live="polite">
            {copyAnnouncement}
          </p>
        </div>

        <div className="result-card">
          {introSections.map((section) => (
            <article key={section.key} className="result-block">
              <div className="result-head">
                <h3>{section.title}</h3>
                <button
                  type="button"
                  className={`secondary copy-btn ${
                    copyFeedback?.key === section.key ? copyFeedback.status : ""
                  }`}
                  onClick={() => void copyText(section)}
                  disabled={isBusy || !state.intro || !section.value.trim()}
                >
                  {copyFeedback?.key === section.key
                    ? copyFeedback.status === "success"
                      ? "복사됨"
                      : "복사 실패"
                    : "복사"}
                </button>
              </div>
              <p>{section.value || section.emptyText}</p>
            </article>
          ))}
        </div>
      </section>

      {state.previousIntro && state.intro && (
        <section className="card compare-shell">
          <div className="card-head">
            <div>
              <p className="card-kicker">비교</p>
              <h2>이전 결과와 지금 결과를 한눈에 확인</h2>
              <p className="anchor-note">빠진 문장은 왼쪽, 새로 들어간 문장은 오른쪽에서 바로 강조합니다.</p>
            </div>
          </div>

          <div className="compare-legend" aria-hidden="true">
            <span className="compare-summary-chip removed">이전에서 빠진 문장</span>
            <span className="compare-summary-chip added">새로 들어간 문장</span>
            <span className="compare-summary-chip same">그대로 유지된 문장</span>
          </div>

          <div className="compare-section-list">
            {compareSections.map((section) => (
              <article key={section.key} className="compare-section">
                <div className="compare-section-head">
                  <div className="compare-section-copy">
                    <p className="compare-section-kicker">{section.title}</p>
                    <h3>{section.changed ? "표현 변화가 보이는 구간" : "큰 변화 없이 유지된 구간"}</h3>
                  </div>
                  <div className="compare-summary" aria-label={`${section.title} 변경 요약`}>
                    {section.removedCount > 0 && (
                      <span className="compare-summary-chip removed">삭제 {section.removedCount}</span>
                    )}
                    {section.addedCount > 0 && (
                      <span className="compare-summary-chip added">추가 {section.addedCount}</span>
                    )}
                    {section.unchangedCount > 0 && (
                      <span className="compare-summary-chip same">유지 {section.unchangedCount}</span>
                    )}
                    {!section.changed && <span className="compare-summary-chip same">변경 없음</span>}
                  </div>
                </div>

                <div className="compare-grid">
                  <article className="result-block compare-column compare-old">
                    <div className="compare-column-head">
                      <p className="compare-column-title">{section.previousTitle}</p>
                      <p className="compare-column-note">이 버전에서 빠지거나 유지된 표현입니다.</p>
                    </div>
                    <div className="compare-body" aria-label={section.previousTitle}>
                      {section.previousChunks.length > 0 ? (
                        section.previousChunks.map((chunk) => (
                          <span key={chunk.id} className={`compare-chunk ${chunk.status}`}>
                            {chunk.text}
                          </span>
                        ))
                      ) : (
                        <p className="compare-empty">이전 내용이 없습니다.</p>
                      )}
                    </div>
                  </article>

                  <article className="result-block compare-column compare-new">
                    <div className="compare-column-head">
                      <p className="compare-column-title">{section.currentTitle}</p>
                      <p className="compare-column-note">이번 생성에서 새로 들어오거나 유지된 표현입니다.</p>
                    </div>
                    <div className="compare-body" aria-label={section.currentTitle}>
                      {section.currentChunks.length > 0 ? (
                        section.currentChunks.map((chunk) => (
                          <span key={chunk.id} className={`compare-chunk ${chunk.status}`}>
                            {chunk.text}
                          </span>
                        ))
                      ) : (
                        <p className="compare-empty">현재 내용이 없습니다.</p>
                      )}
                    </div>
                  </article>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </AppFrame>
  );
}
