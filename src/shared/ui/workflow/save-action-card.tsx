"use client";

import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

interface MissingFieldItem {
  key: string;
  label: string;
}

interface SaveActionCardProps<TKey extends string> {
  busy: boolean;
  missingItems: Array<MissingFieldItem & { key: TKey }>;
  nextHref?: string;
  nextLabel?: string;
  onFocusMissing: (key: TKey) => void;
  onPrimary: () => void;
  primaryDisabled: boolean;
  primaryLabel: string;
  savedAtLabel?: string;
  title: string;
}

export function SaveActionCard<TKey extends string>({
  busy,
  missingItems,
  nextHref,
  nextLabel,
  onFocusMissing,
  onPrimary,
  primaryDisabled,
  primaryLabel,
  savedAtLabel,
  title
}: SaveActionCardProps<TKey>) {
  return (
    <section className="card workflow-footer-card">
      <div className="action-panel review">
        <div className="action-copy">
          <strong>{title}</strong>
          {savedAtLabel && <span className="action-meta">{savedAtLabel}</span>}
          {missingItems.length > 0 && (
            <p className="action-note warn">
              <span>저장 전 확인:</span>{" "}
              {missingItems.map((item, index) => (
                <Fragment key={item.key}>
                  {index > 0 && <span className="action-note-separator">, </span>}
                  <button
                    type="button"
                    className="action-note-link"
                    onClick={() => onFocusMissing(item.key)}
                    disabled={busy}
                  >
                    {item.label}
                  </button>
                </Fragment>
              ))}
            </p>
          )}
        </div>
        <div className="action-row">
          <button type="button" className="primary" onClick={onPrimary} disabled={primaryDisabled}>
            {primaryLabel}
          </button>
          {nextHref && nextLabel && (
            <Link className="nav-btn" href={nextHref as Route}>
              {nextLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
