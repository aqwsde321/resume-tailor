"use client";

import { useEffect, useRef, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import {
  ResumeCoreSection,
  ResumeEvidenceSection,
  ResumeExperienceSection,
  ResumeProjectsSection,
  ResumeSummaryCard
} from "@/app/components/resume-editor/sections";
import { SaveActionCard } from "@/app/components/workflow/save-action-card";
import { SourceInputCard } from "@/app/components/workflow/source-input-card";
import { UrlFetchPanel, type UrlFetchPreview } from "@/app/components/workflow/url-fetch-panel";
import { usePipelineStreamTask } from "@/app/hooks/use-pipeline-stream-task";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { formatSavedAt } from "@/lib/date-format";
import { stringifyInlineList, stringifyLineList } from "@/lib/list-input";
import {
  hasSameResumeIntroData,
  normalizeResumeJsonText,
  serializeResume,
  toResumeDraft
} from "@/lib/resume-utils";
import { usePipeline } from "@/lib/pipeline-context";
import { ResumeSchema } from "@/lib/schemas";
import type { ApiFailure, ApiSuccess, Resume, ResumeExperienceItem, ResumeProjectItem } from "@/lib/types";

function formatIssueDetails(errorMessage: string): string {
  return errorMessage.length > 180 ? `${errorMessage.slice(0, 180)}...` : errorMessage;
}

type ResumeRequiredFieldKey = "desiredPosition" | "techStack";

interface ResumeUrlFetchData {
  url: string;
  title: string;
  nameHint: string;
  desiredPositionHint: string;
  text: string;
}

export default function ResumePage() {
  const {
    state,
    patch,
    clearStatus,
    setError,
    setMessage
  } = usePipeline();
  const runStreamTask = usePipelineStreamTask();

  const isBusy = state.currentTask !== null;
  const isResumeWorking = state.currentTask === "resume";
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlFetchPreview | null>(null);
  const uiBusy = isBusy || isUrlLoading;
  const requiredFieldRefs = useRef<Partial<Record<ResumeRequiredFieldKey, HTMLElement | null>>>({});

  const [draft, setDraft] = useState<Resume>(() => toResumeDraft(state.resumeJsonText));
  const [techStackText, setTechStackText] = useState("");
  const [projectTechStackTexts, setProjectTechStackTexts] = useState<string[]>([]);
  const [achievementsText, setAchievementsText] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const normalizedDraftJson = serializeResume(draft);
  const normalizedConfirmedResumeJson = normalizeResumeJsonText(state.resumeConfirmedJson);
  const resumeNeedsConfirm = Boolean(state.resumeSavedAt) && normalizedConfirmedResumeJson !== normalizedDraftJson;

  // 저장 직전 실패하면 첫 번째 누락 필드로 이동시켜 사용자가 바로 보완할 수 있게 한다.
  const focusRequiredField = (key: ResumeRequiredFieldKey) => {
    const root = requiredFieldRefs.current[key];
    if (!root) {
      return;
    }

    root.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const target =
      root.matches("input, textarea")
        ? root
        : root.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled])");

    window.setTimeout(() => {
      target?.focus({ preventScroll: true });

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const caret = target.value.length;
        target.setSelectionRange(caret, caret);
      }
    }, 220);
  };
  const bindRequiredFieldRef =
    (key: ResumeRequiredFieldKey) => (node: HTMLElement | null) => {
      requiredFieldRefs.current[key] = node;
    };

  const missingResumeRequired: Array<{ key: ResumeRequiredFieldKey; label: string }> = [];
  if (!draft.desiredPosition.trim()) {
    missingResumeRequired.push({ key: "desiredPosition", label: "희망 직무" });
  }
  if (draft.techStack.length === 0) {
    missingResumeRequired.push({ key: "techStack", label: "기술 스택" });
  }

  const hasMissingResumeRequired = missingResumeRequired.length > 0;
  useEffect(() => {
    // 스트림 결과나 저장된 JSON이 바뀌면 편집용 draft와 줄단위 입력 상태를 다시 맞춘다.
    const next = toResumeDraft(state.resumeJsonText);
    setDraft(next);
    setTechStackText(stringifyInlineList(next.techStack));
    setProjectTechStackTexts(next.projects.map((project) => stringifyInlineList(project.techStack)));
    setAchievementsText(stringifyLineList(next.achievements));
    setStrengthsText(stringifyLineList(next.strengths));
  }, [state.resumeJsonText]);

  const setResumeText = (value: string) => {
    patch((prev) => ({
      ...prev,
      resumeText: value,
      resumeConfirmedJson: null,
      companyConfirmedJson: null,
      introSource: prev.introSource
    }));
  };

  const setResumeUrl = (value: string) => {
    patch((prev) => ({
      ...prev,
      resumeUrl: value
    }));
  };

  const setResumeInputMode = (mode: "text" | "file" | "url") => {
    if (mode !== "url") {
      setUrlPreview(null);
    }

    patch((prev) => ({
      ...prev,
      resumeInputMode: mode
    }));
  };

  const setResumeJsonText = (value: string) => {
    patch((prev) => ({
      ...prev,
      resumeJsonText: value,
      resumeConfirmedJson: null,
      companyConfirmedJson: null,
      introSource: prev.introSource
    }));
  };

  const syncDraft = (next: Resume) => {
    setDraft(next);
    setResumeJsonText(JSON.stringify(next, null, 2));
  };

  const updateExperience = (
    index: number,
    key: keyof ResumeExperienceItem,
    value: string
  ) => {
    const next: Resume = {
      ...draft,
      experience: draft.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    };

    syncDraft(next);
  };

  const updateProject = (
    index: number,
    key: keyof Pick<ResumeProjectItem, "name" | "description">,
    value: string
  ) => {
    const next: Resume = {
      ...draft,
      projects: draft.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    };

    syncDraft(next);
  };

  const updateProjectTechStack = (index: number, techStack: string[]) => {
    const next: Resume = {
      ...draft,
      projects: draft.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, techStack } : item
      )
    };

    syncDraft(next);
  };

  const handleTxtUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    clearStatus();

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("지금은 txt 파일만 올릴 수 있어요.");
      return;
    }

    const text = await file.text();
    setUrlPreview(null);
    setResumeText(text);
    setMessage("파일 내용을 입력칸에 넣었어요.");
  };

  const handleFetchUrl = async () => {
    clearStatus();

    if (!state.resumeUrl.trim()) {
      setError("이력서 URL을 먼저 넣어 주세요.");
      return;
    }

    setIsUrlLoading(true);
    setUrlPreview(null);

    try {
      // URL에서 읽은 본문을 먼저 채워 두고, 기존 정리 단계를 그대로 재사용한다.
      const response = await fetch("/api/resume/fetch-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: state.resumeUrl.trim()
        })
      });

      const payload = (await response.json()) as ApiSuccess<ResumeUrlFetchData> | ApiFailure;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "이력서 URL을 불러오지 못했어요." : payload.error.message);
      }

      let sourceHost = payload.data.url;
      try {
        sourceHost = new URL(payload.data.url).hostname.replace(/^www\./, "");
      } catch {
        sourceHost = payload.data.url;
      }

      setResumeUrl(payload.data.url);
      setResumeText(payload.data.text);
      setUrlPreview({
        title: payload.data.title || "이력서 페이지",
        sourceHost,
        textLength: payload.data.text.length
        ,
        fields: [
          { label: "이름", value: payload.data.nameHint },
          { label: "직무", value: payload.data.desiredPositionHint }
        ]
      });
      setMessage(
        payload.data.title
          ? `${payload.data.title} 내용을 입력칸에 넣었어요. 필요하면 아래에서 정리해 주세요.`
          : "URL에서 이력서 내용을 불러왔어요. 필요하면 아래에서 정리해 주세요."
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "이력서 URL을 불러오지 못했어요.");
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!state.resumeText.trim()) {
      setError("이력서 내용을 먼저 넣어 주세요.");
      return;
    }

    await runStreamTask<Resume>({
      task: "resume",
      endpoint: "/api/resume/stream",
      requestBody: {
        text: state.resumeText,
        agent: toAgentRunOptions(state.agentSettings)
      },
      startMessage: "이력서를 읽고 있어요.",
      successMessage: "초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.",
      abortMessage: "이력서 정리를 중단했어요.",
      fallbackErrorMessage: "이력서를 읽는 중 문제가 생겼어요.",
      onSuccess: (resume) => {
        patch((prev) => ({
          ...prev,
          resumeJsonText: JSON.stringify(resume, null, 2),
          resumeConfirmedJson: null,
          companyConfirmedJson: null,
          introSource: prev.introSource
        }));
      }
    });
  };

  const handleConfirmResume = () => {
    clearStatus();

    if (hasMissingResumeRequired) {
      focusRequiredField(missingResumeRequired[0].key);
      setError(`먼저 채워 주세요: ${missingResumeRequired.map((item) => item.label).join(", ")}`);
      return;
    }

    const validated = ResumeSchema.safeParse(draft);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`입력값을 다시 확인해 주세요: ${formatIssueDetails(details)}`);
      return;
    }

    const normalized = serializeResume(validated.data);
    const savedAt = new Date().toISOString();

    patch((prev) => {
      const resumeChanged = !hasSameResumeIntroData(normalized, prev.resumeConfirmedJson);

      return {
        ...prev,
        resumeJsonText: normalized,
        resumeConfirmedJson: normalized,
        resumeSavedAt: savedAt,
        // 이력서가 바뀌면 공고 확인본과 소개글 최신성 판단도 다시 맞춰야 한다.
        companyConfirmedJson: resumeChanged ? null : prev.companyConfirmedJson,
        introSource: prev.introSource
      };
    });

    setMessage("이력서를 저장했어요. 이제 공고를 정리해 주세요.");
  };

  const completedExperienceCount = draft.experience.filter((item) =>
    Boolean(item.company.trim() || item.role.trim() || item.description.trim())
  ).length;
  const completedProjectCount = draft.projects.filter((item) =>
    Boolean(item.name.trim() || item.description.trim() || item.techStack.length > 0)
  ).length;
  const techStackSummary =
    draft.techStack.length === 0
      ? "아직 없음"
      : draft.techStack.length <= 3
        ? draft.techStack.join(", ")
        : `${draft.techStack.slice(0, 3).join(", ")} 외 ${draft.techStack.length - 3}`;

  return (
    <AppFrame
      step="resume"
      title="이력서 정리"
      description="이력서 내용을 읽고, 필요한 정보만 정리해 저장합니다."
    >
      <SourceInputCard
        title="이력서 원문"
        inputMode={state.resumeInputMode}
        modes={[
          { value: "text", label: "붙여넣기", disabled: uiBusy },
          { value: "file", label: "파일 업로드", disabled: uiBusy },
          { value: "url", label: "URL 불러오기", disabled: uiBusy }
        ]}
        onInputModeChange={setResumeInputMode}
        fileSlot={
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={uiBusy}
          />
        }
        urlSlot={
          <UrlFetchPanel
            value={state.resumeUrl}
            onValueChange={(value) => {
              setUrlPreview(null);
              setResumeUrl(value);
            }}
            placeholder="https://노션-이력서-또는-포트폴리오-주소"
            disabled={uiBusy}
            loading={isUrlLoading}
            onFetch={() => void handleFetchUrl()}
            preview={urlPreview}
          />
        }
        textValue={state.resumeText}
        onTextChange={setResumeText}
        textPlaceholder={
          state.resumeInputMode === "url"
            ? "URL에서 불러온 이력서 내용이 여기에 채워집니다."
            : "이력서 내용을 붙여넣어 주세요."
        }
        textareaDisabled={uiBusy}
        actionSlot={
          <>
            <ReasoningInline disabled={uiBusy} />
            <button type="button" className="primary" onClick={handleAnalyze} disabled={uiBusy}>
              {state.currentTask === "resume" ? "정리 중..." : "내용 정리"}
            </button>
          </>
        }
        processing={isResumeWorking}
      />

      <ResumeSummaryCard
        completedExperienceCount={completedExperienceCount}
        completedProjectCount={completedProjectCount}
        draft={draft}
        isSaved={Boolean(state.resumeConfirmedJson)}
        isWorking={isResumeWorking}
        needsConfirm={resumeNeedsConfirm}
        techStackSummary={techStackSummary}
      />

      <ResumeCoreSection
        bindRequiredFieldRef={bindRequiredFieldRef}
        draft={draft}
        syncDraft={syncDraft}
        techStackText={techStackText}
        setTechStackText={setTechStackText}
        uiBusy={uiBusy}
      />

      <ResumeEvidenceSection
        achievementsText={achievementsText}
        draft={draft}
        setAchievementsText={setAchievementsText}
        setStrengthsText={setStrengthsText}
        strengthsText={strengthsText}
        syncDraft={syncDraft}
        uiBusy={uiBusy}
      />

      <ResumeExperienceSection
        draft={draft}
        syncDraft={syncDraft}
        uiBusy={uiBusy}
        updateExperience={updateExperience}
      />

      <ResumeProjectsSection
        draft={draft}
        projectTechStackTexts={projectTechStackTexts}
        setProjectTechStackTexts={setProjectTechStackTexts}
        syncDraft={syncDraft}
        uiBusy={uiBusy}
        updateProject={updateProject}
        updateProjectTechStack={updateProjectTechStack}
      />

      <SaveActionCard
        title="이력서 저장"
        savedAtLabel={state.resumeSavedAt ? `마지막 저장 ${formatSavedAt(state.resumeSavedAt)}` : undefined}
        missingItems={missingResumeRequired}
        onFocusMissing={focusRequiredField}
        onPrimary={handleConfirmResume}
        primaryDisabled={uiBusy || !state.resumeJsonText.trim() || hasMissingResumeRequired}
        primaryLabel="이력서 저장"
        nextHref={state.resumeConfirmedJson ? "/company" : undefined}
        nextLabel={state.resumeConfirmedJson ? "공고 정리로 가기" : undefined}
        busy={uiBusy}
      />
    </AppFrame>
  );
}
