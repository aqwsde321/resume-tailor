"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppFrame } from "@/app/components/frame/app-frame";
import { CompanyDetailsSection } from "@/app/components/company-editor/details-section";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import { SaveActionCard } from "@/app/components/workflow/save-action-card";
import { SourceInputCard } from "@/app/components/workflow/source-input-card";
import { UrlFetchPanel, type UrlFetchPreview } from "@/app/components/workflow/url-fetch-panel";
import { useRequiredFieldFocus } from "@/app/hooks/use-required-field-focus";
import { usePipelineStreamTask } from "@/app/hooks/use-pipeline-stream-task";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { formatSavedAt } from "@/lib/date-format";
import { stringifyInlineList, stringifyLineList } from "@/lib/list-input";
import type { ApiFailure, ApiSuccess, Company } from "@/lib/types";
import { hasResumeConfirmed, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema } from "@/lib/schemas";

const EMPTY_COMPANY: Company = {
  companyName: "",
  companyDescription: "",
  jobTitle: "",
  jobDescription: "",
  requirements: [],
  preferredSkills: [],
  techStack: []
};

interface CompanyUrlFetchData {
  url: string;
  title: string;
  companyNameHint: string;
  jobTitleHint: string;
  text: string;
  warning?: string;
}

function formatIssueDetails(errorMessage: string): string {
  return errorMessage.length > 180 ? `${errorMessage.slice(0, 180)}...` : errorMessage;
}

function toCompanyDraft(jsonText: string): Company {
  if (!jsonText.trim()) {
    return EMPTY_COMPANY;
  }

  try {
    const raw = JSON.parse(jsonText);
    const parsed = CompanySchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    return EMPTY_COMPANY;
  }

  return EMPTY_COMPANY;
}

function serializeCompany(company: Company): string {
  return JSON.stringify(CompanySchema.parse(company), null, 2);
}

type CompanyRequiredFieldKey = "companyName" | "jobTitle" | "requirements";

export default function CompanyPage() {
  const {
    state,
    patch,
    clearStatus,
    setError,
    setMessage
  } = usePipeline();
  const runStreamTask = usePipelineStreamTask();

  const isBusy = state.currentTask !== null;
  const canEdit = hasResumeConfirmed(state);
  const isCompanyWorking = state.currentTask === "company";
  const { bindRequiredFieldRef, focusRequiredField } =
    useRequiredFieldFocus<CompanyRequiredFieldKey>();
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlFetchPreview | null>(null);
  const uiBusy = isBusy || isUrlLoading;

  const [draft, setDraft] = useState<Company>(() => toCompanyDraft(state.companyJsonText));
  const [techStackText, setTechStackText] = useState(() =>
    stringifyInlineList(toCompanyDraft(state.companyJsonText).techStack)
  );
  const [requirementsText, setRequirementsText] = useState(() =>
    stringifyLineList(toCompanyDraft(state.companyJsonText).requirements)
  );
  const [preferredSkillsText, setPreferredSkillsText] = useState(() =>
    stringifyLineList(toCompanyDraft(state.companyJsonText).preferredSkills)
  );
  const lastLocalCompanyJsonRef = useRef<string | null>(null);
  const normalizedDraftJson = JSON.stringify(draft, null, 2);
  const companyNeedsConfirm =
    state.companyJsonText.trim().length > 0 && state.companyConfirmedJson !== normalizedDraftJson;

  const missingCompanyRequired: Array<{ key: CompanyRequiredFieldKey; label: string }> = [];
  if (!draft.companyName.trim()) {
    missingCompanyRequired.push({ key: "companyName", label: "회사명" });
  }
  if (!draft.jobTitle.trim()) {
    missingCompanyRequired.push({ key: "jobTitle", label: "포지션" });
  }
  if (draft.requirements.length === 0) {
    missingCompanyRequired.push({ key: "requirements", label: "필수 조건" });
  }

  const hasMissingCompanyRequired = missingCompanyRequired.length > 0;
  useEffect(() => {
    if (lastLocalCompanyJsonRef.current === state.companyJsonText) {
      return;
    }

    // 외부 저장값이 바뀌면 편집용 draft와 줄단위 입력 상태를 다시 맞춘다.
    const next = toCompanyDraft(state.companyJsonText);
    setDraft(next);
    setTechStackText(stringifyInlineList(next.techStack));
    setRequirementsText(stringifyLineList(next.requirements));
    setPreferredSkillsText(stringifyLineList(next.preferredSkills));
    lastLocalCompanyJsonRef.current = state.companyJsonText;
  }, [state.companyJsonText]);

  const setCompanyText = (value: string) => {
    patch((prev) => ({
      ...prev,
      companyText: value,
      companyConfirmedJson: null,
      introSource: prev.introSource
    }));
  };

  const setCompanyUrl = (value: string) => {
    patch((prev) => ({
      ...prev,
      companyUrl: value
    }));
  };

  const setCompanyInputMode = (mode: "text" | "file" | "url") => {
    if (mode !== "url") {
      setUrlPreview(null);
    }

    patch((prev) => ({
      ...prev,
      companyInputMode: mode
    }));
  };

  const setCompanyJsonText = (value: string) => {
    patch((prev) => ({
      ...prev,
      companyJsonText: value,
      companyConfirmedJson: null,
      introSource: prev.introSource
    }));
  };

  const syncDraft = (next: Company) => {
    setDraft(next);
    const nextJson = serializeCompany(next);
    lastLocalCompanyJsonRef.current = nextJson;
    setCompanyJsonText(nextJson);
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
    setCompanyText(text);
    setMessage("파일 내용을 입력칸에 넣었어요.");
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!canEdit) {
      setError("먼저 이력서를 저장해 주세요.");
      return;
    }

    if (!state.companyText.trim()) {
      setError("채용 공고 내용을 먼저 넣어 주세요.");
      return;
    }

    await runStreamTask<Company>({
      task: "company",
      endpoint: "/api/company/stream",
      requestBody: {
        text: state.companyText,
        agent: toAgentRunOptions(state.agentSettings)
      },
      startMessage: "공고를 읽고 있어요.",
      successMessage: "초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.",
      abortMessage: "공고 정리를 중단했어요.",
      fallbackErrorMessage: "공고를 읽는 중 문제가 생겼어요.",
      onSuccess: (company) => {
        patch((prev) => ({
          ...prev,
          companyJsonText: JSON.stringify(company, null, 2),
          companyConfirmedJson: null,
          introSource: prev.introSource
        }));
      }
    });
  };

  const handleFetchUrl = async () => {
    clearStatus();

    if (!canEdit) {
      setError("먼저 이력서를 저장해 주세요.");
      return;
    }

    if (!state.companyUrl.trim()) {
      setError("공고 URL을 먼저 넣어 주세요.");
      return;
    }

    setIsUrlLoading(true);
    setUrlPreview(null);

    try {
      // URL에서 읽은 원문과 힌트를 먼저 채워 두고, 사용자가 아래 편집 폼에서 바로 다듬게 한다.
      const response = await fetch("/api/company/fetch-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: state.companyUrl.trim()
        })
      });

      const payload = (await response.json()) as ApiSuccess<CompanyUrlFetchData> | ApiFailure;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "공고 URL을 불러오지 못했어요." : payload.error.message);
      }

      let sourceHost = payload.data.url;
      try {
        sourceHost = new URL(payload.data.url).hostname.replace(/^www\./, "");
      } catch {
        sourceHost = payload.data.url;
      }

      setCompanyUrl(payload.data.url);
      setCompanyText(payload.data.text);
      setUrlPreview({
        title: payload.data.title || "공고 페이지",
        sourceHost,
        textLength: payload.data.text.length,
        warning: payload.data.warning,
        fields: [
          { label: "회사", value: payload.data.companyNameHint },
          { label: "포지션", value: payload.data.jobTitleHint }
        ]
      });
      setMessage(
        payload.data.title
          ? `${payload.data.title} 내용을 입력칸에 넣었어요. 필요하면 아래에서 다듬어 주세요.`
          : "URL에서 공고 내용을 불러왔어요. 필요하면 아래에서 다듬어 주세요."
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "공고 URL을 불러오지 못했어요.");
    } finally {
      setIsUrlLoading(false);
    }
  };

  const handleConfirmCompany = () => {
    clearStatus();

    if (hasMissingCompanyRequired) {
      focusRequiredField(missingCompanyRequired[0].key);
      setError(`먼저 채워 주세요: ${missingCompanyRequired.map((item) => item.label).join(", ")}`);
      return;
    }

    const validated = CompanySchema.safeParse(draft);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`입력값을 다시 확인해 주세요: ${formatIssueDetails(details)}`);
      return;
    }

    // 다음 단계에는 스키마 검증을 통과한 정규화 JSON만 넘긴다.
    const normalized = JSON.stringify(validated.data, null, 2);
    const savedAt = new Date().toISOString();

    patch((prev) => ({
      ...prev,
      companyJsonText: normalized,
      companyConfirmedJson: normalized,
      companySavedAt: savedAt,
      introSource: prev.introSource
    }));

    setMessage("공고를 저장했어요. 이제 소개글을 만들어 보세요.");
  };

  return (
    <AppFrame
      step="company"
      title="공고 정리"
      description="채용 공고에서 필요한 내용만 뽑아 저장합니다."
    >
      {!canEdit && (
        <section className="card card-alert">
          <p className="card-kicker">먼저 하기</p>
          <h2>먼저 이력서를 저장해 주세요.</h2>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              이력서로 가기
            </Link>
          </div>
        </section>
      )}

      <SourceInputCard
        title="공고 원문"
        inputMode={state.companyInputMode}
        modes={[
          { value: "text", label: "붙여넣기", disabled: uiBusy || !canEdit },
          { value: "file", label: "파일 업로드", disabled: uiBusy || !canEdit },
          { value: "url", label: "URL 불러오기", disabled: uiBusy || !canEdit }
        ]}
        onInputModeChange={setCompanyInputMode}
        fileSlot={
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={uiBusy || !canEdit}
          />
        }
        urlSlot={
          <UrlFetchPanel
            value={state.companyUrl}
            onValueChange={(value) => {
              setUrlPreview(null);
              setCompanyUrl(value);
            }}
            placeholder="https://회사-채용페이지-주소"
            disabled={uiBusy || !canEdit}
            loading={isUrlLoading}
            onFetch={() => void handleFetchUrl()}
            preview={urlPreview}
          />
        }
        textValue={state.companyText}
        onTextChange={setCompanyText}
        textPlaceholder={
          state.companyInputMode === "url"
            ? "URL에서 불러온 공고 내용이 여기에 채워집니다."
            : "채용 공고 내용을 붙여넣어 주세요."
        }
        textareaDisabled={uiBusy || !canEdit}
        actionSlot={
          <>
            <ReasoningInline disabled={uiBusy || !canEdit} />
            <button
              type="button"
              className="primary"
              onClick={handleAnalyze}
              disabled={uiBusy || !canEdit}
            >
              {state.currentTask === "company" ? "정리 중..." : "내용 정리"}
            </button>
          </>
        }
        processing={isCompanyWorking}
      />

      <CompanyDetailsSection
        bindRequiredFieldRef={bindRequiredFieldRef}
        canEdit={canEdit}
        companyNeedsConfirm={companyNeedsConfirm}
        draft={draft}
        isSaved={Boolean(state.companyConfirmedJson)}
        isWorking={isCompanyWorking}
        requirementsText={requirementsText}
        preferredSkillsText={preferredSkillsText}
        setRequirementsText={setRequirementsText}
        setPreferredSkillsText={setPreferredSkillsText}
        setTechStackText={setTechStackText}
        syncDraft={syncDraft}
        techStackText={techStackText}
        uiBusy={uiBusy}
      />

      <SaveActionCard
        title="공고 저장"
        savedAtLabel={state.companySavedAt ? `마지막 저장 ${formatSavedAt(state.companySavedAt)}` : undefined}
        missingItems={missingCompanyRequired}
        onFocusMissing={focusRequiredField}
        onPrimary={handleConfirmCompany}
        primaryDisabled={
          isBusy ||
          isUrlLoading ||
          !canEdit ||
          !state.companyJsonText.trim() ||
          hasMissingCompanyRequired
        }
        primaryLabel="공고 저장"
        nextHref={state.companyConfirmedJson ? "/result" : undefined}
        nextLabel={state.companyConfirmedJson ? "소개글 만들기로 가기" : undefined}
        busy={uiBusy || !canEdit}
      />
    </AppFrame>
  );
}
