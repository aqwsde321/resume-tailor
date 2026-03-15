"use client";

import type { Route } from "next";
import Link from "next/link";

export interface FrameStepItem {
  active: boolean;
  enabled: boolean;
  href: string;
  key: string;
  label: string;
  status: string;
  statusLabel: string;
}

interface FrameShellProps {
  description: string;
  saveSummaryItems: string[];
  showSaveSummary: boolean;
  steps: FrameStepItem[];
  stickyShell: boolean;
  title: string;
}

export function FrameShell({
  description,
  saveSummaryItems,
  showSaveSummary,
  steps,
  stickyShell,
  title
}: FrameShellProps) {
  return (
    <>
      <header className="hero">
        <p className="eyebrow">ResumeTailor</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <section className={`sticky-shell ${stickyShell ? "" : "static-shell"}`.trim()}>
        <ol className="steps">
          {steps.map((item) => (
            <li
              key={item.key}
              className={`step-item ${item.active ? "active" : ""} ${item.status}`}
            >
              {item.enabled ? (
                <Link href={item.href as Route} className="step-link step-content">
                  <span>{item.label}</span>
                  <span className={`step-state ${item.status}`}>{item.statusLabel}</span>
                </Link>
              ) : (
                <span className="step-link step-content disabled">
                  <span>{item.label}</span>
                  <span className={`step-state ${item.status}`}>{item.statusLabel}</span>
                </span>
              )}
            </li>
          ))}
        </ol>

        {showSaveSummary && saveSummaryItems.length > 0 && (
          <details className="sticky-meta-disclosure">
            <summary>
              <span>최근 저장 {saveSummaryItems.length}건</span>
            </summary>
            <div className="sticky-meta-body" aria-label="마지막 저장 시각">
              {saveSummaryItems.map((item) => (
                <span key={item} className="save-meta-chip subtle">
                  {item}
                </span>
              ))}
            </div>
          </details>
        )}
      </section>
    </>
  );
}
