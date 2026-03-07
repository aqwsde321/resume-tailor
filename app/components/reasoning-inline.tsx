"use client";

import {
  isModelReasoningEffort,
  MODEL_REASONING_EFFORT_LABELS,
  MODEL_REASONING_EFFORT_VALUES
} from "@/lib/agent-settings";
import { usePipeline } from "@/lib/pipeline-context";

interface ReasoningInlineProps {
  disabled?: boolean;
}

export function ReasoningInline({ disabled = false }: ReasoningInlineProps) {
  const { state, patch } = usePipeline();

  return (
    <label className={`inline-setting${disabled ? " disabled" : ""}`}>
      <span className="inline-setting-label">생각 깊이</span>
      <span className="inline-select-shell">
        <select
          className="inline-select"
          aria-label="생각 깊이"
          value={state.agentSettings.modelReasoningEffort}
          onChange={(event) =>
            patch((prev) => ({
              ...prev,
              agentSettings: {
                ...prev.agentSettings,
                modelReasoningEffort: isModelReasoningEffort(event.target.value)
                  ? event.target.value
                  : ""
              }
            }))
          }
          disabled={disabled}
        >
          {MODEL_REASONING_EFFORT_VALUES.map((item) => (
            <option key={item} value={item}>
              {MODEL_REASONING_EFFORT_LABELS[item]}
            </option>
          ))}
        </select>
        <span className="inline-select-caret" aria-hidden="true" />
      </span>
    </label>
  );
}
