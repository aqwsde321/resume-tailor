import { z } from "zod";

import { ResumeSchema } from "@/shared/lib/schemas";
import type { Company, Resume } from "@/shared/lib/types";

const EvidenceIdsSchema = z.array(z.string().trim().min(1).max(100)).min(1).max(4);
const TechnologiesSchema = z.array(z.string().trim().min(1).max(80)).max(30);
export const MAX_TAILORING_COPY_LENGTH = 1600;
const TailoringCopySchema = z.string().trim().min(1).max(MAX_TAILORING_COPY_LENGTH);

const TailoredTextSchema = z
  .object({
    text: TailoringCopySchema,
    evidenceIds: EvidenceIdsSchema,
    technologies: TechnologiesSchema.optional()
  })
  .strict();

const TailoredResumeItemSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(100),
    description: TailoringCopySchema,
    evidenceIds: EvidenceIdsSchema,
    technologies: TechnologiesSchema.optional()
  })
  .strict();

const RequirementMatchTypeSchema = z.enum(["direct", "transferable", "adjacent", "gap"]);

export const RequirementMatchSchema = z
  .object({
    requirementId: z.string().trim().min(1).max(100),
    matchType: RequirementMatchTypeSchema,
    evidenceIds: z.array(z.string().trim().min(1).max(100)).max(6),
    reason: z.string().trim().min(1).max(400)
  })
  .strict();

export interface ResumeTailoringRequirement {
  id: string;
  type: "required" | "preferred";
  text: string;
}

export const ResumeTailoringPlanSchema = z
  .object({
    headline: TailoredTextSchema,
    summary: TailoredTextSchema,
    experience: z.array(TailoredResumeItemSchema).max(12),
    projects: z.array(TailoredResumeItemSchema).max(12),
    requirementMatches: z.array(RequirementMatchSchema),
    skillIds: z.array(z.string().trim().min(1).max(100)).max(40),
    highlightIds: z.array(z.string().trim().min(1).max(100)).max(20),
    strengthIds: z.array(z.string().trim().min(1).max(100)).max(20)
  })
  .strict();

export const ResumeTailoringResultSchema = z
  .object({
    plan: ResumeTailoringPlanSchema,
    resume: ResumeSchema
  })
  .strict();

export type ResumeTailoringPlan = z.infer<typeof ResumeTailoringPlanSchema>;
export type ResumeTailoringRequirementMatch = z.infer<typeof RequirementMatchSchema>;
export type ResumeTailoringResult = z.infer<typeof ResumeTailoringResultSchema>;

export function reviseTailoringPlan(plan: ResumeTailoringPlan, revisions: ReadonlyMap<string, string>): ResumeTailoringPlan {
  if (revisions.size === 0) return plan;

  const reviseItem = (item: ResumeTailoringPlan["experience"][number]) => ({
    ...item,
    description: revisions.get(item.sourceId) ?? item.description,
  });
  return {
    ...plan,
    headline: { ...plan.headline, text: revisions.get("headline") ?? plan.headline.text },
    summary: { ...plan.summary, text: revisions.get("summary") ?? plan.summary.text },
    experience: plan.experience.map(reviseItem),
    projects: plan.projects.map(reviseItem),
  };
}

export interface ResumeTailoringEvidence {
  id: string;
  title: string;
  text: string;
}

export function buildResumeTailoringRequirements(company: Company): ResumeTailoringRequirement[] {
  return [
    ...company.requirements.map((text, index) => ({
      id: `requirement-${index + 1}`,
      type: "required" as const,
      text: text.trim()
    })),
    ...company.preferredSkills.map((text, index) => ({
      id: `preferred-${index + 1}`,
      type: "preferred" as const,
      text: text.trim()
    }))
  ].filter((item) => item.text.length > 0);
}

const MAX_EVIDENCE_ITEMS = 68;
const MAX_EVIDENCE_TEXT_LENGTH = 1600;

function addEvidence(
  evidence: ResumeTailoringEvidence[],
  id: string,
  title: string,
  rawText: string
) {
  const text = rawText.trim();
  if (!text || evidence.length >= MAX_EVIDENCE_ITEMS) {
    return;
  }

  evidence.push({
    id,
    title,
    text: text.length > MAX_EVIDENCE_TEXT_LENGTH
      ? `${text.slice(0, MAX_EVIDENCE_TEXT_LENGTH)}...`
      : text
  });
}

export function buildResumeTailoringEvidence(resume: Resume): ResumeTailoringEvidence[] {
  const evidence: ResumeTailoringEvidence[] = [];

  addEvidence(evidence, "summary", "이력서 요약", resume.summary);
  addEvidence(evidence, "headline", "직무 제목", resume.headline);
  (resume.education ?? []).slice(0, 6).forEach((item, index) => addEvidence(evidence, `education-${index + 1}`, `학력 ${index + 1}`, item));
  (resume.qualifications ?? []).slice(0, 6).forEach((item, index) => addEvidence(evidence, `qualification-${index + 1}`, `자격·교육 ${index + 1}`, item));

  resume.experience.slice(0, 10).forEach((item, index) => {
    const text = [
      item.period && `기간: ${item.period}`,
      item.description
    ]
      .filter(Boolean)
      .join("\n");
    addEvidence(
      evidence,
      `experience-${index + 1}`,
      `경력 · ${[item.company, item.role].filter(Boolean).join(" / ") || `경력 ${index + 1}`}`,
      text
    );
  });

  resume.projects.slice(0, 12).forEach((item, index) => {
    const text = [
      item.subtitle,
      item.description,
      item.techStack.length > 0 ? `기술: ${item.techStack.join(", ")}` : "",
      item.highlights.length > 0 ? `주요 내용: ${item.highlights.join(" / ")}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    addEvidence(evidence, `project-${index + 1}`, `프로젝트 · ${item.name || `프로젝트 ${index + 1}`}`, text);
  });

  resume.achievements.slice(0, 12).forEach((item, index) => {
    addEvidence(evidence, `achievement-${index + 1}`, `성과 ${index + 1}`, item);
  });

  const highlights = resume.pdfHighlights.length > 0 ? resume.pdfHighlights : resume.achievements;
  highlights.slice(0, 12).forEach((item, index) => {
    addEvidence(evidence, `highlight-${index + 1}`, `핵심 성과 ${index + 1}`, item);
  });

  const strengths = resume.pdfStrengths.length > 0 ? resume.pdfStrengths : resume.strengths;
  strengths.slice(0, 8).forEach((item, index) => {
    addEvidence(evidence, `strength-${index + 1}`, `강점 ${index + 1}`, item);
  });

  resume.techStack.slice(0, 12).forEach((item, index) => {
    addEvidence(evidence, `skill-${index + 1}`, `기술 ${index + 1}`, item);
  });

  return evidence;
}

function includesKnownIds(ids: string[], allowedIds: Set<string>) {
  return ids.every((id) => allowedIds.has(id)) && new Set(ids).size === ids.length;
}

export function isResumeTailoringPlanValid(
  resume: Resume,
  company: Company,
  plan: ResumeTailoringPlan
): boolean {
  const evidenceIds = new Set(buildResumeTailoringEvidence(resume).map((item) => item.id));
  const requirementIds = new Set(buildResumeTailoringRequirements(company).map((item) => item.id));
  const experienceIds = new Set(resume.experience.slice(0, 10).map((_, index) => `experience-${index + 1}`));
  const projectIds = new Set(resume.projects.slice(0, 12).map((_, index) => `project-${index + 1}`));
  const skillIds = new Set(resume.techStack.slice(0, 12).map((_, index) => `skill-${index + 1}`));
  const highlights = resume.pdfHighlights.length > 0 ? resume.pdfHighlights : resume.achievements;
  const highlightIds = new Set(highlights.slice(0, 12).map((_, index) => `highlight-${index + 1}`));
  const strengths = resume.pdfStrengths.length > 0 ? resume.pdfStrengths : resume.strengths;
  const strengthIds = new Set(strengths.slice(0, 8).map((_, index) => `strength-${index + 1}`));

  const citationsAreValid = [
    ...plan.headline.evidenceIds,
    ...plan.summary.evidenceIds,
    ...plan.experience.flatMap((item) => item.evidenceIds),
    ...plan.projects.flatMap((item) => item.evidenceIds)
  ].every((id) => evidenceIds.has(id));

  const experienceIsValid =
    plan.experience.every(
      (item) => experienceIds.has(item.sourceId) && item.evidenceIds.includes(item.sourceId)
    ) && new Set(plan.experience.map((item) => item.sourceId)).size === plan.experience.length;
  const projectsAreValid =
    plan.projects.every(
      (item) => projectIds.has(item.sourceId) && item.evidenceIds.includes(item.sourceId)
    ) && new Set(plan.projects.map((item) => item.sourceId)).size === plan.projects.length;
  const requirementIdsInPlan = plan.requirementMatches.map((item) => item.requirementId);
  const requirementMatchesAreValid =
    requirementIdsInPlan.length === requirementIds.size &&
    includesKnownIds(requirementIdsInPlan, requirementIds) &&
    plan.requirementMatches.every((item) => {
      const referencesKnownEvidence =
        includesKnownIds(item.evidenceIds, evidenceIds) || item.evidenceIds.length === 0;
      const evidenceMatchesType =
        item.matchType === "gap" ? item.evidenceIds.length === 0 : item.evidenceIds.length > 0;

      return referencesKnownEvidence && evidenceMatchesType;
    });

  return (
    citationsAreValid &&
    experienceIsValid &&
    projectsAreValid &&
    requirementMatchesAreValid &&
    includesKnownIds(plan.skillIds, skillIds) &&
    includesKnownIds(plan.highlightIds, highlightIds) &&
    includesKnownIds(plan.strengthIds, strengthIds)
  );
}

export function applyResumeTailoringPlan(resume: Resume, plan: ResumeTailoringPlan): Resume {
  const experienceById = new Map(
    resume.experience.map((item, index) => [`experience-${index + 1}`, item])
  );
  const projectsById = new Map(
    resume.projects.map((item, index) => [`project-${index + 1}`, item])
  );
  const skillsById = new Map(resume.techStack.map((item, index) => [`skill-${index + 1}`, item]));
  const highlights = resume.pdfHighlights.length > 0 ? resume.pdfHighlights : resume.achievements;
  const highlightsById = new Map(highlights.map((item, index) => [`highlight-${index + 1}`, item]));
  const strengths = resume.pdfStrengths.length > 0 ? resume.pdfStrengths : resume.strengths;
  const strengthsById = new Map(strengths.map((item, index) => [`strength-${index + 1}`, item]));
  const pdfHighlights = plan.highlightIds.flatMap((id) => {
    const item = highlightsById.get(id);
    return item ? [item] : [];
  });

  return {
    ...resume,
    headline: plan.headline.text,
    summary: plan.summary.text,
    experience: plan.experience.flatMap((item) => {
      const source = experienceById.get(item.sourceId);
      return source ? [{ ...source, description: item.description }] : [];
    }),
    projects: plan.projects.flatMap((item) => {
      const source = projectsById.get(item.sourceId);
      return source ? [{ ...source, description: item.description }] : [];
    }),
    techStack: plan.skillIds.flatMap((id) => {
      const skill = skillsById.get(id);
      return skill ? [skill] : [];
    }),
    pdfHighlights,
    pdfStrengths: plan.strengthIds.flatMap((id) => {
      const strength = strengthsById.get(id);
      return strength ? [strength] : [];
    })
  };
}

const technologiesOutputSchema = {
  type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 80 }
} as const;

export const resumeTailoringOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "experience",
    "projects",
    "requirementMatches",
    "skillIds",
    "highlightIds",
    "strengthIds"
  ],
  properties: {
    headline: {
      type: "object",
      additionalProperties: false,
      required: ["text", "evidenceIds", "technologies"],
      properties: {
        text: { type: "string", maxLength: MAX_TAILORING_COPY_LENGTH },
        technologies: technologiesOutputSchema,
        evidenceIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }
      }
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["text", "evidenceIds", "technologies"],
      properties: {
        text: { type: "string", maxLength: MAX_TAILORING_COPY_LENGTH },
        technologies: technologiesOutputSchema,
        evidenceIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }
      }
    },
    experience: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "description", "evidenceIds", "technologies"],
        properties: {
          sourceId: { type: "string" },
          description: { type: "string", maxLength: MAX_TAILORING_COPY_LENGTH },
          technologies: technologiesOutputSchema,
          evidenceIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }
        }
      }
    },
    projects: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "description", "evidenceIds", "technologies"],
        properties: {
          sourceId: { type: "string" },
          description: { type: "string", maxLength: MAX_TAILORING_COPY_LENGTH },
          technologies: technologiesOutputSchema,
          evidenceIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } }
        }
      }
    },
    requirementMatches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirementId", "matchType", "evidenceIds", "reason"],
        properties: {
          requirementId: { type: "string" },
          matchType: { type: "string", enum: ["direct", "transferable", "adjacent", "gap"] },
          evidenceIds: { type: "array", maxItems: 6, items: { type: "string" } },
          reason: { type: "string", maxLength: 400 }
        }
      }
    },
    skillIds: { type: "array", maxItems: 40, items: { type: "string" } },
    highlightIds: { type: "array", maxItems: 20, items: { type: "string" } },
    strengthIds: { type: "array", maxItems: 20, items: { type: "string" } }
  }
} as const;
