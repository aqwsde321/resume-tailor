import { z } from "zod";

import { ResumeSchema } from "@/shared/lib/schemas";
import type { Resume } from "@/shared/lib/types";

const EvidenceIdsSchema = z.array(z.string().trim().min(1).max(100)).min(1).max(4);

const TailoredTextSchema = z
  .object({
    text: z.string().trim().min(1).max(1600),
    evidenceIds: EvidenceIdsSchema
  })
  .strict();

const TailoredResumeItemSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(1600),
    evidenceIds: EvidenceIdsSchema
  })
  .strict();

export const ResumeTailoringPlanSchema = z
  .object({
    headline: TailoredTextSchema,
    summary: TailoredTextSchema,
    experience: z.array(TailoredResumeItemSchema).max(12),
    projects: z.array(TailoredResumeItemSchema).max(12),
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
export type ResumeTailoringResult = z.infer<typeof ResumeTailoringResultSchema>;

export interface ResumeTailoringEvidence {
  id: string;
  title: string;
  text: string;
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

export function isResumeTailoringPlanValid(resume: Resume, plan: ResumeTailoringPlan): boolean {
  const evidenceIds = new Set(buildResumeTailoringEvidence(resume).map((item) => item.id));
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

  return (
    citationsAreValid &&
    experienceIsValid &&
    projectsAreValid &&
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

export const resumeTailoringOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "experience",
    "projects",
    "skillIds",
    "highlightIds",
    "strengthIds"
  ],
  properties: {
    headline: {
      type: "object",
      additionalProperties: false,
      required: ["text", "evidenceIds"],
      properties: {
        text: { type: "string", maxLength: 1600 },
        evidenceIds: { type: "array", items: { type: "string" } }
      }
    },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["text", "evidenceIds"],
      properties: {
        text: { type: "string", maxLength: 1600 },
        evidenceIds: { type: "array", items: { type: "string" } }
      }
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "description", "evidenceIds"],
        properties: {
          sourceId: { type: "string" },
          description: { type: "string", maxLength: 1600 },
          evidenceIds: { type: "array", items: { type: "string" } }
        }
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "description", "evidenceIds"],
        properties: {
          sourceId: { type: "string" },
          description: { type: "string", maxLength: 1600 },
          evidenceIds: { type: "array", items: { type: "string" } }
        }
      }
    },
    skillIds: { type: "array", items: { type: "string" } },
    highlightIds: { type: "array", items: { type: "string" } },
    strengthIds: { type: "array", items: { type: "string" } }
  }
} as const;
