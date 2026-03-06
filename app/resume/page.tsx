"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
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

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stringifyCsv(value: string[]): string {
  return value.join(", ");
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

  const [draft, setDraft] = useState<Resume>(() => toResumeDraft(state.resumeJsonText));
  const [techStackText, setTechStackText] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const normalizedDraftJson = JSON.stringify(draft, null, 2);
  const resumeNeedsConfirm =
    state.resumeJsonText.trim().length > 0 && state.resumeConfirmedJson !== normalizedDraftJson;

  const missingResumeRequired: string[] = [];
  if (!draft.name.trim()) {
    missingResumeRequired.push("이름");
  }
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
    setTechStackText(stringifyCsv(next.techStack));
    setAchievementsText(stringifyCsv(next.achievements));
    setStrengthsText(stringifyCsv(next.strengths));
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
      projects: draft.projects.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (key === "techStack") {
          return { ...item, techStack: parseCsv(value) };
        }

        return { ...item, [key]: value };
      })
    };

    syncDraft(next);
  };

  const handleTxtUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    clearStatus();

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("MVP는 txt 파일만 지원합니다.");
      return;
    }

    const text = await file.text();
    setResumeText(text);
    setMessage("이력서 txt 파일을 입력란에 반영했습니다.");
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!state.resumeText.trim()) {
      setError("이력서 텍스트를 입력해주세요.");
      return;
    }

    clearLogs();
    startTask("resume", "이력서 분석을 시작했습니다.");

    try {
      const resume = await postSseJson<Resume>(
        "/api/resume/stream",
        { text: state.resumeText },
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

      setMessage("이력서 항목 분석 완료. 폼을 검토 후 '이력서 정보 확정'을 눌러주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "이력서 분석 중 오류가 발생했습니다.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmResume = () => {
    clearStatus();

    if (hasMissingResumeRequired) {
      setError(`필수 항목을 입력하세요: ${missingResumeRequired.join(", ")}`);
      return;
    }

    const validated = ResumeSchema.safeParse(draft);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`이력서 항목 검증 실패: ${formatIssueDetails(details)}`);
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

    setMessage("이력서 정보 확정 완료. STEP 2에서 채용공고를 분석하세요.");
  };

  return (
    <AppFrame
      step="resume"
      title="STEP 1 이력서 분석/확정"
      description="이력서 텍스트를 구조화한 뒤, 항목별 폼에서 검토하고 확정합니다."
    >
      <section className="card">
        <div className="card-head">
          <h2>이력서 입력</h2>
          <button type="button" className="primary" onClick={handleAnalyze} disabled={isBusy}>
            {state.currentTask === "resume" ? "분석 중..." : "이력서 분석 시작"}
          </button>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={state.resumeInputMode === "text" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, resumeInputMode: "text" }))}
            disabled={isBusy}
          >
            텍스트 입력
          </button>
          <button
            type="button"
            className={state.resumeInputMode === "file" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, resumeInputMode: "file" }))}
            disabled={isBusy}
          >
            txt 업로드
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
          placeholder="이력서 텍스트를 붙여넣으세요."
          disabled={isBusy}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>이력서 항목 수정 (한글 폼)</h2>
          {resumeNeedsConfirm ? (
            <span className="inline-badge warn">미확정 변경 있음</span>
          ) : state.resumeConfirmedJson ? (
            <span className="inline-badge ok">확정됨</span>
          ) : (
            <span className="inline-badge">분석 전</span>
          )}
        </div>

        <div className="form-grid two">
          <label className={`field ${!draft.name.trim() ? "field-error" : ""}`}>
            <span>이름</span>
            <input
              className="form-input"
              value={draft.name}
              onChange={(event) => syncDraft({ ...draft, name: event.target.value })}
              disabled={isBusy}
            />
          </label>

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
            <span>기술 스택 (쉼표 구분)</span>
            <input
              className="form-input"
              value={techStackText}
              onChange={(event) => {
                const value = event.target.value;
                setTechStackText(value);
                syncDraft({ ...draft, techStack: parseCsv(value) });
              }}
              disabled={isBusy}
            />
          </label>

          <label className="field field-full">
            <span>성과/수상 (쉼표 구분)</span>
            <input
              className="form-input"
              value={achievementsText}
              onChange={(event) => {
                const value = event.target.value;
                setAchievementsText(value);
                syncDraft({ ...draft, achievements: parseCsv(value) });
              }}
              disabled={isBusy}
            />
          </label>

          <label className="field field-full">
            <span>강점 (쉼표 구분)</span>
            <input
              className="form-input"
              value={strengthsText}
              onChange={(event) => {
                const value = event.target.value;
                setStrengthsText(value);
                syncDraft({ ...draft, strengths: parseCsv(value) });
              }}
              disabled={isBusy}
            />
          </label>
        </div>

        {hasMissingResumeRequired && (
          <p className="required-help">필수 항목: {missingResumeRequired.join(", ")}</p>
        )}

        <div className="array-section">
          <div className="array-head">
            <h3>경력</h3>
            <button
              type="button"
              className="secondary"
              onClick={() => syncDraft({ ...draft, experience: [...draft.experience, makeEmptyExperience()] })}
              disabled={isBusy}
            >
              경력 추가
            </button>
          </div>

          {draft.experience.length === 0 && <p className="muted-help">추가된 경력이 없습니다.</p>}

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
                  <span>역할</span>
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
                  <span>설명</span>
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
              프로젝트 추가
            </button>
          </div>

          {draft.projects.length === 0 && <p className="muted-help">추가된 프로젝트가 없습니다.</p>}

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
                  <span>프로젝트명</span>
                  <input
                    className="form-input"
                    value={item.name}
                    onChange={(event) => updateProject(index, "name", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label className="field">
                  <span>기술 스택 (쉼표 구분)</span>
                  <input
                    className="form-input"
                    value={stringifyCsv(item.techStack)}
                    onChange={(event) => updateProject(index, "techStack", event.target.value)}
                    disabled={isBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>설명</span>
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

        <div className="action-row">
          <button
            type="button"
            className="primary"
            onClick={handleConfirmResume}
            disabled={isBusy || !state.resumeJsonText.trim() || hasMissingResumeRequired}
          >
            이력서 정보 확정
          </button>
          {state.resumeConfirmedJson && (
            <Link className="nav-btn" href={"/company" as Route}>
              STEP 2 채용공고로 이동
            </Link>
          )}
        </div>
      </section>
    </AppFrame>
  );
}
