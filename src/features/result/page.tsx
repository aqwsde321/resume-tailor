"use client";

import { useState } from "react";

import { AppFrame } from "@/shared/ui/frame/app-frame";
import {
  CompareCard,
  ExperienceDiscoveryCard,
  InsightCard,
  IntroActionCard,
  IntroOutputCard,
  PdfNextStepCard,
  WritingAnchorsCard
} from "@/features/result/ui/sections";
import { ReasoningInline } from "@/shared/ui/reasoning-inline";
import { ToneInline } from "@/shared/ui/tone-inline";
import { usePipelineStreamTask } from "@/shared/hooks/use-pipeline-stream-task";
import { useResultPageView } from "@/features/result/hooks/use-result-page-view";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import {
  getResumeIntroSnapshot,
  usePipeline
} from "@/entities/pipeline/model/pipeline-context";
import {
  addDiscoveredExperienceToResume,
  isExperienceDiscoverySessionCurrent as isDiscoverySourceCurrent
} from "@/entities/intro/model/experience-discovery";
import {
  parseResumeJson,
  serializeResume,
  serializeResumeIntroSnapshot
} from "@/entities/resume/model/resume-utils";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";
import type {
  Company,
  DiscoveredExperienceDraft,
  ExperienceDiscoveryMessage,
  ExperienceDiscoveryTurn,
  Intro,
  Resume
} from "@/shared/lib/types";

export default function ResultPage() {
  const {
    state,
    patch,
    clearStatus,
    setError,
    setMessage
  } = usePipeline();
  const runStreamTask = usePipelineStreamTask();
  const [discoveryAnswer, setDiscoveryAnswer] = useState("");

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

  const currentResumeSnapshot = getResumeIntroSnapshot(state);
  const discoverySession = isDiscoverySourceCurrent(
    state.experienceDiscovery,
    currentResumeSnapshot,
    state.companyConfirmedJson
  )
    ? state.experienceDiscovery
    : null;
  const discoveryGaps = introFresh ? state.intro?.gapNotes ?? [] : [];

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

  const requestExperienceDiscoveryTurn = async (params: {
    resume: Resume;
    company: Company;
    requirement: string;
    messages: ExperienceDiscoveryMessage[];
    sourceResumeSnapshot: string;
    sourceCompanyJson: string;
  }) => {
    let completed = false;

    await runStreamTask<ExperienceDiscoveryTurn>({
      task: "experienceDiscovery",
      endpoint: "/api/experience-discovery",
      requestBody: {
        resume: params.resume,
        company: params.company,
        requirement: params.requirement,
        messages: params.messages,
        agent: toAgentRunOptions(state.agentSettings)
      },
      startMessage: "부족한 요건과 연결할 경험을 살펴보고 있어요.",
      successMessage: "경험 발굴 답변을 준비했어요.",
      abortMessage: "경험 발굴을 중단했어요.",
      fallbackErrorMessage: "경험을 찾는 중 문제가 생겼어요.",
      onSuccess: (turn) => {
        completed = true;
        patch((prev) => {
          const active = prev.experienceDiscovery;
          if (
            !isDiscoverySourceCurrent(active, getResumeIntroSnapshot(prev), prev.companyConfirmedJson) ||
            active.requirement !== params.requirement ||
            active.sourceResumeSnapshot !== params.sourceResumeSnapshot ||
            active.sourceCompanyJson !== params.sourceCompanyJson
          ) {
            return prev;
          }

          return {
            ...prev,
            experienceDiscovery: {
              ...active,
              ...turn,
              messages: [...params.messages, { role: "assistant", content: turn.message }]
            }
          };
        });
      }
    });

    return completed;
  };

  const handleStartExperienceDiscovery = async (requirement: string) => {
    clearStatus();

    if (!introFresh || !state.resumeConfirmedJson || !state.companyConfirmedJson) {
      setError("최신 소개글을 만든 뒤 부족한 요건을 확인해 주세요.");
      return;
    }

    let resumeRaw: unknown;
    let companyRaw: unknown;
    try {
      resumeRaw = JSON.parse(state.resumeConfirmedJson);
      companyRaw = JSON.parse(state.companyConfirmedJson);
    } catch {
      setError("저장된 이력서와 공고를 읽지 못했어요. 다시 확인해 주세요.");
      return;
    }

    const resume = ResumeSchema.safeParse(resumeRaw);
    const company = CompanySchema.safeParse(companyRaw);
    if (!resume.success || !company.success) {
      setError("저장한 이력서와 공고 내용을 다시 확인해 주세요.");
      return;
    }

    const sourceResumeSnapshot = serializeResumeIntroSnapshot(resume.data);
    const sourceCompanyJson = state.companyConfirmedJson;
    const session = {
      requirement,
      messages: [],
      status: "question" as const,
      message: "",
      draft: null,
      sourceResumeSnapshot,
      sourceCompanyJson
    };

    patch((prev) => ({
      ...prev,
      experienceDiscovery: session
    }));
    setDiscoveryAnswer("");

    const completed = await requestExperienceDiscoveryTurn({
      resume: resume.data,
      company: company.data,
      requirement,
      messages: [],
      sourceResumeSnapshot,
      sourceCompanyJson
    });

    if (!completed) {
      patch((prev) =>
        prev.experienceDiscovery?.requirement === requirement &&
        prev.experienceDiscovery.sourceResumeSnapshot === sourceResumeSnapshot &&
        prev.experienceDiscovery.sourceCompanyJson === sourceCompanyJson
          ? { ...prev, experienceDiscovery: null }
          : prev
      );
    }
  };

  const handleSubmitDiscoveryAnswer = async () => {
    const answer = discoveryAnswer.trim();
    const session = discoverySession;
    const resume = parseResumeJson(state.resumeConfirmedJson);
    let companyResult: ReturnType<typeof CompanySchema.safeParse> | null = null;
    try {
      companyResult = state.companyConfirmedJson
        ? CompanySchema.safeParse(JSON.parse(state.companyConfirmedJson))
        : null;
    } catch {
      setError("저장된 공고 내용을 읽지 못했어요. 다시 확인해 주세요.");
      return;
    }

    if (!answer || !session || session.status !== "question" || !resume || !companyResult?.success) {
      return;
    }

    const messages = [...session.messages, { role: "user" as const, content: answer }];
    const completed = await requestExperienceDiscoveryTurn({
      resume,
      company: companyResult.data,
      requirement: session.requirement,
      messages,
      sourceResumeSnapshot: session.sourceResumeSnapshot,
      sourceCompanyJson: session.sourceCompanyJson
    });

    if (completed) {
      setDiscoveryAnswer("");
    }
  };

  const handleChangeDiscoveryDraft = (draft: DiscoveredExperienceDraft) => {
    patch((prev) => {
      const active = prev.experienceDiscovery;
      if (
        !isDiscoverySourceCurrent(active, getResumeIntroSnapshot(prev), prev.companyConfirmedJson) ||
        !active.draft
      ) {
        return prev;
      }

      return {
        ...prev,
        experienceDiscovery: {
          ...active,
          draft
        }
      };
    });
  };

  const handleApproveDiscoveryDraft = () => {
    const session = discoverySession;
    const resume = parseResumeJson(state.resumeConfirmedJson);
    if (!session || session.status !== "draft" || !session.draft || !resume) {
      return;
    }

    const updatedResume = addDiscoveredExperienceToResume(resume, session.draft);
    if (updatedResume === resume) {
      setError("초안에 제목과 경험 설명을 채운 뒤 이력서에 추가해 주세요.");
      return;
    }

    const normalized = serializeResume(updatedResume);
    const savedAt = new Date().toISOString();
    patch((prev) => {
      if (
        !isDiscoverySourceCurrent(
          prev.experienceDiscovery,
          getResumeIntroSnapshot(prev),
          prev.companyConfirmedJson
        ) ||
        prev.experienceDiscovery.requirement !== session.requirement
      ) {
        return prev;
      }

      return {
        ...prev,
        resumeJsonText: normalized,
        resumeConfirmedJson: normalized,
        resumeSavedAt: savedAt,
        experienceDiscovery: null
      };
    });
    setDiscoveryAnswer("");
    setMessage("경험을 이력서에 추가했어요. 소개글을 다시 만들어 주세요.");
  };

  const handleDiscardDiscovery = () => {
    patch((prev) => ({
      ...prev,
      experienceDiscovery: null
    }));
    setDiscoveryAnswer("");
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

      <ExperienceDiscoveryCard
        answer={discoveryAnswer}
        gaps={discoveryGaps}
        isBusy={isBusy}
        session={discoverySession}
        onAnswerChange={setDiscoveryAnswer}
        onApproveDraft={handleApproveDiscoveryDraft}
        onDiscard={handleDiscardDiscovery}
        onDraftChange={handleChangeDiscoveryDraft}
        onStart={(requirement) => void handleStartExperienceDiscovery(requirement)}
        onSubmitAnswer={() => void handleSubmitDiscoveryAnswer()}
      />

      {state.previousIntro && state.intro && <CompareCard sections={compareSections} />}

      <PdfNextStepCard canExportPdf={canExportPdf} />
    </AppFrame>
  );
}
