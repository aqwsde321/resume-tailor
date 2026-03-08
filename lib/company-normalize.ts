import type { Company } from "@/lib/types";

const BULLET_PREFIX = /^[\s>*•·\-–—\d.)]+/;
const INLINE_LABEL_PREFIX =
  /^(필수(?:\s*(?:조건|사항))?|자격\s*요건|지원\s*자격|우대(?:\s*(?:조건|사항))?|preferred|requirements?|nice\s*to\s*have|must\s*have|required|plus|tech\s*stack|skills?)\s*[:：-]?\s*/i;
const NOISE_PATTERNS = [
  /로그인하고 비슷한 조건의 ai추천공고/i,
  /채용정보에 잘못된 내용이 있을 경우 문의/i,
  /본 채용정보는/i,
  /불법\/허위\/과장\/오류 신고/i,
  /고객센터/i,
  /즉시 지원/i,
  /홈페이지 지원/i,
  /지원방법/i,
  /접수기간/i,
  /상시채용/i,
  /채용 시 마감/i,
  /전형\s*절차/i,
  /채용\s*절차/i,
  /서류전형/i,
  /최종합격/i,
  /^근무지/i,
  /^근무\s*형태/i,
  /^근무형태/i,
  /^고용\s*형태/i,
  /^고용형태/i,
  /^연봉/i,
  /^급여/i,
  /마감일은 기업의 사정으로 인해/i,
  /지도보기/i,
  /더보기$/i,
  /^top$/i,
  /^궁금해요$/i
];
const BENEFIT_NOISE_PATTERN =
  /(복지|복리후생|보험|연금|휴가|휴무|건강검진|식대|점심|리프레시|카페|포인트|상품권|장기근속|자녀교육비|휴양시설|캠핑장|유연근무|출퇴근|복지제도)/i;
const JOB_DESCRIPTION_END_MARKERS = [
  "이 기업의 취업 전략",
  "로그인하고 비슷한 조건의 AI추천공고",
  "관련 태그",
  "본 채용정보는",
  "마감일은 기업의 사정으로 인해",
  "불법/허위/과장/오류 신고",
  "채용 절차",
  "전형 절차",
  "복리후생",
  "혜택 및 복지",
  "지원 방법",
  "접수기간",
  "근무 조건"
];

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeListItem(value: string) {
  return normalizeWhitespace(
    value
      .replace(BULLET_PREFIX, "")
      .replace(INLINE_LABEL_PREFIX, "")
      .replace(/^[`"'(\[]+|[`"')\]]+$/g, "")
  );
}

function dedupe(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(item);
  });

  return result;
}

function stripTrailingNoise(value: string) {
  let text = value;

  for (const marker of JOB_DESCRIPTION_END_MARKERS) {
    const index = text.indexOf(marker);
    if (index >= 0) {
      text = text.slice(0, index);
    }
  }

  return normalizeWhitespace(text);
}

function normalizeDescription(value: string) {
  const text = stripTrailingNoise(value);
  if (!text) {
    return "";
  }

  return text
    .replace(/^채용정보에 잘못된 내용이 있을 경우 문의해주세요\.?\s*/i, "")
    .replace(/^모집요강\s*/i, "")
    .trim();
}

function splitSentenceChunks(items: string[]) {
  return items.flatMap((item) =>
    item
      .replace(/\r/g, "\n")
      .split("\n")
      .map((part) => normalizeWhitespace(part.replace(BULLET_PREFIX, "")))
      .filter(Boolean)
  );
}

function splitTechStack(items: string[]) {
  return items.flatMap((item) =>
    item
      .replace(/\r/g, "\n")
      .split(/[\n,\/|]|·/g)
      .map((part) => normalizeListItem(part))
      .filter(Boolean)
  );
}

function isNoiseItem(value: string) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(value));
}

function isBenefitNoise(value: string) {
  return BENEFIT_NOISE_PATTERN.test(value);
}

function hasPreferredMarker(value: string) {
  return /^(우대(?:\s*(?:조건|사항))?|preferred|nice\s*to\s*have|plus)(?=\s*[:：-]|\s|$)/i.test(value);
}

function hasRequirementMarker(value: string) {
  return /^(필수(?:\s*(?:조건|사항))?|자격\s*요건|지원\s*자격|requirements?|required|must\s*have)(?=\s*[:：-]|\s|$)/i.test(
    value
  );
}

function cleanupTechStack(items: string[]) {
  return dedupe(
    splitTechStack(items).filter((item) => {
      if (item.length < 2 || isNoiseItem(item)) {
        return false;
      }

      if (item.split(" ").length >= 5) {
        return false;
      }

      return true;
    })
  );
}

export function normalizeCompany(company: Company): Company {
  // 모델 출력에는 필수/우대/복지 문장이 섞여 들어오기 쉬워 저장 전에 한 번 더 정리한다.
  const rawRequirements = splitSentenceChunks(company.requirements);
  const rawPreferred = splitSentenceChunks(company.preferredSkills);
  const nextRequirements: string[] = [];
  const nextPreferred: string[] = [];

  rawRequirements.forEach((item) => {
    const normalized = normalizeListItem(item);
    if (normalized.length < 2 || isNoiseItem(normalized) || isBenefitNoise(normalized)) {
      return;
    }

    if (hasPreferredMarker(item)) {
      nextPreferred.push(normalized);
      return;
    }

    nextRequirements.push(normalized);
  });

  rawPreferred.forEach((item) => {
    const normalized = normalizeListItem(item);
    if (normalized.length < 2 || isNoiseItem(normalized) || isBenefitNoise(normalized)) {
      return;
    }

    if (hasRequirementMarker(item)) {
      nextRequirements.push(normalized);
      return;
    }

    nextPreferred.push(normalized);
  });

  return {
    companyName: normalizeWhitespace(company.companyName),
    companyDescription: normalizeDescription(company.companyDescription),
    jobTitle: normalizeWhitespace(company.jobTitle),
    jobDescription: normalizeDescription(company.jobDescription),
    requirements: dedupe(nextRequirements).filter(Boolean),
    preferredSkills: dedupe(nextPreferred).filter(Boolean),
    // 기술 스택은 문장형 설명보다 짧은 키워드만 남기도록 별도 정리한다.
    techStack: cleanupTechStack(company.techStack)
  };
}
