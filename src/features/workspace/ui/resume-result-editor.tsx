"use client";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import type { ResumeResultDraft, Workspace } from "@/entities/workspace/model/workspace";
import { changeDraftSkills, createResultDraft } from "@/entities/workspace/model/resume-result-draft";
import type { Resume } from "@/shared/lib/types";
import { jsonRequest, workspaceRequest } from "../api";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { DocumentEditor } from "./document-editor";
import { ResumePreview } from "./resume-preview";
import { CoreSkillsEditor } from "./core-skills-editor";

export function ResumeResultEditor({ draft, settings, stale, onChange, onConfirm, onCancel }: { draft: ResumeResultDraft; settings: Workspace["settings"]; stale: boolean; onChange: (draft: ResumeResultDraft) => void; onConfirm: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = draft.document.annotations.some((item) => item.status === "pending");
  const dirty = draft.document.text !== draft.structuredText;
  const hasProposal = Boolean(draft.document.proposal);
  const confirming = draft.stage === "confirm";
  const blocked = busy || stale || pending || hasProposal || dirty;
  return <section className="resume-result-editor" aria-label="정리 결과 편집">
    <header><h2>{confirming ? "최종 확인" : "정리 결과 검토"}</h2><p>{confirming ? "핵심 기술과 완성본을 확인한 뒤 공통 이력서로 확정하세요." : "문장을 드래그해 수정 요청을 남기세요. 검토를 마치면 핵심 기술을 선택할 수 있습니다."}</p></header>
    {confirming ? <>
      <CoreSkillsEditor catalog={draft.skillCatalog} selected={draft.resume.techStack} disabled={blocked} onChange={(selected, catalog) => { try { onChange(changeDraftSkills(draft, selected, catalog)); } catch (caught) { setError((caught as Error).message); } }} />
      <ResumePreview resume={draft.resume} />
    </> : <>
    <div inert={busy}><DocumentEditor active={!busy} variant="studio" presentation="resume" heading="정리 결과 수정" description="문장이나 단락을 드래그해 댓글을 남기세요. 여러 요청을 모아 제안받고 선택한 변경만 반영할 수 있습니다." document={draft.document} settings={settings} onChange={(document) => onChange({ ...draft, document })} /></div>
    {dirty && <div className="result-restructure"><p>수정한 문서를 이력서 항목에 반영하려면 다시 정리해 주세요. 이 작업은 AI를 사용합니다.</p><Button label={busy ? "수정 결과 정리 중…" : "수정한 결과 다시 정리"} isDisabled={busy || pending || hasProposal} onClick={async () => { setBusy(true); setError(""); try { const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: draft.document.text, agent: toAgentRunOptions(settings) })); const next = createResultDraft({ ...resume, pdfProfileImageDataUrl: draft.resume.pdfProfileImageDataUrl, pdfProfileImageVisible: draft.resume.pdfProfileImageVisible }, draft.sourceText, draft.skillCatalog, true); onChange({ ...next, document: { ...draft.document, text: next.structuredText, proposal: null } }); } catch (caught) { setError((caught as Error).message); } finally { setBusy(false); } }} /></div>}
    </>}
    {stale && <p role="alert">원문이 변경되었습니다. 원문에서 다시 정리한 뒤 확정해 주세요.</p>}
    {error && <p role="alert">{error}</p>}
    <footer className="result-editor-footer">
      <Button label={confirming ? "결과 검토로 돌아가기" : "원문에서 다시 수정"} onClick={confirming ? () => onChange({ ...draft, stage: "review" }) : onCancel} isDisabled={busy} />
      <p>{pending || hasProposal ? "남은 수정 댓글과 제안을 먼저 확인해 주세요." : dirty ? "수정한 결과를 다시 정리한 뒤 진행할 수 있습니다." : confirming ? "확정한 이력서가 회사별 맞춤 작업의 기준이 됩니다." : "다음 단계에서 핵심 기술과 완성본을 확인합니다."}</p>
      <Button label={confirming ? "공통 이력서로 확정" : "최종 확인으로"} variant="primary" isDisabled={blocked} onClick={confirming ? onConfirm : () => onChange({ ...draft, stage: "confirm" })} />
    </footer>
  </section>;
}
