"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  CompareSection,
  CopyFeedback,
  IntroSectionKey,
  RefreshReasonBadge
} from "@/lib/result-view";

interface IntroSectionView {
  emptyText: string;
  key: IntroSectionKey;
  title: string;
  value: string;
}

interface WritingAnchorItem {
  evidence: string[];
  label: string;
  target: string;
  type: "requirement" | "preferred";
}

interface WritingAnchorView {
  anchors: WritingAnchorItem[];
  kicker: string;
  title: string;
}

interface InsightView {
  gaps: string[];
  highlights: string[];
  kicker: string;
  keywords: string[];
  opportunities: string[];
  title: string;
}

interface IntroActionCardProps {
  actionControls: ReactNode;
  actionDescription: string;
  actionHeading: string;
  freshnessTone: "info" | "ok" | "warn";
  isWorking: boolean;
  refreshReasonBadges: RefreshReasonBadge[];
}

export function IntroActionCard({
  actionControls,
  actionDescription,
  actionHeading,
  freshnessTone,
  isWorking,
  refreshReasonBadges
}: IntroActionCardProps) {
  return (
    <section className={`card card-accent workflow-main-card ${isWorking ? "card-processing" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">만들기</p>
          <h2>소개글 만들기</h2>
        </div>
      </div>

      <div className="action-panel">
        <div className={`action-copy intro-action-copy ${freshnessTone}`}>
          <strong>{actionHeading}</strong>
          {actionDescription && <span>{actionDescription}</span>}
          {refreshReasonBadges.length > 0 && (
            <div className="reason-chip-row">
              {refreshReasonBadges.map((badge) => (
                <span
                  key={badge.key}
                  className={`reason-chip ${badge.key === "resume" ? "resume" : "company"}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="action-controls">{actionControls}</div>
      </div>
    </section>
  );
}

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

interface CompareCardProps {
  sections: CompareSection[];
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

interface PdfNextStepCardProps {
  canExportPdf: boolean;
}

export function PdfNextStepCard({ canExportPdf }: PdfNextStepCardProps) {
  return (
    <section className="card workflow-footer-card">
      <div className="action-panel review">
        <div className="action-copy">
          <strong>다음 단계: PDF 마감</strong>
          <span>최신 소개글이 준비되면 step 4에서 마지막으로 다듬고 내려받습니다.</span>
        </div>
        <div className="action-row">
          {canExportPdf ? (
            <Link href={"/pdf" as Route} className="nav-btn">
              PDF 단계로 가기
            </Link>
          ) : (
            <button type="button" className="secondary" disabled>
              최신 소개글이 있어야 열림
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
