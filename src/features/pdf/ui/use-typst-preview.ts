"use client";

import { useEffect, useMemo, useState } from "react";

import type { Company, Intro, Resume } from "@/shared/lib/types";

import type { TypstPreviewState } from "./types";

interface UseTypstPreviewArgs {
  company: Company;
  intro: Intro;
  resume: Resume;
}

export function useTypstPreview({ company, intro, resume }: UseTypstPreviewArgs) {
  const [typstPreview, setTypstPreview] = useState<TypstPreviewState>({
    error: "",
    pages: [],
    status: "idle"
  });
  const previewRequestBody = useMemo(
    () =>
      JSON.stringify({
        resume,
        intro,
        company
      }),
    [company, intro, resume]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTypstPreview((current) => ({
        ...current,
        error: "",
        status: "rendering"
      }));

      try {
        const response = await fetch("/api/pdf/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: previewRequestBody,
          signal: controller.signal
        });

        const payload = (await response.json()) as
          | { ok: true; data: { pages: string[] } }
          | { ok: false; error: { message: string; details?: string } };

        if (!response.ok || !payload.ok) {
          const message = payload.ok
            ? "Typst 미리보기를 불러오지 못했어요."
            : payload.error.details || payload.error.message;
          throw new Error(message);
        }

        setTypstPreview({
          error: "",
          pages: payload.data.pages,
          status: "ready"
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setTypstPreview((current) => ({
          error: error instanceof Error ? error.message : "Typst 미리보기를 불러오지 못했어요.",
          pages: current.pages,
          status: "error"
        }));
      }
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [previewRequestBody]);

  return typstPreview;
}
