"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createSubmittedApplicationRecord } from "@/entities/application/model/application-record";
import { saveApplicationPdf } from "@/entities/application/model/application-pdf-store";
import { PDF_TEMPLATE_OPTIONS } from "@/entities/pdf/model/templates";
import { PDF_THEME_OPTIONS } from "@/entities/pdf/model/themes";
import { usePipeline } from "@/entities/pipeline/model/pipeline-context";
import type { CompanyPdfArtifact, CompanyWork } from "@/entities/workspace/model/workspace";
import type { Company } from "@/shared/lib/types";

function artifactLabel(artifact: CompanyPdfArtifact) {
  const date = new Date(artifact.createdAt).toLocaleString("ko-KR");
  const template = PDF_TEMPLATE_OPTIONS.find((option) => option.id === artifact.snapshot?.templateId)?.label;
  const theme = PDF_THEME_OPTIONS.find((option) => option.id === artifact.snapshot?.themeId)?.label;
  return [artifact.name, date, template, theme].filter(Boolean).join(" · ");
}

export function ApplicationSubmission({ work, company }: { work: CompanyWork; company: Company }) {
  const { state, hydrated, patch } = usePipeline();
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inProgress = useRef(false);
  const artifacts = work.artifacts ?? [];
  const selected = artifacts.find(({ id }) => id === selectedId);
  const submitted = state.applications.find((record) => record.submission?.companyWorkId === work.id);

  async function saveSubmission(artifact: CompanyPdfArtifact) {
    if (!hydrated || submitted || inProgress.current) return;
    inProgress.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/workspace/attachment/${artifact.id}`);
      if (!response.ok) throw new Error("선택한 PDF를 불러오지 못했어요.");
      const pdf = await response.blob();
      if (pdf.type !== "application/pdf" || await pdf.slice(0, 5).text() !== "%PDF-") {
        throw new Error("선택한 파일이 올바른 PDF가 아니에요.");
      }

      const record = createSubmittedApplicationRecord({ company, companyWorkId: work.id, artifact });
      await saveApplicationPdf(record.id, pdf);
      patch((previous) => previous.applications.some((entry) => entry.submission?.companyWorkId === work.id)
        ? previous
        : { ...previous, applications: [record, ...previous.applications] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "제출본을 저장하지 못했어요.");
    } finally {
      setSaving(false);
      inProgress.current = false;
    }
  }

  return (
    <section className="company-application-submission">
      <h3>제출본 고정</h3>
      {submitted ? (
        <div className="company-submission-actions">
          <p role="status">제출본을 고정했어요.</p>
          <span>{submitted.pdfFileName} · 지원일 {submitted.appliedAt ?? "미기록"}</span>
          <Link href={`/applications#application-record-${encodeURIComponent(submitted.id)}`}>지원 기록 보기</Link>
        </div>
      ) : artifacts.length > 0 ? (
        <>
          <p>실제로 제출한 파일을 골라 이 브라우저의 지원 기록에 저장하세요.</p>
          <label>
            실제 제출한 PDF
            <select className="form-select" value={selectedId} disabled={!hydrated || saving} onChange={(event) => {
              setSelectedId(event.target.value);
              setError("");
            }}>
              <option value="">PDF 선택</option>
              {[...artifacts].reverse().map((artifact) => <option key={artifact.id} value={artifact.id}>{artifactLabel(artifact)}</option>)}
            </select>
          </label>
          <div className="company-submission-actions">
            {selected && <a href={`/api/workspace/attachment/${selected.id}`} target="_blank" rel="noreferrer">선택한 PDF 확인</a>}
            <button className="primary" type="button" disabled={!hydrated || saving || !selected} onClick={() => {
              if (selected) void saveSubmission(selected);
            }}>{saving ? "제출본 저장 중…" : "지원 완료 기록"}</button>
          </div>
        </>
      ) : <p>이력서 PDF를 만들면 실제 제출한 파일을 지원 기록에 저장할 수 있어요.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
