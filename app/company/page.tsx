"use client";

import type { Route } from "next";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { ListPreview } from "@/app/components/list-preview";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import { TagInput } from "@/app/components/tag-input";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { formatSavedAt } from "@/lib/date-format";
import { parseListText, stringifyLineList } from "@/lib/list-input";
import type { ApiFailure, ApiSuccess, Company } from "@/lib/types";
import { hasResumeConfirmed, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema } from "@/lib/schemas";
import { isAbortError, postSseJson } from "@/lib/stream-client";

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

interface UrlPreview {
  title: string;
  companyName: string;
  jobTitle: string;
  sourceHost: string;
  textLength: number;
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

type CompanyRequiredFieldKey = "companyName" | "jobTitle" | "requirements";

export default function CompanyPage() {
  const {
    state,
    patch,
    clearStatus,
    setError,
    setMessage,
    clearLogs,
    startTask,
    finishTask,
    addLog,
    setTaskAborter
  } = usePipeline();

  const isBusy = state.currentTask !== null;
  const canEdit = hasResumeConfirmed(state);
  const isCompanyWorking = state.currentTask === "company";
  const requiredFieldRefs = useRef<Partial<Record<CompanyRequiredFieldKey, HTMLElement | null>>>({});
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null);
  const uiBusy = isBusy || isUrlLoading;

  const [draft, setDraft] = useState<Company>(() => toCompanyDraft(state.companyJsonText));
  const [requirementsText, setRequirementsText] = useState("");
  const [preferredSkillsText, setPreferredSkillsText] = useState("");
  const normalizedDraftJson = JSON.stringify(draft, null, 2);
  const companyNeedsConfirm =
    state.companyJsonText.trim().length > 0 && state.companyConfirmedJson !== normalizedDraftJson;

  // 저장 직전 실패하면 첫 번째 누락 필드로 이동시켜 사용자가 바로 수정할 수 있게 한다.
  const focusRequiredField = (key: CompanyRequiredFieldKey) => {
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
    // 스트림 결과나 외부 저장값이 바뀌면 편집용 draft와 줄단위 입력 상태를 다시 맞춘다.
    const next = toCompanyDraft(state.companyJsonText);
    setDraft(next);
    setRequirementsText(stringifyLineList(next.requirements));
    setPreferredSkillsText(stringifyLineList(next.preferredSkills));
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
    setCompanyJsonText(JSON.stringify(next, null, 2));
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

    clearLogs();
    startTask("company", "공고를 읽고 있어요.");
    const controller = new AbortController();
    setTaskAborter(() => controller.abort());

    try {
      const company = await postSseJson<Company>(
        "/api/company/stream",
        {
          text: state.companyText,
          agent: toAgentRunOptions(state.agentSettings)
        },
        {
          onLog: (payload) => addLog("company", payload),
          signal: controller.signal
        }
      );

      patch((prev) => ({
        ...prev,
        companyJsonText: JSON.stringify(company, null, 2),
        companyConfirmedJson: null,
        introSource: prev.introSource
      }));

      setMessage("초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.");
    } catch (error) {
      if (isAbortError(error)) {
        setMessage("공고 정리를 중단했어요.");
      } else {
        setError(error instanceof Error ? error.message : "공고를 읽는 중 문제가 생겼어요.");
      }
    } finally {
      setTaskAborter(null);
      finishTask();
    }
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
        companyName: payload.data.companyNameHint,
        jobTitle: payload.data.jobTitleHint,
        sourceHost,
        textLength: payload.data.text.length,
        warning: payload.data.warning
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

      <section className={`card card-accent ${isCompanyWorking ? "card-processing" : ""}`}>
        <div className="card-head">
          <div>
            <p className="card-kicker">입력</p>
            <h2>공고 넣기</h2>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={state.companyInputMode === "text" ? "tab active" : "tab"}
            onClick={() => setCompanyInputMode("text")}
            disabled={uiBusy || !canEdit}
          >
            붙여넣기
          </button>
          <button
            type="button"
            className={state.companyInputMode === "file" ? "tab active" : "tab"}
            onClick={() => setCompanyInputMode("file")}
            disabled={uiBusy || !canEdit}
          >
            파일 업로드
          </button>
          <button
            type="button"
            className={state.companyInputMode === "url" ? "tab active" : "tab"}
            onClick={() => setCompanyInputMode("url")}
            disabled={uiBusy || !canEdit}
          >
            URL 불러오기
          </button>
        </div>

        {state.companyInputMode === "file" && (
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={uiBusy || !canEdit}
          />
        )}

        {state.companyInputMode === "url" && (
          <div className="url-fetch-panel">
            <div className="url-fetch-row">
              <input
                type="url"
                value={state.companyUrl}
                onChange={(event) => {
                  setUrlPreview(null);
                  setCompanyUrl(event.target.value);
                }}
                placeholder="https://회사-채용페이지-주소"
                disabled={uiBusy || !canEdit}
              />
              <button
                type="button"
                className="secondary"
                onClick={() => void handleFetchUrl()}
                disabled={uiBusy || !canEdit}
              >
                {isUrlLoading ? "불러오는 중..." : "URL 불러오기"}
              </button>
            </div>
            {urlPreview && (
              <div className="url-preview" aria-live="polite">
                <div className="url-preview-head">
                  <strong>읽어온 정보</strong>
                  <div className="url-preview-badges">
                    <span className="inline-badge ok">본문 {urlPreview.textLength.toLocaleString()}자</span>
                    {urlPreview.warning && <span className="inline-badge warn">이미지 본문 감지</span>}
                  </div>
                </div>
                <p className="url-preview-title">{urlPreview.title}</p>
                {urlPreview.warning && <p className="url-preview-note">{urlPreview.warning}</p>}
                <div className="url-preview-meta">
                  <span className="url-preview-chip">
                    <span>회사</span>
                    <strong>{urlPreview.companyName || "확인 필요"}</strong>
                  </span>
                  <span className="url-preview-chip">
                    <span>포지션</span>
                    <strong>{urlPreview.jobTitle || "확인 필요"}</strong>
                  </span>
                  <span className="url-preview-chip">
                    <span>출처</span>
                    <strong>{urlPreview.sourceHost}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <textarea
          value={state.companyText}
          onChange={(event) => setCompanyText(event.target.value)}
          placeholder={
            state.companyInputMode === "url"
              ? "URL에서 불러온 공고 내용이 여기에 채워집니다."
              : "채용 공고 내용을 붙여넣어 주세요."
          }
          disabled={uiBusy || !canEdit}
        />

        <div className="action-panel">
          <div className="action-copy">
            <strong>초안 만들기</strong>
          </div>
          <div className="action-controls">
            <ReasoningInline disabled={uiBusy || !canEdit} />
            <button
              type="button"
              className="primary"
              onClick={handleAnalyze}
              disabled={uiBusy || !canEdit}
            >
              {state.currentTask === "company" ? "정리 중..." : "내용 정리"}
            </button>
          </div>
        </div>
      </section>

      <section className={`card card-review ${isCompanyWorking ? "card-processing review" : ""}`}>
        <div className="card-head">
          <div>
            <p className="card-kicker">확인</p>
            <h2>공고 다듬기</h2>
          </div>
          {companyNeedsConfirm ? (
            <span className="inline-badge warn">수정됨</span>
          ) : state.companyConfirmedJson ? (
            <span className="inline-badge ok">저장됨</span>
          ) : (
            <span className="inline-badge">아직 없음</span>
          )}
        </div>

        <div className="form-grid two">
          <label
            ref={(node) => {
              requiredFieldRefs.current.companyName = node;
            }}
            className={`field ${!draft.companyName.trim() ? "field-error" : ""}`}
          >
            <span>회사명</span>
            <input
              className="form-input"
              value={draft.companyName}
              onChange={(event) => syncDraft({ ...draft, companyName: event.target.value })}
              disabled={uiBusy || !canEdit}
            />
          </label>

          <label
            ref={(node) => {
              requiredFieldRefs.current.jobTitle = node;
            }}
            className={`field ${!draft.jobTitle.trim() ? "field-error" : ""}`}
          >
            <span>포지션</span>
            <input
              className="form-input"
              value={draft.jobTitle}
              onChange={(event) => syncDraft({ ...draft, jobTitle: event.target.value })}
              disabled={uiBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>회사 소개</span>
            <AutoGrowTextarea
              value={draft.companyDescription}
              onChange={(event) =>
                syncDraft({ ...draft, companyDescription: event.target.value })
              }
              disabled={uiBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>주요 업무</span>
            <AutoGrowTextarea
              value={draft.jobDescription}
              onChange={(event) => syncDraft({ ...draft, jobDescription: event.target.value })}
              disabled={uiBusy || !canEdit}
            />
          </label>

          <label
            ref={(node) => {
              requiredFieldRefs.current.requirements = node;
            }}
            className={`field field-full ${draft.requirements.length === 0 ? "field-error" : ""}`}
          >
            <span>필수 조건</span>
            <AutoGrowTextarea
              className="list-textarea"
              value={requirementsText}
              onChange={(event) => {
                const value = event.target.value;
                setRequirementsText(value);
                syncDraft({ ...draft, requirements: parseListText(value) });
              }}
              placeholder={"한 줄에 하나씩 입력해 주세요.\n예) Java 기반 서버 개발 경험"}
              disabled={uiBusy || !canEdit}
            />
            <ListPreview items={draft.requirements} label="지금 들어간 필수 조건" />
          </label>

          <label className="field field-full">
            <span>우대 조건</span>
            <AutoGrowTextarea
              className="list-textarea"
              value={preferredSkillsText}
              onChange={(event) => {
                const value = event.target.value;
                setPreferredSkillsText(value);
                syncDraft({ ...draft, preferredSkills: parseListText(value) });
              }}
              placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 대용량 트래픽 서비스 경험"}
              disabled={uiBusy || !canEdit}
            />
            <ListPreview items={draft.preferredSkills} label="지금 들어간 우대 조건" />
          </label>

          <div className="field field-full">
            <span>기술 스택</span>
            <TagInput
              ariaLabel="공고 기술 스택"
              values={draft.techStack}
              onChange={(values) => syncDraft({ ...draft, techStack: values })}
              placeholder="입력 후 Enter로 추가"
              disabled={uiBusy || !canEdit}
            />
          </div>
        </div>

        <div className="action-panel review">
          <div className="action-copy">
            <strong>공고 저장</strong>
            {state.companySavedAt && <span className="action-meta">마지막 저장 {formatSavedAt(state.companySavedAt)}</span>}
            {hasMissingCompanyRequired && (
              <p className="action-note warn">
                <span>저장 전 확인:</span>{" "}
                {missingCompanyRequired.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 && <span className="action-note-separator">, </span>}
                    <button
                      type="button"
                      className="action-note-link"
                      onClick={() => focusRequiredField(item.key)}
                      disabled={uiBusy || !canEdit}
                    >
                      {item.label}
                    </button>
                  </Fragment>
                ))}
              </p>
            )}
          </div>
          <div className="action-row">
            <button
              type="button"
              className="primary"
              onClick={handleConfirmCompany}
              disabled={
                  isBusy ||
                  isUrlLoading ||
                  !canEdit ||
                  !state.companyJsonText.trim() ||
                  hasMissingCompanyRequired
              }
            >
              공고 저장
            </button>
            {state.companyConfirmedJson && (
              <Link className="nav-btn" href={"/result" as Route}>
                소개글 만들기로 가기
              </Link>
            )}
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
