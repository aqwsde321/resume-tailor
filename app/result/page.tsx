"use client";

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
import { useResultPageView } from "@/app/hooks/use-result-page-view";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { usePipeline } from "@/lib/pipeline-context";
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
  const isIntroWorking = state.currentTask === "intro";
  const {
    actionDescription,
    actionHeading,
    canExportPdf,
    canGenerate,
    compareSections,
    copyAnnouncement,
    copyFeedback,
    copyText,
    freshnessTone,
    insightView,
    introFresh,
    introSections,
    refreshReasonBadges,
    writingAnchorView
  } = useResultPageView(state);

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
