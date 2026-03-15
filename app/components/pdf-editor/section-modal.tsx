"use client";

import type { ReactNode } from "react";

interface PdfEditorModalSectionProps {
  action?: ReactNode;
  children: ReactNode;
  chipTitle?: string;
  description?: string;
  isActive: boolean;
  kicker: string;
  onClose: () => void;
  onOpen: () => void;
  summary: string;
  title: string;
}

export function PdfEditorModalSection({
  action,
  children,
  chipTitle,
  description,
  isActive,
  kicker,
  onClose,
  onOpen,
  summary,
  title
}: PdfEditorModalSectionProps) {
  return (
    <>
      <button
        type="button"
        className={`pdf-editor-chip ${isActive ? "active" : ""}`}
        onClick={onOpen}
      >
        <span className="pdf-editor-chip-copy">
          <span className="pdf-editor-chip-key">{kicker}</span>
          <span className="pdf-editor-chip-title">{chipTitle ?? title}</span>
        </span>
        <span className="pdf-editor-chip-meta">{summary}</span>
      </button>

      {isActive && (
        <section className="pdf-modal-shell" aria-modal="true" role="dialog">
          <button
            type="button"
            className="pdf-modal-backdrop"
            onClick={onClose}
            aria-label={`${title} 편집 닫기`}
          />

          <div className="pdf-modal pdf-editor-modal">
            <div className="pdf-modal-head">
              <div>
                <p className="card-kicker">{kicker}</p>
                <h2>{title}</h2>
                {description && <p className="pdf-modal-copy">{description}</p>}
              </div>
              <div className="pdf-modal-actions">
                {action}
                <button type="button" className="secondary" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>

            <div className="pdf-editor-modal-body">{children}</div>
          </div>
        </section>
      )}
    </>
  );
}
