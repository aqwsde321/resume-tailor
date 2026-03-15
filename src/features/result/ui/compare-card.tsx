"use client";

import type { ResultCompareSection } from "@/features/result/ui/types";

interface CompareCardProps {
  sections: ResultCompareSection[];
}

export function CompareCard({ sections }: CompareCardProps) {
  return (
    <section className="card workflow-support-card compare-shell">
      <div className="card-head">
        <div>
          <p className="card-kicker">비교</p>
          <h2>이전 / 지금 비교</h2>
        </div>
      </div>

      <div className="compare-section-list">
        {sections.map((section) => (
          <article key={section.key} className="compare-section">
            <div className="compare-section-head">
              <h3>{section.title}</h3>
            </div>

            <div className="compare-grid">
              <article className="compare-column compare-old">
                <p className="compare-column-title">이전</p>
                <div className="compare-body" aria-label={section.previousTitle}>
                  {section.previousChunks.length > 0 ? (
                    section.previousChunks.map((chunk) => (
                      <span key={chunk.id} className={`compare-chunk ${chunk.status}`}>
                        {chunk.text}
                      </span>
                    ))
                  ) : (
                    <p className="compare-empty">이전 내용이 없습니다.</p>
                  )}
                </div>
              </article>

              <article className="compare-column compare-new">
                <p className="compare-column-title">지금</p>
                <div className="compare-body" aria-label={section.currentTitle}>
                  {section.currentChunks.length > 0 ? (
                    section.currentChunks.map((chunk) => (
                      <span key={chunk.id} className={`compare-chunk ${chunk.status}`}>
                        {chunk.text}
                      </span>
                    ))
                  ) : (
                    <p className="compare-empty">현재 내용이 없습니다.</p>
                  )}
                </div>
              </article>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
