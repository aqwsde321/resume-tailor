"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/app/components/app-frame";
import { PdfEditorWorkspace } from "@/app/components/pdf-editor-workspace";
import { formatSavedAt } from "@/lib/date-format";
import { buildPdfDownloadName, buildTypstResumeDocument } from "@/lib/pdf/view-model";
import { getIntroRefreshReasons, getResumeIntroSnapshot, isIntroFresh, usePipeline } from "@/lib/pipeline-context";
import { CompanySchema, ResumeSchema } from "@/lib/schemas";
import type { ApiFailure, ApiSuccess, Company, Intro, Resume } from "@/lib/types";

function buildEditablePdfResume(resume: Resume, intro: Intro, company: Company): Resume {
  const preview = buildTypstResumeDocument(resume, intro, company);

  return {
    ...resume,
    headline: preview.headline,
    careerDurationText: preview.careerDuration,
    pdfHighlights: preview.achievements,
    pdfStrengths: preview.strengths,
    projects: resume.projects.map((project) => ({
      ...project,
      linkLabel: project.linkLabel.trim() || project.link.trim()
    }))
  };
}

function buildEditablePdfIntro(intro: Intro): Intro {
  return {
    ...intro,
    longIntro: intro.longIntro.trim() || intro.shortIntro.trim() || intro.oneLineIntro.trim()
  };
}

export default function PdfPage() {
  const { state, clearStatus, setMessage } = usePipeline();
  const introFresh = isIntroFresh(state);
  const refreshReasons = getIntroRefreshReasons(state);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const confirmedResume = useMemo(() => {
    if (!state.resumeConfirmedJson) {
      return null;
    }

    try {
      const parsed = ResumeSchema.safeParse(JSON.parse(state.resumeConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.resumeConfirmedJson]);

  const confirmedCompany = useMemo(() => {
    if (!state.companyConfirmedJson) {
      return null;
    }

    try {
      const parsed = CompanySchema.safeParse(JSON.parse(state.companyConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.companyConfirmedJson]);

  const resumeSnapshot = useMemo(() => getResumeIntroSnapshot(state), [state]);
  const canExportPdf = Boolean(
    state.intro &&
      state.introSource &&
      introFresh &&
      confirmedResume &&
      confirmedCompany &&
      resumeSnapshot &&
      state.companyConfirmedJson
  );
  const [pdfResume, setPdfResume] = useState<Resume | null>(null);
  const [pdfIntro, setPdfIntro] = useState<Intro | null>(null);
  const [pdfCompany, setPdfCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (confirmedResume && state.intro && confirmedCompany) {
      setPdfResume(buildEditablePdfResume(confirmedResume, state.intro, confirmedCompany));
    }
  }, [confirmedResume, confirmedCompany, state.intro]);

  useEffect(() => {
    if (state.intro) {
      setPdfIntro(buildEditablePdfIntro(state.intro));
    }
  }, [state.intro]);

  useEffect(() => {
    if (confirmedCompany) {
      setPdfCompany(confirmedCompany);
    }
  }, [confirmedCompany]);

  const handlePdfExport = async () => {
    clearStatus();

    if (!pdfResume || !pdfIntro || !pdfCompany || !state.introSource || !resumeSnapshot || !state.companyConfirmedJson) {
      setPdfError("최신 소개글이 있어야 PDF를 만들 수 있어요.");
      return;
    }

    setPdfError("");
    setIsPdfExporting(true);

    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resume: pdfResume,
          company: pdfCompany,
          intro: pdfIntro,
          introSource: state.introSource,
          resumeSnapshot,
          companySnapshot: state.companyConfirmedJson
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiSuccess<never> | ApiFailure;
        throw new Error(payload.ok ? "PDF를 만들지 못했어요." : payload.error.details || payload.error.message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildPdfDownloadName(pdfCompany, pdfResume);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage("PDF를 내려받았어요.");
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF를 만들지 못했어요.");
    } finally {
      setIsPdfExporting(false);
    }
  };

  return (
    <AppFrame
      step="pdf"
      title="PDF 내보내기"
      description="출력할 내용만 마지막으로 정리하고 Typst PDF로 내보냅니다."
      layout="wide"
    >
      {!canExportPdf && (
        <section className="card card-alert">
          <div className="card-head">
            <div>
              <p className="card-kicker">먼저 하기</p>
              <h2>최신 소개글이 준비된 뒤에 PDF 단계가 열립니다.</h2>
            </div>
          </div>
          <p className="card-copy">
            {!state.resumeConfirmedJson || !state.companyConfirmedJson || !state.intro
              ? "이력서 저장, 공고 저장, 소개글 생성이 모두 끝나야 PDF를 만들 수 있어요."
              : refreshReasons.map((reason) => reason.message).join(" ")}
          </p>
          <div className="action-row">
            <Link href={"/resume" as Route} className="nav-btn">
              이력서
            </Link>
            <Link href={"/company" as Route} className="nav-btn">
              공고
            </Link>
            <Link href={"/result" as Route} className="nav-btn">
              소개글
            </Link>
          </div>
        </section>
      )}

      {canExportPdf && state.intro && confirmedResume && confirmedCompany && (
        <>
          <div className="save-meta-row pdf-meta-row" aria-label="PDF 단계 메타">
            {state.introSavedAt && (
              <span className="save-meta-chip">소개글 생성 {formatSavedAt(state.introSavedAt)}</span>
            )}
            <span className="save-meta-chip">{confirmedCompany.companyName || "회사"} PDF</span>
            <span className="save-meta-chip">{confirmedResume.projects.length}개 프로젝트 반영</span>
          </div>

          {pdfResume && pdfIntro && pdfCompany && (
            <PdfEditorWorkspace
              company={pdfCompany}
              error={pdfError}
              exporting={isPdfExporting}
              intro={pdfIntro}
              onCompanyChange={setPdfCompany}
              onExport={() => void handlePdfExport()}
              onIntroChange={setPdfIntro}
              onResumeChange={setPdfResume}
              resume={pdfResume}
            />
          )}
        </>
      )}
    </AppFrame>
  );
}
