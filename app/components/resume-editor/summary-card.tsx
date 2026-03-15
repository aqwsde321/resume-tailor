"use client";

import type { Resume } from "@/lib/types";

interface ResumeSummaryCardProps {
  completedExperienceCount: number;
  completedProjectCount: number;
  draft: Resume;
  isWorking: boolean;
  isSaved: boolean;
  needsConfirm: boolean;
  techStackSummary: string;
}

export function ResumeSummaryCard({
  completedExperienceCount,
  completedProjectCount,
  draft,
  isWorking,
  isSaved,
  needsConfirm,
  techStackSummary
}: ResumeSummaryCardProps) {
  return (
    <section className={`card workflow-summary-card ${isWorking ? "card-processing" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">확인</p>
          <h2>이력서 다듬기</h2>
        </div>
        {needsConfirm ? (
          <span className="inline-badge warn">수정됨</span>
        ) : isSaved ? (
          <span className="inline-badge ok">저장됨</span>
        ) : (
          <span className="inline-badge">아직 없음</span>
        )}
      </div>

      <div className="summary-list" aria-label="이력서 현재 요약">
        <div className={`summary-row ${draft.desiredPosition.trim() ? "ok" : "warn"}`}>
          <span>희망 직무</span>
          <strong>{draft.desiredPosition.trim() || "입력 필요"}</strong>
        </div>
        <div className={`summary-row ${draft.techStack.length > 0 ? "ok" : "warn"}`}>
          <span>기술 스택</span>
          <strong>{techStackSummary}</strong>
        </div>
        <div
          className={`summary-row ${
            draft.achievements.length > 0 || draft.strengths.length > 0 ? "ok" : "warn"
          }`}
        >
          <span>소개글 근거</span>
          <strong>{`성과 ${draft.achievements.length} · 강점 ${draft.strengths.length}`}</strong>
        </div>
        <div className="summary-row">
          <span>경력 / 프로젝트</span>
          <strong>{`경력 ${completedExperienceCount} · 프로젝트 ${completedProjectCount}`}</strong>
        </div>
      </div>
    </section>
  );
}
