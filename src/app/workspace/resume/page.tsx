"use client";
import { useState } from "react";
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
import { ResumePreview } from "@/features/workspace/ui/resume-preview";
export default function MyResumePage() {
  const { workspace, update } = useWorkspace();
  const [candidate, setCandidate] = useState<{ resume: Resume; sourceText: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [latestFirst, setLatestFirst] = useState(true);
  if (!workspace) return null;
  const master = workspace.master;
  const stage = !master ? 0 : candidate || master.resume ? 2 : 1;
  const sourceInput = <SourceInput kind="resume" variant="studio" onImport={(document) => {
      update((previous) => ({ ...previous, master: { id: previous.master?.id ?? crypto.randomUUID(), version: previous.master?.version ?? 1, document, resume: previous.master?.resume ?? null, enrichment: previous.master?.enrichment ?? [], updatedAt: new Date().toISOString() } })); setCandidate(null);
    }} />;
  return <div className="studio-resume-page">
    <header className="studio-page-heading"><div><h1>내 이력서</h1><p>당신의 경험을 정리하는 곳. 회사별 이력서의 기준이 됩니다.</p></div><span className="studio-state-badge"><StudioIcon name={master?.resume ? "check" : "document"} size={15} />{master?.resume ? `공통 원본 · 버전 ${master.version}` : master ? "원문 검토 중" : "공통 이력서"}</span></header>
    <ol className="studio-progress" aria-label="이력서 정리 단계">{["자료 등록", "원문 검토", "이력서 확정"].map((label, index) => <li key={label} aria-current={stage === index ? "step" : undefined} data-complete={stage > index}><span className="studio-step-dot">{stage > index ? <StudioIcon name="check" size={12} /> : index + 1}</span>{label}</li>)}</ol>
    {!master ? <div className="studio-registration">{sourceInput}<aside className="studio-registration-help"><span className="studio-help-icon"><StudioIcon name="sparkle" size={23} /></span><h2>완벽하게 정리하지<br />않아도 괜찮아요.</h2><p>기존에 작성한 이력서부터 시작하세요.<br />부족한 부분은 함께 채울 수 있습니다.</p><ol><li><strong>자료를 읽어올게요</strong><span>PDF부터 복사한 텍스트까지.</span></li><li><strong>원문을 보고 바로잡으세요</strong><span>문장을 선택하고 수정 댓글을 남기세요.</span></li><li><strong>빠진 경험은 질문으로</strong><span>AI 질문에 답하며 내용을 보완하세요.</span></li></ol><p className="studio-storage-note"><StudioIcon name="check" size={14} />자료는 이 컴퓨터에 보관됩니다.</p></aside></div> : <details className="studio-replace-source"><summary>다른 원본 자료 등록</summary>{sourceInput}</details>}
    {master && <>
      <DocumentEditor variant="studio" document={master.document} settings={workspace.settings} onChange={(document) => { update((previous) => ({ ...previous, master: { ...previous.master!, document } })); setCandidate(null); }} />
      <div className="studio-review-actions"><div><label><input type="checkbox" checked={latestFirst} onChange={(event) => setLatestFirst(event.target.checked)} />경력·프로젝트를 시작일 최신순으로 정리</label><p>남은 수정 댓글을 반영하거나 삭제한 후 다음 단계로 진행하세요.</p></div>
      <button className="primary" disabled={busy || !master.document.text.trim() || Boolean(master.document.proposal) || master.document.annotations.some((item) => item.status === "pending")} onClick={async () => {
        setBusy(true); setError("");
        try { const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: master.document.text, agent: toAgentRunOptions(workspace.settings) })); setCandidate({ resume: latestFirst ? sortResumeChronologically(resume) : resume, sourceText: master.document.text }); }
        catch (error) { setError((error as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "이력서 항목 정리 중…" : "검토한 내용으로 이력서 정리"}<StudioIcon name="arrow" size={16} /></button></div>
      {error && <p role="alert">{error}</p>}
      {candidate && <section className="studio-candidate"><header><h2>정리 결과 확인</h2><p>빠지거나 잘못 정리된 내용이 없는지 확인해 주세요.</p></header><ResumePreview resume={candidate.resume} /><div className="studio-candidate-actions"><button onClick={() => setCandidate(null)}>원문에서 다시 수정</button><button className="primary" disabled={candidate.sourceText !== master.document.text} onClick={() => { update((previous) => publishMasterResume(previous, previous.master!.document, candidate.resume)); setCandidate(null); }}>공통 이력서로 확정<StudioIcon name="check" size={16} /></button></div></section>}
      {master.resume && <><details className="studio-confirmed"><summary>확정 이력서 · 버전 {master.version}</summary><ResumePreview resume={master.resume} /><Link className="studio-next-link" href="/workspace/companies">회사별 이력서 만들기<StudioIcon name="arrow" size={16} /></Link></details>
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
