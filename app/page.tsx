"use client";

import { useState } from "react";

import type { ApiFailure, ApiSuccess, Company, Intro, Resume } from "@/lib/types";

type Step = 1 | 2 | 3;
type InputMode = "text" | "file";
type BusyAction = "analyze" | "generate" | "regenerate" | "company-only" | null;

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || !data.ok) {
    const message = data.ok ? "요청 실패" : data.error.message;
    const details = data.ok ? "" : data.error.details;
    throw new Error(details ? `${message} (${details})` : message);
  }

  return data.data;
}

function parseJsonEditor<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} JSON 형식이 올바르지 않습니다.`);
  }
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);

  const [resumeInputMode, setResumeInputMode] = useState<InputMode>("text");
  const [companyInputMode, setCompanyInputMode] = useState<InputMode>("text");

  const [resumeText, setResumeText] = useState("");
  const [companyText, setCompanyText] = useState("");

  const [resumeJsonText, setResumeJsonText] = useState("");
  const [companyJsonText, setCompanyJsonText] = useState("");

  const [intro, setIntro] = useState<Intro | null>(null);
  const [lockedResume, setLockedResume] = useState<Resume | null>(null);

  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isBusy = busyAction !== null;

  const clearStatus = () => {
    setMessage("");
    setError("");
  };

  const handleTxtUpload = async (
    file: File | undefined,
    label: string,
    setter: (value: string) => void
  ) => {
    if (!file) {
      return;
    }

    clearStatus();

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("MVP는 txt 파일만 지원합니다.");
      return;
    }

    const text = await file.text();
    setter(text);
    setMessage(`${label} txt 파일을 입력란에 반영했습니다.`);
  };

  const handleAnalyze = async () => {
    clearStatus();

    if (!resumeText.trim() || !companyText.trim()) {
      setError("이력서/채용공고 텍스트를 모두 입력해주세요.");
      return;
    }

    setBusyAction("analyze");

    try {
      const [resume, company] = await Promise.all([
        postJson<Resume>("/api/resume", { text: resumeText }),
        postJson<Company>("/api/company", { text: companyText })
      ]);

      setResumeJsonText(JSON.stringify(resume, null, 2));
      setCompanyJsonText(JSON.stringify(company, null, 2));
      setIntro(null);
      setLockedResume(null);
      setStep(2);
      setMessage("분석 완료. STEP 2에서 JSON을 수정한 뒤 자기소개를 생성하세요.");
    } catch (analyzeError) {
      setError(
        analyzeError instanceof Error
          ? analyzeError.message
          : "분석 중 오류가 발생했습니다."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const generateIntro = async (mode: Exclude<BusyAction, "analyze" | null>) => {
    clearStatus();
    setBusyAction(mode);

    try {
      const company = parseJsonEditor<Company>(companyJsonText, "company.json");
      const resume =
        mode === "company-only"
          ? lockedResume
          : parseJsonEditor<Resume>(resumeJsonText, "resume.json");

      if (!resume) {
        throw new Error("company-only 재생성용 resume 고정본이 없습니다. 먼저 일반 생성을 실행하세요.");
      }

      const result = await postJson<Intro>("/api/intro", {
        resume,
        company
      });

      setIntro(result);
      if (mode !== "company-only") {
        setLockedResume(resume);
      }
      setStep(3);
      setMessage(
        mode === "company-only"
          ? "company 변경 기준으로 자기소개를 재생성했습니다."
          : "자기소개를 생성했습니다."
      );
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "자기소개 생성 중 오류가 발생했습니다."
      );
    } finally {
      setBusyAction(null);
    }
  };

  const copyText = async (value: string, label: string) => {
    clearStatus();

    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label}를 클립보드에 복사했습니다.`);
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해주세요.");
    }
  };

  return (
    <main className="page">
      <div className="backdrop" />
      <div className="container">
        <header className="hero">
          <p className="eyebrow">ResumeMake Local MVP</p>
          <h1>이력서·채용공고 기반 자기소개 생성기</h1>
          <p>
            `@openai/codex-sdk` + `SKILL.md` 파이프라인으로 JSON을 만들고,
            결과를 웹에서 수정/재생성합니다.
          </p>
        </header>

        <ol className="steps">
          <li className={step >= 1 ? "active" : ""}>STEP 1 입력</li>
          <li className={step >= 2 ? "active" : ""}>STEP 2 JSON 수정</li>
          <li className={step >= 3 ? "active" : ""}>STEP 3 결과 확인</li>
        </ol>

        <section className="card">
          <div className="card-head">
            <h2>STEP 1 입력</h2>
            <button
              type="button"
              className="secondary"
              onClick={handleAnalyze}
              disabled={isBusy}
            >
              {busyAction === "analyze" ? "분석 중..." : "분석 시작"}
            </button>
          </div>

          <div className="grid two">
            <article className="panel">
              <h3>이력서</h3>
              <div className="tabs">
                <button
                  type="button"
                  className={resumeInputMode === "text" ? "tab active" : "tab"}
                  onClick={() => setResumeInputMode("text")}
                  disabled={isBusy}
                >
                  텍스트 입력
                </button>
                <button
                  type="button"
                  className={resumeInputMode === "file" ? "tab active" : "tab"}
                  onClick={() => setResumeInputMode("file")}
                  disabled={isBusy}
                >
                  txt 업로드
                </button>
              </div>
              {resumeInputMode === "file" && (
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(event) =>
                    void handleTxtUpload(event.target.files?.[0], "이력서", setResumeText)
                  }
                  disabled={isBusy}
                />
              )}
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                placeholder="이력서 텍스트를 붙여넣으세요."
                disabled={isBusy}
              />
            </article>

            <article className="panel">
              <h3>채용공고</h3>
              <div className="tabs">
                <button
                  type="button"
                  className={companyInputMode === "text" ? "tab active" : "tab"}
                  onClick={() => setCompanyInputMode("text")}
                  disabled={isBusy}
                >
                  텍스트 입력
                </button>
                <button
                  type="button"
                  className={companyInputMode === "file" ? "tab active" : "tab"}
                  onClick={() => setCompanyInputMode("file")}
                  disabled={isBusy}
                >
                  txt 업로드
                </button>
              </div>
              {companyInputMode === "file" && (
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(event) =>
                    void handleTxtUpload(event.target.files?.[0], "채용공고", setCompanyText)
                  }
                  disabled={isBusy}
                />
              )}
              <textarea
                value={companyText}
                onChange={(event) => setCompanyText(event.target.value)}
                placeholder="채용공고 텍스트를 붙여넣으세요."
                disabled={isBusy}
              />
            </article>
          </div>
        </section>

        {step >= 2 && (
          <section className="card">
            <div className="card-head">
              <h2>STEP 2 JSON 확인·수정</h2>
              <button
                type="button"
                className="primary"
                onClick={() => void generateIntro("generate")}
                disabled={isBusy || !resumeJsonText || !companyJsonText}
              >
                {busyAction === "generate" ? "생성 중..." : "자기소개 생성"}
              </button>
            </div>

            <div className="grid two">
              <article className="panel">
                <h3>resume.json</h3>
                <textarea
                  value={resumeJsonText}
                  onChange={(event) => setResumeJsonText(event.target.value)}
                  placeholder="resume.json"
                  disabled={isBusy}
                />
              </article>
              <article className="panel">
                <h3>company.json</h3>
                <textarea
                  value={companyJsonText}
                  onChange={(event) => setCompanyJsonText(event.target.value)}
                  placeholder="company.json"
                  disabled={isBusy}
                />
              </article>
            </div>
          </section>
        )}

        {step >= 3 && intro && (
          <section className="card result-card">
            <div className="card-head">
              <h2>STEP 3 결과</h2>
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(2)}
                disabled={isBusy}
              >
                JSON 수정으로 돌아가기
              </button>
            </div>

            <article className="result-block">
              <div className="result-head">
                <h3>oneLineIntro</h3>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void copyText(intro.oneLineIntro, "oneLineIntro")}
                  disabled={isBusy}
                >
                  복사
                </button>
              </div>
              <p>{intro.oneLineIntro}</p>
            </article>

            <article className="result-block">
              <div className="result-head">
                <h3>shortIntro</h3>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void copyText(intro.shortIntro, "shortIntro")}
                  disabled={isBusy}
                >
                  복사
                </button>
              </div>
              <p>{intro.shortIntro}</p>
            </article>

            <div className="action-row">
              <button
                type="button"
                className="primary"
                onClick={() => void generateIntro("regenerate")}
                disabled={isBusy}
              >
                {busyAction === "regenerate" ? "재생성 중..." : "다시 생성"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void generateIntro("company-only")}
                disabled={isBusy || !lockedResume}
              >
                {busyAction === "company-only"
                  ? "재생성 중..."
                  : "company만 바꿔서 재생성"}
              </button>
            </div>
          </section>
        )}

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}
      </div>
    </main>
  );
}
