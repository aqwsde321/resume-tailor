"use client";

import { useRef } from "react";

export function useRequiredFieldFocus<TKey extends string>() {
  const requiredFieldRefs = useRef<Partial<Record<TKey, HTMLElement | null>>>({});

  const focusRequiredField = (key: TKey) => {
    const root = requiredFieldRefs.current[key];
    if (!root) {
      return;
    }

    root.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    const target =
      root.matches("input, textarea")
        ? root
        : root.querySelector<HTMLElement>("input:not([disabled]), textarea:not([disabled])");

    window.setTimeout(() => {
      target?.focus({ preventScroll: true });

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const caret = target.value.length;
        target.setSelectionRange(caret, caret);
      }
    }, 220);
  };

  const bindRequiredFieldRef = (key: TKey) => (node: HTMLElement | null) => {
    requiredFieldRefs.current[key] = node;
  };

  return {
    bindRequiredFieldRef,
    focusRequiredField
  };
}
