"use client";
import { useState, type Ref } from "react";
import type { z } from "zod";
import type { EnrichmentSchema, Workspace } from "@/entities/workspace/model/workspace";
import type { Company, DiscoveredExperienceDraft, ExperienceDiscoveryTurn, Resume } from "@/shared/lib/types";
import { postSseJson } from "@/shared/lib/stream-client";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
type Session = z.infer<typeof EnrichmentSchema>;
const defaultTopic = "이력서에서 역할·행동·결과가 부족한 경험과 최근에 빠뜨린 경험을 확인해 줘.";
const topicLimit = 300;
export type ApprovedDraft = { sessionId: string; id: string; draft: DiscoveredExperienceDraft; target?: string };
export function EnrichmentPanel({ resume, company, sessions, settings, onChange, onApply, topicRequest, topicInputRef, knownGaps = [], scope = company ? "job" : "common" }: {
  scope?: "common" | "job"; resume: Resume; company?: Company; sessions: Session[]; settings: Workspace["settings"];
  topicRequest?: { text: string };
  topicInputRef?: Ref<HTMLTextAreaElement>;
  knownGaps?: readonly string[];
  onChange: (sessions: Session[]) => void; onApply: (drafts: ApprovedDraft[]) => void;
}) {
  const [topicEdit, setTopicEdit] = useState<{ request?: typeof topicRequest; value: string }>();
  const [answerDraft, setAnswerDraft] = useState<{ sessionId: string; value: string }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
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
    {pending.length > 0 && <><h3>모아 둔 경험 초안</h3>{pending.map((item) => <article className="review-comment" key={item.id}>
      <label>반영할 위치<select value={item.target ?? "new"} onChange={(event) => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, target: event.target.value } : entry) })))}><option value="new">새 경험으로 추가</option>{resume.experience.map((entry, index) => <option key={`experience:${index}`} value={`experience:${index}`}>경력 보완: {entry.company} · {entry.role}</option>)}{resume.projects.map((entry, index) => <option key={`project:${index}`} value={`project:${index}`}>프로젝트 보완: {entry.name}</option>)}</select></label>
      <label><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} />이 경험 반영</label>
      {(["title", "organization", "role", "period", "description"] as const).map((key) => <label key={key}>{({ title: "제목", organization: "소속", role: "역할", period: "기간", description: "경험 내용" })[key]}<textarea rows={key === "description" ? 4 : 1} maxLength={key === "description" ? 1600 : key === "period" ? 100 : 160} value={item.draft[key]} onChange={(event) => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, draft: { ...entry.draft, [key]: event.target.value } } : entry) })))} /></label>)}
      <button disabled={busy} onClick={() => onChange(sessions.map((session) => ({ ...session, drafts: session.drafts.map((entry) => entry.id === item.id ? { ...entry, status: "dismissed" } : entry) })))}>이 초안 제외</button>
    </article>)}<button className="primary" disabled={busy || !selected.some((id) => pending.some((item) => item.id === id))} onClick={() => {
      const drafts = pending.filter((item) => selected.includes(item.id));
      if (drafts.some((item) => !item.draft.description.trim() || (!item.draft.title.trim() && !item.draft.organization.trim()))) { setError("선택한 경험의 제목 또는 소속과 내용을 확인해 주세요."); return; }
      onApply(drafts); setSelected([]);
    }}>선택한 경험을 모아서 반영</button></>}
  </section>;
}
