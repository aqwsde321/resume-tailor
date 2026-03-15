"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildIntroGuidance, buildMatchInsights } from "@/entities/intro/model/intro-insights";
import {
  getIntroRefreshReasons,
  getResumeIntroSnapshot,
  isIntroFresh,
  type PipelineState
} from "@/entities/pipeline/model/pipeline-context";
import {
  buildCompareSection,
  buildIntroActionSummary,
  buildRefreshReasonBadges,
  getIntroInsights,
  type CopyFeedback,
  type IntroSectionKey
} from "@/features/result/model/result-view";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";

export function useResultPageView(state: PipelineState) {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const canGenerate = Boolean(state.resumeConfirmedJson && state.companyConfirmedJson);
  const introFresh = isIntroFresh(state);
  const refreshReasons = getIntroRefreshReasons(state);
  const needsRefresh = refreshReasons.length > 0;

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  const refreshReasonBadges = useMemo(
    () =>
      buildRefreshReasonBadges(
        refreshReasons,
        Boolean(state.resumeConfirmedJson),
        Boolean(state.companyConfirmedJson)
      ),
    [refreshReasons, state.companyConfirmedJson, state.resumeConfirmedJson]
  );
  const freshnessTone: "info" | "ok" | "warn" = !state.intro ? "info" : introFresh ? "ok" : "warn";
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

  return {
    actionDescription,
    actionHeading,
    canExportPdf,
    canGenerate,
    compareSections,
    copyAnnouncement,
    copyFeedback,
    copyText,
    confirmedCompany,
    confirmedResume,
    freshnessTone,
    insightView,
    introFresh,
    introSections,
    refreshReasonBadges,
    writingAnchorView
  };
}
