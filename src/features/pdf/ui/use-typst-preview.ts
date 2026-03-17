"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import {
  PDF_PREVIEW_RENDER_VERSION,
  type PdfTemplateId
} from "@/entities/pdf/model/templates";
import type { PdfThemeId } from "@/entities/pdf/model/themes";
import type { Company, Intro, Resume } from "@/shared/lib/types";

import type { TypstPreviewState } from "./types";

interface UseTypstPreviewArgs {
  company: Company;
  customAccentHex: string;
  intro: Intro;
  resume: Resume;
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
}

const PREVIEW_DEBOUNCE_MS = 320;
const PREVIEW_CACHE_TTL_MS = 60_000;

type CachedPreview = {
  fetchedAt: number;
  pages: string[];
};

const previewResponseCache = new Map<string, CachedPreview>();

function readCachedPreview(cacheKey: string) {
  const cached = previewResponseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAt > PREVIEW_CACHE_TTL_MS) {
    previewResponseCache.delete(cacheKey);
    return null;
  }

  return cached.pages;
}

function writeCachedPreview(cacheKey: string, pages: string[]) {
  previewResponseCache.set(cacheKey, {
    fetchedAt: Date.now(),
    pages
  });
}

export function useTypstPreview({
  company,
  customAccentHex,
  intro,
  resume,
  templateId,
  themeId
}: UseTypstPreviewArgs) {
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
        company,
        templateId,
        themeId,
        customAccentHex: customAccentHex || undefined,
        renderVersion: PDF_PREVIEW_RENDER_VERSION
      }),
    [company, customAccentHex, intro, resume, templateId, themeId]
  );
  const deferredPreviewRequestBody = useDeferredValue(previewRequestBody);

  useEffect(() => {
    const cachedPages = readCachedPreview(deferredPreviewRequestBody);
    if (cachedPages) {
      setTypstPreview({
        error: "",
        pages: cachedPages,
        status: "ready"
      });
      return;
    }

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
          body: deferredPreviewRequestBody,
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

        writeCachedPreview(deferredPreviewRequestBody, payload.data.pages);
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
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredPreviewRequestBody]);

  return typstPreview;
}
