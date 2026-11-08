import { z } from "zod";

import { PDF_TEMPLATE_IDS, type PdfTemplateId } from "@/entities/pdf/model/templates";
import { PDF_THEME_IDS, type PdfThemeId } from "@/entities/pdf/model/themes";
import { buildPdfDownloadName } from "@/entities/pdf/model/view-model";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";
import type { Company, Intro, Resume } from "@/shared/lib/types";

const APPLICATION_STATUSES = ["preparing", "applied", "interviewing", "closed"] as const;

export const APPLICATION_STATUS_OPTIONS: Array<{ id: ApplicationStatus; label: string }> = [
  { id: "preparing", label: "준비 중" },
  { id: "applied", label: "지원 완료" },
  { id: "interviewing", label: "면접 중" },
  { id: "closed", label: "종료" }
];

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);

const ApplicationSnapshotSchema = z
  .object({
    resume: ResumeSchema,
    company: CompanySchema,
    intro: IntroSchema,
    resumeSnapshot: z.string().trim().min(1),
    companySnapshot: z.string().trim().min(1),
    templateId: z.enum(PDF_TEMPLATE_IDS),
    themeId: z.enum(PDF_THEME_IDS),
    customAccentHex: z.string()
  })
  .strict();

export const ApplicationRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    companyName: z.string(),
    jobTitle: z.string(),
    status: ApplicationStatusSchema,
    notes: z.string().max(5000),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    pdfFileName: z.string().trim().min(1),
    snapshot: ApplicationSnapshotSchema
  })
  .strict();

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ApplicationStatusFilter = ApplicationStatus | "all";
export type ApplicationSnapshot = z.infer<typeof ApplicationSnapshotSchema>;
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>;

export interface CreateApplicationRecordInput {
  resume: Resume;
  company: Company;
  intro: Intro;
  resumeSnapshot: string;
  companySnapshot: string;
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
  customAccentHex: string;
}

export function createApplicationRecord(
  input: CreateApplicationRecordInput,
  options: { id?: string; now?: string } = {}
): ApplicationRecord {
  const now = options.now ?? new Date().toISOString();
  const resumeSnapshot = {
    ...input.resume,
    pdfProfileImageDataUrl: "",
    pdfProfileImageVisible: false
  };
  const snapshot = structuredClone({
    resume: resumeSnapshot,
    company: input.company,
    intro: input.intro,
    resumeSnapshot: input.resumeSnapshot,
    companySnapshot: input.companySnapshot,
    templateId: input.templateId,
    themeId: input.themeId,
    customAccentHex: input.customAccentHex
  });

  return ApplicationRecordSchema.parse({
    id: options.id ?? crypto.randomUUID(),
    companyName: input.company.companyName.trim() || "회사",
    jobTitle: input.company.jobTitle.trim() || "포지션",
    status: "preparing",
    notes: "",
    createdAt: now,
    updatedAt: now,
    pdfFileName: buildPdfDownloadName(input.company, input.resume),
    snapshot
  });
}

export function normalizeApplicationRecords(value: unknown): ApplicationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set<string>();
  return value.flatMap((item) => {
    const parsed = ApplicationRecordSchema.safeParse(item);
    if (!parsed.success || ids.has(parsed.data.id)) {
      return [];
    }

    ids.add(parsed.data.id);
    return [parsed.data];
  });
}

export function updateApplicationRecord(
  records: ApplicationRecord[],
  id: string,
  changes: Partial<Pick<ApplicationRecord, "status" | "notes">>,
  updatedAt = new Date().toISOString()
): ApplicationRecord[] {
  return records.map((record) =>
    record.id === id
      ? ApplicationRecordSchema.parse({
          ...record,
          ...changes,
          updatedAt
        })
      : record
  );
}

export function filterApplicationRecords(
  records: ApplicationRecord[],
  query: string,
  status: ApplicationStatusFilter = "all"
): ApplicationRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");

  return records.filter((record) => {
    if (status !== "all" && record.status !== status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      record.companyName,
      record.jobTitle,
      record.notes,
      record.snapshot.resume.name,
      record.snapshot.resume.desiredPosition
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  });
}

export function deleteApplicationRecord(records: ApplicationRecord[], id: string): ApplicationRecord[] {
  return records.filter((record) => record.id !== id);
}
