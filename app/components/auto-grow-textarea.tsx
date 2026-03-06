"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type TextareaHTMLAttributes
} from "react";

interface AutoGrowTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
}

export function AutoGrowTextarea({ minHeight = 44, ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    el.style.height = "auto";
    const nextHeight = Math.max(minHeight, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, [minHeight]);

  useEffect(() => {
    resize();
  }, [resize, props.value]);

  return (
    <textarea
      {...props}
      ref={ref}
      onInput={(event) => {
        resize();
        props.onInput?.(event);
      }}
      className={["form-input", props.className].filter(Boolean).join(" ")}
    />
  );
}
