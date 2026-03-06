"use client";

import type { Route } from "next";
import Link from "next/link";

import { AppFrame } from "@/app/components/app-frame";
import { usePipeline } from "@/lib/pipeline-context";
import { ResumeSchema } from "@/lib/schemas";
import { postSseJson } from "@/lib/stream-client";
import type { Resume } from "@/lib/types";

function formatIssueDetails(errorMessage: string): string {
  return errorMessage.length > 180 ? `${errorMessage.slice(0, 180)}...` : errorMessage;
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

      setMessage("resume.json 생성 완료. 내용 확인 후 '이력서 JSON 확정'을 눌러주세요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "이력서 분석 중 오류가 발생했습니다.");
    } finally {
      finishTask();
    }
  };

  const handleConfirmResume = () => {
    clearStatus();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(state.resumeJsonText);
    } catch {
      setError("resume.json 형식이 올바르지 않습니다.");
      return;
    }

    const validated = ResumeSchema.safeParse(parsedJson);
    if (!validated.success) {
      const details = validated.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join(" | ");
      setError(`resume.json 검증 실패: ${formatIssueDetails(details)}`);
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

    setMessage("이력서 JSON 확정 완료. STEP 2에서 채용공고를 분석하세요.");
  };

  return (
    <AppFrame
      step="resume"
      title="STEP 1 이력서 분석/확정"
      description="이력서 텍스트를 JSON으로 만든 뒤, 검토하고 확정합니다."
    >
      <section className="card">
        <div className="card-head">
          <h2>이력서 입력</h2>
          <button type="button" className="primary" onClick={handleAnalyze} disabled={isBusy}>
            {state.currentTask === "resume" ? "분석 중..." : "resume.json 생성"}
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
          <h2>resume.json 확인/수정</h2>
          <button
            type="button"
            className="secondary"
            onClick={handleConfirmResume}
            disabled={isBusy || !state.resumeJsonText.trim()}
          >
            이력서 JSON 확정
          </button>
        </div>

        <textarea
          value={state.resumeJsonText}
          onChange={(event) => setResumeJsonText(event.target.value)}
          placeholder="resume.json"
          disabled={isBusy}
        />

        <div className="action-row">
          {state.resumeConfirmedJson ? (
            <Link className="nav-btn" href={"/company" as Route}>
              STEP 2 채용공고로 이동
            </Link>
          ) : (
            <span className="nav-btn disabled">STEP 2 채용공고로 이동</span>
          )}
        </div>
      </section>
    </AppFrame>
  );
}
