"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { ListPreview } from "@/app/components/list-preview";
import { ReasoningInline } from "@/app/components/reasoning-inline";
import { TagInput } from "@/app/components/tag-input";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { parseListText, stringifyLineList } from "@/lib/list-input";
import { usePipeline } from "@/lib/pipeline-context";
import { ResumeSchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Resume, ResumeExperienceItem, ResumeProjectItem } from "@/lib/types";

const EMPTY_RESUME: Resume = {
  name: "",
  summary: "",
  desiredPosition: "",
  careerYears: 0,
  techStack: [],
  experience: [],
  projects: [],
  achievements: [],
  strengths: []
};

function formatIssueDetails(errorMessage: string): string {
  return errorMessage.length > 180 ? `${errorMessage.slice(0, 180)}...` : errorMessage;
}

function toResumeDraft(jsonText: string): Resume {
  if (!jsonText.trim()) {
    return EMPTY_RESUME;
  }

  try {
    const raw = JSON.parse(jsonText);
    const parsed = ResumeSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    return EMPTY_RESUME;
  }

  return EMPTY_RESUME;
}

function makeEmptyExperience(): ResumeExperienceItem {
  return {
    company: "",
    role: "",
    period: "",
    description: ""
  };
}

function makeEmptyProject(): ResumeProjectItem {
  return {
    name: "",
    description: "",
    techStack: []
  };
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
    addLog
  } = usePipeline();

  const isBusy = state.currentTask !== null;
  const isResumeWorking = state.currentTask === "resume";

  const [draft, setDraft] = useState<Resume>(() => toResumeDraft(state.resumeJsonText));
  const [achievementsText, setAchievementsText] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const normalizedDraftJson = JSON.stringify(draft, null, 2);
  const resumeNeedsConfirm =
    state.resumeJsonText.trim().length > 0 && state.resumeConfirmedJson !== normalizedDraftJson;

  const missingResumeRequired: string[] = [];
  if (!draft.desiredPosition.trim()) {
    missingResumeRequired.push("희망 직무");
  }
  if (draft.techStack.length === 0) {
    missingResumeRequired.push("기술 스택");
  }

  const hasMissingResumeRequired = missingResumeRequired.length > 0;
  useEffect(() => {
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
      introSource: null
    }));
  };

  const setResumeJsonText = (value: string) => {
    patch((prev) => ({
      ...prev,
      resumeJsonText: value,
      resumeConfirmedJson: null,
      companyConfirmedJson: null,
      introSource: null
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

  const updateProject = (index: number, key: keyof ResumeProjectItem, value: string) => {
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
    setResumeText(text);
    setMessage("파일 내용을 입력칸에 넣었어요.");
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!state.resumeText.trim()) {
      setError("이력서 내용을 먼저 넣어 주세요.");
      return;
    }

    clearLogs();
    startTask("resume", "이력서를 읽고 있어요.");

    try {
      const resume = await postSseJson<Resume>(
        "/api/resume/stream",
        {
          text: state.resumeText,
          agent: toAgentRunOptions(state.agentSettings)
        },
        {
          onLog: (payload) => addLog("resume", payload)
        }
      );

      patch((prev) => ({
        ...prev,
        resumeJsonText: JSON.stringify(resume, null, 2),
        resumeConfirmedJson: null,
        companyConfirmedJson: null,
        introSource: null
      }));

      setMessage("초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "이력서를 읽는 중 문제가 생겼어요.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmResume = () => {
    clearStatus();

    if (hasMissingResumeRequired) {
      setError(`먼저 채워 주세요: ${missingResumeRequired.join(", ")}`);
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

    const normalized = JSON.stringify(validated.data, null, 2);

    patch((prev) => {
      const resumeChanged = prev.resumeConfirmedJson !== normalized;

      return {
        ...prev,
        resumeJsonText: normalized,
        resumeConfirmedJson: normalized,
        companyConfirmedJson: resumeChanged ? null : prev.companyConfirmedJson,
        introSource: resumeChanged ? null : prev.introSource
      };
    });

    setMessage("이력서를 저장했어요. 이제 공고를 정리해 주세요.");
  };

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

        <p className="card-copy">
          파일을 올리거나 내용을 붙여넣으면 바로 정리해 줍니다.
        </p>

        {isResumeWorking && (
          <p className="processing-banner">
            <span className="spinner" />
            이력서 내용을 읽고 항목 초안을 만들고 있어요.
          </p>
        )}

        <div className="tabs">
          <button
            type="button"
            className={state.resumeInputMode === "text" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, resumeInputMode: "text" }))}
            disabled={isBusy}
          >
            붙여넣기
          </button>
          <button
            type="button"
            className={state.resumeInputMode === "file" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, resumeInputMode: "file" }))}
            disabled={isBusy}
          >
            파일 업로드
          </button>
        </div>

        {state.resumeInputMode === "file" && (
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={isBusy}
          />
        )}

        <textarea
          value={state.resumeText}
          onChange={(event) => setResumeText(event.target.value)}
          placeholder="이력서 내용을 붙여넣어 주세요."
          disabled={isBusy}
        />

        <div className="action-panel">
          <div className="action-copy">
            <strong>먼저 초안을 만들어요</strong>
            <span>입력한 내용을 읽고 아래 폼을 채워 줍니다.</span>
          </div>
          <div className="action-controls">
            <ReasoningInline disabled={isBusy} />
            <button type="button" className="primary" onClick={handleAnalyze} disabled={isBusy}>
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
          </div>
          {resumeNeedsConfirm ? (
            <span className="inline-badge warn">수정됨</span>
          ) : state.resumeConfirmedJson ? (
            <span className="inline-badge ok">저장됨</span>
          ) : (
            <span className="inline-badge">아직 없음</span>
          )}
        </div>

        <p className="card-copy">
          자동으로 정리된 내용을 보고 필요한 부분만 고치면 됩니다.
        </p>

        {isResumeWorking && (
          <p className="processing-banner review">
            <span className="spinner" />
            정리 결과를 반영하는 중이에요. 완료되면 바로 아래에서 확인할 수 있습니다.
          </p>
        )}

        <div className="form-grid two">
          <label className={`field ${!draft.desiredPosition.trim() ? "field-error" : ""}`}>
            <span>희망 직무</span>
            <input
              className="form-input"
              value={draft.desiredPosition}
              onChange={(event) => syncDraft({ ...draft, desiredPosition: event.target.value })}
              disabled={isBusy}
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
              disabled={isBusy}
            />
          </label>

          <label className="field field-full">
            <span>요약</span>
            <AutoGrowTextarea
              value={draft.summary}
              onChange={(event) => syncDraft({ ...draft, summary: event.target.value })}
              disabled={isBusy}
            />
          </label>

          <label className={`field field-full ${draft.techStack.length === 0 ? "field-error" : ""}`}>
            <span>기술 스택</span>
            <TagInput
              values={draft.techStack}
              onChange={(values) => syncDraft({ ...draft, techStack: values })}
              placeholder="입력 후 Enter로 추가"
              disabled={isBusy}
            />
            <span className="field-help">짧은 항목은 칩으로 나눠 두면 보기 쉽고 수정도 빨라요.</span>
          </label>

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
              disabled={isBusy}
            />
            <ListPreview items={draft.achievements} label="지금 들어간 성과" />
            <span className="field-help">문장형 항목은 한 줄씩 나누면 검토가 훨씬 쉬워집니다.</span>
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
              disabled={isBusy}
            />
            <ListPreview items={draft.strengths} label="지금 들어간 강점" />
            <span className="field-help">예전처럼 쉼표로 붙여 넣어도 읽을 수 있지만, 줄바꿈 입력이 더 안정적입니다.</span>
          </label>
        </div>

        <div className="array-section">
          <div className="array-head">
            <h3>경력</h3>
            <button
              type="button"
              className="secondary"
              onClick={() => syncDraft({ ...draft, experience: [...draft.experience, makeEmptyExperience()] })}
              disabled={isBusy}
            >
              추가
            </button>
          </div>

          {draft.experience.length === 0 && <p className="muted-help">아직 경력이 없어요.</p>}

          {draft.experience.map((item, index) => (
            <div className="array-item" key={`experience-${index}`}>
              <div className="array-item-head">
                <strong>경력 {index + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      experience: draft.experience.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={isBusy}
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
                    disabled={isBusy}
                  />
                </label>
                <label className="field">
                  <span>담당 역할</span>
                  <input
                    className="form-input"
                    value={item.role}
                    onChange={(event) => updateExperience(index, "role", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>기간</span>
                  <input
                    className="form-input"
                    value={item.period}
                    onChange={(event) => updateExperience(index, "period", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>내용</span>
                  <AutoGrowTextarea
                    value={item.description}
                    onChange={(event) => updateExperience(index, "description", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="array-section">
          <div className="array-head">
            <h3>프로젝트</h3>
            <button
              type="button"
              className="secondary"
              onClick={() => syncDraft({ ...draft, projects: [...draft.projects, makeEmptyProject()] })}
              disabled={isBusy}
            >
              추가
            </button>
          </div>

          {draft.projects.length === 0 && <p className="muted-help">아직 프로젝트가 없어요.</p>}

          {draft.projects.map((item, index) => (
            <div className="array-item" key={`project-${index}`}>
              <div className="array-item-head">
                <strong>프로젝트 {index + 1}</strong>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      projects: draft.projects.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={isBusy}
                >
                  삭제
                </button>
              </div>

              <div className="form-grid two">
                <label className="field">
                  <span>프로젝트 이름</span>
                  <input
                    className="form-input"
                    value={item.name}
                    onChange={(event) => updateProject(index, "name", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label className="field">
                  <span>기술 스택</span>
                  <TagInput
                    values={item.techStack}
                    onChange={(values) => updateProjectTechStack(index, values)}
                    placeholder="입력 후 Enter로 추가"
                    disabled={isBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>내용</span>
                  <AutoGrowTextarea
                    value={item.description}
                    onChange={(event) => updateProject(index, "description", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="action-panel review">
          <div className="action-copy">
            <strong>확인했으면 저장해요</strong>
            <span>
              {state.resumeConfirmedJson && !resumeNeedsConfirm
                ? "저장된 상태예요. 수정했다면 다시 저장해 주세요."
                : "필수 항목을 채우면 다음 단계로 넘어갈 수 있어요."}
            </span>
            {hasMissingResumeRequired && (
              <p className="action-note warn">저장 전 확인: {missingResumeRequired.join(", ")}</p>
            )}
          </div>
          <div className="action-row">
            <button
              type="button"
              className="primary"
              onClick={handleConfirmResume}
              disabled={isBusy || !state.resumeJsonText.trim() || hasMissingResumeRequired}
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
