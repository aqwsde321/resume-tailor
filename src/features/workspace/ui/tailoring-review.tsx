"use client";

import { useState } from "react";
import type { CompanyWork } from "@/entities/workspace/model/workspace";
import { buildTailoringReviewRows, mergeTailoringSelection } from "@/entities/workspace/model/tailoring-selection";
import { buildResumeTailoringEvidence, buildResumeTailoringRequirements, reviseTailoringPlan } from "@/entities/resume/model/resume-tailoring";
import { buildTailoringClaimWarnings } from "@/entities/resume/model/tailoring-claim-warnings";
import { useTailoringCopyEdits } from "@/features/resume/hooks/use-tailoring-copy-edits";
import { TailoringCopyReview } from "@/features/resume/ui/tailoring-copy-review";
import type { Resume } from "@/shared/lib/types";
import "../tailoring-review.css";

const matchLabels = {
  direct: "직접 경험",
  transferable: "전이 가능한 경험",
  adjacent: "관련 경험",
  gap: "추가 확인 필요",
};

export function TailoringReview({ work, onApply, onDismiss, onCheckRequirement, onSetRequirementGap, requirementActionsEnabled }: {
  work: CompanyWork;
  onApply: (resume: Resume) => void;
  onDismiss: () => void;
  onCheckRequirement: (text: string) => void;
  onSetRequirementGap: (text: string, marked: boolean) => void;
  requirementActionsEnabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [error, setError] = useState("");
  const edits = useTailoringCopyEdits();
  const review = work.tailoring;
  if (!review) return null;

  const source = review.sourceResume;
  const current = work.resume ?? review.editingSnapshot ?? source;
  const isStale = JSON.stringify(work.resume) !== JSON.stringify(review.editingSnapshot ?? source);
  const evidence = new Map(buildResumeTailoringEvidence(source).map((item) => [item.id, item]));
  const requirements = new Map((work.company ? buildResumeTailoringRequirements(work.company) : []).map((item) => [item.id, item]));
  const plan = reviseTailoringPlan(review.plan, edits.revisions);
  const rows = buildTailoringReviewRows(current, source, plan);
  const claimWarnings = buildTailoringClaimWarnings(source, plan, work.company?.techStack);
  const changedRows = rows.filter((row) => row.changed && !row.unavailableReason);
  const unchangedRows = rows.filter((row) => !row.changed && !row.unavailableReason && !edits.revisions.has(row.id));
  const activeSelection = selected.filter((id) => changedRows.some((row) => row.id === id));
  const visibleRows = rows.filter((row) => showUnchanged || row.changed || row.unavailableReason || edits.revisions.has(row.id) || edits.editingId === row.id);
  const unavailableMessage = !work.resume
    ? "회사별 이력서가 없어 반영할 수 없습니다. 이력서를 만든 뒤 다시 제안받아 주세요."
    : isStale
      ? "제안을 받은 뒤 회사별 이력서가 수정되었습니다. 현재 편집 내용을 보호하기 위해 반영을 잠시 막았어요. 최신 이력서로 다시 제안받아 주세요."
      : "";

  return (
    <section className="tailoring-review" aria-label="회사 맞춤 변경 검토">
      <header className="tailoring-review-header">
        <div>
          <h2>어떤 표현을 반영할까요?</h2>
          <p>현재 회사별 이력서와 제안을 비교하고, 필요한 변경만 골라 주세요.</p>
        </div>
        <button type="button" onClick={onDismiss}>검토 닫기</button>
      </header>

      <details className="tailoring-requirements">
        <summary>공고 요건과 경험 연결 <span>{review.plan.requirementMatches.length}개</span></summary>
        <p>제안에 사용한 이력서의 근거로 연결했습니다. 추가 확인이 필요한 요건은 자동으로 채우지 않습니다.</p>
        {review.plan.requirementMatches.length === 0 && <p>연결된 공고 요건이 없습니다.</p>}
        {review.plan.requirementMatches.map((match) => {
          const requirement = requirements.get(match.requirementId);
          const isKnownGap = Boolean(requirement && work.knownGaps?.includes(requirement.text));
          const labelId = `tailoring-${match.requirementId}`;
          return (
            <div className="tailoring-requirement" key={match.requirementId}>
              <span className="tailoring-match-label" data-match={isKnownGap ? "known-gap" : match.matchType}>{isKnownGap ? "해당 경험 없음" : matchLabels[match.matchType]}</span>
              <strong id={labelId}>{requirement?.text ?? "공고 요건 원문을 찾지 못했습니다."}</strong>
              <p>{match.reason}</p>
              {match.evidenceIds.length > 0 && <details><summary>연결한 원본 근거 {match.evidenceIds.length}개</summary>
                {match.evidenceIds.map((id) => <blockquote key={id}><strong>{evidence.get(id)?.title ?? "원본 근거"}</strong><p>{evidence.get(id)?.text ?? "이 근거의 원문을 찾지 못했습니다."}</p></blockquote>)}
              </details>}
              {requirement && (isKnownGap || match.matchType === "gap") && <div className="tailoring-requirement-actions">
                {!isKnownGap && <button type="button" aria-describedby={labelId} disabled={!requirementActionsEnabled} onClick={() => onCheckRequirement(requirement.text)}>이 경험 확인하기</button>}
                <button type="button" aria-describedby={labelId} disabled={!requirementActionsEnabled} onClick={() => onSetRequirementGap(requirement.text, !isKnownGap)}>{isKnownGap ? "기록 취소" : "해당 경험 없음"}</button>
              </div>}
            </div>
          );
        })}
      </details>

      {unavailableMessage && <p className="tailoring-review-notice" role="status">{unavailableMessage}</p>}
      <div className="tailoring-selection-toolbar">
        <p aria-live="polite"><strong>{activeSelection.length}</strong> / {changedRows.length}개 변경 선택</p>
        <div className="tailoring-selection-actions">
          <button type="button" disabled={!changedRows.length || !!unavailableMessage || activeSelection.length === changedRows.length} onClick={() => setSelected(changedRows.map((row) => row.id))}>변경 전체 선택</button>
          <button type="button" disabled={!activeSelection.length} onClick={() => setSelected([])}>선택 해제</button>
        </div>
        {unchangedRows.length > 0 && <label className="tailoring-unchanged-toggle"><input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} />변경 없는 항목 {unchangedRows.length}개 보기</label>}
      </div>

      <div className="tailoring-changes">
        {!visibleRows.length && <p className="tailoring-review-empty">현재 이력서와 제안이 같습니다. 반영할 변경이 없습니다.</p>}
        {visibleRows.map((row) => {
          const matches = review.plan.requirementMatches.filter((match) => match.evidenceIds.some((id) => row.evidenceIds.includes(id)));
          return (
            <article className="tailoring-change" data-selected={activeSelection.includes(row.id)} key={row.id}>
              <header className="tailoring-change-header">
                <label><input type="checkbox" checked={activeSelection.includes(row.id)} disabled={!row.changed || !!row.unavailableReason || !!unavailableMessage} onChange={(event) => {
                  setError("");
                  setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id));
                }} /><span>{row.label}</span></label>
                <span className="tailoring-change-state">{row.unavailableReason ? "확인 필요" : row.addsItem ? "항목 추가" : row.changed ? "표현 변경" : "변경 없음"}</span>
              </header>
              {row.unavailableReason ? <p className="tailoring-row-notice">{row.unavailableReason}</p> : <>
                <div className="tailoring-compare-columns">
                  <div><h3>반영 전 <span>현재 회사별 이력서</span></h3><p>{row.before || (row.addsItem ? "현재 이력서에 없는 항목입니다." : "작성된 내용이 없습니다.")}</p></div>
                  <div>
                    <h3>반영 후 <span>{row.changed ? "선택하면 바뀔 내용" : "현재 내용과 같음"}</span></h3>
                    <TailoringCopyReview id={row.id} text={row.after} warning={claimWarnings.get(row.id)}
                      edits={edits} disabled={Boolean(unavailableMessage)}>
                      <p>{row.after || "작성된 내용이 없습니다."}</p>
                    </TailoringCopyReview>
                  </div>
                </div>
                {row.addsItem && <p className="tailoring-row-note">선택하면 기존 항목 뒤에 추가합니다. 현재 항목과 순서는 유지합니다.</p>}
              </>}
              <details className="tailoring-row-evidence">
                <summary>제안에 사용한 원본 근거 {row.evidenceIds.length}개{matches.length > 0 ? ` · 연결된 공고 요건 ${matches.length}개` : ""}</summary>
                {row.evidenceIds.length === 0 && <p>연결된 원본 근거가 없습니다.</p>}
                {row.evidenceIds.map((id) => <blockquote key={id}><strong>{evidence.get(id)?.title ?? "원본 근거"}</strong><p>{evidence.get(id)?.text ?? "이 근거의 원문을 찾지 못했습니다."}</p></blockquote>)}
                {matches.map((match) => <div className="tailoring-row-requirement" key={match.requirementId}><strong>{requirements.get(match.requirementId)?.text ?? "공고 요건 원문을 찾지 못했습니다."}</strong><p>{matchLabels[match.matchType]}: {match.reason}</p></div>)}
              </details>
            </article>
          );
        })}
      </div>
      <footer className="tailoring-review-footer">
        <div><p>선택하지 않은 내용은 그대로 유지됩니다.</p><span>경력과 프로젝트의 기존 순서도 유지합니다.</span></div>
        <button type="button" className="primary" disabled={!activeSelection.length || !!unavailableMessage || edits.editingId !== null} onClick={() => {
          if (!work.resume || unavailableMessage || edits.editingId !== null) return;
          try { onApply(mergeTailoringSelection(work.resume, source, plan, activeSelection)); }
          catch (caught) { setError(caught instanceof Error ? caught.message : "반영하지 못했습니다. 선택한 항목을 확인해 주세요."); }
        }}>{activeSelection.length ? `선택한 ${activeSelection.length}개 변경 반영` : "반영할 변경을 선택하세요"}</button>
      </footer>
      {error && <p className="tailoring-review-notice" role="alert">{error}</p>}
    </section>
  );
}
