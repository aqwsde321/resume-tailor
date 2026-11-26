"use client";
import { useState, type Ref } from "react";
import type { z } from "zod";
import type { EnrichmentSchema, Workspace } from "@/entities/workspace/model/workspace";
import type { Company, DiscoveredExperienceDraft, ExperienceDiscoveryTurn, Resume } from "@/shared/lib/types";
import { postSseJson } from "@/shared/lib/stream-client";
import type { ConfirmedExperience, ConfirmedExperienceScope } from "@/entities/resume/model/confirmed-experience";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
type Session = z.infer<typeof EnrichmentSchema>;
const defaultTopic = "이력서에서 역할·행동·결과가 부족한 경험과 최근에 빠뜨린 경험을 확인해 줘.";
const topicLimit = 300;
export type ApprovedDraft = { sessionId: string; id: string; draft: DiscoveredExperienceDraft; target?: string };
export function EnrichmentPanel({ resume, company, sessions, settings, onChange, onApply, commonExperiences, companyExperiences = [], onSaveExperience, onRemoveExperience, topicRequest, topicInputRef, knownGaps = [], scope = company ? "job" : "common" }: {
  scope?: "common" | "job"; resume: Resume; company?: Company; sessions: Session[]; settings: Workspace["settings"];
  topicRequest?: { text: string };
  topicInputRef?: Ref<HTMLTextAreaElement>;
  knownGaps?: readonly string[];
  commonExperiences: readonly ConfirmedExperience[];
  companyExperiences?: readonly ConfirmedExperience[];
  onSaveExperience: (experience: ConfirmedExperience, scope: ConfirmedExperienceScope) => void;
  onRemoveExperience: (id: string) => void;
  onChange: (sessions: Session[]) => void; onApply: (drafts: ApprovedDraft[]) => void;
}) {
  const [topicEdit, setTopicEdit] = useState<{ request?: typeof topicRequest; value: string }>();
  const [answerDraft, setAnswerDraft] = useState<{ sessionId: string; value: string }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [experienceScopes, setExperienceScopes] = useState<Record<string, ConfirmedExperienceScope>>({});
  const [technologyEdits, setTechnologyEdits] = useState<Record<string, string>>({});
  const savedExperiences = [...companyExperiences.map((item) => ({ ...item, scope: "company" as const })),
    ...commonExperiences.map((item) => ({ ...item, scope: "common" as const }))];
  const requestedTopic = topicRequest?.text.slice(0, topicLimit).trim();
  const topic = topicEdit && topicEdit.request === topicRequest ? topicEdit.value : requestedTopic ?? defaultTopic;
  const requirement = topic.trim() === requestedTopic ? topicRequest?.text : undefined;
  const current = topicRequest
    ? sessions.findLast((session) => requirement ? session.requirement === requirement : session.topic === topic.trim())
    : sessions.at(-1);
  const answer = answerDraft && answerDraft.sessionId === current?.id ? answerDraft.value : "";
  const topicBlocked = knownGaps.includes(requirement ?? topic.trim());
  const currentBlocked = current && knownGaps.includes(current.requirement ?? current.topic.trim());
  const pending = sessions.flatMap((session) => session.drafts.filter((item) => item.status === "pending").map((item) => ({ sessionId: session.id, ...item })));
  function reviewedDraft(item: ApprovedDraft) {
    const edit = technologyEdits[item.id];
    return edit === undefined ? item.draft : { ...item.draft,
      techStack: [...new Set(edit.split(",").map((value) => value.trim()).filter(Boolean))] };
  }
  const hasValidTechnologies = (draft: DiscoveredExperienceDraft) =>
    draft.techStack.length <= 30 && draft.techStack.every((value) => value.length <= 80);

  async function ask(start: boolean) {
    const session: Session | undefined = start
      ? { id: crypto.randomUUID(), topic: topic.trim(), requirement, status: "question", messages: [], drafts: [] }
      : current;
    if (!session || (start ? topicBlocked : currentBlocked)) return;
    setBusy(true); setError("");
    const messages = start ? [] : [...session.messages, { role: "user" as const, content: answer.trim() }];
    const nextSessions = start ? [...sessions, session] : sessions;
    try {
      const result = await postSseJson<ExperienceDiscoveryTurn>("/api/experience-discovery", { resume, company, requirement: session.topic.slice(0, topicLimit), messages, agent: toAgentRunOptions(settings) });
      const drafts = result.draft ? [...session.drafts, { id: crypto.randomUUID(), draft: result.draft, status: "pending" as const }] : session.drafts;
      onChange(nextSessions.map((item) => item.id === session.id ? { ...session, status: result.status, messages: [...messages, { role: "assistant", content: result.message }], drafts } : item));
      setAnswerDraft((draft) => draft?.sessionId === session.id ? undefined : draft);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card"><h2>{scope === "job" ? "공고와 연결할 경험 보완" : "공통 경험 보완"}</h2>
    <p>{scope === "job" ? "이 공고에 필요한 경험을 질문으로 확인합니다. 선택한 내용은 이 회사의 이력서에만 반영되며 공통 이력서는 바뀌지 않습니다." : "회사에 관계없이 활용할 실제 경험을 질문으로 정리합니다. 선택한 내용은 공통 이력서 편집 초안에 반영합니다."}</p>
    <label>보완할 내용<textarea ref={topicInputRef} value={topic} onChange={(event) => setTopicEdit({ request: topicRequest, value: event.target.value })} maxLength={topicLimit} rows={2} /></label>
    <button disabled={busy || !topic.trim() || topicBlocked} onClick={() => void ask(true)}>{busy ? "답변을 정리하는 중…" : "새 질문 받기"}</button>
    {topicBlocked && <p role="status">이 요건은 경험이 없다고 기록했습니다.</p>}
    {sessions.map((session) => <details key={session.id} open={session.id === current?.id}><summary>{session.topic}</summary>
      {session.messages.map((message, index) => <article key={index}><strong>{message.role === "assistant" ? "AI 질문·정리" : "내 답변"}</strong><p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p></article>)}
    </details>)}
    {current?.status === "question" && !currentBlocked && <><label>내 답변<textarea value={answer} onChange={(event) => setAnswerDraft({ sessionId: current.id, value: event.target.value })} maxLength={2000} rows={4} placeholder="없거나 기억나지 않는 내용은 그대로 알려 주세요." /></label><button disabled={busy || !answer.trim() || current.messages.length >= 15} onClick={() => void ask(false)}>답변 보내기</button>{current.messages.length >= 15 && <p>대화가 길어졌습니다. 새 질문으로 이어가 주세요.</p>}</>}
    {error && <p role="alert">{error}</p>}
    {savedExperiences.length > 0 && <details>
      <summary>다시 사용할 경험 {savedExperiences.length}개</summary>
      {savedExperiences.map(({ id, draft, scope: savedScope }) => <article className="review-comment" key={id}>
        <strong>{draft.title || draft.organization} · {savedScope === "common" ? "공통" : "이 회사만"}</strong>
        <p>{[draft.organization, draft.role, draft.period].filter(Boolean).join(" · ")}</p>
        <p>{draft.description}</p>
        {draft.techStack.length > 0 && <p>사용 기술 {draft.techStack.join(", ")}</p>}
        {(scope === "common" || savedScope === "company") && <button type="button" onClick={() => onRemoveExperience(id)}>저장한 근거 삭제</button>}
      </article>)}
    </details>}
    {pending.length > 0 && <><h3>모아 둔 경험 초안</h3>{pending.map((item) => {
      const saved = savedExperiences.find(({ id }) => id === item.id);
      const experienceScope = experienceScopes[item.id] ?? saved?.scope ?? (scope === "job" ? "company" : "common");
      const techText = technologyEdits[item.id] ?? item.draft.techStack.join(", ");
      const reviewed = reviewedDraft(item);
      const valid = hasValidTechnologies(reviewed);
      return <article className="review-comment" key={item.id}>
      <label>반영할 위치<select value={item.target ?? "new"} onChange={(event) => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, target: event.target.value } : entry) })))}><option value="new">새 경험으로 추가</option>{resume.experience.map((entry, index) => <option key={`experience:${index}`} value={`experience:${index}`}>경력 보완: {entry.company} · {entry.role}</option>)}{resume.projects.map((entry, index) => <option key={`project:${index}`} value={`project:${index}`}>프로젝트 보완: {entry.name}</option>)}</select></label>
      <label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />이 경험 반영</label>
      {(["title", "organization", "role", "period", "description"] as const).map((key) => <label key={key}>{({ title: "제목", organization: "소속", role: "역할", period: "기간", description: "경험 내용" })[key]}<textarea rows={key === "description" ? 4 : 1} maxLength={key === "description" ? 1600 : key === "period" ? 100 : 160} value={item.draft[key]} onChange={(event) => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, draft: { ...entry.draft, [key]: event.target.value } } : entry) })))} /></label>)}
      <label>사용 기술<input type="text" value={techText} onChange={(event) => setTechnologyEdits((edits) => ({ ...edits, [item.id]: event.target.value }))} /></label>
      {!valid && <p role="alert">기술은 이름당 80자 이내로, 쉼표로 구분해 최대 30개 입력해 주세요.</p>}
      {scope === "job" && <label>근거를 다시 사용할 범위<select value={experienceScope} onChange={(event) => setExperienceScopes((scopes) => ({ ...scopes, [item.id]: event.target.value as ConfirmedExperienceScope }))}>
        <option value="company">이 회사만</option><option value="common">공통</option>
      </select></label>}
      <button type="button" disabled={busy || !valid || !reviewed.description.trim() || !(reviewed.title.trim() || reviewed.organization.trim())
        || Boolean(saved && saved.scope === experienceScope && JSON.stringify(saved.draft) === JSON.stringify(reviewed))} onClick={() => {
        onSaveExperience({ id: item.id, draft: reviewed }, experienceScope);
      }}>{saved ? "확인한 근거 다시 저장" : "확인한 근거로 저장"}</button>
      <button disabled={busy} onClick={() => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, status: "dismissed" } : entry) })))}>이 초안 제외</button>
    </article>;
    })}<button className="primary" disabled={busy || !selected.some((id) => pending.some((item) => item.id === id))} onClick={() => {
      const drafts = pending.filter((item) => selected.includes(item.id)).map((item) => ({ ...item, draft: reviewedDraft(item) }));
      if (drafts.some(({ draft }) => !hasValidTechnologies(draft))) return;
      if (drafts.some((item) => !item.draft.description.trim() || (!item.draft.title.trim() && !item.draft.organization.trim()))) { setError("선택한 경험의 제목 또는 소속과 내용을 확인해 주세요."); return; }
      onApply(drafts); setSelected([]);
    }}>선택한 경험을 모아서 반영</button></>}
  </section>;
}
