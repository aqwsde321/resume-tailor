"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";

import { parseInlineItems } from "@/lib/list-input";

interface TagInputProps {
  disabled?: boolean;
  onChange: (values: string[]) => void;
  placeholder?: string;
  values: string[];
}

export function TagInput({ values, onChange, disabled = false, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const commitDraft = (rawValue: string) => {
    const nextItems = parseInlineItems(rawValue);
    if (nextItems.length === 0) {
      setDraft("");
      return;
    }

    onChange(parseInlineItems([...values, ...nextItems].join("\n")));
    setDraft("");
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (!draft.trim()) {
        return;
      }

      event.preventDefault();
      commitDraft(draft);
      return;
    }

    if (event.key === "Backspace" && !draft && values.length > 0) {
      event.preventDefault();
      removeAt(values.length - 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text.includes(",") && !text.includes("\n")) {
      return;
    }

    event.preventDefault();
    commitDraft(text);
  };

  return (
    <div className={`tag-input ${disabled ? "disabled" : ""}`}>
      {values.map((value, index) => (
        <span className="tag-chip" key={`${value}-${index}`}>
          <span>{value}</span>
          <button
            type="button"
            className="tag-chip-remove"
            onClick={() => removeAt(index)}
            disabled={disabled}
            aria-label={`${value} 삭제`}
          >
            ×
          </button>
        </span>
      ))}

      <input
        type="text"
        className="tag-input-entry"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commitDraft(draft)}
        onPaste={handlePaste}
        placeholder={values.length === 0 ? placeholder : ""}
        disabled={disabled}
      />
    </div>
  );
}
