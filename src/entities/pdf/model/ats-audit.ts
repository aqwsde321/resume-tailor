import { z } from "zod";

import type { Company, Resume } from "@/shared/lib/types";

const KeywordCoverageSchema = z
  .object({
    total: z.number().int().nonnegative(),
    matchedCount: z.number().int().nonnegative(),
    matched: z.array(z.string()),
    missing: z.array(z.string())
  })
  .strict();

export const PdfAtsAuditSchema = z
  .object({
    status: z.enum(["checked", "unavailable", "failed"]),
    message: z.string(),
    textCharacterCount: z.number().int().nonnegative(),
    nameFound: z.boolean().nullable(),
    contacts: z.array(
      z
        .object({
          label: z.string(),
          found: z.boolean()
        })
        .strict()
    ),
    requiredTerms: KeywordCoverageSchema,
    preferredTerms: KeywordCoverageSchema,
    textPreview: z.string()
  })
  .strict();

export type PdfAtsAudit = z.infer<typeof PdfAtsAuditSchema>;
type KeywordCoverage = PdfAtsAudit["requiredTerms"];

const IGNORED_REQUIREMENT_WORDS = new Set([
  "ability",
  "and",
  "are",
  "experience",
  "for",
  "from",
  "have",
  "in",
  "knowledge",
  "of",
  "or",
  "plus",
  "preferred",
  "required",
  "strong",
  "the",
  "to",
  "with",
  "years",
  "year",
  "개발",
  "가능",
  "경력",
  "경험",
  "관련",
  "구축",
  "기술",
  "능력",
  "및",
  "보유",
  "분야",
  "설계",
  "서비스",
  "수행",
  "시스템",
  "업무",
  "역량",
  "운영",
  "이상",
  "이해",
  "이하",
  "자격",
  "지원",
  "활용",
  "필수",
  "학력",
  "협업",
  "우대"
]);

function normalizeTerm(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}+#]/gu, "");
}

function getWords(value: string) {
  return value.match(/[\p{L}\p{N}+#.]+/gu) ?? [];
}

function collectKeywords(values: string[], keepSingleCharacterWords = false) {
  const unique = new Map<string, string>();

  for (const value of values) {
    for (const word of getWords(value.trim())) {
      const key = normalizeTerm(word);
      if (
        key.length === 0 ||
        /^\p{N}+$/u.test(key) ||
        (!keepSingleCharacterWords && [...key].length < 2) ||
        IGNORED_REQUIREMENT_WORDS.has(key)
      ) {
        continue;
      }

      if (!unique.has(key)) {
        unique.set(key, word.replace(/^[.#]+|[.#]+$/g, ""));
      }
    }
  }

  return [...unique.entries()].map(([key, label]) => ({ key, label }));
}

function makeCoverage(terms: Array<{ key: string; label: string }>, text: string): KeywordCoverage {
  const textWords = new Set(getWords(text).map(normalizeTerm));
  const matched = terms.filter(({ key }) => textWords.has(key));
  const missing = terms.filter(({ key }) => !matched.some((term) => term.key === key));

  return {
    total: terms.length,
    matchedCount: matched.length,
    matched: matched.slice(0, 8).map(({ label }) => label),
    missing: missing.slice(0, 8).map(({ label }) => label)
  };
}

function buildNameFound(text: string, name: string) {
  const nameTokens = getWords(name).map(normalizeTerm).filter(Boolean);
  if (nameTokens.length === 0) {
    return null;
  }

  const textWords = new Set(getWords(text).map(normalizeTerm));
  return nameTokens.every((token) => textWords.has(token));
}

export function buildPdfAtsAudit(text: string, resume: Resume, company: Company): PdfAtsAudit {
  const requiredTerms = collectKeywords(company.techStack, true);
  const requirementTerms = collectKeywords(company.requirements);
  for (const { key, label } of requirementTerms) {
    if (!requiredTerms.some((term) => term.key === key)) {
      requiredTerms.push({ key, label });
    }
  }

  const preferredTerms = collectKeywords(company.preferredSkills, true);
  const contacts = resume.contacts
    .map((contact) => ({
      label: contact.label.trim() || "연락처",
      value: contact.value.trim()
    }))
    .filter((contact) => Boolean(contact.value))
    .map(({ label, value }) => ({
      label,
      found: normalizeTerm(text).includes(normalizeTerm(value))
    }));

  return {
    status: "checked",
    message: text.trim() ? "PDF에서 텍스트를 추출했어요." : "PDF에서 읽을 수 있는 텍스트를 찾지 못했어요.",
    textCharacterCount: [...text].length,
    nameFound: buildNameFound(text, resume.name),
    contacts,
    requiredTerms: makeCoverage(requiredTerms, text),
    preferredTerms: makeCoverage(preferredTerms, text),
    textPreview: text.replace(/\s+/g, " ").trim().slice(0, 220)
  };
}

export function parsePdfAtsAuditHeader(header: string | null): PdfAtsAudit | null {
  if (!header) {
    return null;
  }

  try {
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    const parsed = PdfAtsAuditSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
