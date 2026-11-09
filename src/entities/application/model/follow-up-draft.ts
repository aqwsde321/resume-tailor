import { z } from "zod";

export const FOLLOW_UP_OCCASION_OPTIONS = [
  { id: "application-thanks", label: "지원 후 확인" },
  { id: "interview-thanks", label: "면접 후 감사" },
  { id: "result-inquiry", label: "결과 문의" }
] as const;

export const FollowUpOccasionSchema = z.enum([
  "application-thanks",
  "interview-thanks",
  "result-inquiry"
]);

export const FollowUpDraftContentSchema = z
  .object({
    subject: z.string().trim().min(1).max(180),
    body: z.string().trim().min(1).max(4000)
  })
  .strict();

const EditableFollowUpDraftSchema = z
  .object({
    subject: z.string().max(180),
    body: z.string().max(4000)
  })
  .strict();

export const ApplicationFollowUpDraftSchema = EditableFollowUpDraftSchema.extend({
  occasion: FollowUpOccasionSchema,
  generatedAt: z.string().datetime()
}).strict();

export type FollowUpOccasion = z.infer<typeof FollowUpOccasionSchema>;
export type ApplicationFollowUpDraft = z.infer<typeof ApplicationFollowUpDraftSchema>;

export const followUpDraftOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string" },
    body: { type: "string" }
  }
} as const;

export function upsertApplicationFollowUpDraft(
  drafts: ApplicationFollowUpDraft[],
  nextDraft: ApplicationFollowUpDraft
): ApplicationFollowUpDraft[] {
  const byOccasion = new Map(drafts.map((draft) => [draft.occasion, draft]));
  byOccasion.set(nextDraft.occasion, nextDraft);

  return FOLLOW_UP_OCCASION_OPTIONS.flatMap((option) => {
    const draft = byOccasion.get(option.id);
    return draft ? [draft] : [];
  });
}
