"use client";

import type { Route } from "next";
import Link from "next/link";

interface PdfNextStepCardProps {
  canExportPdf: boolean;
}

export function PdfNextStepCard({ canExportPdf }: PdfNextStepCardProps) {
  return (
    <section className="card workflow-footer-card">
      <div className="action-panel review">
        <div className="action-copy">
          <strong>다음 단계: PDF 마감</strong>
          <span>최신 소개글이 준비되면 step 4에서 마지막으로 다듬고 내려받습니다.</span>
        </div>
        <div className="action-row">
          {canExportPdf ? (
            <Link href={"/pdf" as Route} className="nav-btn">
              PDF 단계로 가기
            </Link>
          ) : (
            <button type="button" className="secondary" disabled>
              최신 소개글이 있어야 열림
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
