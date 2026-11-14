"use client";
import { useState } from "react";
import type { z } from "zod";
import type { EnrichmentSchema, Workspace } from "@/entities/workspace/model/workspace";
import type { Company, DiscoveredExperienceDraft, ExperienceDiscoveryTurn, Resume } from "@/shared/lib/types";
import { postSseJson } from "@/shared/lib/stream-client";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
type Session = z.infer<typeof EnrichmentSchema>;
export type ApprovedDraft = { sessionId: string; id: string; draft: DiscoveredExperienceDraft; target?: string };
export function EnrichmentPanel({ resume, company, sessions, settings, onChange, onApply }: {
  resume: Resume; company?: Company; sessions: Session[]; settings: Workspace["settings"];
  onChange: (sessions: Session[]) => void; onApply: (drafts: ApprovedDraft[]) => void;
}) {
  const [topic, setTopic] = useState("이력서에서 역할·행동·결과가 부족한 경험과 최근에 빠뜨린 경험을 확인해 줘.");
  const [answer, setAnswer] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const current = sessions[sessions.length - 1];
  const pending = sessions.flatMap((session) => session.drafts.filter((item) => item.status === "pending").map((item) => ({ sessionId: session.id, ...item })));
  async function ask(start: boolean) {
    setBusy(true); setError("");
    const session: Session = start ? { id: crypto.randomUUID(), topic, status: "question", messages: [], drafts: [] } : current;
    const messages = start ? [] : [...session.messages, { role: "user" as const, content: answer.trim() }];
    const nextSessions = start ? [...sessions, session] : sessions;
    try {
      const result = await postSseJson<ExperienceDiscoveryTurn>("/api/experience-discovery", { resume, company, requirement: session.topic.slice(0, 300), messages, agent: toAgentRunOptions(settings) });
      const drafts = result.draft ? [...session.drafts, { id: crypto.randomUUID(), draft: result.draft, status: "pending" as const }] : session.drafts;
      onChange(nextSessions.map((item) => item.id === session.id ? { ...session, status: result.status, messages: [...messages, { role: "assistant", content: result.message }], drafts } : item));
      setAnswer("");
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card"><h2>AI와 부족한 내용 보완하기</h2>
    <p>질문에 답하면 실제 경험을 초안으로 모아 둡니다. 확인하고 선택한 내용만 이력서에 반영합니다.</p>
    <label>보완할 내용<textarea value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={300} rows={2} /></label>
    <button disabled={busy || !topic.trim()} onClick={() => void ask(true)}>{busy ? "답변을 정리하는 중…" : "새 질문 받기"}</button>
    {sessions.map((session) => <details key={session.id} open={session.id === current?.id}><summary>{session.topic}</summary>
      {session.messages.map((message, index) => <article key={index}><strong>{message.role === "assistant" ? "AI 질문·정리" : "내 답변"}</strong><p style={{ whiteSpace: "pre-wrap" }}>{message.content}</p></article>)}
    </details>)}
    {current?.status === "question" && <><label>내 답변<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={2000} rows={4} placeholder="없거나 기억나지 않는 내용은 그대로 알려 주세요." /></label><button disabled={busy || !answer.trim() || current.messages.length >= 15} onClick={() => void ask(false)}>답변 보내기</button>{current.messages.length >= 15 && <p>대화가 길어졌습니다. 새 질문으로 이어가 주세요.</p>}</>}
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
