"use client";

import { formatIntroToneLabel, INTRO_TONE_LABELS, INTRO_TONE_VALUES, isIntroTone } from "@/lib/intro-tone";
import { usePipeline } from "@/lib/pipeline-context";

interface ToneInlineProps {
  disabled?: boolean;
}

export function ToneInline({ disabled = false }: ToneInlineProps) {
  const { state, patch } = usePipeline();
  const selectedTone = isIntroTone(state.introTone) ? state.introTone : "balanced";
  const selectedLabel = formatIntroToneLabel(selectedTone);

  return (
    <label className={`inline-setting${disabled ? " disabled" : ""}`}>
      <span className="inline-setting-hint" aria-hidden="true">
        소개글 말투와 강조 방향을 정합니다
      </span>
      <span className="inline-setting-label" aria-hidden="true">
        톤
      </span>
      <span className="inline-setting-value" aria-hidden="true">
        {selectedLabel}
      </span>
      <span className="inline-select-caret" aria-hidden="true" />
      <select
        className="inline-select"
        aria-label={`소개글 톤: ${selectedLabel}. 소개글 말투와 강조 방향을 정합니다.`}
        value={selectedTone}
        onChange={(event) =>
          patch((prev) => ({
            ...prev,
            introTone: isIntroTone(event.target.value) ? event.target.value : "balanced"
          }))
        }
        disabled={disabled}
      >
        {INTRO_TONE_VALUES.map((item) => (
          <option key={item} value={item}>
            {INTRO_TONE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}

