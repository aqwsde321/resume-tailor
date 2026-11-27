import { addDiscoveredExperienceToResume } from "@/entities/intro/model/experience-discovery";
import { CompanySchema, ProjectEnrichmentRevisionSchema, ResumeProjectItemSchema, ResumeSchema } from "@/shared/lib/schemas";
import type { Company, DiscoveredExperienceDraft, Intro, Resume } from "@/shared/lib/types";
import type { z } from "zod";
import type { CompanyWork, EnrichmentSchema } from "./workspace";

type ProjectEnrichmentReview = NonNullable<z.infer<typeof EnrichmentSchema>["projectReview"]>;
export type ProjectEnrichmentRevision = z.infer<typeof ProjectEnrichmentRevisionSchema>;

export function getEnrichmentSummary(resume: Resume, intro: Intro | null): string {
  return intro?.longIntro.trim() || intro?.shortIntro.trim() || intro?.oneLineIntro.trim() || resume.summary.trim();
}

export function isProjectEnrichmentCurrent(resume: Resume, company: Company | null | undefined, summary: string, review: ProjectEnrichmentReview): boolean {
  const project = resume.projects[review.index];
  return Boolean(project && company) && summary === review.summary &&
    JSON.stringify(CompanySchema.parse(company)) === JSON.stringify(CompanySchema.parse(review.company)) &&
    JSON.stringify(ResumeProjectItemSchema.parse(project)) === JSON.stringify(ResumeProjectItemSchema.parse(review.project));
}

export function applyProjectEnrichmentReview(work: CompanyWork, sessionId: string, draft: ProjectEnrichmentRevision) {
  const resume = work.resume;
  const review = work.enrichment.find(({ id, status }) => id === sessionId && status === "draft")?.projectReview;
  const revision = ProjectEnrichmentRevisionSchema.safeParse(draft);
  if (!resume || !review?.revision || !revision.success ||
    !isProjectEnrichmentCurrent(resume, work.company, getEnrichmentSummary(resume, work.intro), review)) return undefined;

  return ResumeSchema.parse({
    ...resume,
    summary: revision.data.summary,
    projects: resume.projects.map((project, index) => index === review.index ? { ...project, description: revision.data.description } : project),
  });
}

export function applyEnrichmentDrafts(resume: Resume, drafts: { target?: string; draft: DiscoveredExperienceDraft }[]): Resume {
  let result = structuredClone(resume);
  const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  for (const { target, draft } of drafts) {
    if (!draft.description.trim() || (!draft.title.trim() && !draft.organization.trim())) throw new Error("반영할 경험의 제목·소속과 내용을 확인해 주세요.");
    if (!target || target === "new") { result = addDiscoveredExperienceToResume(result, draft); continue; }
    const [type, position] = target.split(":"); const index = Number(position);
    if (!Number.isInteger(index) || index < 0 || !["project", "experience"].includes(type)) throw new Error("보완할 이력서 항목을 찾지 못했습니다.");
    const item = type === "project" ? result.projects[index] : result.experience[index];
    if (!item) throw new Error("보완할 이력서 항목을 찾지 못했습니다.");
    item.description = item.description.includes(draft.description.trim()) ? item.description : [item.description, draft.description.trim()].filter(Boolean).join("\n\n");
    if (type === "project") result.projects[index].techStack = unique([...result.projects[index].techStack, ...draft.techStack]);
    result.techStack = unique([...result.techStack, ...draft.techStack]);
  }
  return ResumeSchema.parse(result);
}


export function acceptEnrichmentDrafts(
  sessions: CompanyWork["enrichment"],
  drafts: { id: string; draft: DiscoveredExperienceDraft }[],
): CompanyWork["enrichment"] {
  const approved = new Map(drafts.map(({ id, draft }) => [id, draft]));
  return sessions.map((session) => ({
    ...session,
    drafts: session.drafts.map((item) => {
      const draft = approved.get(item.id);
      return draft ? { ...item, draft, status: "accepted" } : item;
    }),
  }));
}
