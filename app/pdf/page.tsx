"use client";

import type { Route } from "next";
import Link from "next/link";

import { AppFrame } from "@/app/components/frame/app-frame";
import { PdfEditorWorkspace } from "@/app/components/pdf-editor/workspace";
import { usePdfWorkspaceDock } from "@/app/hooks/use-pdf-workspace-dock";
import { usePdfWorkspaceState } from "@/app/hooks/use-pdf-workspace-state";
import { getIntroRefreshReasons, usePipeline } from "@/lib/pipeline-context";

export default function PdfPage() {
  const { state, clearStatus, setMessage } = usePipeline();
  const refreshReasons = getIntroRefreshReasons(state);
  const {
    canExportPdf,
    confirmedCompany,
    confirmedResume,
    exportPdf,
    isPdfExporting,
    pdfCompany,
    pdfError,
    pdfIntro,
    pdfResume,
    setPdfCompany,
    setPdfIntro,
    setPdfResume
  } = usePdfWorkspaceState({
    clearStatus,
    setMessage,
    state
  });
  const workspaceRef = usePdfWorkspaceDock(canExportPdf);

  return (
    <AppFrame
      step="pdf"
      title="PDF 내보내기"
      description="출력할 내용만 마지막으로 정리하고 Typst PDF로 내보냅니다."
      layout="wide"
      stickyShell={false}
      showSaveSummary={false}
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
          {pdfResume && pdfIntro && pdfCompany && (
            <PdfEditorWorkspace
              company={pdfCompany}
              error={pdfError}
              exporting={isPdfExporting}
              intro={pdfIntro}
              onCompanyChange={setPdfCompany}
              onExport={() => void exportPdf()}
              onIntroChange={setPdfIntro}
              onResumeChange={setPdfResume}
              rootRef={workspaceRef}
              resume={pdfResume}
            />
          )}
        </>
      )}
    </AppFrame>
  );
}
