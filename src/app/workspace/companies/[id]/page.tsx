"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/features/workspace/context";
import { DocumentEditor } from "@/features/workspace/ui/document-editor";
import { TailoringReview } from "@/features/workspace/ui/tailoring-review";
import { StudioIcon } from "@/features/workspace/ui/studio-icon";
import { EnrichmentPanel } from "@/features/workspace/ui/enrichment-panel";
import { ResumeReadonlyDocument } from "@/features/workspace/ui/resume-readonly-document";
import { AiTaskStatus } from "@/features/workspace/ui/ai-task-status";
import { useAiTask } from "@/features/workspace/hooks/use-ai-task";
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
import "@/features/workspace/company-detail.css";

type Stage = "review" | "edit" | "export";
function aiInputSnapshot(work: CompanyWork) {
  return JSON.stringify({ company: work.company, companySourceText: work.companySourceText, document: work.document, resume: work.resume, resumeDocument: work.resumeDocument, sourceResume: work.sourceResume, sourceResumeVersion: work.sourceResumeVersion });
}
const stages: { id: Stage; title: string; description: string }[] = [
  { id: "review", title: "공고 검토", description: "추출 내용 확인·확정" },
  { id: "edit", title: "맞춤 편집", description: "제안 검토·경험 보완" },
  { id: "export", title: "내보내기", description: "최종 확인·파일 저장" },
];

export default function CompanyWorkPage() {
  const { id } = useParams<{ id: string }>();
  const { workspace, update } = useWorkspace();
  const aiTask = useAiTask();
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [candidate, setCandidate] = useState<{ company: Company; sourceText: string } | null>(null);
  const [editedCandidate, setEditedCandidate] = useState<{ resume: Resume; sourceText: string } | null>(null);
  const stageButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const work = workspace?.works.find((item) => item.id === id);
  const fallbackResumeDocument = work?.resume ? { ...newTextDocument("resume", work.title, resumeToMarkdown(work.resume)), id: work.id } : null;
  if (!workspace) return null;
  if (!work) return <><p>작업을 찾지 못했습니다.</p><Link href="/workspace/companies">목록으로</Link></>;
  const change = (updater: (work: CompanyWork) => CompanyWork) => update((previous) => ({ ...previous, works: previous.works.map((item) => item.id === id ? { ...updater(item), updatedAt: new Date().toISOString() } : item) }));
  const setResume = (resume: Resume) => change((current) => {
    const document = current.resumeDocument ?? newTextDocument("resume", current.title, resumeToMarkdown(current.resume!));
    return { ...current, resume: ResumeSchema.parse(resume), resumeDocument: { ...document, text: resumeToMarkdown(resume), proposal: null, history: [...document.history, { text: document.text, annotationIds: [], createdAt: new Date().toISOString() }] }, tailoring: null,
      versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] };
  });
  const agent = toAgentRunOptions(workspace.settings);
  const busy = aiTask.busy;
  const companyCurrent = Boolean(work.company && work.companySourceText === work.document.text);
  const stage = selectedStage ?? (companyCurrent ? "edit" : "review");
  const pendingComments = work.document.annotations.filter((item) => item.status === "pending").length;
  const canOrganize = Boolean(work.document.text.trim()) && !work.document.proposal && pendingComments === 0;
  const goTo = (next: Stage) => setSelectedStage(next);
  const tailor = (useOriginal: boolean) => {
    const sourceResume = (useOriginal ? work.sourceResume : work.resume)!;
    const editingSnapshot = work.resume!;
    const inputSnapshot = aiInputSnapshot(work);
    void aiTask.run({
      label: "맞춤 이력서 제안 작성",
      execute: (signal) => postSseJson<ResumeTailoringResult>("/api/resume/tailor/stream", { resume: sourceResume, company: work.company, agent }, { signal }),
      onSuccess: (result) => change((current) => aiInputSnapshot(current) === inputSnapshot ? { ...current, tailoring: { sourceResume, editingSnapshot, ...result } } : current),
    });
  };
  return <div className="company-detail">
    <Link className="company-detail-back" href="/workspace/companies">← 회사별 이력서 목록</Link>
    <header className="company-detail-heading">
      <div><h1>{work.company?.companyName || work.title}</h1><p>{work.company?.jobTitle || "공고를 확인하고 회사에 맞는 이력서를 만들어 보세요."}</p></div>
      <span className="studio-state-badge">{!work.company ? "공고 확인 중" : !companyCurrent ? "공고 재확정 필요" : work.tailoring ? "맞춤 제안 검토 중" : "회사별 편집본"}</span>
    </header>
    <nav className="company-detail-steps company-compact-steps" aria-label="회사별 이력서 작업 단계">
      {stages.map((item, index) => <button type="button" key={item.id} aria-label={item.title} ref={(element) => { stageButtons.current[index] = element; }} aria-current={stage === item.id ? "step" : undefined} aria-controls={`company-stage-${item.id}`} disabled={item.id !== "review" && !work.company} onClick={() => goTo(item.id)} onKeyDown={(event) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const available = stages.map((entry, position) => ({ ...entry, position })).filter((entry) => entry.id === "review" || work.company);
        const currentIndex = available.findIndex((entry) => entry.id === item.id);
        const target = event.key === "Home" ? available[0] : event.key === "End" ? available.at(-1)! : available[(currentIndex + (event.key === "ArrowRight" ? 1 : -1) + available.length) % available.length];
        goTo(target.id); stageButtons.current[target.position]?.focus();
      }}><span className="company-detail-step-number" aria-hidden="true">{index + 1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}
    </nav>
    <AiTaskStatus task={aiTask} />
    {work.company && !companyCurrent && <div className="company-detail-notice" role="status"><div><strong>공고 원문이 바뀌었습니다.</strong><p>맞춤 제안을 받기 전에 검토한 공고를 다시 확정해 주세요.</p></div>{stage !== "review" && <button type="button" onClick={() => goTo("review")}>공고 다시 검토</button>}</div>}

    <section id="company-stage-review" className="company-detail-panel" aria-label="공고 검토 단계" hidden={stage !== "review"}>
      <div className="company-detail-section-heading"><div><h2>공고 원문 검토·수정</h2><p>추출한 내용을 확인하세요. 잘못된 부분은 선택해 댓글로 요청할 수 있습니다.</p></div>{companyCurrent && <span className="company-detail-confirmed">확정된 공고</span>}</div>
      <DocumentEditor variant="studio" hideHeading active={stage === "review"} document={work.document} settings={workspace.settings} onChange={(document) => { change((current) => ({ ...current, document })); setCandidate(null); }} />
      <div className="company-detail-action-row"><p>{pendingComments > 0 ? `수정 댓글 ${pendingComments}개를 먼저 반영해 주세요.` : work.document.proposal ? "문서 변경 제안을 먼저 확인해 주세요." : "검토한 원문에서 업무와 지원 요건을 정리합니다."}</p><button className="primary" disabled={busy || !canOrganize} onClick={() => {
        const sourceText = work.document.text;
        void aiTask.run({ label: "공고 내용 정리", execute: (signal) => workspaceRequest<Company>("/api/company", { ...jsonRequest({ text: sourceText, agent }), signal }), onSuccess: (company) => setCandidate({ company, sourceText }) });
      }}>검토한 공고 정리</button></div>
      {candidate && <section className="company-detail-company-preview"><div className="company-detail-section-heading"><div><h2>정리된 공고 확인</h2><p>아래 내용이 맞으면 확정하고 맞춤 편집을 시작하세요.</p></div></div><h3>{candidate.company.companyName} · {candidate.company.jobTitle}</h3><p className="company-detail-prose">{candidate.company.jobDescription}</p><div className="company-detail-requirements"><section><h4>필수 요건</h4>{candidate.company.requirements.length ? <ul>{candidate.company.requirements.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>명시된 필수 요건이 없습니다.</p>}</section><section><h4>우대 요건</h4>{candidate.company.preferredSkills.length ? <ul>{candidate.company.preferredSkills.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>명시된 우대 요건이 없습니다.</p>}</section></div><button className="primary" disabled={candidate.sourceText !== work.document.text} onClick={() => { change((current) => ({ ...current, company: CompanySchema.parse(candidate.company), companySourceText: candidate.sourceText, title: `${candidate.company.companyName} · ${candidate.company.jobTitle}`, tailoring: null })); setCandidate(null); goTo("edit"); }}>이 공고로 확정</button></section>}
      {companyCurrent && !candidate && <div className="company-detail-stage-footer"><p>공고가 확정되었습니다. 회사에 맞춰 이력서를 편집할 수 있습니다.</p><button type="button" className="primary" onClick={() => goTo("edit")}>맞춤 편집으로 이동</button></div>}
    </section>

    {work.company && <section id="company-stage-edit" className="company-detail-panel" aria-label="맞춤 편집 단계" hidden={stage !== "edit"}>
      {workspace.master && workspace.master.version !== work.sourceResumeVersion && <section className="company-detail-notice"><div><strong>공통 이력서의 새 버전이 있습니다.</strong><p>기준 원본을 바꿔도 회사별 편집본은 유지됩니다.</p></div><button disabled={busy} onClick={() => change((current) => ({ ...refreshCompanySource(current, workspace.master!), tailoring: null }))}>새 공통 원본을 기준으로 선택</button></section>}
      <section className="company-detail-generator"><div><h2>맞춤 이력서</h2><p>회사에 필요한 경험을 골라 제안합니다. 직접 확인한 변경만 편집본에 반영됩니다.</p><span>공통 원본 버전 {work.sourceResumeVersion}</span></div><div className="company-detail-generator-actions"><button className="primary" disabled={busy || !companyCurrent || !work.resume} onClick={() => tailor(false)}>현재 편집본으로 맞춤 제안 받기</button><button disabled={busy || !companyCurrent || !work.sourceResume} onClick={() => tailor(true)}>공통 원본으로 맞춤 제안 받기</button></div></section>
      {work.tailoring && <TailoringReview key={JSON.stringify(work.tailoring.plan)} work={work} onApply={setResume} onDismiss={() => change((current) => ({ ...current, tailoring: null }))} />}
      {work.resume && <>
        <section className="company-detail-current"><div className="company-detail-section-heading"><div><h2>회사별 편집본</h2><p>문장이나 기술을 드래그해 수정 요청을 남기세요. 공통 이력서는 유지됩니다.</p></div><button disabled={busy} onClick={() => change((current) => ({ ...current, versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] }))}>현재 버전 보관</button></div><DocumentEditor variant="studio" presentation="resume" hideHeading active={stage === "edit"} document={work.resumeDocument ?? fallbackResumeDocument!} settings={workspace.settings} onChange={(resumeDocument) => { change((current) => ({ ...current, resumeDocument })); setEditedCandidate(null); }} /><div className="company-detail-action-row"><p>문서를 정리한 뒤 반영할 내용을 한 번 더 확인합니다.</p><button className="primary" disabled={busy || !work.resumeDocument || Boolean(work.resumeDocument.proposal) || work.resumeDocument.annotations.some((item) => item.status === "pending")} onClick={() => {
          const sourceText = work.resumeDocument!.text;
          void aiTask.run({ label: "편집 문서 정리", execute: (signal) => workspaceRequest<Resume>("/api/resume", { ...jsonRequest({ text: sourceText, agent }), signal }), onSuccess: (resume) => setEditedCandidate({ resume, sourceText }) });
        }}>검토한 문서를 편집본에 반영</button></div>{editedCandidate && <section className="company-detail-candidate"><h3>편집본 반영 전 확인</h3><ResumeReadonlyDocument text={resumeToMarkdown(editedCandidate.resume)} toolbar={<span className="studio-paper-filename">변경 내용 · 반영 전 확인</span>} /><button className="primary" disabled={editedCandidate.sourceText !== work.resumeDocument?.text} onClick={() => { setResume(editedCandidate.resume); setEditedCandidate(null); }}>이 내용으로 편집본 확정</button></section>}</section>
        <details className="company-enrichment"><summary className="ai-enrichment-trigger"><StudioIcon name="sparkle" size={18} /><span>공고에 맞춰 경험 보완</span></summary><EnrichmentPanel scope="job" resume={work.resume} company={work.company} sessions={work.enrichment} settings={workspace.settings} onChange={(enrichment) => change((current) => ({ ...current, enrichment }))} onApply={(drafts) => change((current) => {
          const resume = ResumeSchema.parse(applyEnrichmentDrafts(current.resume!, drafts));
          return { ...current, resume, resumeDocument: newTextDocument("resume", current.title, resumeToMarkdown(resume)), tailoring: null, enrichment: current.enrichment.map((session) => ({ ...session, drafts: session.drafts.map((item) => drafts.some((approved) => approved.id === item.id) ? { ...item, status: "accepted" as const } : item) })) };
        })} /></details>
        <details className="company-detail-disclosure"><summary>보관 버전 {work.versions.length}개</summary><div className="company-detail-disclosure-content">{work.versions.length === 0 && <p>아직 보관한 버전이 없습니다. 편집본 위의 ‘현재 버전 보관’으로 저장할 수 있습니다.</p>}{[...work.versions].reverse().map((version) => <article className="company-detail-version" key={version.id}><p>{new Date(version.createdAt).toLocaleString("ko-KR")}</p><details><summary>내용 확인</summary><ResumeReadonlyDocument text={resumeToMarkdown(version.resume)} toolbar={<span className="studio-paper-filename">보관된 회사별 이력서</span>} /></details><button disabled={busy} onClick={() => change((current) => ({ ...current, resume: version.resume, intro: version.intro, tailoring: null, resumeDocument: newTextDocument("resume", current.title, resumeToMarkdown(version.resume)), versions: [...current.versions, { id: crypto.randomUUID(), resume: current.resume!, intro: current.intro, createdAt: new Date().toISOString() }] }))}>현재 편집본 보관 후 이 버전 복원</button></article>)}</div></details>
        <div className="company-detail-stage-footer"><button type="button" onClick={() => goTo("review")}>이전: 공고 검토</button><p>편집을 마쳤다면 제출할 파일을 확인하세요.</p><button type="button" className="primary" onClick={() => goTo("export")}>내보내기로 이동</button></div>
      </>}
    </section>}

    {work.company && work.resume && <section id="company-stage-export" className="company-detail-panel" aria-label="내보내기 단계" hidden={stage !== "export"}>
      <div className="company-detail-section-heading"><div><h2>제출할 이력서 확인</h2><p>현재 편집본으로 파일을 만듭니다. 소개글은 필요한 경우에만 추가하세요.</p></div><button type="button" onClick={() => goTo("edit")}>편집으로 돌아가기</button></div>
      <ResumeReadonlyDocument text={resumeToMarkdown(work.resume)} toolbar={<span className="studio-paper-filename">제출할 이력서 · 내용 확인</span>} />
      <details className="company-detail-disclosure"><summary>소개글 · 선택 사항{work.intro ? " · 작성됨" : ""}</summary><div className="company-detail-disclosure-content"><p>소개글 없이 이력서를 내보낼 수 있습니다.</p><button disabled={busy || !companyCurrent} onClick={() => {
        const inputSnapshot = aiInputSnapshot(work);
        const introSnapshot = JSON.stringify(work.intro);
        void aiTask.run({ label: "소개글 작성", execute: (signal) => workspaceRequest<Intro>("/api/intro", { ...jsonRequest({ resume: work.resume, company: work.company, agent }), signal }), onSuccess: (intro) => change((current) => aiInputSnapshot(current) === inputSnapshot && JSON.stringify(current.intro) === introSnapshot ? { ...current, intro: IntroSchema.parse(intro) } : current) });
      }}>{work.intro ? "소개글 다시 만들기" : "소개글 만들기"}</button>{work.intro && <><label>소개글<textarea name="company-intro" rows={6} value={work.intro.longIntro} onChange={(event) => change((current) => ({ ...current, intro: { ...current.intro!, longIntro: event.target.value } }))} /></label><button onClick={() => change((current) => ({ ...current, intro: null }))}>소개글 제외</button></>}</div></details>
      <WorkExport work={work} onSaved={(artifactId, name) => change((current) => ({ ...current, artifacts: [...(current.artifacts ?? []), { id: artifactId, name, createdAt: new Date().toISOString() }] }))} />
    </section>}
  </div>;
}
