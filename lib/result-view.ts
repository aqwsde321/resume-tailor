import type { IntroRefreshReason } from "@/lib/pipeline-context";
import type { Intro } from "@/lib/types";

export type IntroSectionKey = "oneLineIntro" | "shortIntro" | "longIntro";
export type CompareChunkStatus = "same" | "added" | "removed";

export interface CopyFeedback {
  key: IntroSectionKey;
  title: string;
  status: "success" | "error";
}

export interface CompareChunk {
  id: string;
  text: string;
  status: CompareChunkStatus;
}

export interface CompareSection {
  addedCount: number;
  changed: boolean;
  currentChunks: CompareChunk[];
  currentTitle: string;
  key: IntroSectionKey;
  previousChunks: CompareChunk[];
  previousTitle: string;
  removedCount: number;
  title: string;
  unchangedCount: number;
}

export interface RefreshReasonBadge {
  key: IntroRefreshReason["key"];
  label: string;
}

const SENTENCE_CHUNK_PATTERN = /[^.!?。！？\n]+[.!?。！？]?/g;

export function getIntroInsights(intro: Intro | null) {
  if (!intro) {
    return null;
  }

  const fitReasons = Array.isArray(intro.fitReasons) ? intro.fitReasons.filter(Boolean) : [];
  const matchedSkills = Array.isArray(intro.matchedSkills) ? intro.matchedSkills.filter(Boolean) : [];
  const gapNotes = Array.isArray(intro.gapNotes) ? intro.gapNotes.filter(Boolean) : [];
  const missingButRelevant = Array.isArray(intro.missingButRelevant)
    ? intro.missingButRelevant.filter(Boolean)
    : [];

  if (
    fitReasons.length === 0 &&
    matchedSkills.length === 0 &&
    gapNotes.length === 0 &&
    missingButRelevant.length === 0
  ) {
    return null;
  }

  return {
    fitReasons,
    matchedSkills,
    gapNotes,
    missingButRelevant
  };
}

export function buildRefreshReasonBadges(
  reasons: IntroRefreshReason[],
  hasResumeConfirmed: boolean,
  hasCompanyConfirmed: boolean
): RefreshReasonBadge[] {
  return reasons.map((reason) => ({
    key: reason.key,
    label:
      reason.key === "resume"
        ? hasResumeConfirmed
          ? "이력서 변경"
          : "이력서 다시 저장"
        : hasCompanyConfirmed
          ? "공고 변경"
          : "공고 다시 저장"
  }));
}

export function buildIntroActionSummary(params: {
  canGenerate: boolean;
  hasIntro: boolean;
  needsRefresh: boolean;
  refreshReasonBadges: RefreshReasonBadge[];
}) {
  const { canGenerate, hasIntro, needsRefresh, refreshReasonBadges } = params;

  return {
    heading: !canGenerate
      ? "저장 후 만들 수 있어요"
      : !hasIntro
        ? "저장한 내용으로 바로 만들 수 있어요"
        : needsRefresh
          ? refreshReasonBadges.map((badge) => badge.label).join(", ")
          : "최신 결과가 준비돼 있어요",
    description:
      !canGenerate || !hasIntro || needsRefresh
        ? ""
        : "필요하면 같은 조건으로 다시 만들 수 있어요"
  };
}

function splitCompareChunks(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return normalized.split(/\n+/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return [];
    }

    const chunks = trimmed.match(SENTENCE_CHUNK_PATTERN) ?? [trimmed];
    return chunks.map((chunk) => chunk.trim()).filter(Boolean);
  });
}

function normalizeCompareChunk(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\u2022•\-*]+\s*/, "")
    .replace(/[.!?。！？]+$/g, "")
    .trim()
    .toLowerCase();
}

function countCompareSignatures(chunks: string[]) {
  const counts = new Map<string, number>();

  for (const chunk of chunks) {
    const signature = normalizeCompareChunk(chunk);
    if (!signature) {
      continue;
    }

    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  return counts;
}

function markCompareChunks(
  chunks: string[],
  otherCounts: Map<string, number>,
  missingStatus: CompareChunkStatus
) {
  const seen = new Map<string, number>();

  return chunks.map((chunk, index) => {
    const signature = normalizeCompareChunk(chunk);
    const seenCount = seen.get(signature) ?? 0;
    seen.set(signature, seenCount + 1);

    return {
      id: `${signature || "chunk"}-${index}`,
      text: chunk,
      status: signature && seenCount < (otherCounts.get(signature) ?? 0) ? "same" : missingStatus
    } satisfies CompareChunk;
  });
}

export function buildCompareSection(
  key: IntroSectionKey,
  title: string,
  previousTitle: string,
  currentTitle: string,
  previousValue: string,
  currentValue: string
) {
  const previousSource = splitCompareChunks(previousValue);
  const currentSource = splitCompareChunks(currentValue);
  const previousCounts = countCompareSignatures(previousSource);
  const currentCounts = countCompareSignatures(currentSource);
  const previousChunks = markCompareChunks(previousSource, currentCounts, "removed");
  const currentChunks = markCompareChunks(currentSource, previousCounts, "added");
  const addedCount = currentChunks.filter((chunk) => chunk.status === "added").length;
  const removedCount = previousChunks.filter((chunk) => chunk.status === "removed").length;
  const unchangedCount = currentChunks.filter((chunk) => chunk.status === "same").length;

  return {
    key,
    title,
    previousTitle,
    currentTitle,
    previousChunks,
    currentChunks,
    addedCount,
    removedCount,
    unchangedCount,
    changed: addedCount > 0 || removedCount > 0
  } satisfies CompareSection;
}
