"use client";

import type { InsightView } from "@/app/components/result/types";

interface InsightCardProps {
  view: InsightView;
}

export function InsightCard({ view }: InsightCardProps) {
  return (
    <section className="card workflow-support-card">
      <div className="card-head insight-head">
        <div className="insight-head-copy">
          <p className="card-kicker">{view.kicker}</p>
          <h2>{view.title}</h2>
        </div>

        {view.keywords.length > 0 && (
          <aside className="insight-keyword-panel" aria-label="소개글 키워드">
            <p className="insight-keyword-title">키워드</p>
            <div className="keyword-list">
              {view.keywords.map((item) => (
                <span key={item} className="keyword-chip">
                  {item}
                </span>
              ))}
            </div>
          </aside>
        )}
      </div>

      <div className="insight-grid">
        <article className="insight-card ok">
          <h3>잘 맞는 점</h3>
          <ul className="insight-list">
            {view.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="insight-card warn">
          <h3>보완할 점</h3>
          <ul className="insight-list">
            {view.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        {view.opportunities.length > 0 && (
          <article className="insight-card info">
            <h3>더 살릴 수 있는 점</h3>
            <ul className="insight-list">
              {view.opportunities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        )}
      </div>
    </section>
  );
}
