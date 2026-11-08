import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { buildPdfAtsAudit, type PdfAtsAudit } from "@/entities/pdf/model/ats-audit";
import type { Company, Resume } from "@/shared/lib/types";

const execFileAsync = promisify(execFile);
const AUDIT_WORKDIR_PREFIX = "resume-tailor-pdf-audit-";

function isExecMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function createUnavailableAudit(status: "unavailable" | "failed", message: string): PdfAtsAudit {
  return {
    status,
    message,
    textCharacterCount: 0,
    nameFound: null,
    contacts: [],
    requiredTerms: { total: 0, matchedCount: 0, matched: [], missing: [] },
    preferredTerms: { total: 0, matchedCount: 0, matched: [], missing: [] },
    textPreview: ""
  };
}

export async function auditResumePdf(pdf: Buffer, resume: Resume, company: Company): Promise<PdfAtsAudit> {
  let workdir = "";

  try {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), AUDIT_WORKDIR_PREFIX));
    const pdfPath = path.join(workdir, "resume.pdf");
    await fs.writeFile(pdfPath, pdf);

    const { stdout } = await execFileAsync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024
    });

    return buildPdfAtsAudit(stdout, resume, company);
  } catch (error) {
    if (isExecMissing(error)) {
      return createUnavailableAudit(
        "unavailable",
        "Poppler의 pdftotext가 없어 PDF 텍스트 검사를 건너뛰었어요. Poppler를 설치한 뒤 다시 내보내면 검사할 수 있어요."
      );
    }

    return createUnavailableAudit("failed", "PDF 텍스트를 추출하지 못해 검사를 완료하지 못했어요.");
  } finally {
    if (workdir) {
      await fs.rm(workdir, { recursive: true, force: true });
    }
  }
}
