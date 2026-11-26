"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createSubmittedApplicationRecord } from "@/entities/application/model/application-record";
import { buildApplicationMailto, createApplicationEmailDraft, type ApplicationEmailDraft } from "@/entities/application/model/application-email";
import { getApplicationPdf, saveApplicationPdf } from "@/entities/application/model/application-pdf-store";
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

export function ApplicationSubmission({ work, company, onEmailDraftChange }: {
  work: CompanyWork;
  company: Company;
  onEmailDraftChange: (draft: ApplicationEmailDraft) => void;
}) {
  const { state, hydrated, patch } = usePipeline();
  const [submittedIdOverride, setSubmittedIdOverride] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const inProgress = useRef(false);
  const artifacts = work.artifacts ?? [];
  const submitted = state.applications.find((record) => record.submission?.companyWorkId === work.id);

  const draft = work.applicationEmailDraft;
  const emailPdf = artifacts.find(({ id }) => id === draft?.artifactId);
  const selected = artifacts.find(({ id }) => id === (submittedIdOverride ?? emailPdf?.id));
  const mailto = draft && (emailPdf || submitted) ? buildApplicationMailto(draft) : null;
  const pdfOptions = [...artifacts].reverse().map((artifact) => (
    <option key={artifact.id} value={artifact.id}>{artifactLabel(artifact)}</option>
  ));

  async function downloadPinnedPdf(id: string, name: string) {
    setError("");
    try {
      const pdf = await getApplicationPdf(id);
      if (!pdf) throw new Error("이 브라우저에서 고정한 제출본 PDF를 찾지 못했어요.");
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "고정한 제출본을 불러오지 못했어요.");
    }
  }

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
      <details className="company-application-email">
        <summary>최초 지원 메일 초안{draft ? " · 작성됨" : ""}</summary>
        {draft ? <>
          <label>받는 사람<input type="email" value={draft.recipient} maxLength={254} placeholder="공고에서 확인한 지원 이메일" onChange={(event) => onEmailDraftChange({ ...draft, recipient: event.target.value })} /></label>
          <label>메일 제목<input value={draft.subject} maxLength={200} onChange={(event) => onEmailDraftChange({ ...draft, subject: event.target.value })} /></label>
          <label>메일 본문<textarea rows={7} value={draft.body} maxLength={4000} onChange={(event) => onEmailDraftChange({ ...draft, body: event.target.value })} /></label>
          {artifacts.length > 0 && <label>
            메일에 첨부할 PDF
            <select className="form-select" value={emailPdf?.id ?? ""} onChange={(event) => onEmailDraftChange({ ...draft, artifactId: event.target.value || null })}>
              <option value="">PDF 선택</option>
              {pdfOptions}
            </select>
          </label>}
          <p>{emailPdf || submitted ? "메일 앱에서 PDF를 직접 첨부해 주세요." : "메일에 첨부할 PDF를 준비해 주세요."}</p>
          <div className="company-submission-actions">
            {emailPdf && <a href={`/api/workspace/attachment/${emailPdf.id}`} download={emailPdf.name}>첨부할 PDF 다운로드</a>}
            {mailto && <a href={mailto}>메일 앱에서 열기</a>}
            <button type="button" disabled={!draft.subject.trim() || !draft.body.trim()} onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
                setEmailMessage("메일 제목과 본문을 복사했어요.");
              } catch {
                setEmailMessage("복사할 수 없어요. 제목과 본문을 직접 선택해 복사해 주세요.");
              }
            }}>메일 제목·본문 복사</button>
          </div>
          {emailMessage && <p role="status">{emailMessage}</p>}
        </> : <button type="button" onClick={() => onEmailDraftChange(createApplicationEmailDraft(
          company, work.resume?.name ?? "", work.companySourceText === work.document.text ? work.document.text : "",
          submitted?.submission?.artifactId ?? selected?.id ?? null,
        ))}>지원 메일 초안 만들기</button>}
      </details>
      <h3>제출본 고정</h3>
      {submitted ? (
        <div className="company-submission-actions">
          <p role="status">제출본을 고정했어요.</p>
          <span>{submitted.pdfFileName} · 지원일 {submitted.appliedAt ?? "미기록"}</span>
          <button type="button" onClick={() => void downloadPinnedPdf(submitted.id, submitted.pdfFileName)}>고정한 제출본 다운로드</button>
          <Link href={`/applications#application-record-${encodeURIComponent(submitted.id)}`}>지원 기록 보기</Link>
        </div>
      ) : artifacts.length > 0 ? (
        <>
          <p>{submittedIdOverride === undefined && emailPdf
            ? "메일 초안에서 고른 PDF가 선택되어 있어요. 실제로 보낸 파일을 확인한 뒤 기록하세요."
            : "실제로 제출한 파일을 골라 이 브라우저의 지원 기록에 저장하세요."}</p>
          <label>
            실제 제출한 PDF
            <select className="form-select" value={selected?.id ?? ""} disabled={!hydrated || saving} onChange={(event) => {
              setSubmittedIdOverride(event.target.value);
              setError("");
            }}>
              <option value="">PDF 선택</option>
              {pdfOptions}
            </select>
          </label>
          <div className="company-submission-actions">
            {selected && <>
              <a href={`/api/workspace/attachment/${selected.id}`} target="_blank" rel="noreferrer">선택한 PDF 확인</a>
              <a href={`/api/workspace/attachment/${selected.id}`} download={selected.name}>선택한 PDF 다운로드</a>
            </>}
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
