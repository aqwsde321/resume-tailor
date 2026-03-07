import { z } from "zod";

const StringArraySchema = z.array(z.string()).default([]);
export const ModelReasoningEffortSchema = z.enum(["minimal", "low", "medium", "high", "xhigh"]);
export const AgentRunOptionsSchema = z
  .object({
    model: z.string().trim().min(1).max(120).optional(),
    modelReasoningEffort: ModelReasoningEffortSchema.optional()
  })
  .strict();

const ResumeExperienceItemSchema = z
  .object({
    company: z.string().default(""),
    role: z.string().default(""),
    period: z.string().default(""),
    description: z.string().default("")
  })
  .strict();

const ResumeProjectItemSchema = z
  .object({
    name: z.string().default(""),
    description: z.string().default(""),
    techStack: StringArraySchema
  })
  .strict();

export const ResumeSchema = z
  .object({
    name: z.string().default(""),
    summary: z.string().default(""),
    desiredPosition: z.string().default(""),
    careerYears: z.number().int().nonnegative().default(0),
    techStack: StringArraySchema,
    experience: z.array(ResumeExperienceItemSchema).default([]),
    projects: z.array(ResumeProjectItemSchema).default([]),
    achievements: StringArraySchema,
    strengths: StringArraySchema
  })
  .strict();

export const CompanySchema = z
  .object({
    companyName: z.string().default(""),
    companyDescription: z.string().default(""),
    jobTitle: z.string().default(""),
    jobDescription: z.string().default(""),
    requirements: StringArraySchema,
    preferredSkills: StringArraySchema,
    techStack: StringArraySchema
  })
  .strict();

export const IntroSchema = z
  .object({
    oneLineIntro: z.string().default(""),
    shortIntro: z.string().default(""),
    longIntro: z.string().default(""),
    fitReasons: StringArraySchema,
    matchedSkills: StringArraySchema,
    gapNotes: StringArraySchema,
    missingButRelevant: StringArraySchema
  })
  .strict();

export const resumeOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "summary",
    "desiredPosition",
    "careerYears",
    "techStack",
    "experience",
    "projects",
    "achievements",
    "strengths"
  ],
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    desiredPosition: { type: "string" },
    careerYears: { type: "integer" },
    techStack: {
      type: "array",
      items: { type: "string" }
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["company", "role", "period", "description"],
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          period: { type: "string" },
          description: { type: "string" }
        }
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "techStack"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          techStack: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    achievements: {
      type: "array",
      items: { type: "string" }
    },
    strengths: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export const companyOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "companyName",
    "companyDescription",
    "jobTitle",
    "jobDescription",
    "requirements",
    "preferredSkills",
    "techStack"
  ],
  properties: {
    companyName: { type: "string" },
    companyDescription: { type: "string" },
    jobTitle: { type: "string" },
    jobDescription: { type: "string" },
    requirements: {
      type: "array",
      items: { type: "string" }
    },
    preferredSkills: {
      type: "array",
      items: { type: "string" }
    },
    techStack: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export const introOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "oneLineIntro",
    "shortIntro",
    "longIntro",
    "fitReasons",
    "matchedSkills",
    "gapNotes",
    "missingButRelevant"
  ],
  properties: {
    oneLineIntro: { type: "string" },
    shortIntro: { type: "string" },
    longIntro: { type: "string" },
    fitReasons: {
      type: "array",
      items: { type: "string" }
    },
    matchedSkills: {
      type: "array",
      items: { type: "string" }
    },
    gapNotes: {
      type: "array",
      items: { type: "string" }
    },
    missingButRelevant: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
