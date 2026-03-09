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
import {
  hasSameResumeIntroData,
  makeEmptyExperience,
  makeEmptyProject,
  normalizeResumeJsonText,
  serializeResume,
  toResumeDraft
} from "@/lib/resume-utils";
import { usePipeline } from "@/lib/pipeline-context";
import { ResumeSchema } from "@/lib/schemas";
import { isAbortError, postSseJson } from "@/lib/stream-client";
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

interface UrlPreview {
  title: string;
  name: string;
  desiredPosition: string;
  sourceHost: string;
  textLength: number;
}

export default function ResumePage() {
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
  const isResumeWorking = state.currentTask === "resume";
  const [isUrlLoading, setIsUrlLoading] = useState(false);
  const [urlPreview, setUrlPreview] = useState<UrlPreview | null>(null);
  const uiBusy = isBusy || isUrlLoading;
  const requiredFieldRefs = useRef<Partial<Record<ResumeRequiredFieldKey, HTMLElement | null>>>({});

  const [draft, setDraft] = useState<Resume>(() => toResumeDraft(state.resumeJsonText));
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
        name: payload.data.nameHint,
        desiredPosition: payload.data.desiredPositionHint,
        sourceHost,
        textLength: payload.data.text.length
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

    clearLogs();
    startTask("resume", "이력서를 읽고 있어요.");
    const controller = new AbortController();
    setTaskAborter(() => controller.abort());

    try {
      const resume = await postSseJson<Resume>(
        "/api/resume/stream",
        {
          text: state.resumeText,
          agent: toAgentRunOptions(state.agentSettings)
        },
        {
          onLog: (payload) => addLog("resume", payload),
          signal: controller.signal
        }
      );

      patch((prev) => ({
        ...prev,
        resumeJsonText: JSON.stringify(resume, null, 2),
        resumeConfirmedJson: null,
        companyConfirmedJson: null,
        introSource: prev.introSource
      }));

      setMessage("초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.");
    } catch (error) {
      if (isAbortError(error)) {
        setMessage("이력서 정리를 중단했어요.");
      } else {
        setError(error instanceof Error ? error.message : "이력서를 읽는 중 문제가 생겼어요.");
      }
    } finally {
      setTaskAborter(null);
      finishTask();
    }
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

  return (
    <AppFrame
      step="resume"
      title="이력서 정리"
      description="이력서 내용을 읽고, 필요한 정보만 정리해 저장합니다."
    >
      <section className={`card card-accent ${isResumeWorking ? "card-processing" : ""}`}>
        <div className="card-head">
          <div>
            <p className="card-kicker">입력</p>
            <h2>이력서 넣기</h2>
          </div>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={state.resumeInputMode === "text" ? "tab active" : "tab"}
            onClick={() => setResumeInputMode("text")}
            disabled={uiBusy}
          >
            붙여넣기
          </button>
          <button
            type="button"
            className={state.resumeInputMode === "file" ? "tab active" : "tab"}
            onClick={() => setResumeInputMode("file")}
            disabled={uiBusy}
          >
            파일 업로드
          </button>
          <button
            type="button"
            className={state.resumeInputMode === "url" ? "tab active" : "tab"}
            onClick={() => setResumeInputMode("url")}
            disabled={uiBusy}
          >
            URL 불러오기
          </button>
        </div>

        {state.resumeInputMode === "file" && (
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={uiBusy}
          />
        )}

        {state.resumeInputMode === "url" && (
          <div className="url-fetch-panel">
            <div className="url-fetch-row">
              <input
                type="url"
                value={state.resumeUrl}
                onChange={(event) => {
                  setUrlPreview(null);
                  setResumeUrl(event.target.value);
                }}
                placeholder="https://노션-이력서-또는-포트폴리오-주소"
                disabled={uiBusy}
              />
              <button type="button" className="secondary" onClick={() => void handleFetchUrl()} disabled={uiBusy}>
                {isUrlLoading ? "불러오는 중..." : "URL 불러오기"}
              </button>
            </div>
            {urlPreview && (
              <div className="url-preview" aria-live="polite">
                <div className="url-preview-head">
                  <strong>읽어온 정보</strong>
                  <div className="url-preview-badges">
                    <span className="inline-badge ok">본문 {urlPreview.textLength.toLocaleString()}자</span>
                  </div>
                </div>
                <p className="url-preview-title">{urlPreview.title}</p>
                <div className="url-preview-meta">
                  <span className="url-preview-chip">
                    <span>이름</span>
                    <strong>{urlPreview.name || "확인 필요"}</strong>
                  </span>
                  <span className="url-preview-chip">
                    <span>직무</span>
                    <strong>{urlPreview.desiredPosition || "확인 필요"}</strong>
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
          value={state.resumeText}
          onChange={(event) => setResumeText(event.target.value)}
          placeholder={
            state.resumeInputMode === "url"
              ? "URL에서 불러온 이력서 내용이 여기에 채워집니다."
              : "이력서 내용을 붙여넣어 주세요."
          }
          disabled={uiBusy}
        />

        <div className="action-panel">
          <div className="action-copy">
            <strong>초안 만들기</strong>
          </div>
          <div className="action-controls">
            <ReasoningInline disabled={uiBusy} />
            <button type="button" className="primary" onClick={handleAnalyze} disabled={uiBusy}>
              {state.currentTask === "resume" ? "정리 중..." : "내용 정리"}
            </button>
          </div>
        </div>
      </section>

      <section className={`card card-review ${isResumeWorking ? "card-processing review" : ""}`}>
        <div className="card-head">
          <div>
            <p className="card-kicker">확인</p>
            <h2>이력서 다듬기</h2>
            <p className="card-copy">
              여기서는 소개글 생성에 필요한 정보만 정리합니다. PDF용 헤더, 연락처, 링크, 출력 전용 Highlights는
              step 4에서 마지막으로 손봅니다.
            </p>
          </div>
          {resumeNeedsConfirm ? (
            <span className="inline-badge warn">수정됨</span>
          ) : state.resumeConfirmedJson ? (
            <span className="inline-badge ok">저장됨</span>
          ) : (
            <span className="inline-badge">아직 없음</span>
          )}
        </div>

        <div className="mini-grid compact">
          <div className={`mini-stat ${draft.desiredPosition.trim() && draft.techStack.length > 0 ? "ok" : "warn"}`}>
            <span>핵심 정보</span>
            <strong>
              {draft.desiredPosition.trim()
                ? `${draft.desiredPosition} · ${draft.techStack.length}개 스택`
                : "희망 직무와 기술 스택 확인 필요"}
            </strong>
          </div>
          <div className={`mini-stat ${draft.achievements.length > 0 || draft.strengths.length > 0 ? "ok" : "warn"}`}>
            <span>소개글 근거</span>
            <strong>{`${draft.achievements.length}개 성과 · ${draft.strengths.length}개 강점`}</strong>
          </div>
          <div className="mini-stat">
            <span>경력 / 프로젝트</span>
            <strong>{`${completedExperienceCount}개 경력 · ${completedProjectCount}개 프로젝트`}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">1. 핵심 정보</p>
            <h2>소개글의 뼈대</h2>
          </div>
        </div>

        <div className="form-grid resume-core-grid">
          <label className="field">
            <span>이름</span>
            <input
              className="form-input"
              value={draft.name}
              onChange={(event) => syncDraft({ ...draft, name: event.target.value })}
              disabled={uiBusy}
            />
          </label>

          <label
            ref={(node) => {
              requiredFieldRefs.current.desiredPosition = node;
            }}
            className={`field ${!draft.desiredPosition.trim() ? "field-error" : ""}`}
          >
            <span>희망 직무</span>
            <input
              className="form-input"
              value={draft.desiredPosition}
              onChange={(event) => syncDraft({ ...draft, desiredPosition: event.target.value })}
              disabled={uiBusy}
            />
          </label>

          <label className="field">
            <span>경력 연차</span>
            <input
              className="form-input"
              type="number"
              min={0}
              value={draft.careerYears}
              onChange={(event) =>
                syncDraft({
                  ...draft,
                  careerYears: Number.isNaN(Number(event.target.value))
                    ? 0
                    : Math.max(0, Number(event.target.value))
                })
              }
              disabled={uiBusy}
            />
          </label>

          <div
            ref={(node) => {
              requiredFieldRefs.current.techStack = node;
            }}
            className={`field field-full ${draft.techStack.length === 0 ? "field-error" : ""}`}
          >
            <span>기술 스택</span>
            <TagInput
              ariaLabel="기술 스택"
              values={draft.techStack}
              onChange={(values) => syncDraft({ ...draft, techStack: values })}
              placeholder="입력 후 Enter로 추가"
              disabled={uiBusy}
            />
          </div>

          <label className="field field-full">
            <span>요약</span>
            <AutoGrowTextarea
              value={draft.summary}
              onChange={(event) => syncDraft({ ...draft, summary: event.target.value })}
              disabled={uiBusy}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">2. 소개글 근거</p>
            <h2>성과와 강점</h2>
            <p className="card-copy">한 줄씩 정리할수록 소개글이 더 선명해집니다.</p>
          </div>
        </div>

        <div className="form-grid two">
          <label className="field field-full">
            <span>성과</span>
            <AutoGrowTextarea
              className="list-textarea"
              value={achievementsText}
              onChange={(event) => {
                const value = event.target.value;
                setAchievementsText(value);
                syncDraft({ ...draft, achievements: parseListText(value) });
              }}
              placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 결제 전환율 18% 개선"}
              disabled={uiBusy}
            />
            <ListPreview items={draft.achievements} label="지금 들어간 성과" />
          </label>

          <label className="field field-full">
            <span>강점</span>
            <AutoGrowTextarea
              className="list-textarea"
              value={strengthsText}
              onChange={(event) => {
                const value = event.target.value;
                setStrengthsText(value);
                syncDraft({ ...draft, strengths: parseListText(value) });
              }}
              placeholder={"한 줄에 하나씩 입력해 주세요.\n예) 복잡한 요구사항을 구조화해 정리하는 편"}
              disabled={uiBusy}
            />
            <ListPreview items={draft.strengths} label="지금 들어간 강점" />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">3. 경력</p>
            <h2>필요한 카드만 펼쳐서 수정</h2>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => syncDraft({ ...draft, experience: [...draft.experience, makeEmptyExperience()] })}
            disabled={uiBusy}
          >
            경력 추가
          </button>
        </div>

        {draft.experience.length === 0 && <p className="muted-help">아직 경력이 없어요.</p>}

        <div className="array-section">
          {draft.experience.map((item, index) => (
            <details key={`experience-${index}`} className="collapsible-section" open={draft.experience.length === 1}>
              <summary>
                <div className="resume-item-summary">
                  <p className="card-kicker">경력 {index + 1}</p>
                  <strong>{item.company.trim() || item.role.trim() || `경력 ${index + 1}`}</strong>
                  <p>{item.period.trim() || "기간을 입력해 주세요."}</p>
                </div>
                <span className="inline-badge">{item.role.trim() || "역할 입력"}</span>
              </summary>

              <div className="collapsible-content">
                <div className="array-item-head">
                  <span className="muted-help">소개글에 반영할 핵심 역할과 문제 해결 경험만 남기면 충분합니다.</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      syncDraft({
                        ...draft,
                        experience: draft.experience.filter((_, itemIndex) => itemIndex !== index)
                      })
                    }
                    disabled={uiBusy}
                  >
                    삭제
                  </button>
                </div>

                <div className="form-grid two">
                  <label className="field">
                    <span>회사</span>
                    <input
                      className="form-input"
                      value={item.company}
                      onChange={(event) => updateExperience(index, "company", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                  <label className="field">
                    <span>담당 역할</span>
                    <input
                      className="form-input"
                      value={item.role}
                      onChange={(event) => updateExperience(index, "role", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                  <label className="field field-full">
                    <span>기간</span>
                    <input
                      className="form-input"
                      value={item.period}
                      onChange={(event) => updateExperience(index, "period", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                  <label className="field field-full">
                    <span>내용</span>
                    <AutoGrowTextarea
                      value={item.description}
                      onChange={(event) => updateExperience(index, "description", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">4. 프로젝트</p>
            <h2>핵심 설명과 사용 기술만 정리</h2>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => syncDraft({ ...draft, projects: [...draft.projects, makeEmptyProject()] })}
            disabled={uiBusy}
          >
            프로젝트 추가
          </button>
        </div>

        <p className="card-copy">
          링크, 부제목, PDF 하이라이트는 step 4에서 최종 출력 직전에 다룹니다. 여기서는 소개글 생성에 필요한 핵심 설명만 다듬으면 됩니다.
        </p>

        {draft.projects.length === 0 && <p className="muted-help">아직 프로젝트가 없어요.</p>}

        <div className="array-section">
          {draft.projects.map((item, index) => (
            <details key={`project-${index}`} className="collapsible-section" open={draft.projects.length === 1}>
              <summary>
                <div className="resume-item-summary">
                  <p className="card-kicker">프로젝트 {index + 1}</p>
                  <strong>{item.name.trim() || `프로젝트 ${index + 1}`}</strong>
                  <p>{item.techStack.length > 0 ? item.techStack.join(", ") : "기술 스택을 입력해 주세요."}</p>
                </div>
                <span className="inline-badge">{item.techStack.length}개 스택</span>
              </summary>

              <div className="collapsible-content">
                <div className="array-item-head">
                  <span className="muted-help">프로젝트 설명은 문제, 기여, 결과가 한 번에 보이도록 짧게 적는 편이 좋습니다.</span>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      syncDraft({
                        ...draft,
                        projects: draft.projects.filter((_, itemIndex) => itemIndex !== index)
                      })
                    }
                    disabled={uiBusy}
                  >
                    삭제
                  </button>
                </div>

                <div className="project-grid">
                  <label className="field field-full">
                    <span>프로젝트 이름</span>
                    <input
                      className="form-input"
                      value={item.name}
                      onChange={(event) => updateProject(index, "name", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                  <label className="field field-full project-description-field">
                    <span>내용</span>
                    <AutoGrowTextarea
                      className="project-description-textarea"
                      value={item.description}
                      onChange={(event) => updateProject(index, "description", event.target.value)}
                      disabled={uiBusy}
                    />
                  </label>
                  <div className="project-stack-panel field-full">
                    <div className="field">
                      <span>기술 스택</span>
                      <TagInput
                        ariaLabel="프로젝트 기술 스택"
                        values={item.techStack}
                        onChange={(values) => updateProjectTechStack(index, values)}
                        placeholder="입력 후 Enter로 추가"
                        disabled={uiBusy}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="card card-review">
        <div className="action-panel review">
          <div className="action-copy">
            <strong>이력서 저장</strong>
            {state.resumeSavedAt && <span className="action-meta">마지막 저장 {formatSavedAt(state.resumeSavedAt)}</span>}
            {hasMissingResumeRequired && (
              <p className="action-note warn">
                <span>저장 전 확인:</span>{" "}
                {missingResumeRequired.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 && <span className="action-note-separator">, </span>}
                    <button
                      type="button"
                      className="action-note-link"
                      onClick={() => focusRequiredField(item.key)}
                      disabled={uiBusy}
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
              onClick={handleConfirmResume}
              disabled={uiBusy || !state.resumeJsonText.trim() || hasMissingResumeRequired}
            >
              이력서 저장
            </button>
            {state.resumeConfirmedJson && (
              <Link className="nav-btn" href={"/company" as Route}>
                공고 정리로 가기
              </Link>
            )}
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
