"use client";

import { useState, type FormEvent } from "react";
import { createInterviewRound, getInterviewRoundTitle, updateInterviewRound, type InterviewRound } from "@/entities/application/model/interview-rounds";
import { InterviewPrepContent } from "./interview-prep-content";

export function ApplicationInterviewRounds({ recordId, rounds, focusedRoundId, canGenerate, busyRoundId, busy, onChange, onGenerate }: {
  recordId: string;
  rounds: InterviewRound[];
  focusedRoundId?: string;
  canGenerate: boolean;
  busyRoundId: string | null;
  busy: boolean;
  onChange: (change: (rounds: InterviewRound[]) => InterviewRound[]) => void;
  onGenerate: (round: InterviewRound) => void;
}) {
  const [open, setOpen] = useState(Boolean(focusedRoundId));
  const [selectedId, setSelectedId] = useState(focusedRoundId);
  const [deleteId, setDeleteId] = useState<string>();

  return <details className="application-interview-rounds" open={open} onToggle={(event) => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}>
    <summary>면접 차수{rounds.length > 0 ? ` · ${rounds.length}개` : ""}</summary>
    <div className="application-round-list">
      {rounds.map((round) => <details key={round.id} id={`application-round-${recordId}-${round.id}`} open={selectedId === round.id}
        onToggle={(event) => {
          if (event.target !== event.currentTarget) return;
          const opened = event.currentTarget.open;
          setSelectedId((current) => opened ? round.id : current === round.id ? undefined : current);
        }}>
        <summary>
          <strong>{getInterviewRoundTitle(round)}</strong>
          <span>{[round.date ?? "일정 미정", round.date && round.time, round.completed && "완료"].filter(Boolean).join(" · ")}</span>
        </summary>
        <InterviewRoundFields round={round} onEdit={(edit) => onChange((current) => updateInterviewRound(current, round.id, edit))} />
        {canGenerate && <details className="application-interview-prep application-round-prep">
          <summary>이 차수의 예상 질문{round.interviewPrep ? " · 저장됨" : ""}</summary>
          <div className="application-interview-prep-content">
            {round.interviewPrep && <InterviewPrepContent prep={round.interviewPrep} />}
            <button className="nav-btn" type="button" disabled={busy || Boolean(busyRoundId)} onClick={() => onGenerate(round)}>
              {busyRoundId === round.id ? "예상 질문 만드는 중…" : round.interviewPrep ? "이 차수의 예상 질문 다시 만들기" : "이 차수의 예상 질문 만들기"}
            </button>
          </div>
        </details>}
        {deleteId === round.id ? <div className="action-row">
          <button type="button" className="nav-btn" onClick={() => setDeleteId(undefined)}>삭제 취소</button>
          <button type="button" className="nav-btn" onClick={() => {
            onChange((current) => current.filter(({ id }) => id !== round.id));
            setDeleteId(undefined);
          }}>이 차수 삭제 확인</button>
        </div> : <button type="button" className="text-btn" onClick={() => setDeleteId(round.id)}>이 차수 삭제</button>}
      </details>)}
      <button className="nav-btn" type="button" onClick={() => {
        const round = createInterviewRound(rounds);
        onChange((current) => [...current, round]);
        setSelectedId(round.id);
      }}>면접 차수 추가</button>
    </div>
  </details>;
}

function InterviewRoundFields({ round, onEdit }: {
  round: InterviewRound;
  onEdit: (update: (round: InterviewRound) => InterviewRound) => void;
}) {
  const [checklistTitle, setChecklistTitle] = useState("");
  const updateFields = (changes: Partial<InterviewRound>) => onEdit((current) => ({ ...current, ...changes }));

  function addItem(event: FormEvent) {
    event.preventDefault();
    const text = checklistTitle.trim();
    if (!text) return;
    const item = { id: crypto.randomUUID(), text, done: false };
    onEdit((current) => ({ ...current, checklist: [...current.checklist, item] }));
    setChecklistTitle("");
  }

  return <div className="application-round-fields">
    <div className="application-round-schedule">
      <label className="application-field">차수 이름<input className="form-input" maxLength={100} value={round.title}
        placeholder={`${round.number}차 면접`} onChange={(event) => updateFields({ title: event.target.value })} /></label>
      <label className="application-field">면접 날짜<input className="form-input" type="date" min="0100-01-01" max="9999-12-31" value={round.date ?? ""}
        onChange={(event) => { if (event.target.validity.valid) updateFields({ date: event.target.value || null }); }} /></label>
      <label className="application-field">면접 시간<input className="form-input" type="time" value={round.time ?? ""}
        onChange={(event) => { if (event.target.validity.valid) updateFields({ time: event.target.value || null }); }} /></label>
    </div>
    <label><input type="checkbox" checked={round.completed} onChange={(event) => updateFields({ completed: event.target.checked })} /> 면접 완료</label>
    <fieldset className="application-round-checklist">
      <legend>준비 체크리스트</legend>
      {round.checklist.map((item) => <div key={item.id}>
        <label><input type="checkbox" checked={item.done} onChange={(event) => {
          const done = event.target.checked;
          onEdit((current) => ({ ...current, checklist: current.checklist.map((entry) => entry.id === item.id ? { ...entry, done } : entry) }));
        }} /> {item.text}</label>
        <button type="button" className="text-btn" aria-label={`${item.text} 삭제`}
          onClick={() => onEdit((current) => ({ ...current, checklist: current.checklist.filter(({ id }) => id !== item.id) }))}>삭제</button>
      </div>)}
      <form onSubmit={addItem}>
        <label className="application-field">새 준비 항목<input className="form-input" maxLength={160} value={checklistTitle}
          onChange={(event) => setChecklistTitle(event.target.value)} /></label>
        <button type="submit" className="nav-btn" disabled={!checklistTitle.trim()}>항목 추가</button>
      </form>
    </fieldset>
    <label className="application-field">준비 메모<textarea className="form-input" maxLength={3000} rows={3} value={round.preparation}
      onChange={(event) => updateFields({ preparation: event.target.value })} /></label>
    <label className="application-field">면접 복기<textarea className="form-input" maxLength={3000} rows={4} value={round.reflection}
      placeholder="받은 질문, 피드백, 다음 차수에서 준비할 내용을 적어 두세요." onChange={(event) => updateFields({ reflection: event.target.value })} /></label>
  </div>;
}
