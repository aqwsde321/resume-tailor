"use client";

import { useEffect, useMemo, useState } from "react";

import { AutoGrowTextarea } from "@/shared/ui/auto-grow-textarea";
import { parseListText, stringifyLineList } from "@/shared/lib/list-input";

interface ListTextareaProps {
  disabled: boolean;
  onChange: (nextValues: string[]) => void;
  placeholder?: string;
  value: string[];
}

export function ListTextarea({ disabled, onChange, placeholder, value }: ListTextareaProps) {
  const canonicalValue = useMemo(() => stringifyLineList(value), [value]);
  const [draft, setDraft] = useState(canonicalValue);

  useEffect(() => {
    setDraft(canonicalValue);
  }, [canonicalValue]);

  return (
    <AutoGrowTextarea
      className="list-textarea"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        onChange(parseListText(nextValue));
      }}
      disabled={disabled}
    />
  );
}
