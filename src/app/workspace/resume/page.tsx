"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { DocumentEditor } from "@/features/workspace/ui/document-editor";
import { EnrichmentPanel } from "@/features/workspace/ui/enrichment-panel";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { publishMasterResume, resumeToMarkdown, sortResumeChronologically } from "@/entities/workspace/model/operations";
import { applyEnrichmentDrafts } from "@/entities/workspace/model/enrichment-application";
import type { Resume } from "@/shared/lib/types";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { StudioIcon } from "@/features/workspace/ui/studio-icon";
import { ResumeResultEditor } from "@/features/workspace/ui/resume-result-editor";
import { createResultDraft, resumeToReviewText } from "@/entities/workspace/model/resume-result-draft";
import { ResumeDocumentPreview } from "@/features/workspace/ui/resume-document-preview";
export default function MyResumePage() {
  const { workspace, update } = useWorkspace();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [latestFirst, setLatestFirst] = useState(true);
  const replaceDialog = useRef<HTMLDialogElement>(null);
  if (!workspace) return null;
  const master = workspace.master;
  const candidate = master?.resultDraft ?? null;
  const stage = !master ? 0 : candidate ? candidate.stage === "confirm" ? 3 : 2 : master.resume ? 3 : 1;
  const sourceInput = <SourceInput kind="resume" variant="studio" onImport={(document) => {
      update((previous) => ({ ...previous, master: { id: previous.master?.id ?? crypto.randomUUID(), version: previous.master?.version ?? 1, document, resume: previous.master?.resume ?? null, resultDraft: null, skillCatalog: previous.master?.skillCatalog ?? [], enrichment: previous.master?.enrichment ?? [], updatedAt: new Date().toISOString() } })); replaceDialog.current?.close();
    }} />;
  return <div className="studio-resume-page">
    <header className="studio-page-heading"><div><h1>내 이력서</h1><p>당신의 경험을 정리하는 곳. 회사별 이력서의 기준이 됩니다.</p></div><span className="studio-state-badge"><StudioIcon name={master?.resume ? "check" : "document"} size={15} />{master?.resume ? `공통 원본 · 버전 ${master.version}` : candidate ? candidate.stage === "confirm" ? "공통 이력서 확인 중" : "정리 결과 검토 중" : master ? "원문 검토 중" : "공통 이력서"}</span></header>
    <ol className="studio-progress" aria-label="이력서 정리 단계">{["자료 등록", "원문 검토", "정리 결과 검토", "공통 이력서 확인"].map((label, index) => <li key={label} aria-current={stage === index ? "step" : undefined} data-complete={stage > index}><span className="studio-step-dot">{stage > index ? <StudioIcon name="check" size={12} /> : index + 1}</span>{label}</li>)}</ol>
    {!master ? <div className="studio-registration">{sourceInput}<aside className="studio-registration-help"><span className="studio-help-icon"><StudioIcon name="sparkle" size={23} /></span><h2>완벽하게 정리하지<br />않아도 괜찮아요.</h2><p>기존에 작성한 이력서부터 시작하세요.<br />부족한 부분은 함께 채울 수 있습니다.</p><ol><li><strong>자료를 읽어올게요</strong><span>PDF부터 복사한 텍스트까지.</span></li><li><strong>원문을 보고 바로잡으세요</strong><span>문장을 선택하고 수정 댓글을 남기세요.</span></li><li><strong>빠진 경험은 질문으로</strong><span>AI 질문에 답하며 내용을 보완하세요.</span></li></ol><p className="studio-storage-note"><StudioIcon name="check" size={14} />자료는 이 컴퓨터에 보관됩니다.</p></aside></div> : <><div className="review-source-bar"><span><StudioIcon name="document" size={18} /><strong>{master.document.title}</strong></span><button type="button" onClick={() => replaceDialog.current?.showModal()}>자료 교체</button></div><dialog ref={replaceDialog} className="review-replace-dialog" aria-labelledby="replace-source-title"><header><h2 id="replace-source-title">이력서 자료 교체</h2><button type="button" onClick={() => replaceDialog.current?.close()}>교체 취소</button></header><p>새 자료를 추출하면 현재 검토 문서와 수정 댓글이 교체됩니다.</p><p>확정된 공통 이력서와 회사별 이력서는 유지됩니다. 새 자료를 검토한 뒤 공통 이력서를 다시 확정해 주세요.</p>{sourceInput}</dialog></>}
    {master && <>
      <div hidden={Boolean(candidate)}><DocumentEditor active={!candidate} variant="studio" document={master.document} settings={workspace.settings} onChange={(document) => { update((previous) => ({ ...previous, master: { ...previous.master!, document, resultDraft: null } })); }} />
      <div className="studio-review-actions"><div><label><input type="checkbox" checked={latestFirst} onChange={(event) => setLatestFirst(event.target.checked)} />경력·프로젝트를 시작일 최신순으로 정리</label><p>남은 수정 댓글을 반영하거나 삭제한 후 다음 단계로 진행하세요.</p></div>
      <button className="primary" disabled={busy || !master.document.text.trim() || Boolean(master.document.proposal) || master.document.annotations.some((item) => item.status === "pending")} onClick={async () => {
        setBusy(true); setError("");
        try { const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: master.document.text, agent: toAgentRunOptions(workspace.settings) })); update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: createResultDraft(latestFirst ? sortResumeChronologically(resume) : resume, master.document.text, previous.master?.skillCatalog) } })); }
        catch (error) { setError((error as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "이력서 항목 정리 중…" : "검토한 내용으로 이력서 정리"}<StudioIcon name="arrow" size={16} /></button></div></div>
      {error && <p role="alert">{error}</p>}
      {candidate && <ResumeResultEditor key={candidate.document.id} draft={candidate} settings={workspace.settings} stale={candidate.sourceText !== master.document.text} onChange={(draft) => update((previous) => previous.master?.resultDraft?.document.id !== draft.document.id ? previous : ({ ...previous, master: { ...previous.master!, resultDraft: draft } }))} onConfirm={() => update((previous) => publishMasterResume(previous, previous.master!.document, candidate.resume))} onCancel={() => update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: null } }))} />}
      {master.resume && <><details className="studio-confirmed"><summary>확정 이력서 · 버전 {master.version}</summary><ResumeDocumentPreview text={resumeToReviewText(master.resume)} /><button onClick={() => update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: createResultDraft(previous.master!.resume!, previous.master!.document.text, previous.master!.skillCatalog, true) } }))}>확정 이력서 수정</button><Link className="studio-next-link" href="/workspace/companies">회사별 이력서 만들기<StudioIcon name="arrow" size={16} /></Link></details>
        <div className="studio-enrichment">
        <EnrichmentPanel resume={master.resume} sessions={master.enrichment} settings={workspace.settings} onChange={(enrichment) => update((previous) => ({ ...previous, master: { ...previous.master!, enrichment } }))} onApply={(drafts) => update((previous) => {
          const current = previous.master!;
          const resume = applyEnrichmentDrafts(current.resume!, drafts);
          const document = { ...current.document, text: resumeToMarkdown(resume), proposal: null, history: [...current.document.history, { text: current.document.text, annotationIds: [], createdAt: new Date().toISOString() }] };
          const next = publishMasterResume(previous, document, resume);
          return { ...next, master: { ...next.master!, enrichment: current.enrichment.map((session) => ({ ...session, drafts: session.drafts.map((item) => drafts.some((approved) => approved.id === item.id) ? { ...item, status: "accepted" as const } : item) })) } };
        })} /></div>
      </>}
    </>}
  </div>;
}
