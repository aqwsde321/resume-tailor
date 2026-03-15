"use client";

import type { ReactNode } from "react";

type SourceInputMode = "text" | "file" | "url";

interface SourceInputModeOption {
  disabled?: boolean;
  label: string;
  value: SourceInputMode;
}

interface SourceInputCardProps {
  actionSlot: ReactNode;
  fileSlot?: ReactNode;
  inputMode: SourceInputMode;
  modes: SourceInputModeOption[];
  onInputModeChange: (mode: SourceInputMode) => void;
  processing: boolean;
  textPlaceholder: string;
  textValue: string;
  textareaDisabled: boolean;
  title: string;
  urlSlot?: ReactNode;
  onTextChange: (value: string) => void;
}

export function SourceInputCard({
  actionSlot,
  fileSlot,
  inputMode,
  modes,
  onInputModeChange,
  processing,
  textPlaceholder,
  textValue,
  textareaDisabled,
  title,
  urlSlot,
  onTextChange
}: SourceInputCardProps) {
  return (
    <section className={`card card-accent workflow-main-card ${processing ? "card-processing" : ""}`}>
      <div className="input-card-head">
        <h2>{title}</h2>
      </div>

      <div className="tabs input-mode-tabs">
        {modes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            className={inputMode === mode.value ? "tab active" : "tab"}
            onClick={() => onInputModeChange(mode.value)}
            disabled={mode.disabled}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {inputMode === "file" && fileSlot}
      {inputMode === "url" && urlSlot}

      <textarea
        value={textValue}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={textPlaceholder}
        disabled={textareaDisabled}
      />

      <div className="action-panel input-card-actions">
        <div className="action-controls">{actionSlot}</div>
      </div>
    </section>
  );
}
