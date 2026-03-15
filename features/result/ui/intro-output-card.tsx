"use client";

import type { CopyFeedback } from "@/features/result/model/result-view";

import type { IntroSectionView } from "@/features/result/ui/types";

interface IntroOutputCardProps {
  copyAnnouncement: string;
  copyFeedback: CopyFeedback | null;
  introSections: IntroSectionView[];
  isBusy: boolean;
  onCopy: (section: IntroSectionView) => void;
}

export function IntroOutputCard({
  copyAnnouncement,
  copyFeedback,
  introSections,
  isBusy,
  onCopy
}: IntroOutputCardProps) {
  return (
    <section className="card workflow-result-card result-output-shell">
      <div className="result-output-head">
        <div>
          <p className="card-kicker">결과</p>
          <h2>복사 전에 한 번만 읽어 보세요</h2>
        </div>
        <p className="sr-only" aria-live="polite">
          {copyAnnouncement}
        </p>
      </div>

      <div className="result-card">
        {introSections.map((section) => (
          <article key={section.key} className="result-block">
            <div className="result-head">
              <h3>{section.title}</h3>
              <button
                type="button"
                className={`secondary copy-btn ${
                  copyFeedback?.key === section.key ? copyFeedback.status : ""
                }`}
                onClick={() => onCopy(section)}
                disabled={isBusy || !section.value.trim()}
              >
                {copyFeedback?.key === section.key
                  ? copyFeedback.status === "success"
                    ? "복사됨"
                    : "복사 실패"
                  : "복사"}
              </button>
            </div>
            <p>{section.value || section.emptyText}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
