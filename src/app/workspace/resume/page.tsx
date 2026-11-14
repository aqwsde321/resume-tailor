"use client";
import { useState } from "react";
import { useWorkspace } from "@/features/workspace/context";
import { SourceInput } from "@/features/workspace/ui/source-input";
import { DocumentEditor } from "@/features/workspace/ui/document-editor";
import { EnrichmentPanel } from "@/features/workspace/ui/enrichment-panel";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { publishMasterResume, resumeToMarkdown } from "@/entities/workspace/model/operations";
import { addDiscoveredExperienceToResume } from "@/entities/intro/model/experience-discovery";
import type { Resume } from "@/shared/lib/types";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
export default function MyResumePage() {
  const { workspace, update } = useWorkspace();
  const [candidate, setCandidate] = useState<{ resume: Resume; sourceText: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!workspace) return null;
  const master = workspace.master;
  return <>
    <h1>내 이력서</h1><p>공통 원본을 정리해 두고 회사별 이력서의 기준으로 사용합니다.</p>
    <details open={!master}><summary>{master ? "다른 원본 자료 등록" : "자료 등록"}</summary><SourceInput kind="resume" onImport={(document) => {
      update((previous) => ({ ...previous, master: { id: previous.master?.id ?? crypto.randomUUID(), version: previous.master?.version ?? 1, document, resume: previous.master?.resume ?? null, enrichment: previous.master?.enrichment ?? [], updatedAt: new Date().toISOString() } })); setCandidate(null);
    }} /></details>
    {master && <>
      <DocumentEditor document={master.document} settings={workspace.settings} onChange={(document) => { update((previous) => ({ ...previous, master: { ...previous.master!, document } })); setCandidate(null); }} />
      <button className="primary" disabled={busy || !master.document.text.trim() || Boolean(master.document.proposal) || master.document.annotations.some((item) => item.status === "pending")} onClick={async () => {
        setBusy(true); setError("");
        try { setCandidate({ resume: await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: master.document.text, agent: toAgentRunOptions(workspace.settings) })), sourceText: master.document.text }); }
        catch (error) { setError((error as Error).message); }
        finally { setBusy(false); }
      }}>{busy ? "이력서 항목 정리 중…" : "검토한 내용으로 이력서 정리"}</button>
      <p>남은 수정 댓글을 반영하거나 삭제한 후 이력서를 정리해 주세요.</p>
      {error && <p role="alert">{error}</p>}
      {candidate && <section className="card"><h2>정리 결과 확인</h2><pre>{resumeToMarkdown(candidate.resume)}</pre><button className="primary" disabled={candidate.sourceText !== master.document.text} onClick={() => { update((previous) => publishMasterResume(previous, previous.master!.document, candidate.resume)); setCandidate(null); }}>공통 이력서로 확정</button><button onClick={() => setCandidate(null)}>원문에서 다시 수정</button></section>}
      {master.resume && <><details><summary>확정 이력서 · 버전 {master.version}</summary><pre>{resumeToMarkdown(master.resume)}</pre></details>
        <EnrichmentPanel resume={master.resume} sessions={master.enrichment} settings={workspace.settings} onChange={(enrichment) => update((previous) => ({ ...previous, master: { ...previous.master!, enrichment } }))} onApply={(drafts) => update((previous) => {
          const current = previous.master!;
          const resume = drafts.reduce<Resume>((value, item) => addDiscoveredExperienceToResume(value, item.draft), current.resume!);
          const additions = drafts.map((item) => `### ${item.draft.title} | ${item.draft.organization} | ${item.draft.role} | ${item.draft.period}\n\n${item.draft.description}\n\n기술: ${item.draft.techStack.join(", ")}`).join("\n\n");
          const document = { ...current.document, text: `${current.document.text}\n\n## 질문으로 보완한 경험\n\n${additions}`, proposal: null };
          const next = publishMasterResume(previous, document, resume);
          return { ...next, master: { ...next.master!, enrichment: current.enrichment.map((session) => ({ ...session, drafts: session.drafts.map((item) => drafts.some((approved) => approved.id === item.id) ? { ...item, status: "accepted" as const } : item) })) } };
        })} />
      </>}
    </>}
  </>;
}
