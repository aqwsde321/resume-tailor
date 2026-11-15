import { z } from "zod";
import { evaluateIntroQuality, normalizeIntroWithGuidance } from "@/entities/intro/model/intro-insights";
import type { Company, Resume } from "@/shared/lib/types";

// 생성 품질 평가에서는 API 호환용 기본값 보정이 누락 필드를 가리지 않게 한다.
const GeneratedIntroSchema = z.object({
  oneLineIntro: z.string(),
  shortIntro: z.string(),
  longIntro: z.string(),
  fitReasons: z.array(z.string()).max(4),
  matchedSkills: z.array(z.string()).max(6),
  gapNotes: z.array(z.string()).max(3),
  missingButRelevant: z.array(z.string()).max(3)
}).strict();

export function evaluateIntroSample(raw: unknown, resume: Resume, company: Company) {
  const parsed = GeneratedIntroSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      raw,
      schemaValid: false,
      schemaIssues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      rawQuality: null,
      normalized: null,
      normalizedQuality: null
    };
  }
  const normalized = normalizeIntroWithGuidance(parsed.data, resume, company);
  return {
    raw,
    schemaValid: true,
    schemaIssues: [],
    rawQuality: evaluateIntroQuality(parsed.data, resume, company),
    normalized,
    normalizedQuality: evaluateIntroQuality(normalized, resume, company)
  };
}
