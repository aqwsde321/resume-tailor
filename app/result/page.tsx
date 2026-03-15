"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import {
  CompareCard,
  InsightCard,
  IntroActionCard,
  IntroOutputCard,
  PdfNextStepCard,
  WritingAnchorsCard
} from "@/app/components/result/sections";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import { ToneInline } from "@/app/components/tone-inline";
import { usePipelineStreamTask } from "@/app/hooks/use-pipeline-stream-task";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { buildIntroGuidance, buildMatchInsights } from "@/lib/intro-insights";
import { getIntroRefreshReasons, getResumeIntroSnapshot, isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import {
  buildCompareSection,
  buildIntroActionSummary,
  buildRefreshReasonBadges,
  getIntroInsights,
  type CopyFeedback,
  type IntroSectionKey
} from "@/lib/result-view";
import { serializeResumeIntroSnapshot } from "@/lib/resume-utils";
import { CompanySchema, ResumeSchema } from "@/lib/schemas";
import type { Intro } from "@/lib/types";

export default function ResultPage() {
  const {
    state,
    patch,
    clearStatus,
    setError
  } = usePipeline();
  const runStreamTask = usePipelineStreamTask();

  const isBusy = state.currentTask !== null;
  const canGenerate = Boolean(state.resumeConfirmedJson && state.companyConfirmedJson);
  const introFresh = isIntroFresh(state);
  const refreshReasons = getIntroRefreshReasons(state);
  const needsRefresh = refreshReasons.length > 0;
  const isIntroWorking = state.currentTask === "intro";
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const refreshReasonBadges = useMemo(
    () =>
      buildRefreshReasonBadges(
        refreshReasons,
        Boolean(state.resumeConfirmedJson),
        Boolean(state.companyConfirmedJson)
      ),
    [refreshReasons, state.companyConfirmedJson, state.resumeConfirmedJson]
  );
  const freshnessTone = !state.intro ? "info" : introFresh ? "ok" : "warn";
  const { heading: actionHeading, description: actionDescription } = useMemo(
    () =>
      buildIntroActionSummary({
        canGenerate,
        hasIntro: Boolean(state.intro),
        needsRefresh,
        refreshReasonBadges
      }),
    [canGenerate, needsRefresh, refreshReasonBadges, state.intro]
  );
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
  const resumeSnapshot = useMemo(() => getResumeIntroSnapshot(state), [state]);
  const canExportPdf = Boolean(state.intro && introFresh && confirmedResume && confirmedCompany && resumeSnapshot);
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

    await runStreamTask<Intro>({
      task: "intro",
      endpoint: "/api/intro/stream",
      requestBody: {
        resume: resume.data,
        company: company.data,
        tone: state.introTone,
        agent: toAgentRunOptions(state.agentSettings)
      },
      startMessage: "소개글을 만들고 있어요.",
      successMessage: "소개글이 준비됐어요.",
      abortMessage: "소개글 생성을 중단했어요.",
      fallbackErrorMessage: "소개글을 만드는 중 문제가 생겼어요.",
      onSuccess: (intro) => {
        patch((prev) => ({
          ...prev,
          // 비교 패널에서 직전 결과를 보여줄 수 있도록 생성 전 결과를 따로 보관한다.
          previousIntro: prev.intro,
          intro,
          introSavedAt: new Date().toISOString(),
          introSource: {
            resumeConfirmedJson: serializeResumeIntroSnapshot(resume.data),
            companyConfirmedJson: prev.companyConfirmedJson ?? ""
          }
        }));
      }
    });
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
            <a href="/resume" className="nav-btn">
              이력서로 가기
            </a>
            <a href="/company" className="nav-btn">
              공고로 가기
            </a>
          </div>
        </section>
      )}

      <IntroActionCard
        actionControls={
          <>
            <ToneInline disabled={isBusy || !canGenerate} />
            <ReasoningInline disabled={isBusy || !canGenerate} />
            <button type="button" className="primary" onClick={handleGenerate} disabled={isBusy || !canGenerate}>
              {state.currentTask === "intro" ? "만드는 중..." : introFresh ? "다시 만들기" : "소개글 만들기"}
            </button>
          </>
        }
        actionDescription={actionDescription}
        actionHeading={actionHeading}
        freshnessTone={freshnessTone}
        isWorking={isIntroWorking}
        refreshReasonBadges={refreshReasonBadges}
      />

      <IntroOutputCard
        copyAnnouncement={copyAnnouncement}
        copyFeedback={copyFeedback}
        introSections={introSections}
        isBusy={isBusy || !Boolean(state.intro)}
        onCopy={(section) => void copyText(section)}
      />

      {writingAnchorView && <WritingAnchorsCard view={writingAnchorView} />}

      {insightView && <InsightCard view={insightView} />}

      {state.previousIntro && state.intro && <CompareCard sections={compareSections} />}

      <PdfNextStepCard canExportPdf={canExportPdf} />
    </AppFrame>
  );
}
