"use client";
import { useState } from "react";
import type { CompanyWork } from "@/entities/workspace/model/workspace";
import { mergeTailoringSelection } from "@/entities/workspace/model/tailoring-selection";
import { buildResumeTailoringEvidence } from "@/entities/resume/model/resume-tailoring";
import type { Resume } from "@/shared/lib/types";
export function TailoringReview({ work, onApply, onDismiss }: { work: CompanyWork; onApply: (resume: Resume) => void; onDismiss: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const review = work.tailoring;
  if (!review) return null;
  const source = review.sourceResume;
  const evidence = new Map(buildResumeTailoringEvidence(source).map((item) => [item.id, item]));
  const rows = [
    { id: "headline", label: "한 줄 소개", before: source.headline, after: review.plan.headline.text, evidenceIds: review.plan.headline.evidenceIds },
    { id: "summary", label: "소개", before: source.summary, after: review.plan.summary.text, evidenceIds: review.plan.summary.evidenceIds },
    ...review.plan.experience.map((item) => ({ id: item.sourceId, label: source.experience[Number(item.sourceId.split("-")[1]) - 1]?.company ?? "경력", before: source.experience[Number(item.sourceId.split("-")[1]) - 1]?.description ?? "", after: item.description, evidenceIds: item.evidenceIds })),
    ...review.plan.projects.map((item) => ({ id: item.sourceId, label: source.projects[Number(item.sourceId.split("-")[1]) - 1]?.name ?? "프로젝트", before: source.projects[Number(item.sourceId.split("-")[1]) - 1]?.description ?? "", after: item.description, evidenceIds: item.evidenceIds })),
  ];
  return <section className="card"><h2>회사 맞춤 변경 검토</h2><p>선택한 표현만 반영합니다. 경력·프로젝트 항목과 순서는 유지합니다.</p>
    <button onClick={() => setSelected(rows.map((row) => row.id))}>모든 표현 선택</button>
    {review.plan.requirementMatches.map((match) => <p key={match.requirementId}>{({ direct: "직접 경험", transferable: "전이 가능한 경험", adjacent: "관련 경험", gap: "추가 확인 필요" })[match.matchType]} · {match.reason}</p>)}
    {rows.map((row) => <article className="review-change" key={row.id}><label><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))} />{row.label}</label><div className="review-columns"><pre>{row.before}</pre><pre>{row.after}</pre></div><details><summary>원본 근거</summary>{row.evidenceIds.map((id) => <p key={id}>{evidence.get(id)?.text}</p>)}</details></article>)}
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={!selected.length || JSON.stringify(work.resume) !== JSON.stringify(review.editingSnapshot ?? source)} onClick={() => {
      try { onApply(mergeTailoringSelection(work.resume!, source, review.plan, selected)); }
      catch (error) { setError((error as Error).message); }
    }}>선택한 표현 적용</button><button onClick={onDismiss}>제안 닫기</button>
  </section>;
}
