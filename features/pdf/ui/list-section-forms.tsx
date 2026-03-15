"use client";

import { ListTextarea } from "./list-textarea";
import type { SharedSectionProps } from "./section-form-types";

export function HighlightsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  return (
    <label className="field">
      <span>Highlights</span>
      <ListTextarea
        value={resume.pdfHighlights}
        placeholder="한 줄이 항목 1개입니다."
        onChange={(nextValues) =>
          updateResume((current) => ({
            ...current,
            pdfHighlights: nextValues
          }))
        }
        disabled={exporting}
      />
    </label>
  );
}

export function StrengthsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  return (
    <label className="field">
      <span>Strengths</span>
      <ListTextarea
        value={resume.pdfStrengths}
        placeholder="한 줄이 항목 1개입니다."
        onChange={(nextValues) =>
          updateResume((current) => ({
            ...current,
            pdfStrengths: nextValues
          }))
        }
        disabled={exporting}
      />
    </label>
  );
}
