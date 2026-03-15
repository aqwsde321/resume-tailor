import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { HttpError } from "@/server/http";
import {
  DEFAULT_PDF_TEMPLATE_ID,
  type PdfTemplateId
} from "@/entities/pdf/model/templates";
import {
  DEFAULT_PDF_THEME_ID,
  type PdfThemeId
} from "@/entities/pdf/model/themes";
import { buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import type { Company, Intro, Resume } from "@/shared/lib/types";

const execFileAsync = promisify(execFile);
const TEMPLATE_ROOT = path.join(process.cwd(), "src", "templates", "typst");
const PDF_WORKDIR_PREFIX = "resume-tailor-pdf";
const SVG_WORKDIR_PREFIX = "resume-tailor-svg-preview";

export interface ResumeSvgPreview {
  pages: string[];
}

function resolveTemplatePath(templateId: PdfTemplateId) {
  return path.join(TEMPLATE_ROOT, templateId, "resume.typ");
}

function isExecMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function getExecErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return "알 수 없는 실행 오류";
  }

  const record = error as { stderr?: unknown; message?: unknown };
  const stderr = typeof record.stderr === "string" ? record.stderr.trim() : "";
  if (stderr) {
    return stderr;
  }

  const message = typeof record.message === "string" ? record.message.trim() : "";
  return message || "알 수 없는 실행 오류";
}

export async function buildResumePdf(
  resume: Resume,
  intro: Intro,
  company: Company,
  templateId: PdfTemplateId = DEFAULT_PDF_TEMPLATE_ID,
  themeId: PdfThemeId = DEFAULT_PDF_THEME_ID
): Promise<Buffer> {
  const workdir = path.join(os.tmpdir(), PDF_WORKDIR_PREFIX, randomUUID());
  const templateOutputPath = path.join(workdir, "resume.typ");
  const dataOutputPath = path.join(workdir, "resume.json");
  const pdfOutputPath = path.join(workdir, "resume.pdf");
  const payload = buildTypstResumeDocument(resume, intro, company, themeId);
  const sourceTemplatePath = resolveTemplatePath(templateId);

  try {
    await fs.mkdir(workdir, { recursive: true });
    await fs.copyFile(sourceTemplatePath, templateOutputPath);
    await fs.writeFile(dataOutputPath, JSON.stringify(payload, null, 2), "utf8");

    try {
      await execFileAsync("typst", ["compile", templateOutputPath, pdfOutputPath], {
        cwd: workdir,
        maxBuffer: 10 * 1024 * 1024
      });
    } catch (error) {
      if (isExecMissing(error)) {
        throw new HttpError(
          503,
          "Typst가 설치되어 있지 않아 PDF를 만들 수 없어요.",
          "로컬 환경에 typst를 설치하거나 Typst가 포함된 Docker 이미지를 사용해 주세요."
        );
      }

      throw new HttpError(500, "Typst로 PDF를 만들지 못했어요.", getExecErrorDetails(error));
    }

    return await fs.readFile(pdfOutputPath);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      500,
      "PDF 빌드 준비 중 오류가 발생했어요.",
      error instanceof Error ? error.message : "알 수 없는 파일 시스템 오류"
    );
  } finally {
    await fs.rm(workdir, {
      recursive: true,
      force: true
    });
  }
}

export async function buildResumeSvgPreview(
  resume: Resume,
  intro: Intro,
  company: Company,
  templateId: PdfTemplateId = DEFAULT_PDF_TEMPLATE_ID,
  themeId: PdfThemeId = DEFAULT_PDF_THEME_ID
): Promise<ResumeSvgPreview> {
  const workdir = path.join(os.tmpdir(), SVG_WORKDIR_PREFIX, randomUUID());
  const templateOutputPath = path.join(workdir, "resume.typ");
  const dataOutputPath = path.join(workdir, "resume.json");
  const svgOutputPattern = "preview-{0p}.svg";
  const payload = buildTypstResumeDocument(resume, intro, company, themeId);
  const sourceTemplatePath = resolveTemplatePath(templateId);

  try {
    await fs.mkdir(workdir, { recursive: true });
    await fs.copyFile(sourceTemplatePath, templateOutputPath);
    await fs.writeFile(dataOutputPath, JSON.stringify(payload, null, 2), "utf8");

    try {
      await execFileAsync(
        "typst",
        ["compile", "--format", "svg", templateOutputPath, svgOutputPattern],
        {
          cwd: workdir,
          maxBuffer: 10 * 1024 * 1024
        }
      );
    } catch (error) {
      if (isExecMissing(error)) {
        throw new HttpError(
          503,
          "Typst가 설치되어 있지 않아 미리보기를 만들 수 없어요.",
          "로컬 환경에 typst를 설치하거나 Typst가 포함된 Docker 이미지를 사용해 주세요."
        );
      }

      throw new HttpError(500, "Typst SVG 미리보기를 만들지 못했어요.", getExecErrorDetails(error));
    }

    const entries = await fs.readdir(workdir);
    const pages = await Promise.all(
      entries
        .filter((entry) => /^preview-\d+\.svg$/.test(entry))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
        .map((entry) => fs.readFile(path.join(workdir, entry), "utf8"))
    );

    if (pages.length === 0) {
      throw new HttpError(500, "Typst SVG 미리보기를 만들지 못했어요.", "생성된 SVG 페이지가 없습니다.");
    }

    return { pages };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      500,
      "SVG 미리보기 준비 중 오류가 발생했어요.",
      error instanceof Error ? error.message : "알 수 없는 파일 시스템 오류"
    );
  } finally {
    await fs.rm(workdir, {
      recursive: true,
      force: true
    });
  }
}

export function buildPdfContentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, "").replace(/\s+/g, "-") || "resume-tailor.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
