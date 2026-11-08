import { z } from "zod";

const StringArraySchema = z.array(z.string()).default([]);
export const ModelReasoningEffortSchema = z.enum(["minimal", "low", "medium", "high", "xhigh"]);
export const IntroToneSchema = z.enum(["balanced", "confident", "collaborative", "problemSolving"]);
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

const ResumeContactItemSchema = z
  .object({
    label: z.string().default(""),
    value: z.string().default(""),
    url: z.string().default("")
  })
  .strict();

const ResumeProjectItemSchema = z
  .object({
    name: z.string().default(""),
    description: z.string().default(""),
    subtitle: z.string().default(""),
    link: z.string().default(""),
    linkLabel: z.string().default(""),
    techStack: StringArraySchema,
    highlights: StringArraySchema
  })
  .strict();

export const ResumeSchema = z
  .object({
    name: z.string().default(""),
    headline: z.string().default(""),
    summary: z.string().default(""),
    desiredPosition: z.string().default(""),
    careerYears: z.number().int().nonnegative().default(0),
    careerDurationText: z.string().default(""),
    pdfProfileImageDataUrl: z.string().default(""),
    pdfProfileImageVisible: z.boolean().default(false),
    contacts: z.array(ResumeContactItemSchema).default([]),
    techStack: StringArraySchema,
    experience: z.array(ResumeExperienceItemSchema).default([]),
    projects: z.array(ResumeProjectItemSchema).default([]),
    achievements: StringArraySchema,
    pdfHighlights: StringArraySchema,
    strengths: StringArraySchema,
    pdfStrengths: StringArraySchema
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

export const ExperienceDiscoveryMessageSchema = z
  .object({
    role: z.enum(["assistant", "user"]),
    content: z.string().trim().min(1).max(2000)
  })
  .strict();

export const DiscoveredExperienceDraftSchema = z
  .object({
    category: z.enum(["experience", "project"]),
    title: z.string().max(160),
    organization: z.string().max(160),
    role: z.string().max(160),
    period: z.string().max(100),
    description: z.string().max(1600),
    techStack: z.array(z.string().max(80)).max(30).default([])
  })
  .strict();

export const ExperienceDiscoveryTurnSchema = z
  .object({
    status: z.enum(["question", "draft", "done"]),
    message: z.string().trim().min(1).max(1000),
    draft: DiscoveredExperienceDraftSchema.nullable()
  })
  .strict()
  .superRefine((turn, context) => {
    if (turn.status === "draft" && !turn.draft) {
      context.addIssue({ code: "custom", message: "draft 상태에는 경험 초안이 필요합니다.", path: ["draft"] });
    }

    if (turn.status !== "draft" && turn.draft) {
      context.addIssue({ code: "custom", message: "draft 외 상태에는 경험 초안을 넣을 수 없습니다.", path: ["draft"] });
    }
  });

export const ExperienceDiscoverySessionSchema = z
  .object({
    requirement: z.string().trim().min(1).max(300),
    messages: z.array(ExperienceDiscoveryMessageSchema).max(16),
    status: z.enum(["question", "draft", "done"]),
    message: z.string().max(1000),
    draft: DiscoveredExperienceDraftSchema.nullable(),
    sourceResumeSnapshot: z.string().max(200_000),
    sourceCompanyJson: z.string().max(50_000)
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

export const experienceDiscoveryOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "draft"],
  properties: {
    status: { type: "string", enum: ["question", "draft", "done"] },
    message: { type: "string" },
    draft: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["category", "title", "organization", "role", "period", "description", "techStack"],
          properties: {
            category: { type: "string", enum: ["experience", "project"] },
            title: { type: "string" },
            organization: { type: "string" },
            role: { type: "string" },
            period: { type: "string" },
            description: { type: "string" },
            techStack: { type: "array", items: { type: "string" } }
          }
        },
        { type: "null" }
      ]
    }
  }
} as const;
