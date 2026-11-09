import { z } from "zod";

export const InterviewPrepQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    focus: z.string().trim().min(1).max(500),
    resumeEvidence: z.string().trim().min(1).max(700),
    answerOutline: z.array(z.string().trim().min(1).max(300)).min(2).max(5)
  })
  .strict();

export const InterviewPrepContentSchema = z
  .object({
    openingPitch: z.string().trim().min(1).max(1200),
    questions: z.array(InterviewPrepQuestionSchema).min(3).max(8),
    questionsToAsk: z.array(z.string().trim().min(1).max(300)).min(2).max(6)
  })
  .strict();

export const ApplicationInterviewPrepSchema = InterviewPrepContentSchema.extend({
  generatedAt: z.string().datetime()
}).strict();

export type InterviewPrepContent = z.infer<typeof InterviewPrepContentSchema>;
export type ApplicationInterviewPrep = z.infer<typeof ApplicationInterviewPrepSchema>;

export const interviewPrepOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["openingPitch", "questions", "questionsToAsk"],
  properties: {
    openingPitch: { type: "string" },
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "focus", "resumeEvidence", "answerOutline"],
        properties: {
          question: { type: "string" },
          focus: { type: "string" },
          resumeEvidence: { type: "string" },
          answerOutline: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string" }
          }
        }
      }
    },
    questionsToAsk: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" }
    }
  }
} as const;
