import { z } from "zod";

import { ApplicationFollowUpDraftSchema } from "@/entities/application/model/follow-up-draft";
import { ApplicationInterviewPrepSchema } from "@/entities/application/model/interview-prep";
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

const ApplicationStatusHistoryEntrySchema = z
  .object({
    status: ApplicationStatusSchema,
    changedAt: z.string().datetime()
  })
  .strict();

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

const ApplicationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === (month ?? 0) - 1 && parsed.getUTCDate() === day;
  }, "유효한 날짜가 아니에요.")
  .nullable()
  .default(null);

export const ApplicationRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    companyName: z.string(),
    jobTitle: z.string(),
    status: ApplicationStatusSchema,
    notes: z.string().max(5000),
    nextAction: z.string().max(5000).default(""),
    nextActionDate: ApplicationDateSchema,
    appliedAt: ApplicationDateSchema,
    statusHistory: z.array(ApplicationStatusHistoryEntrySchema).default([]),
    interviewPrep: ApplicationInterviewPrepSchema.nullable().default(null),
    followUpDrafts: z.array(ApplicationFollowUpDraftSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    pdfFileName: z.string().trim().min(1),
    snapshot: ApplicationSnapshotSchema
  })
  .strict();

export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
export type ApplicationStatusHistoryEntry = z.infer<typeof ApplicationStatusHistoryEntrySchema>;
export type { ApplicationInterviewPrep } from "@/entities/application/model/interview-prep";
export type { ApplicationFollowUpDraft } from "@/entities/application/model/follow-up-draft";
export type ApplicationStatusFilter = ApplicationStatus | "all";
export type ApplicationRecordSort = "recent" | "due-date";
export type ApplicationDeadlineStatus = "none" | "overdue" | "today" | "upcoming";
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
    nextAction: "",
    nextActionDate: null,
    appliedAt: null,
    statusHistory: [{ status: "preparing", changedAt: now }],
    interviewPrep: null,
    followUpDrafts: [],
    createdAt: now,
    updatedAt: now,
    pdfFileName: buildPdfDownloadName(input.company, input.resume),
    snapshot
  });
}

export function normalizeApplicationRecord(value: unknown): ApplicationRecord | null {
  const parsed = ApplicationRecordSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    statusHistory:
      parsed.data.statusHistory.length > 0
        ? parsed.data.statusHistory
        : [{ status: parsed.data.status, changedAt: parsed.data.updatedAt }]
  };
}

export function normalizeApplicationRecords(value: unknown): ApplicationRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = new Set<string>();
  return value.flatMap((item) => {
    const record = normalizeApplicationRecord(item);
    if (!record || ids.has(record.id)) {
      return [];
    }

    ids.add(record.id);
    return [record];
  });
}

export function updateApplicationRecord(
  records: ApplicationRecord[],
  id: string,
  changes: Partial<
    Pick<
      ApplicationRecord,
      | "status"
      | "notes"
      | "nextAction"
      | "nextActionDate"
      | "appliedAt"
      | "interviewPrep"
      | "followUpDrafts"
    >
  >,
  updatedAt = new Date().toISOString()
): ApplicationRecord[] {
  return records.map((record) =>
    record.id === id
      ? (() => {
          const nextStatus = changes.status ?? record.status;
          const statusChanged = nextStatus !== record.status;
          const hasAppliedAtChange = Object.prototype.hasOwnProperty.call(changes, "appliedAt");
          const appliedAt = hasAppliedAtChange
            ? changes.appliedAt
            : !record.appliedAt && statusChanged && nextStatus !== "preparing"
              ? getLocalDateKey(new Date(updatedAt))
              : record.appliedAt;
          const statusHistory = statusChanged
            ? [
                ...record.statusHistory,
                {
                  status: nextStatus,
                  changedAt: updatedAt
                }
              ]
            : record.statusHistory;

          return ApplicationRecordSchema.parse({
            ...record,
            ...changes,
            appliedAt,
            statusHistory,
            updatedAt
          });
        })()
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
      record.nextAction,
      record.snapshot.resume.name,
      record.snapshot.resume.desiredPosition
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  });
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getApplicationDeadlineStatus(
  nextActionDate: string | null,
  today = getLocalDateKey(new Date())
): ApplicationDeadlineStatus {
  if (!nextActionDate) {
    return "none";
  }

  if (nextActionDate < today) {
    return "overdue";
  }
  if (nextActionDate === today) {
    return "today";
  }
  return "upcoming";
}

export function sortApplicationRecords(
  records: ApplicationRecord[],
  sort: ApplicationRecordSort = "recent"
): ApplicationRecord[] {
  return [...records].sort((left, right) => {
    if (sort === "due-date") {
      if (left.nextActionDate && right.nextActionDate) {
        return (
          left.nextActionDate.localeCompare(right.nextActionDate) ||
          right.createdAt.localeCompare(left.createdAt)
        );
      }
      if (left.nextActionDate) {
        return -1;
      }
      if (right.nextActionDate) {
        return 1;
      }
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

export interface ApplicationCompanySummary {
  companyName: string;
  totalApplications: number;
  submittedApplications: number;
  interviewedApplications: number;
  closedApplications: number;
}

export interface ApplicationDashboardSummary {
  totalApplications: number;
  submittedApplications: number;
  interviewedApplications: number;
  interviewConversionRate: number;
  statusCounts: Record<ApplicationStatus, number>;
  companies: ApplicationCompanySummary[];
}

function hasBeenSubmitted(record: ApplicationRecord) {
  return (
    record.appliedAt !== null ||
    record.status !== "preparing" ||
    record.statusHistory.some((entry) => entry.status !== "preparing")
  );
}

function hasBeenInterviewed(record: ApplicationRecord) {
  return (
    record.status === "interviewing" ||
    record.statusHistory.some((entry) => entry.status === "interviewing")
  );
}

export function buildApplicationDashboard(
  records: ApplicationRecord[]
): ApplicationDashboardSummary {
  const statusCounts: Record<ApplicationStatus, number> = {
    preparing: 0,
    applied: 0,
    interviewing: 0,
    closed: 0
  };
  const companies = new Map<string, ApplicationCompanySummary>();
  let submittedApplications = 0;
  let interviewedApplications = 0;

  for (const record of records) {
    statusCounts[record.status] += 1;

    const submitted = hasBeenSubmitted(record);
    const interviewed = hasBeenInterviewed(record);
    if (submitted) {
      submittedApplications += 1;
    }
    if (interviewed) {
      interviewedApplications += 1;
    }

    const companyName = record.companyName.trim() || "회사";
    const summary = companies.get(companyName) ?? {
      companyName,
      totalApplications: 0,
      submittedApplications: 0,
      interviewedApplications: 0,
      closedApplications: 0
    };
    summary.totalApplications += 1;
    summary.submittedApplications += Number(submitted);
    summary.interviewedApplications += Number(interviewed);
    summary.closedApplications += Number(record.status === "closed");
    companies.set(companyName, summary);
  }

  return {
    totalApplications: records.length,
    submittedApplications,
    interviewedApplications,
    interviewConversionRate:
      submittedApplications > 0
        ? Math.round((interviewedApplications / submittedApplications) * 100)
        : 0,
    statusCounts,
    companies: [...companies.values()].sort(
      (left, right) =>
        right.totalApplications - left.totalApplications ||
        left.companyName.localeCompare(right.companyName, "ko-KR")
    )
  };
}

export function deleteApplicationRecord(records: ApplicationRecord[], id: string): ApplicationRecord[] {
  return records.filter((record) => record.id !== id);
}
