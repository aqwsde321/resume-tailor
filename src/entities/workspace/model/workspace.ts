import { upgradeResultDraftMarkdown } from "./resume-markdown";
import { z } from "zod";
import { CompanySchema, DiscoveredExperienceDraftSchema, ExperienceDiscoveryMessageSchema, IntroSchema, ModelReasoningEffortSchema, ResumeSchema } from "@/shared/lib/schemas";
import { DocumentChangeSchema } from "./document-review";
import { ResumeTailoringPlanSchema } from "@/entities/resume/model/resume-tailoring";

const Id = z.string().uuid();
const Timestamp = z.string().datetime();
export const AnnotationSchema = z.object({
  id: Id,
  instruction: z.string().max(4000),
  anchor: z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), quote: z.string() }).strict(),
    z.object({ type: z.literal("document") }).strict(),
    z.object({ type: z.literal("region"), page: z.number().int().positive(), x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict(),
  ]),
  status: z.enum(["pending", "accepted", "dismissed"]),
  createdAt: Timestamp,
}).strict();

export const ReviewDocumentSchema = z.object({
  id: Id,
  kind: z.enum(["resume", "job"]),
  title: z.string().max(300),
  warnings: z.array(z.string()).optional(),
  source: z.object({
    type: z.enum(["text", "markdown", "url", "pdf", "image"]),
    url: z.string().url().optional(),
    attachmentId: Id.optional(),
    originalText: z.string().max(500000),
    pages: z.array(z.object({ page: z.number().int().positive(), text: z.string(), method: z.enum(["text", "ocr"]), imageId: Id.optional() }).strict()).default([]),
  }).strict(),
  text: z.string().max(500000),
  annotations: z.array(AnnotationSchema).max(500),
  proposal: z.object({ sourceText: z.string(), changes: z.array(DocumentChangeSchema), unresolved: z.array(z.object({ commentId: z.string(), message: z.string() }).strict()).default([]) }).strict().nullable(),
  history: z.array(z.object({ text: z.string(), annotationIds: z.array(Id), createdAt: Timestamp }).strict()),
  updatedAt: Timestamp,
}).strict();

export const EnrichmentSchema = z.object({
  id: Id,
  topic: z.string().max(2000),
  status: z.enum(["question", "draft", "done"]).default("question"),
  messages: z.array(ExperienceDiscoveryMessageSchema),
  drafts: z.array(z.object({ id: Id, draft: DiscoveredExperienceDraftSchema, target: z.string().optional(), status: z.enum(["pending", "accepted", "dismissed"]) }).strict()),
}).strict();

export const ResumeResultDraftSchema = z.object({
  stage: z.enum(["review", "confirm"]).optional(),
  resume: ResumeSchema,
  document: ReviewDocumentSchema,
  sourceText: z.string().max(500000),
  structuredText: z.string().max(500000),
  skillCatalog: z.array(z.string().trim().min(1).max(120)).max(300),
}).strict();
export type ResumeResultDraft = z.infer<typeof ResumeResultDraftSchema>;

export const MasterResumeSchema = z.object({
  id: Id,
  version: z.number().int().positive(),
  document: ReviewDocumentSchema,
  resume: ResumeSchema.nullable(),
  resultDraft: ResumeResultDraftSchema.nullable().optional(),
  reviewMarkdown: z.string().max(500000).optional(),
  sourceNeedsReview: z.boolean().optional(),
  viewStep: z.enum(["source", "edit", "save", "saved"]).optional(),
  skillCatalog: z.array(z.string().max(120)).optional(),
  enrichment: z.array(EnrichmentSchema),
  updatedAt: Timestamp,
}).strict();

export const CompanyWorkSchema = z.object({
  id: Id,
  title: z.string().max(300),
  document: ReviewDocumentSchema,
  company: CompanySchema.nullable(),
  companySourceText: z.string().optional(),
  resumeDocument: ReviewDocumentSchema.nullable().optional(),
  tailoring: z.object({ sourceResume: ResumeSchema, editingSnapshot: ResumeSchema.optional(), plan: ResumeTailoringPlanSchema, resume: ResumeSchema }).strict().nullable().optional(),
  artifacts: z.array(z.object({ id: Id, name: z.string(), createdAt: Timestamp }).strict()).optional(),
  sourceResumeVersion: z.number().int().positive().nullable(),
  sourceResume: ResumeSchema.nullable(),
  resume: ResumeSchema.nullable(),
  intro: IntroSchema.nullable(),
  enrichment: z.array(EnrichmentSchema),
  versions: z.array(z.object({ id: Id, resume: ResumeSchema, intro: IntroSchema.nullable(), createdAt: Timestamp }).strict()),
  createdAt: Timestamp,
  updatedAt: Timestamp,
}).strict();

export const WorkspaceSchema = z.object({
  formatVersion: z.literal(1),
  revision: z.number().int().nonnegative(),
  master: MasterResumeSchema.nullable(),
  works: z.array(CompanyWorkSchema),
  settings: z.object({ provider: z.enum(["codex", "claude"]).optional(), model: z.string().trim().max(120), modelReasoningEffort: ModelReasoningEffortSchema.or(z.literal("")) }).strict(),
  // 일회성 가져오기 UI를 제거한 후에도 기존 저장본·백업과의 호환성을 유지한다.
  legacyBackup: z.record(z.string(), z.unknown()).nullable(),
}).strict().transform((workspace) => workspace.master?.resultDraft ? { ...workspace, master: { ...workspace.master, resultDraft: upgradeResultDraftMarkdown(workspace.master.resultDraft) } } : workspace);
export type Workspace = z.infer<typeof WorkspaceSchema>;
export type ReviewDocument = z.infer<typeof ReviewDocumentSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type CompanyWork = z.infer<typeof CompanyWorkSchema>;
export function createEmptyWorkspace(): Workspace {
  return { formatVersion: 1, revision: 0, master: null, works: [], settings: { model: "", modelReasoningEffort: "" }, legacyBackup: null };
}
