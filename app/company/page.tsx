"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { toAgentRunOptions } from "@/lib/agent-settings";
import { hasResumeConfirmed, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Company } from "@/lib/types";

const EMPTY_COMPANY: Company = {
  companyName: "",
  companyDescription: "",
  jobTitle: "",
  jobDescription: "",
  requirements: [],
  preferredSkills: [],
  techStack: []
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
    addLog
  } = usePipeline();

  const isBusy = state.currentTask !== null;
  const canEdit = hasResumeConfirmed(state);

  const [draft, setDraft] = useState<Company>(() => toCompanyDraft(state.companyJsonText));
  const [requirementsText, setRequirementsText] = useState("");
  const [preferredSkillsText, setPreferredSkillsText] = useState("");
  const [techStackText, setTechStackText] = useState("");
  const normalizedDraftJson = JSON.stringify(draft, null, 2);
  const companyNeedsConfirm =
    state.companyJsonText.trim().length > 0 && state.companyConfirmedJson !== normalizedDraftJson;

  const missingCompanyRequired: string[] = [];
  if (!draft.companyName.trim()) {
    missingCompanyRequired.push("회사명");
  }
  if (!draft.jobTitle.trim()) {
    missingCompanyRequired.push("채용 직무");
  }
  if (draft.requirements.length === 0) {
    missingCompanyRequired.push("필수 요구사항");
  }

  const hasMissingCompanyRequired = missingCompanyRequired.length > 0;
  useEffect(() => {
    const next = toCompanyDraft(state.companyJsonText);
    setDraft(next);
    setRequirementsText(stringifyCsv(next.requirements));
    setPreferredSkillsText(stringifyCsv(next.preferredSkills));
    setTechStackText(stringifyCsv(next.techStack));
  }, [state.companyJsonText]);

  const setCompanyText = (value: string) => {
    patch((prev) => ({
      ...prev,
      companyText: value,
      companyConfirmedJson: null,
      introSource: null
    }));
  };

  const setCompanyJsonText = (value: string) => {
    patch((prev) => ({
      ...prev,
      companyJsonText: value,
      companyConfirmedJson: null,
      introSource: null
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
      setError("MVP는 txt 파일만 지원합니다.");
      return;
    }

    const text = await file.text();
    setCompanyText(text);
    setMessage("채용공고 txt 파일을 입력란에 반영했습니다.");
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!canEdit) {
      setError("먼저 STEP 1에서 이력서 정보를 확정하세요.");
      return;
    }

    if (!state.companyText.trim()) {
      setError("채용공고 텍스트를 입력해주세요.");
      return;
    }

    clearLogs();
    startTask("company", "채용공고 분석을 시작했습니다.");

    try {
      const company = await postSseJson<Company>(
        "/api/company/stream",
        {
          text: state.companyText,
          agent: toAgentRunOptions(state.agentSettings)
        },
        {
          onLog: (payload) => addLog("company", payload)
        }
      );

      patch((prev) => ({
        ...prev,
        companyJsonText: JSON.stringify(company, null, 2),
        companyConfirmedJson: null,
        introSource: null
      }));

      setMessage("채용공고 항목 분석 완료. 폼을 검토 후 '채용공고 정보 확정'을 눌러주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "채용공고 분석 중 오류가 발생했습니다.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmCompany = () => {
    clearStatus();

    if (hasMissingCompanyRequired) {
      setError(`필수 항목을 입력하세요: ${missingCompanyRequired.join(", ")}`);
      return;
    }

    const validated = CompanySchema.safeParse(draft);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`채용공고 항목 검증 실패: ${formatIssueDetails(details)}`);
      return;
    }

    const normalized = JSON.stringify(validated.data, null, 2);

    patch((prev) => ({
      ...prev,
      companyJsonText: normalized,
      companyConfirmedJson: normalized,
      introSource: null
    }));

    setMessage("채용공고 정보 확정 완료. STEP 3에서 자기소개를 생성하세요.");
  };

  return (
    <AppFrame
      step="company"
      title="STEP 2 채용공고 분석/확정"
      description="확정된 이력서를 기준으로 채용공고를 구조화하고 확정합니다."
    >
      {!canEdit && (
        <section className="card">
          <h2>먼저 이력서 확정이 필요합니다.</h2>
          <p>STEP 1에서 이력서 정보를 확정해야 STEP 2를 진행할 수 있습니다.</p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              STEP 1으로 이동
            </Link>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">공고 원문 입력</p>
            <h2>채용공고 입력</h2>
          </div>
          <button
            type="button"
            className="primary"
            onClick={handleAnalyze}
            disabled={isBusy || !canEdit}
          >
            {state.currentTask === "company" ? "분석 중..." : "채용공고 분석 시작"}
          </button>
        </div>

        <p className="card-copy">
          회사 공고 전문을 넣으면 필수 요구사항과 직무 정보를 구조화합니다. 이 단계는 STEP 1 이력서 확정이
          완료돼야 활성화됩니다.
        </p>

        <div className="tabs">
          <button
            type="button"
            className={state.companyInputMode === "text" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, companyInputMode: "text" }))}
            disabled={isBusy || !canEdit}
          >
            텍스트 입력
          </button>
          <button
            type="button"
            className={state.companyInputMode === "file" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, companyInputMode: "file" }))}
            disabled={isBusy || !canEdit}
          >
            txt 업로드
          </button>
        </div>

        {state.companyInputMode === "file" && (
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => void handleTxtUpload(event.target.files?.[0])}
            disabled={isBusy || !canEdit}
          />
        )}

        <textarea
          value={state.companyText}
          onChange={(event) => setCompanyText(event.target.value)}
          placeholder="채용공고 텍스트를 붙여넣으세요."
          disabled={isBusy || !canEdit}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">회사 기준 검토</p>
            <h2>채용공고 항목 수정</h2>
          </div>
          {companyNeedsConfirm ? (
            <span className="inline-badge warn">미확정 변경 있음</span>
          ) : state.companyConfirmedJson ? (
            <span className="inline-badge ok">확정됨</span>
          ) : (
            <span className="inline-badge">분석 전</span>
          )}
        </div>

        <p className="card-copy">
          공고에서 추출된 회사명, 채용 직무, 요구사항을 정리하는 단계입니다. 확정 후에만 STEP 3에서
          자기소개 생성이 열립니다.
        </p>

        <div className="form-grid two">
          <label className={`field ${!draft.companyName.trim() ? "field-error" : ""}`}>
            <span>회사명</span>
            <input
              className="form-input"
              value={draft.companyName}
              onChange={(event) => syncDraft({ ...draft, companyName: event.target.value })}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label className={`field ${!draft.jobTitle.trim() ? "field-error" : ""}`}>
            <span>채용 직무</span>
            <input
              className="form-input"
              value={draft.jobTitle}
              onChange={(event) => syncDraft({ ...draft, jobTitle: event.target.value })}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>회사 소개</span>
            <AutoGrowTextarea
              value={draft.companyDescription}
              onChange={(event) =>
                syncDraft({ ...draft, companyDescription: event.target.value })
              }
              disabled={isBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>업무 설명</span>
            <AutoGrowTextarea
              value={draft.jobDescription}
              onChange={(event) => syncDraft({ ...draft, jobDescription: event.target.value })}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label
            className={`field field-full ${draft.requirements.length === 0 ? "field-error" : ""}`}
          >
            <span>필수 요구사항 (쉼표 구분)</span>
            <input
              className="form-input"
              value={requirementsText}
              onChange={(event) => {
                const value = event.target.value;
                setRequirementsText(value);
                syncDraft({ ...draft, requirements: parseCsv(value) });
              }}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>우대사항 (쉼표 구분)</span>
            <input
              className="form-input"
              value={preferredSkillsText}
              onChange={(event) => {
                const value = event.target.value;
                setPreferredSkillsText(value);
                syncDraft({ ...draft, preferredSkills: parseCsv(value) });
              }}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label className="field field-full">
            <span>기술 스택 (쉼표 구분)</span>
            <input
              className="form-input"
              value={techStackText}
              onChange={(event) => {
                const value = event.target.value;
                setTechStackText(value);
                syncDraft({ ...draft, techStack: parseCsv(value) });
              }}
              disabled={isBusy || !canEdit}
            />
          </label>
        </div>

        {hasMissingCompanyRequired && (
          <p className="required-help">필수 항목: {missingCompanyRequired.join(", ")}</p>
        )}

        <div className="action-row">
          <button
            type="button"
            className="primary"
            onClick={handleConfirmCompany}
            disabled={
              isBusy ||
              !canEdit ||
              !state.companyJsonText.trim() ||
              hasMissingCompanyRequired
            }
          >
            채용공고 정보 확정
          </button>
          {state.companyConfirmedJson && (
            <Link className="nav-btn" href={"/result" as Route}>
              STEP 3 결과로 이동
            </Link>
          )}
        </div>
      </section>
    </AppFrame>
  );
}
