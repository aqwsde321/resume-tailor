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
    missingCompanyRequired.push("포지션");
  }
  if (draft.requirements.length === 0) {
    missingCompanyRequired.push("필수 조건");
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
      setError("지금은 txt 파일만 올릴 수 있어요.");
      return;
    }

    const text = await file.text();
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

      setMessage("초안이 준비됐어요. 아래에서 다듬고 저장해 주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "공고를 읽는 중 문제가 생겼어요.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmCompany = () => {
    clearStatus();

    if (hasMissingCompanyRequired) {
      setError(`먼저 채워 주세요: ${missingCompanyRequired.join(", ")}`);
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

    const normalized = JSON.stringify(validated.data, null, 2);

    patch((prev) => ({
      ...prev,
      companyJsonText: normalized,
      companyConfirmedJson: normalized,
      introSource: null
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
          <p>이 단계는 이력서를 저장한 뒤에 열립니다.</p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              이력서로 가기
            </Link>
          </div>
        </section>
      )}

      <section className="card card-accent">
        <div className="card-head">
          <div>
            <p className="card-kicker">입력</p>
            <h2>공고 넣기</h2>
          </div>
        </div>

        <p className="card-copy">
          채용 공고를 붙여넣으면 회사명, 역할, 조건을 정리해 줍니다.
        </p>

        <div className="tabs">
          <button
            type="button"
            className={state.companyInputMode === "text" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, companyInputMode: "text" }))}
            disabled={isBusy || !canEdit}
          >
            붙여넣기
          </button>
          <button
            type="button"
            className={state.companyInputMode === "file" ? "tab active" : "tab"}
            onClick={() => patch((prev) => ({ ...prev, companyInputMode: "file" }))}
            disabled={isBusy || !canEdit}
          >
            파일 업로드
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
          placeholder="채용 공고 내용을 붙여넣어 주세요."
          disabled={isBusy || !canEdit}
        />

        <div className="action-panel">
          <div className="action-copy">
            <strong>먼저 초안을 만들어요</strong>
            <span>입력한 공고를 읽고 회사명, 포지션, 조건을 정리합니다.</span>
          </div>
          <button
            type="button"
            className="primary"
            onClick={handleAnalyze}
            disabled={isBusy || !canEdit}
          >
            {state.currentTask === "company" ? "정리 중..." : "내용 정리"}
          </button>
        </div>
      </section>

      <section className="card card-review">
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

        <p className="card-copy">
          자동으로 정리된 내용을 보고 필요한 부분만 고치면 됩니다.
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
            <span>포지션</span>
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
            <span>주요 업무</span>
            <AutoGrowTextarea
              value={draft.jobDescription}
              onChange={(event) => syncDraft({ ...draft, jobDescription: event.target.value })}
              disabled={isBusy || !canEdit}
            />
          </label>

          <label
            className={`field field-full ${draft.requirements.length === 0 ? "field-error" : ""}`}
          >
            <span>필수 조건 (쉼표로 구분)</span>
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
            <span>우대 조건 (쉼표로 구분)</span>
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
            <span>기술 스택 (쉼표로 구분)</span>
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
          <p className="required-help">먼저 채워 주세요: {missingCompanyRequired.join(", ")}</p>
        )}

        <div className="action-panel review">
          <div className="action-copy">
            <strong>확인했으면 저장해요</strong>
            <span>
              {state.companyConfirmedJson && !companyNeedsConfirm
                ? "저장된 상태예요. 수정했다면 다시 저장해 주세요."
                : "필수 조건을 채우면 소개글 단계로 넘어갈 수 있어요."}
            </span>
          </div>
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
