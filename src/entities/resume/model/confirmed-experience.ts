import { z } from "zod";
import { DiscoveredExperienceDraftSchema } from "@/shared/lib/schemas";

export const ConfirmedExperienceSchema = z.object({
  id: z.string().uuid(),
  draft: DiscoveredExperienceDraftSchema.refine(
    (draft) => Boolean(draft.description.trim() && (draft.title.trim() || draft.organization.trim())),
    "경험의 제목 또는 소속과 내용을 확인해 주세요.",
  ),
}).strict();

export type ConfirmedExperience = z.infer<typeof ConfirmedExperienceSchema>;
export type ConfirmedExperienceScope = "common" | "company";
