"use client";

import { buildResumeTailoringEvidence } from "@/entities/resume/model/resume-tailoring";
import type { ResumeTailoringReview } from "@/features/pdf/hooks/use-resume-tailoring-workflow";

interface ResumeTailoringReviewProps {
  review: ResumeTailoringReview;
  onApply: () => void;
  onDismiss: () => void;
}

export function ResumeTailoringReviewPanel({
  review,
  onApply,
  onDismiss
}: ResumeTailoringReviewProps) {
  const evidenceById = new Map(
    buildResumeTailoringEvidence(review.sourceResume).map((item) => [item.id, item])
  );

  const renderEvidence = (ids: string[]) => (
    <ul className="resume-tailoring-evidence-list">
      {ids.map((id) => {
        const evidence = evidenceById.get(id);
        return evidence ? (
          <li key={id}>
            <strong>{evidence.title}</strong>
            <p>{evidence.text}</p>
          </li>
        ) : null;
      })}
    </ul>
  );

  return (
    <section className="resume-tailoring-review" aria-label="맞춤 이력서 검토">
      <header>
        <div>
          <p className="card-kicker">검토 후 적용</p>
          <h3>공고에 맞춘 이력서 초안</h3>
          <p>원본 경력과 프로젝트에서 바뀐 표현을 확인하고 적용해 주세요.</p>
        </div>
      </header>

      <section className="resume-tailoring-copy-change">
        <h4>직무 제목</h4>
        <p className="resume-tailoring-before">기존: {review.sourceResume.headline || "없음"}</p>
        <p className="resume-tailoring-after">맞춤: {review.plan.headline.text}</p>
        {renderEvidence(review.plan.headline.evidenceIds)}
      </section>

      <section className="resume-tailoring-copy-change">
        <h4>요약</h4>
        <p className="resume-tailoring-before">기존: {review.sourceResume.summary || "없음"}</p>
        <p className="resume-tailoring-after">맞춤: {review.plan.summary.text}</p>
        {renderEvidence(review.plan.summary.evidenceIds)}
      </section>

      {review.plan.experience.length > 0 && (
        <section className="resume-tailoring-item-group">
          <h4>경력 순서와 표현</h4>
          {review.plan.experience.map((item) => {
            const source = evidenceById.get(item.sourceId);
            const original = review.sourceResume.experience[Number(item.sourceId.split("-").at(-1)) - 1];
            return (
              <article className="resume-tailoring-item" key={item.sourceId}>
                <strong>{source?.title ?? item.sourceId}</strong>
                {original && <p className="resume-tailoring-before">기존: {original.description}</p>}
                <p className="resume-tailoring-after">맞춤: {item.description}</p>
                {renderEvidence(item.evidenceIds)}
              </article>
            );
          })}
        </section>
      )}

      {review.plan.projects.length > 0 && (
        <section className="resume-tailoring-item-group">
          <h4>프로젝트 순서와 표현</h4>
          {review.plan.projects.map((item) => {
            const source = evidenceById.get(item.sourceId);
            const original = review.sourceResume.projects[Number(item.sourceId.split("-").at(-1)) - 1];
            return (
              <article className="resume-tailoring-item" key={item.sourceId}>
                <strong>{source?.title ?? item.sourceId}</strong>
                {original && <p className="resume-tailoring-before">기존: {original.description}</p>}
                <p className="resume-tailoring-after">맞춤: {item.description}</p>
                {renderEvidence(item.evidenceIds)}
              </article>
            );
          })}
        </section>
      )}

      <section className="resume-tailoring-selection">
        <h4>선택한 기술과 성과</h4>
        <p><strong>기술:</strong> {review.resume.techStack.join(", ") || "선택 없음"}</p>
        <p><strong>성과:</strong> {review.resume.achievements.join(" / ") || "선택 없음"}</p>
        <p><strong>강점:</strong> {review.resume.pdfStrengths.join(" / ") || "선택 없음"}</p>
      </section>

      <footer className="action-row">
        <button type="button" className="text-btn" onClick={onDismiss}>
          취소
        </button>
        <button type="button" className="primary" onClick={onApply}>
          맞춤 이력서 적용
        </button>
      </footer>
    </section>
  );
}
