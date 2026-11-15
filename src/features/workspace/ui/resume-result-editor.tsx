"use client";
import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import type { ResumeResultDraft, ReviewDocument, Workspace } from "@/entities/workspace/model/workspace";
import { createResultDraft } from "@/entities/workspace/model/resume-result-draft";
import type { Resume } from "@/shared/lib/types";
import { jsonRequest, workspaceRequest } from "../api";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { DocumentEditor } from "./document-editor";
import { ResumeDocumentPreview } from "./resume-document-preview";

export function ResumeResultEditor({ draft, settings, stale, onChange, onConfirm, onNavigate, originalSource, enrichment, active = true, onBusyChange, onCommentDraftChange }: { draft: ResumeResultDraft; settings: Workspace["settings"]; stale: boolean; onChange: (draft: ResumeResultDraft) => void; onConfirm: () => void; onNavigate: (step: "source" | "edit" | "save") => void; active?: boolean; onBusyChange?: (busy: boolean) => void; onCommentDraftChange?: (draft: boolean) => void; originalSource?: ReviewDocument["source"]; enrichment?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [commentDraft, setCommentDraft] = useState(false);
  const handleActivity = useCallback((busy: boolean, draft: boolean) => { setDocumentBusy(busy); setCommentDraft(draft); }, []);
  useEffect(() => { onBusyChange?.(busy || documentBusy); }, [busy, documentBusy, onBusyChange]);
  useEffect(() => { onCommentDraftChange?.(commentDraft); }, [commentDraft, onCommentDraftChange]);
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const [error, setError] = useState("");
  const pending = draft.document.annotations.some((item) => item.status === "pending");
  const dirty = draft.document.text !== draft.structuredText;
  const hasProposal = Boolean(draft.document.proposal);
  const confirming = draft.stage === "confirm";
  const blocked = busy || documentBusy || commentDraft || stale || pending || hasProposal || dirty;
  return <section className="resume-result-editor" aria-label="정리 결과 편집">
    <header><h2>{confirming ? "공통 이력서 확인" : "이력서 편집"}</h2><p>{confirming ? "회사별 맞춤에 사용할 공통 이력서를 확인하세요. PDF 디자인은 회사별 이력서를 완성한 뒤 선택합니다." : "이력서에서 문장이나 핵심 기술을 드래그해 수정 요청을 남기세요. 여러 댓글을 모아 한 번에 반영할 수 있습니다."}</p></header>
    {confirming && <ResumeDocumentPreview text={draft.document.text} />}
    <div hidden={confirming}>
    {enrichment && <div className="resume-enrichment-tools"><Button label={enrichmentOpen ? "공통 경험 보완 닫기" : "공통 경험 보완"} variant="secondary" onClick={() => setEnrichmentOpen(!enrichmentOpen)} /><div hidden={!enrichmentOpen}><p>선택한 경험은 편집 초안에 추가됩니다. 확인 후 공통 이력서로 저장해 주세요.</p>{(pending || dirty || hasProposal) && <p role="status">문서 수정과 댓글을 먼저 마무리하면 경험을 보완할 수 있습니다.</p>}<div inert={pending || dirty || hasProposal || busy}>{enrichment}</div></div></div>}
    <div inert={busy}><DocumentEditor onActivityChange={handleActivity} originalSource={originalSource} active={active && !busy && !confirming} variant="studio" presentation="resume" hideHeading document={draft.document} settings={settings} onChange={(document) => onChange({ ...draft, document })} /></div>
    {dirty && <div className="result-restructure"><p>수정한 문서를 이력서 항목에 반영하려면 다시 정리해 주세요. 이 작업은 AI를 사용합니다.</p><Button label={busy ? "수정 결과 정리 중…" : "수정한 결과 다시 정리"} isDisabled={busy || pending || hasProposal} onClick={async () => { setBusy(true); setError(""); try { const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: draft.document.text, agent: toAgentRunOptions(settings) })); const next = createResultDraft({ ...resume, pdfProfileImageDataUrl: draft.resume.pdfProfileImageDataUrl, pdfProfileImageVisible: draft.resume.pdfProfileImageVisible }, draft.sourceText, draft.skillCatalog, true); onChange({ ...next, structuredText: draft.document.text, document: { ...draft.document, proposal: null } }); } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); } }} /></div>}
    </div>
    {stale && <p role="alert">원문이 변경되었습니다. 원문에서 다시 정리한 뒤 확정해 주세요.</p>}
    {error && <p role="alert">{error}</p>}
    <footer className="result-editor-footer">
      <Button label={confirming ? "이전: 이력서 편집" : "이전: 자료 확인"} onClick={() => onNavigate(confirming ? "edit" : "source")} isDisabled={busy} />
      <p>{commentDraft ? "작성 중인 댓글을 등록하거나 취소해 주세요." : pending || hasProposal ? "남은 수정 댓글과 제안을 먼저 확인해 주세요." : dirty ? "수정한 결과를 다시 정리한 뒤 진행할 수 있습니다." : confirming ? "저장한 공통 이력서로 회사별 맞춤 작업을 시작할 수 있습니다." : "다음 단계에서는 검토한 이력서를 마지막으로 확인합니다."}</p>
      <Button label={confirming ? "공통 이력서로 저장" : "공통 이력서 확인으로"} variant="primary" isDisabled={blocked} onClick={confirming ? onConfirm : () => onNavigate("save")} />
    </footer>
  </section>;
}
