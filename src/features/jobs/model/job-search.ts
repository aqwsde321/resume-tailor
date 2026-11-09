import { z } from "zod";

import { ResumeSchema } from "@/shared/lib/schemas";
import type { Resume } from "@/shared/lib/types";

export const JobSourceSchema = z.enum(["saramin", "work24"]);
export type JobSource = z.infer<typeof JobSourceSchema>;

export const JobSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(120),
    resume: ResumeSchema,
    sources: z.array(JobSourceSchema).min(1).max(2)
  })
  .strict()
  .refine((request) => new Set(request.sources).size === request.sources.length, {
    message: "검색 사이트를 중복 선택할 수 없습니다.",
    path: ["sources"]
  });

export const JobListingSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    source: JobSourceSchema,
    title: z.string().trim().min(1).max(300),
    companyName: z.string().trim().min(1).max(200),
    url: z.string().url().max(2000),
    keywords: z.array(z.string().trim().min(1).max(120)).max(50),
    location: z.string().max(200),
    employmentType: z.string().max(120),
    careerLabel: z.string().max(120),
    careerMinYears: z.number().nonnegative().nullable(),
    careerMaxYears: z.number().nonnegative().nullable(),
    salary: z.string().max(200),
    deadline: z.string().max(80),
    postedAt: z.string().max(80),
    active: z.boolean()
  })
  .strict();

export const RankedJobListingSchema = JobListingSchema.extend({
  fit: z.enum(["high", "medium", "low"]),
  matchedSkills: z.array(z.string().max(120)).max(30),
  reasons: z.array(z.string().max(240)).max(8)
}).strict();

export type JobListing = z.infer<typeof JobListingSchema>;
export type RankedJobListing = z.infer<typeof RankedJobListingSchema>;

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}+#]/gu, "");
}

function words(value: string): string[] {
  return value.match(/[\p{L}\p{N}+#.]+/gu) ?? [];
}

export function resolveJobSearchQuery(resume: Resume, requestedQuery: string): string {
  return requestedQuery.trim().slice(0, 120) || resume.desiredPosition.trim() || resume.techStack[0]?.trim() || "";
}

function hasCareerFit(resume: Resume, listing: JobListing): boolean {
  if (listing.careerMinYears !== null && resume.careerYears < listing.careerMinYears) {
    return false;
  }

  if (listing.careerMaxYears !== null && resume.careerYears > listing.careerMaxYears) {
    return false;
  }

  return true;
}

function getMatch(resume: Resume, listing: JobListing) {
  const searchableText = [listing.title, ...listing.keywords].join(" ");
  const normalizedListingText = normalize(searchableText);
  const position = normalize(resume.desiredPosition);
  const positionTerms = words(resume.desiredPosition)
    .map(normalize)
    .filter((term) => term.length >= 2);
  const matchedPositionTerms = positionTerms.filter((term) => normalizedListingText.includes(term));
  const roleMatched = Boolean(position && normalizedListingText.includes(position)) || matchedPositionTerms.length > 0;

  const resumeSkills = [...new Set([...resume.techStack, ...resume.projects.flatMap((project) => project.techStack)])];
  const normalizedKeywords = listing.keywords.map(normalize).filter(Boolean);
  const matchedSkills = resumeSkills.filter((skill) => {
    const normalizedSkill = normalize(skill);
    return normalizedKeywords.some(
      (keyword) =>
        keyword === normalizedSkill ||
        (normalizedSkill.length >= 5 && (keyword.includes(normalizedSkill) || normalizedSkill.includes(keyword)))
    );
  });
  const careerMatched = hasCareerFit(resume, listing);
  const skillCoverage = resumeSkills.length > 0 ? matchedSkills.length / resumeSkills.length : 0;
  const score = (roleMatched ? 50 : 0) + skillCoverage * 40 + (careerMatched ? 10 : 0);
  const reasons: string[] = [];

  if (roleMatched && resume.desiredPosition.trim()) {
    reasons.push(`희망 직무(${resume.desiredPosition})와 공고의 제목·직무 키워드가 맞아요.`);
  }
  if (matchedSkills.length > 0) {
    reasons.push(`${matchedSkills.join(", ")}이 공고 키워드에 표시돼 있어요.`);
  }
  if (listing.careerLabel) {
    reasons.push(
      careerMatched
        ? `${resume.careerYears}년 경력이 공고 경력 조건(${listing.careerLabel})에 들어가요.`
        : `공고 경력 조건(${listing.careerLabel})을 확인해 주세요.`
    );
  }
  if (reasons.length === 0) {
    reasons.push("공고 요약에서 이력서와 겹치는 직무·기술을 확인하지 못했어요. 원문을 확인해 주세요.");
  }

  return {
    score,
    fit: score >= 65 ? ("high" as const) : score >= 35 ? ("medium" as const) : ("low" as const),
    matchedSkills: matchedSkills.slice(0, 12),
    reasons: reasons.slice(0, 8)
  };
}

export function rankJobListings(resume: Resume, listings: JobListing[]): RankedJobListing[] {
  return listings
    .filter((listing) => listing.active)
    .map((listing) => ({ listing, match: getMatch(resume, listing) }))
    .sort((left, right) => {
      if (left.match.score !== right.match.score) {
        return right.match.score - left.match.score;
      }
      return right.listing.postedAt.localeCompare(left.listing.postedAt);
    })
    .map(({ listing, match }) => ({
      ...listing,
      fit: match.fit,
      matchedSkills: match.matchedSkills,
      reasons: match.reasons
    }));
}
