"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/features/workspace/context";
import { DocumentEditor } from "@/features/workspace/ui/document-editor";
import { TailoringReview } from "@/features/workspace/ui/tailoring-review";
import { EnrichmentPanel } from "@/features/workspace/ui/enrichment-panel";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { newTextDocument, refreshCompanySource, resumeToMarkdown } from "@/entities/workspace/model/operations";
import type { CompanyWork } from "@/entities/workspace/model/workspace";
import { ResumeSchema, CompanySchema, IntroSchema } from "@/shared/lib/schemas";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { postSseJson } from "@/shared/lib/stream-client";
import type { Company, Intro, Resume } from "@/shared/lib/types";
import type { ResumeTailoringResult } from "@/entities/resume/model/resume-tailoring";
import { applyEnrichmentDrafts } from "@/entities/workspace/model/enrichment-application";
import { WorkExport } from "@/features/workspace/ui/work-export";

export default function CompanyWorkPage() {
  const { id } = useParams<{ id: string }>(); const { workspace, update } = useWorkspace();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<{ company: Company; sourceText: string } | null>(null);
  const [editedCandidate, setEditedCandidate] = useState<{ resume: Resume; sourceText: string } | null>(null);
  if (!workspace) return null;
  const work = workspace.works.find((item) => item.id === id);
  if (!work) return <><p>작업을 찾지 못했습니다.</p><Link href="/workspace/companies">목록으로</Link></>;
  const change = (updater: (work: CompanyWork) => CompanyWork) => update((previous) => ({ ...previous, works: previous.works.map((item) => item.id === id ? { ...updater(item), updatedAt: new Date().toISOString() } : item) }));
  const setResume = (resume: Resume) => change((current) => {
    const document = current.resumeDocument ?? newTextDocument("resume", current.title, resumeToMarkdown(current.resume!));
    return { ...current, resume: ResumeSchema.parse(resume), resumeDocument: { ...document, text: resumeToMarkdown(resume), proposal: null, history: [...document.history, { text: document.text, annotationIds: [], createdAt: new Date().toISOString() }] }, tailoring: null,
      versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] };
  });
  const agent = toAgentRunOptions(workspace.settings);
  async function task(action: () => Promise<void>) { setBusy(true); setError(""); try { await action(); } catch (error) { setError((error as Error).message); } finally { setBusy(false); } }
  const companyCurrent = work.company && work.companySourceText === work.document.text;
  return <><Link href="/workspace/companies">← 회사별 이력서 목록</Link><h1>{work.title}</h1>
    {error && <p role="alert">{error}</p>}
    <details open={!work.company}><summary>공고 원문 검토·수정</summary><DocumentEditor document={work.document} settings={workspace.settings} onChange={(document) => { change((current) => ({ ...current, document })); setCandidate(null); }} />
      <button className="primary" disabled={busy || !work.document.text.trim() || Boolean(work.document.proposal) || work.document.annotations.some((item) => item.status === "pending")} onClick={() => void task(async () => {
        const company = await workspaceRequest<Company>("/api/company", jsonRequest({ text: work.document.text, agent })); setCandidate({ company, sourceText: work.document.text });
      })}>검토한 공고 정리</button>
      {candidate && <section><h2>정리된 공고 확인</h2><h3>{candidate.company.companyName} · {candidate.company.jobTitle}</h3><p>{candidate.company.jobDescription}</p><h4>필수 요건</h4><ul>{candidate.company.requirements.map((item, index) => <li key={index}>{item}</li>)}</ul><h4>우대 요건</h4><ul>{candidate.company.preferredSkills.map((item, index) => <li key={index}>{item}</li>)}</ul><button disabled={candidate.sourceText !== work.document.text} onClick={() => { change((current) => ({ ...current, company: CompanySchema.parse(candidate.company), companySourceText: candidate.sourceText, title: `${candidate.company.companyName} · ${candidate.company.jobTitle}`, tailoring: null })); setCandidate(null); }}>이 공고로 확정</button></section>}
    </details>
    {work.company && <>
      {!companyCurrent && <p role="status">공고 원문이 바뀌었습니다. 검토한 공고를 다시 확정해 주세요.</p>}
      {workspace.master && workspace.master.version !== work.sourceResumeVersion && <section className="card"><p>공통 이력서의 새 버전이 있습니다. 회사별 편집본은 유지됩니다.</p><button disabled={busy} onClick={() => change((current) => ({ ...refreshCompanySource(current, workspace.master!), tailoring: null }))}>새 공통 원본을 기준으로 선택</button></section>}
      <section className="card"><h2>맞춤 이력서</h2><p>공통 원본 버전 {work.sourceResumeVersion}을 참고합니다. 생성할 때 기존 편집본 또는 공통 원본을 선택하세요.</p>
        <button className="primary" disabled={busy || !companyCurrent || !work.resume} onClick={() => void task(async () => {
          const sourceResume = work.resume!;
          const result = await postSseJson<ResumeTailoringResult>("/api/resume/tailor/stream", { resume: sourceResume, company: work.company, agent });
          change((current) => ({ ...current, tailoring: { sourceResume, editingSnapshot: work.resume!, ...result } }));
        })}>{busy ? "처리 중…" : "현재 편집본으로 맞춤 제안 받기"}</button>
        <button disabled={busy || !companyCurrent || !work.sourceResume} onClick={() => void task(async () => {
          const sourceResume = work.sourceResume!;
          const result = await postSseJson<ResumeTailoringResult>("/api/resume/tailor/stream", { resume: sourceResume, company: work.company, agent });
          // 편집본은 덮어쓰지 않는다. 공통 원본 제안은 별도로 검토한다.
          change((current) => ({ ...current, tailoring: { sourceResume, editingSnapshot: work.resume!, ...result } }));
        })}>공통 원본으로 맞춤 제안 받기</button>
      </section>
      {work.tailoring && <TailoringReview key={JSON.stringify(work.tailoring.plan)} work={work} onApply={setResume} onDismiss={() => change((current) => ({ ...current, tailoring: null }))} />}
      {work.resume && <>
        <section className="card"><h2>회사별 편집본</h2><pre>{resumeToMarkdown(work.resume)}</pre>
          <button disabled={busy} onClick={() => change((current) => ({ ...current, versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] }))}>현재 버전 보관</button>
        </section>
        <details><summary>이력서 직접 수정·추가 댓글</summary><DocumentEditor document={work.resumeDocument ?? newTextDocument("resume", work.title, resumeToMarkdown(work.resume))} settings={workspace.settings} onChange={(resumeDocument) => { change((current) => ({ ...current, resumeDocument })); setEditedCandidate(null); }} />
          <button disabled={busy || !work.resumeDocument || Boolean(work.resumeDocument.proposal) || work.resumeDocument.annotations.some((item) => item.status === "pending")} onClick={() => void task(async () => {
            const resume = await workspaceRequest<Resume>("/api/resume", jsonRequest({ text: work.resumeDocument!.text, agent }));
            setEditedCandidate({ resume, sourceText: work.resumeDocument!.text });
          })}>검토한 문서를 편집본에 반영</button>
          {editedCandidate && <section><h3>편집본 반영 전 확인</h3><pre>{resumeToMarkdown(editedCandidate.resume)}</pre><button disabled={editedCandidate.sourceText !== work.resumeDocument?.text} onClick={() => { setResume(editedCandidate.resume); setEditedCandidate(null); }}>이 내용으로 편집본 확정</button></section>}
        </details>
        <EnrichmentPanel resume={work.resume} company={work.company} sessions={work.enrichment} settings={workspace.settings} onChange={(enrichment) => change((current) => ({ ...current, enrichment }))} onApply={(drafts) => change((current) => {
          const resume = ResumeSchema.parse(applyEnrichmentDrafts(current.resume!, drafts));
          return { ...current, resume, resumeDocument: newTextDocument("resume", current.title, resumeToMarkdown(resume)), tailoring: null, enrichment: current.enrichment.map((session) => ({ ...session, drafts: session.drafts.map((item) => drafts.some((approved) => approved.id === item.id) ? { ...item, status: "accepted" as const } : item) })) };
        })} />
        <details><summary>소개글 · 선택 사항</summary><p>소개글 없이 이력서를 내보낼 수 있습니다.</p><button disabled={busy || !companyCurrent} onClick={() => void task(async () => {
          const intro = IntroSchema.parse(await workspaceRequest<Intro>("/api/intro", jsonRequest({ resume: work.resume, company: work.company, agent }))); change((current) => ({ ...current, intro }));
        })}>{work.intro ? "소개글 다시 만들기" : "소개글 만들기"}</button>
          {work.intro && <><label>소개글<textarea rows={6} value={work.intro.longIntro} onChange={(event) => change((current) => ({ ...current, intro: { ...current.intro!, longIntro: event.target.value } }))} /></label><button onClick={() => change((current) => ({ ...current, intro: null }))}>소개글 제외</button></>}
        </details>
        <WorkExport work={work} onSaved={(artifactId, name) => change((current) => ({ ...current, artifacts: [...(current.artifacts ?? []), { id: artifactId, name, createdAt: new Date().toISOString() }] }))} />
        <details><summary>보관 버전 {work.versions.length}개</summary>{[...work.versions].reverse().map((version) => <article key={version.id}><p>{new Date(version.createdAt).toLocaleString("ko-KR")}</p><details><summary>내용 확인</summary><pre>{resumeToMarkdown(version.resume)}</pre></details><button disabled={busy} onClick={() => change((current) => ({ ...current, resume: version.resume, intro: version.intro, tailoring: null, resumeDocument: newTextDocument("resume", current.title, resumeToMarkdown(version.resume)), versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] }))}>현재 편집본 보관 후 이 버전 복원</button></article>)}</details>
      </>}
    </>}
  </>;
}
