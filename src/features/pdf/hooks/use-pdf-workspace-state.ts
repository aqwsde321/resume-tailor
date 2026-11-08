"use client";

import { useEffect, useMemo, useState } from "react";

import type { PdfTemplateId } from "@/entities/pdf/model/templates";
import type { PdfThemeId } from "@/entities/pdf/model/themes";
import { parsePdfAtsAuditHeader, type PdfAtsAudit } from "@/entities/pdf/model/ats-audit";
import { buildPdfDownloadName, buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import { createApplicationRecord } from "@/entities/application/model/application-record";
import { saveApplicationPdf } from "@/entities/application/model/application-pdf-store";
import { getResumeIntroSnapshot, isIntroFresh, type PipelineState } from "@/entities/pipeline/model/pipeline-context";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";
import type { ApiFailure, ApiSuccess, Company, Intro, Resume } from "@/shared/lib/types";

function buildEditablePdfResume(resume: Resume, intro: Intro, company: Company): Resume {
  const preview = buildTypstResumeDocument(resume, intro, company);

  return {
    ...resume,
    headline: preview.headline,
    careerDurationText: preview.careerDuration,
    pdfHighlights: preview.achievements,
    pdfStrengths: preview.strengths,
    projects: resume.projects.map((project) => ({
      ...project,
      linkLabel: project.linkLabel.trim() || project.link.trim()
    }))
  };
}

function buildEditablePdfIntro(intro: Intro): Intro {
  return {
    ...intro,
    longIntro: intro.longIntro.trim() || intro.shortIntro.trim() || intro.oneLineIntro.trim()
  };
}

interface UsePdfWorkspaceStateArgs {
  clearStatus: () => void;
  patch: (updater: (prev: PipelineState) => PipelineState) => void;
  setMessage: (message: string) => void;
  state: PipelineState;
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
  customAccentHex: string;
}

export function usePdfWorkspaceState({
  clearStatus,
  patch,
  setMessage,
  state,
  templateId,
  themeId,
  customAccentHex
}: UsePdfWorkspaceStateArgs) {
  const introFresh = isIntroFresh(state);
  const confirmedResume = useMemo(() => {
    if (!state.resumeConfirmedJson) {
      return null;
    }

    try {
      const parsed = ResumeSchema.safeParse(JSON.parse(state.resumeConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.resumeConfirmedJson]);

  const confirmedCompany = useMemo(() => {
    if (!state.companyConfirmedJson) {
      return null;
    }

    try {
      const parsed = CompanySchema.safeParse(JSON.parse(state.companyConfirmedJson));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [state.companyConfirmedJson]);

  const resumeSnapshot = useMemo(() => getResumeIntroSnapshot(state), [state]);
  const canExportPdf = Boolean(
    state.intro &&
      state.introSource &&
      introFresh &&
      confirmedResume &&
      confirmedCompany &&
      resumeSnapshot &&
      state.companyConfirmedJson
  );
  const [pdfResume, setPdfResume] = useState<Resume | null>(null);
  const [pdfIntro, setPdfIntro] = useState<Intro | null>(null);
  const [pdfCompany, setPdfCompany] = useState<Company | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isApplicationSaving, setIsApplicationSaving] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfAtsAudit, setPdfAtsAudit] = useState<PdfAtsAudit | null>(null);
  const [pdfAtsAuditSource, setPdfAtsAuditSource] = useState<string | null>(null);
  const currentPdfAuditSource = useMemo(
    () =>
      JSON.stringify({
        resume: pdfResume,
        intro: pdfIntro,
        company: pdfCompany,
        templateId,
        themeId,
        customAccentHex
      }) ?? "",
    [customAccentHex, pdfCompany, pdfIntro, pdfResume, templateId, themeId]
  );

  const buildPdfRequestBody = () => {
    if (
      !pdfResume ||
      !pdfIntro ||
      !pdfCompany ||
      !state.introSource ||
      !resumeSnapshot ||
      !state.companyConfirmedJson
    ) {
      setPdfError("최신 소개글이 있어야 PDF를 만들 수 있어요.");
      return null;
    }

    return {
      resume: pdfResume,
      company: pdfCompany,
      intro: pdfIntro,
      templateId,
      themeId,
      customAccentHex: customAccentHex || undefined,
      introSource: state.introSource,
      resumeSnapshot,
      companySnapshot: state.companyConfirmedJson
    };
  };

  const requestPdf = async (body: NonNullable<ReturnType<typeof buildPdfRequestBody>>) => {
    const response = await fetch("/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiSuccess<never> | ApiFailure;
      throw new Error(
        payload.ok ? "PDF를 만들지 못했어요." : payload.error.details || payload.error.message
      );
    }

    return {
      audit: parsePdfAtsAuditHeader(response.headers.get("x-resume-pdf-ats-audit")),
      blob: await response.blob()
    };
  };

  const setAuditResult = (audit: PdfAtsAudit | null) => {
    setPdfAtsAudit(audit);
    setPdfAtsAuditSource(audit ? currentPdfAuditSource : null);
  };

  useEffect(() => {
    if (confirmedResume && state.intro && confirmedCompany) {
      setPdfResume(buildEditablePdfResume(confirmedResume, state.intro, confirmedCompany));
    }
  }, [confirmedResume, confirmedCompany, state.intro]);

  useEffect(() => {
    if (state.intro) {
      setPdfIntro(buildEditablePdfIntro(state.intro));
    }
  }, [state.intro]);

  useEffect(() => {
    if (confirmedCompany) {
      setPdfCompany(confirmedCompany);
    }
  }, [confirmedCompany]);

  const exportPdf = async () => {
    clearStatus();
    const body = buildPdfRequestBody();
    if (!body) {
      return;
    }

    setPdfError("");
    setPdfAtsAudit(null);
    setPdfAtsAuditSource(null);
    setIsPdfExporting(true);

    try {
      const { audit, blob } = await requestPdf(body);
      setAuditResult(audit);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildPdfDownloadName(body.company, body.resume);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setMessage("PDF를 내려받았어요.");
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF를 만들지 못했어요.");
    } finally {
      setIsPdfExporting(false);
    }
  };

  const saveApplication = async () => {
    clearStatus();
    const body = buildPdfRequestBody();
    if (!body || !pdfResume || !pdfIntro || !pdfCompany || !resumeSnapshot || !state.companyConfirmedJson) {
      return;
    }

    setPdfError("");
    setPdfAtsAudit(null);
    setPdfAtsAuditSource(null);
    setIsPdfExporting(true);
    setIsApplicationSaving(true);

    try {
      const { audit, blob } = await requestPdf(body);
      const record = createApplicationRecord({
        resume: pdfResume,
        company: pdfCompany,
        intro: pdfIntro,
        resumeSnapshot,
        companySnapshot: state.companyConfirmedJson,
        templateId,
        themeId,
        customAccentHex
      });

      await saveApplicationPdf(record.id, blob);
      patch((previous) => ({
        ...previous,
        applications: [record, ...previous.applications]
      }));
      setAuditResult(audit);
      setMessage("지원 기록과 PDF를 저장했어요.");
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "지원 기록을 저장하지 못했어요.");
    } finally {
      setIsPdfExporting(false);
      setIsApplicationSaving(false);
    }
  };

  return {
    canExportPdf,
    confirmedCompany,
    confirmedResume,
    pdfCompany,
    pdfAtsAudit: pdfAtsAuditSource === currentPdfAuditSource ? pdfAtsAudit : null,
    pdfError,
    pdfIntro,
    pdfResume,
    setPdfCompany,
    setPdfIntro,
    setPdfResume,
    exportPdf,
    saveApplication,
    isApplicationSaving,
    isPdfExporting
  };
}
