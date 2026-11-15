"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { DocumentEditor } from "@/features/workspace/ui/document-editor";
import { EnrichmentPanel } from "@/features/workspace/ui/enrichment-panel";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { publishMasterResume, sortResumeChronologically } from "@/entities/workspace/model/operations";
import { applyEnrichmentDrafts } from "@/entities/workspace/model/enrichment-application";
import { ResumeSchema } from "@/shared/lib/schemas";
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
  const showSource = Boolean(master && !candidate && (!master.resume || master.sourceNeedsReview));
  const stage = !master || showSource ? 0 : candidate && candidate.stage !== "confirm" ? 1 : 2;
  const sourceInput = <SourceInput kind="resume" variant="studio" onImport={(document) => {
      update((previous) => ({ ...previous, master: { id: previous.master?.id ?? crypto.randomUUID(), version: previous.master?.version ?? 1, document, resume: previous.master?.resume ?? null, resultDraft: null, sourceNeedsReview: true, reviewMarkdown: previous.master?.reviewMarkdown, skillCatalog: previous.master?.skillCatalog ?? [], enrichment: previous.master?.enrichment ?? [], updatedAt: new Date().toISOString() } })); replaceDialog.current?.close();
    }} />;
  return <div className="studio-resume-page">
    <header className="studio-page-heading"><div><h1>내 이력서</h1><p>당신의 경험을 정리하는 곳. 회사별 이력서의 기준이 됩니다.</p></div><span className="studio-state-badge"><StudioIcon name={master?.resume ? "check" : "document"} size={15} />{candidate ? candidate.stage === "confirm" ? "공통 이력서 확인 중" : "이력서 편집 중" : showSource ? "자료 확인 중" : master?.resume ? `저장됨 · 버전 ${master.version}` : "공통 이력서"}</span></header>
    <ol className="studio-progress" aria-label="이력서 정리 단계">{["자료 확인", "이력서 편집", "공통 이력서 저장"].map((label, index) => <li key={label} aria-current={stage === index ? "step" : undefined} data-complete={stage > index}><span className="studio-step-dot">{stage > index ? <StudioIcon name="check" size={12} /> : index + 1}</span>{label}</li>)}</ol>
    {!master ? <div className="studio-registration">{sourceInput}<aside className="studio-registration-help"><span className="studio-help-icon"><StudioIcon name="sparkle" size={23} /></span><h2>완벽하게 정리하지<br />않아도 괜찮아요.</h2><p>기존에 작성한 이력서부터 시작하세요.<br />부족한 부분은 함께 채울 수 있습니다.</p><ol><li><strong>자료를 읽어올게요</strong><span>PDF부터 복사한 텍스트까지.</span></li><li><strong>원문을 보고 바로잡으세요</strong><span>문장을 선택하고 수정 댓글을 남기세요.</span></li><li><strong>빠진 경험은 질문으로</strong><span>AI 질문에 답하며 내용을 보완하세요.</span></li></ol><p className="studio-storage-note"><StudioIcon name="check" size={14} />자료는 이 컴퓨터에 보관됩니다.</p></aside></div> : <><div className="review-source-bar"><span><StudioIcon name="document" size={18} /><strong>{master.document.title}</strong></span><button type="button" onClick={() => replaceDialog.current?.showModal()}>자료 교체</button></div><dialog ref={replaceDialog} className="review-replace-dialog" aria-labelledby="replace-source-title"><header><h2 id="replace-source-title">이력서 자료 교체</h2><button type="button" onClick={() => replaceDialog.current?.close()}>교체 취소</button></header><p>새 자료를 추출하면 현재 검토 문서와 수정 댓글이 교체됩니다.</p><p>확정된 공통 이력서와 회사별 이력서는 유지됩니다. 새 자료를 검토한 뒤 공통 이력서를 다시 확정해 주세요.</p>{sourceInput}</dialog></>}
    {master && <>
      {showSource && <div><DocumentEditor allowComments={false} heading="추출 자료 확인" description="원본과 비교해 누락되거나 깨진 글자를 직접 고치세요. 내용에 대한 수정 요청은 다음 이력서 편집 단계에서 남깁니다." variant="studio" document={master.document} settings={workspace.settings} onChange={(document) => { update((previous) => ({ ...previous, master: { ...previous.master!, document, resultDraft: null } })); }} />
      <div className="studio-review-actions"><div><label><input type="checkbox" checked={latestFirst} onChange={(event) => setLatestFirst(event.target.checked)} />경력·프로젝트를 시작일 최신순으로 정리</label><p>남은 수정 댓글을 반영하거나 삭제한 후 다음 단계로 진행하세요.</p></div>
      <button className="primary" disabled={busy || !master.document.text.trim() || Boolean(master.document.proposal) || master.document.annotations.some((item) => item.status === "pending")} onClick={async () => {
        setBusy(true); setError("");
        try { const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: master.document.text, agent: toAgentRunOptions(workspace.settings) })); update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: createResultDraft(latestFirst ? sortResumeChronologically(resume) : resume, master.document.text, previous.master?.skillCatalog) } })); }
        catch (error) { setError((error as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "이력서 항목 정리 중…" : "검토한 내용으로 이력서 정리"}<StudioIcon name="arrow" size={16} /></button></div></div>}
      {error && <p role="alert">{error}</p>}
      {candidate && <ResumeResultEditor key={candidate.document.id} draft={candidate} settings={workspace.settings} originalSource={master.document.source} stale={candidate.sourceText !== master.document.text}
        onChange={(draft) => update((previous) => previous.master?.resultDraft?.document.id !== draft.document.id ? previous : ({ ...previous, master: { ...previous.master!, resultDraft: draft } }))}
        onConfirm={() => update((previous) => publishMasterResume(previous, previous.master!.document, candidate.resume))}
        onCancel={() => update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: null } }))}
        enrichment={<EnrichmentPanel resume={candidate.resume} sessions={master.enrichment} settings={workspace.settings}
          onChange={(enrichment) => update((previous) => ({ ...previous, master: { ...previous.master!, enrichment } }))}
          onApply={(drafts) => update((previous) => {
            const current = previous.master!; const draft = current.resultDraft;
            if (!draft || draft.document.text !== draft.structuredText || draft.document.proposal || draft.document.annotations.some((item) => item.status === "pending")) return previous;
            const enriched = applyEnrichmentDrafts(draft.resume, drafts);
            const resume = ResumeSchema.parse({ ...enriched, techStack: draft.resume.techStack });
            const additions = drafts.map((item) => {
              const [kind, position] = (item.target ?? "new").split(":");
              const target = kind === "project" ? draft.resume.projects[Number(position)]?.name : kind === "experience" ? draft.resume.experience[Number(position)]?.company : "";
              return [`### ${target || item.draft.title || item.draft.organization}`, [item.draft.organization, item.draft.role, item.draft.period].filter(Boolean).join(" · "), item.draft.description, item.draft.techStack.length ? `사용 기술: ${item.draft.techStack.join(", ")}` : ""].filter(Boolean).join("\n\n");
            }).join("\n\n");
            const text = `${draft.document.text}\n\n## 보완한 경험\n\n${additions}`;
            return { ...previous, master: { ...current,
              resultDraft: { ...draft, resume, structuredText: text, document: { ...draft.document, text, history: [...draft.document.history, { text: draft.document.text, annotationIds: [], createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() } },
              enrichment: current.enrichment.map((session) => ({ ...session, drafts: session.drafts.map((item) => drafts.some((approved) => approved.id === item.id) ? { ...item, status: "accepted" as const } : item) }))
            } };
          })} />}
      />}
      {master.resume && !candidate && !showSource && <section className="studio-saved-resume" aria-label="저장된 공통 이력서">
        <header><h2>저장된 공통 이력서</h2><p>버전 {master.version} · 이 이력서를 기준으로 회사별 맞춤 이력서를 만듭니다.</p></header>
        <div className="studio-saved-actions"><button onClick={() => update((previous) => ({ ...previous, master: { ...previous.master!, resultDraft: createResultDraft(previous.master!.resume!, previous.master!.document.text, previous.master!.skillCatalog, true, previous.master!.reviewMarkdown) } }))}>이력서 수정하기</button><Link className="studio-next-link" href="/workspace/companies">회사별 이력서 만들기<StudioIcon name="arrow" size={16} /></Link></div>
        <ResumeDocumentPreview text={master.reviewMarkdown ?? resumeToReviewText(master.resume)} />
      </section>}

    </>}
  </div>;
}
