"use client";

import type { WritingAnchorView } from "@/features/result/ui/types";

interface WritingAnchorsCardProps {
  view: WritingAnchorView;
}

export function WritingAnchorsCard({ view }: WritingAnchorsCardProps) {
  return (
    <section className="card workflow-support-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">{view.kicker}</p>
          <h2>{view.title}</h2>
        </div>
      </div>

      <div className="anchor-grid" aria-label={view.title}>
        {view.anchors.map((anchor) => (
          <article key={`${anchor.type}-${anchor.target}`} className={`anchor-card ${anchor.type}`}>
            <div className="anchor-head">
              <span className={`anchor-type ${anchor.type}`}>{anchor.label}</span>
            </div>
            <h3>{anchor.target}</h3>
            <ul className="anchor-evidence">
              {anchor.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
