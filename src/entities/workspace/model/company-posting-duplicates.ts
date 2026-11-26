import type { CompanyWork, ReviewDocument } from "./workspace";

const reasonPriority = { url: 0, text: 1, similar: 2 };
type DuplicateReason = keyof typeof reasonPriority;

function postingUrl(raw?: string) {
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.*|fbclid|gclid|msclkid|li_fat_id)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  const route = /^#!?\/|^#\?/.test(url.hash) ? url.hash : "";
  return `${url.host}${url.pathname.replace(/\/+$/, "")}${url.search}${route}`;
}

function postingWords(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#]*/gu) ?? [];
}

function trigrams(words: string[]) {
  const result = new Set<string>();
  for (let index = 2; index < words.length; index++) {
    result.add(`${words[index - 2]} ${words[index - 1]} ${words[index]}`);
  }
  return result;
}

function matchingText(words: string[], input: string, phrases: Set<string>, sharedCompanyAndTitle: boolean): DuplicateReason | null {
  const minimumPhrases = sharedCompanyAndTitle ? 5 : 12;
  const text = words.join(" ");
  if (input === text && (text.length >= 24 || (sharedCompanyAndTitle && Boolean(text)))) return "text";
  const other = trigrams(words);
  if (Math.min(phrases.size, other.size) < minimumPhrases) return null;
  let common = 0;
  for (const phrase of other) if (phrases.has(phrase)) common++;
  const similarity = (2 * common) / (phrases.size + other.size);
  return similarity >= (sharedCompanyAndTitle ? 0.75 : 0.9) ? "similar" : null;
}

export function findDuplicateCompanyPostings(document: ReviewDocument, works: readonly CompanyWork[]) {
  const url = postingUrl(document.source.url);
  const words = postingWords(document.text);
  const input = words.join(" ");
  const phrases = trigrams(words);
  const contains = (value: string | undefined) => {
    const match = postingWords(value ?? "").join(" ");
    return Boolean(match && ` ${input} `.includes(` ${match} `));
  };
  return works.flatMap((work) => {
    let reason: DuplicateReason | null = null;
    if (url && url === postingUrl(work.document.source.url)) {
      reason = "url";
    } else {
      const sameCompanyAndRole = contains(work.company?.companyName) && contains(work.company?.jobTitle);
      reason = matchingText(postingWords(work.document.text), input, phrases, sameCompanyAndRole);
      const original = work.document.source.originalText;
      if (original !== work.document.text && reason !== "text") {
        const originalMatch = matchingText(postingWords(original), input, phrases, sameCompanyAndRole);
        if (originalMatch === "text" || !reason) reason = originalMatch;
      }
    }
    return reason ? [{ work, reason }] : [];
  }).sort((left, right) => reasonPriority[left.reason] - reasonPriority[right.reason] || right.work.updatedAt.localeCompare(left.work.updatedAt));
}
