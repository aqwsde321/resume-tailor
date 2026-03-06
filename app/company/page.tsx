"use client";

import type { Route } from "next";
import Link from "next/link";

import { AppFrame } from "@/app/components/app-frame";
import { hasResumeConfirmed, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Company } from "@/lib/types";

function formatIssueDetails(errorMessage: string): string {
  return errorMessage.length > 180 ? `${errorMessage.slice(0, 180)}...` : errorMessage;
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
      setError("먼저 STEP 1에서 이력서 JSON을 확정하세요.");
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
        { text: state.companyText },
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

      setMessage("company.json 생성 완료. 확인 후 '채용공고 JSON 확정'을 눌러주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "채용공고 분석 중 오류가 발생했습니다.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmCompany = () => {
    clearStatus();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(state.companyJsonText);
    } catch {
      setError("company.json 형식이 올바르지 않습니다.");
      return;
    }

    const validated = CompanySchema.safeParse(parsedJson);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`company.json 검증 실패: ${formatIssueDetails(details)}`);
      return;
    }

    const normalized = JSON.stringify(validated.data, null, 2);

    patch((prev) => ({
      ...prev,
      companyJsonText: normalized,
      companyConfirmedJson: normalized,
      introSource: null
    }));

    setMessage("채용공고 JSON 확정 완료. STEP 3에서 자기소개를 생성하세요.");
  };

  return (
    <AppFrame
      step="company"
      title="STEP 2 채용공고 분석/확정"
      description="확정된 이력서를 기준으로 채용공고를 JSON으로 변환하고 확정합니다."
    >
      {!canEdit && (
        <section className="card">
          <h2>먼저 이력서 확정이 필요합니다.</h2>
          <p>STEP 1에서 resume.json을 확정해야 STEP 2를 진행할 수 있습니다.</p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              STEP 1으로 이동
            </Link>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>채용공고 입력</h2>
          <button
            type="button"
            className="primary"
            onClick={handleAnalyze}
            disabled={isBusy || !canEdit}
          >
            {state.currentTask === "company" ? "분석 중..." : "company.json 생성"}
          </button>
        </div>

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
          <h2>company.json 확인/수정</h2>
          <button
            type="button"
            className="secondary"
            onClick={handleConfirmCompany}
            disabled={isBusy || !canEdit || !state.companyJsonText.trim()}
          >
            채용공고 JSON 확정
          </button>
        </div>

        <textarea
          value={state.companyJsonText}
          onChange={(event) => setCompanyJsonText(event.target.value)}
          placeholder="company.json"
          disabled={isBusy || !canEdit}
        />

        <div className="action-row">
          {state.companyConfirmedJson ? (
            <Link className="nav-btn" href={"/result" as Route}>
              STEP 3 결과로 이동
            </Link>
          ) : (
            <span className="nav-btn disabled">STEP 3 결과로 이동</span>
          )}
        </div>
      </section>
    </AppFrame>
  );
}
