import { isIP } from "node:net";

import { load } from "cheerio";

import { extractTextFromImages, isImageOcrAvailable } from "@/lib/company-image-ocr";
import { HttpError } from "@/lib/http";

const FETCH_TIMEOUT_MS = 10000;
const BROWSER_TIMEOUT_MS = 15000;
const MAX_BODY_LENGTH = 2_000_000;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_OCR_IMAGE_COUNT = 4;
const MIN_TEXT_LENGTH = 80;
const MIN_OCR_TEXT_LENGTH = 60;
const STRONG_TEXT_LENGTH = 180;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ResumeTailorBot/1.0; +https://localhost/resume-tailor)";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

const JOB_SIGNAL_KEYWORDS = [
  "주요 업무",
  "자격 요건",
  "필수 조건",
  "우대 사항",
  "기술 스택",
  "지원 자격",
  "requirements",
  "qualifications",
  "preferred",
  "responsibilities",
  "job description",
  "tech stack"
];

const TITLE_KEYS = [
  "title",
  "jobTitle",
  "positionTitle",
  "position",
  "recruitmentTitle",
  "headline",
  "name"
];

const COMPANY_KEYS = [
  "companyName",
  "company",
  "organization",
  "hiringOrganization",
  "team",
  "companyInfo"
];

const BODY_KEYS = [
  "description",
  "jobDescription",
  "responsibilities",
  "responsibility",
  "qualifications",
  "requirements",
  "preferredQualifications",
  "preferredSkills",
  "skills",
  "niceToHave",
  "mustHave",
  "summary",
  "jobSummary",
  "roleDescription",
  "whatYouWillDo",
  "whoYouAre",
  "content",
  "body",
  "text",
  "details",
  "techStack",
  "stack"
];

const JSON_ASSIGNMENT_PATTERNS = [
  /(?:window\.)?__NEXT_DATA__\s*=\s*({[\s\S]+})\s*;?\s*$/,
  /(?:window\.)?__INITIAL_STATE__\s*=\s*({[\s\S]+})\s*;?\s*$/,
  /(?:window\.)?__NUXT__\s*=\s*({[\s\S]+})\s*;?\s*$/,
  /(?:window\.)?__APOLLO_STATE__\s*=\s*({[\s\S]+})\s*;?\s*$/
];

const DOMAIN_SELECTORS: Array<{
  match: (hostname: string) => boolean;
  selectors: string[];
}> = [
  {
    match: (hostname) => hostname.includes("greenhouse.io"),
    selectors: ["#content", "#app_body", ".content", ".opening"]
  },
  {
    match: (hostname) => hostname.includes("lever.co"),
    selectors: [".posting-page", ".posting", ".main-content", ".section-wrapper"]
  },
  {
    match: (hostname) => hostname.includes("workable.com"),
    selectors: ["[data-ui='job-description']", ".job-description", ".content"]
  },
  {
    match: (hostname) => hostname.includes("wanted.co.kr"),
    selectors: ["main", "[class*='JobDescription']", "[class*='JobContent']", ".content"]
  },
  {
    match: (hostname) => hostname.includes("jobkorea.co.kr") || hostname.includes("saramin.co.kr"),
    selectors: ["#content", ".tplJobView", ".viewArea", "main"]
  },
  {
    match: (hostname) => hostname.includes("jumpit.saramin.co.kr") || hostname.includes("jumpit.co.kr"),
    selectors: ["main", "[class*='JobDescription']", "[class*='Position']", ".content"]
  }
];

const GENERIC_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  ".job-description",
  ".job-content",
  ".posting",
  ".description",
  ".content",
  "#content",
  "body"
];

type ExtractionSource = "embedded" | "html" | "browser" | "ocr";

interface ExtractedCandidate {
  title: string;
  siteName: string;
  text: string;
  source: ExtractionSource;
  score: number;
}

interface BrowserFallbackResult {
  candidate: ExtractedCandidate | null;
  imageOcr: ImageOcrAttemptResult;
  failure?: string;
}

interface ImageFetchHeaders {
  cookieHeader?: string;
  refererUrl?: string;
}

interface ImageOcrAttemptResult {
  candidate: ExtractedCandidate | null;
  detectedImageCount: number;
  ocrUnsupported: boolean;
}

interface CandidateWithImageOcrResult {
  candidate: ExtractedCandidate | null;
  imageOcr: ImageOcrAttemptResult;
}

const NO_IMAGE_OCR_ATTEMPT: ImageOcrAttemptResult = {
  candidate: null,
  detectedImageCount: 0,
  ocrUnsupported: false
};

const IMAGE_OCR_WARNING =
  "상세 본문 이미지가 감지돼 현재 실행 환경에서는 일부 내용이 누락될 수 있어요. macOS 로컬 실행에서 다시 시도하거나 공고 본문을 직접 붙여넣어 주세요.";

const IMAGE_OCR_ERROR_MESSAGE =
  "상세 본문 이미지가 감지됐지만 현재 실행 환경에서는 자동으로 읽지 못했어요.";

const IMAGE_OCR_ERROR_DETAILS =
  "macOS 로컬 실행에서 다시 시도하거나 공고 본문을 직접 붙여넣어 주세요.";

function splitSetCookieHeader(value: string): string[] {
  return value
    .split(/,(?=[^;,=\s]+=[^;,]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractCookieHeader(headers: Headers): string {
  const maybeGetSetCookie = (
    headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  const rawCookies =
    typeof maybeGetSetCookie === "function"
      ? maybeGetSetCookie.call(headers)
      : splitSetCookieHeader(headers.get("set-cookie") ?? "");

  return rawCookies
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function isSaraminRelayUrl(url: URL): boolean {
  return url.hostname.includes("saramin.co.kr") && url.pathname === "/zf_user/jobs/relay/view";
}

function isJobkoreaGiReadUrl(url: URL): boolean {
  return url.hostname.includes("jobkorea.co.kr") && /^\/Recruit\/GI_Read\/\d+/.test(url.pathname);
}

function isSaraminNotFoundHtml(html: string): boolean {
  return html.includes("요청하신 페이지를 찾을 수 없습니다.");
}

function createHtmlResponseCandidate(
  html: string,
  url: URL,
  selectors: string[],
  titleFallback: string,
  siteNameFallback: string,
  scoreBoost: number
): ExtractedCandidate | null {
  const $ = load(html);
  const title = normalizeLine(
    $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $(selectors.join(",")).first().find("h1, .title, .tit_job, .job-header__title").first().text() ||
      $("title").first().text() ||
      titleFallback
  );
  const siteName = normalizeLine(
    $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      siteNameFallback ||
      hostnameToLabel(url.hostname)
  );
  const text = normalizeBlock(
    selectors
      .map((selector) => $(selector).toArray().map((node) => $(node).text()).join("\n"))
      .join("\n")
  );

  if (!text) {
    return null;
  }

  return {
    title,
    siteName,
    text,
    source: "html",
    score: scoreTextQuality(text, title) + scoreBoost
  };
}

function mergeTextBlocks(...values: Array<string | null | undefined>): string {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = normalizeBlock(value);
    if (!normalized) {
      continue;
    }

    for (const line of normalized.split("\n")) {
      if (!line || seen.has(line)) {
        continue;
      }

      seen.add(line);
      merged.push(line);
    }
  }

  return merged.join("\n");
}

function mergeCandidates(
  primary: ExtractedCandidate | null | undefined,
  secondary: ExtractedCandidate | null | undefined,
  source: ExtractionSource,
  scoreBoost: number
): ExtractedCandidate | null {
  if (!primary && !secondary) {
    return null;
  }

  const title = primary?.title || secondary?.title || "";
  const siteName = primary?.siteName || secondary?.siteName || "";
  const text = mergeTextBlocks(primary?.text, secondary?.text);

  if (!text) {
    return null;
  }

  return {
    title,
    siteName,
    text,
    source,
    score:
      scoreTextQuality(text, title) +
      Math.max(primary?.score ?? 0, secondary?.score ?? 0) +
      scoreBoost
  };
}

function collectImageUrlsFromHtml(html: string, baseUrl: URL, selectors: string[]): URL[] {
  const $ = load(html);
  const seen = new Set<string>();
  const imageUrls: URL[] = [];
  const scope = selectors.length > 0 ? $(selectors.join(",")) : $("body");

  scope.find("img").each((_, node) => {
    if (imageUrls.length >= MAX_OCR_IMAGE_COUNT) {
      return;
    }

    const src =
      $(node).attr("src") ||
      $(node).attr("data-src") ||
      $(node).attr("data-original") ||
      $(node).attr("data-lazy-src");

    if (!src || src.startsWith("data:")) {
      return;
    }

    try {
      const resolved = assertAllowedUrl(new URL(src, baseUrl).toString());
      const key = resolved.toString();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      imageUrls.push(resolved);
    } catch {
      return;
    }
  });

  return imageUrls;
}

async function fetchOcrImage(
  imageUrl: URL,
  baseUrl: URL,
  { cookieHeader, refererUrl }: ImageFetchHeaders
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*;q=0.9,*/*;q=0.5",
        Referer: refererUrl || baseUrl.toString(),
        ...(cookieHeader && imageUrl.origin === baseUrl.origin ? { Cookie: cookieHeader } : {})
      },
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType && !contentType.startsWith("image/")) {
      return null;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
      return null;
    }

    return {
      buffer: imageBuffer,
      contentType,
      sourceUrl: imageUrl.toString()
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractImageOcrCandidateFromHtml(
  html: string,
  baseUrl: URL,
  selectors: string[],
  title: string,
  siteName: string,
  imageHeaders: ImageFetchHeaders,
  scoreBoost: number
): Promise<ImageOcrAttemptResult> {
  // HTML 본문이 약할 때만 이미지 OCR을 보조 후보로 붙인다.
  const imageUrls = collectImageUrlsFromHtml(html, baseUrl, selectors);
  if (imageUrls.length === 0) {
    return NO_IMAGE_OCR_ATTEMPT;
  }

  if (!isImageOcrAvailable()) {
    return {
      candidate: null,
      detectedImageCount: imageUrls.length,
      ocrUnsupported: true
    };
  }

  const images = (
    await Promise.all(imageUrls.map((imageUrl) => fetchOcrImage(imageUrl, baseUrl, imageHeaders)))
  ).filter((image): image is NonNullable<typeof image> => !!image);

  if (images.length === 0) {
    return {
      candidate: null,
      detectedImageCount: imageUrls.length,
      ocrUnsupported: false
    };
  }

  const ocrText = mergeTextBlocks(...(await extractTextFromImages(images)));
  if (!ocrText || ocrText.length < MIN_OCR_TEXT_LENGTH) {
    return {
      candidate: null,
      detectedImageCount: imageUrls.length,
      ocrUnsupported: false
    };
  }

  return {
    candidate: {
      title,
      siteName,
      text: ocrText,
      source: "ocr",
      score: scoreTextQuality(ocrText, title) + scoreBoost + images.length * 60
    },
    detectedImageCount: imageUrls.length,
    ocrUnsupported: false
  };
}

function buildImageOcrWarning(...results: ImageOcrAttemptResult[]): string | undefined {
  return results.some((result) => result.ocrUnsupported && result.detectedImageCount > 0)
    ? IMAGE_OCR_WARNING
    : undefined;
}

async function fetchSaraminRelayCandidate(
  pageUrl: URL,
  cookieHeader: string
): Promise<CandidateWithImageOcrResult> {
  // 사람인 relay는 요약 ajax 응답과 iframe 상세를 합쳐야 실제 공고 본문에 가깝다.
  const recIdx = pageUrl.searchParams.get("rec_idx")?.trim();
  if (!recIdx) {
    return {
      candidate: null,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const viewType = pageUrl.searchParams.get("view_type") || "avatar";
  const tRef = pageUrl.searchParams.get("t_ref") || "avatar";
  const tRefContent = pageUrl.searchParams.get("t_ref_content") || "";
  const tRefScnid = pageUrl.searchParams.get("t_ref_scnid") || "";
  const referNonce = pageUrl.searchParams.get("referNonce") || "";
  const refDp = pageUrl.searchParams.get("ref_dp") || tRefContent;
  const ajaxUrl = new URL("/zf_user/jobs/relay/view-ajax", pageUrl);

  const ajaxResponse = await fetch(ajaxUrl, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: `${pageUrl.protocol}//${pageUrl.host}`,
      Referer: pageUrl.toString(),
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    },
    body: new URLSearchParams({
      rec_idx: recIdx,
      rec_seq: "0",
      view_type: viewType,
      t_ref: tRef,
      t_ref_content: tRefContent,
      t_ref_scnid: tRefScnid,
      ref_dp: refDp,
      dpId: pageUrl.searchParams.get("dpId") || "",
      recommendRecIdx: pageUrl.searchParams.get("recommendRecIdx") || "",
      referNonce,
      trainingStudentCode: pageUrl.searchParams.get("trainingStudentCode") || ""
    })
  });

  if (!ajaxResponse.ok) {
    return {
      candidate: null,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const ajaxHtml = await ajaxResponse.text();
  if (!ajaxHtml.trim() || isSaraminNotFoundHtml(ajaxHtml)) {
    return {
      candidate: null,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const $ajax = load(ajaxHtml);
  const ajaxCandidate = createHtmlResponseCandidate(
    ajaxHtml,
    pageUrl,
    [".wrap_jv_header", ".jv_summary", ".jv_benefit", ".jv_location"],
    $ajax(".tit_job").first().text(),
    $ajax(".company").first().text(),
    880
  );

  const detailSrc = $ajax("iframe.iframe_content").attr("src");
  if (!detailSrc) {
    return {
      candidate: ajaxCandidate,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const detailUrl = new URL(detailSrc, pageUrl);
  const detailResponse = await fetch(detailUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: pageUrl.toString(),
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    }
  });

  if (!detailResponse.ok) {
    return {
      candidate: ajaxCandidate,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const detailHtml = await detailResponse.text();
  if (!detailHtml.trim() || isSaraminNotFoundHtml(detailHtml)) {
    return {
      candidate: ajaxCandidate,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const detailCandidate = createHtmlResponseCandidate(
    detailHtml,
    detailUrl,
    [".user_content", "main.job-posting", ".job-content"],
    ajaxCandidate?.title || "",
    ajaxCandidate?.siteName || "사람인",
    1160
  );
  const detailTitle = detailCandidate?.title || ajaxCandidate?.title || "";
  const detailSiteName = detailCandidate?.siteName || ajaxCandidate?.siteName || "사람인";

  if (isStrongCandidate(detailCandidate)) {
    return {
      candidate: pickBestCandidate([detailCandidate, ajaxCandidate]),
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const detailImageResult = await extractImageOcrCandidateFromHtml(
    detailHtml,
    detailUrl,
    [".user_content", "main.job-posting", ".job-content"],
    detailTitle,
    detailSiteName,
    {
      cookieHeader,
      refererUrl: pageUrl.toString()
    },
    1240
  );

  const mergedDetailCandidate = mergeCandidates(detailCandidate, detailImageResult.candidate, "ocr", 280);

  return {
    candidate: pickBestCandidate([
      mergedDetailCandidate,
      detailImageResult.candidate,
      detailCandidate,
      ajaxCandidate
    ]),
    imageOcr: detailImageResult
  };
}

function trimTextBetweenMarkers(
  text: string,
  {
    startMarker,
    endMarkers
  }: {
    startMarker?: string;
    endMarkers?: string[];
  }
) {
  let result = text;

  if (startMarker) {
    const startIndex = result.indexOf(startMarker);
    if (startIndex >= 0) {
      result = result.slice(startIndex);
    }
  }

  if (endMarkers && endMarkers.length > 0) {
    const endIndexes = endMarkers
      .map((marker) => result.indexOf(marker))
      .filter((index) => index >= 0);

    if (endIndexes.length > 0) {
      result = result.slice(0, Math.min(...endIndexes));
    }
  }

  return normalizeBlock(result);
}

function extractJobkoreaSummaryCandidate(pageHtml: string): ExtractedCandidate | null {
  const $ = load(pageHtml);
  const title = normalizeLine(
    $('meta[property="og:title"]').attr("content") ||
      $("title").first().text() ||
      $("main").first().find("h1").first().text()
  );
  const siteName = normalizeLine(
    $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      "잡코리아"
  );
  const mainText = normalizeBlock($("main").first().text());
  const summaryText = trimTextBetweenMarkers(mainText, {
    startMarker: mainText.includes("모집요강") ? "모집요강" : undefined,
    endMarkers: [
      "이 기업의 취업 전략",
      "로그인하고 비슷한 조건의 AI추천공고",
      "관련 태그",
      "본 채용정보는 잡코리아의 동의없이",
      "TOP",
      "궁금해요"
    ]
  });

  if (!summaryText) {
    return null;
  }

  return {
    title,
    siteName,
    text: summaryText,
    source: "html",
    score: scoreTextQuality(summaryText, title) + 980
  };
}

async function fetchJobkoreaGiReadCandidate(
  pageUrl: URL,
  pageHtml: string,
  cookieHeader: string
): Promise<CandidateWithImageOcrResult> {
  const jobId = pageUrl.pathname.match(/\/Recruit\/GI_Read\/(\d+)/)?.[1];
  if (!jobId) {
    return {
      candidate: null,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const summaryCandidate = extractJobkoreaSummaryCandidate(pageHtml);
  const detailUrl = new URL("/Recruit/GI_Read_Comt_Ifrm", pageUrl);

  for (const [key, value] of pageUrl.searchParams.entries()) {
    detailUrl.searchParams.set(key, value);
  }
  detailUrl.searchParams.set("Gno", jobId);

  const detailResponse = await fetch(detailUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: pageUrl.toString(),
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    }
  });

  if (!detailResponse.ok) {
    return {
      candidate: summaryCandidate,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const detailHtml = await detailResponse.text();
  if (!detailHtml.trim()) {
    return {
      candidate: summaryCandidate,
      imageOcr: NO_IMAGE_OCR_ATTEMPT
    };
  }

  const extractedDetail = extractTextFromHtml(detailHtml, detailUrl, "html");
  const detailText = trimTextBetweenMarkers(extractedDetail.text, {
    endMarkers: ["본 공고는 수시 채용으로 채용 완료 시 조기 마감될 수 있습니다."]
  });
  const detailCandidate =
    detailText.length > 0
      ? {
          title: summaryCandidate?.title || extractedDetail.title,
          siteName: summaryCandidate?.siteName || extractedDetail.siteName || "잡코리아",
          text: detailText,
          source: "html" as const,
          score: scoreTextQuality(detailText, summaryCandidate?.title || extractedDetail.title) + 1420
        }
      : null;

  const detailImageResult = isStrongCandidate(detailCandidate)
    ? NO_IMAGE_OCR_ATTEMPT
    : await extractImageOcrCandidateFromHtml(
        detailHtml,
        detailUrl,
        ["main", "body"],
        summaryCandidate?.title || extractedDetail.title,
        summaryCandidate?.siteName || extractedDetail.siteName || "잡코리아",
        {
          cookieHeader,
          refererUrl: pageUrl.toString()
        },
        1360
      );

  const mergedDetailCandidate = mergeCandidates(detailCandidate, detailImageResult.candidate, "ocr", 260);
  const mergedCandidate = mergeCandidates(mergedDetailCandidate, summaryCandidate, "html", 220);

  return {
    candidate: pickBestCandidate([
      mergedCandidate,
      mergedDetailCandidate,
      detailImageResult.candidate,
      detailCandidate,
      summaryCandidate
    ]),
    imageOcr: detailImageResult
  };
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split(".").map((item) => Number(item));
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function assertAllowedUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "URL 형식이 올바르지 않습니다.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(400, "http 또는 https 주소만 사용할 수 있어요.");
  }

  if (parsed.username || parsed.password) {
    throw new HttpError(400, "인증 정보가 포함된 URL은 사용할 수 없어요.");
  }

  const hostname = parsed.hostname.toLowerCase();
  // 서버가 내부망 자원을 읽는 SSRF 경로를 막기 위해 로컬/사설 주소는 차단한다.
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new HttpError(400, "내부 네트워크 주소는 불러올 수 없어요.");
  }

  const ipVersion = isIP(hostname);
  if ((ipVersion === 4 && isPrivateIpv4(hostname)) || (ipVersion === 6 && isPrivateIpv6(hostname))) {
    throw new HttpError(400, "내부 네트워크 주소는 불러올 수 없어요.");
  }

  return parsed;
}

function normalizeLine(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function normalizeTitleSegment(value: string): string {
  return normalizeLine(stripHtmlTags(value))
    .replace(/\b(hiring|recruiting)\b/gi, "")
    .replace(/\s*\(D-\d+\)\s*$/gi, "")
    .replace(/\s*채용\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBlock(value: string): string {
  const lines = stripHtmlTags(value)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 1);

  const deduped: string[] = [];
  for (const line of lines) {
    const previous = deduped[deduped.length - 1];
    if (line !== previous) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

function getSelectors(hostname: string): string[] {
  const matched = DOMAIN_SELECTORS.find((entry) => entry.match(hostname));
  return matched ? [...matched.selectors, ...GENERIC_SELECTORS] : GENERIC_SELECTORS;
}

function looksLikeJobTitle(value: string): boolean {
  const lowered = value.toLowerCase();

  return /engineer|developer|designer|manager|analyst|scientist|intern|backend|frontend|fullstack|mobile|data|ai|software|devops|qa|pm/.test(
    lowered
  ) || /개발자|개발|엔지니어|디자이너|매니저|분석가|인턴|백엔드|프론트엔드|풀스택|모바일|데이터|담당|사원|연구원/.test(value);
}

function hostnameToLabel(hostname: string): string {
  return hostname.replace(/^www\./, "").split(".").slice(0, 2).join(".");
}

function splitTitleSegments(title: string): string[] {
  return title
    .split(/\s*\|\s*|\s*·\s*|\s*–\s*|\s*:\s*|\s+-\s+/g)
    .map((segment) => normalizeTitleSegment(segment))
    .filter(Boolean);
}

function normalizeHintToken(value: string): string {
  return normalizeTitleSegment(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function isGenericSiteName(value: string, hostname: string): boolean {
  const normalized = normalizeHintToken(value);
  if (!normalized) {
    return false;
  }

  return new Set([
    normalizeHintToken(hostnameToLabel(hostname)),
    "사람인",
    "잡코리아",
    "원티드",
    "점핏",
    "saramin",
    "jobkorea",
    "wanted",
    "jumpit",
    "greenhouse",
    "lever",
    "workable"
  ]).has(normalized);
}

function extractCompanyPrefixFromSegment(segment: string): string {
  const normalized = normalizeTitleSegment(segment);
  const match = normalized.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!match) {
    return "";
  }

  const [, prefix, rest] = match;
  if (looksLikeJobTitle(prefix) || !looksLikeJobTitle(rest)) {
    return "";
  }

  return normalizeTitleSegment(prefix);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCompanyPrefixFromTitle(segment: string, companyCandidates: string[]): string {
  let cleaned = normalizeTitleSegment(segment);

  const normalizedCandidates = [...new Set(companyCandidates.map((candidate) => normalizeTitleSegment(candidate)).filter(Boolean))]
    .sort((left, right) => right.length - left.length);

  for (const candidate of normalizedCandidates) {
    const escaped = escapeRegExp(candidate);
    cleaned = cleaned
      .replace(new RegExp(`^\\[${escaped}\\]\\s*`, "i"), "")
      .replace(new RegExp(`^${escaped}\\s*채용\\s*[-:：]?\\s*`, "i"), "")
      .replace(new RegExp(`^${escaped}\\s*[-:：]\\s*`, "i"), "")
      .replace(new RegExp(`^${escaped}\\s+`, "i"), "")
      .trim();
  }

  return normalizeTitleSegment(cleaned);
}

function guessHints(title: string, siteName: string, hostname: string) {
  const normalizedTitle = normalizeTitleSegment(title);
  const normalizedSiteName = normalizeTitleSegment(siteName);
  const segments = splitTitleSegments(title);
  const companyFromBracket = segments.map((segment) => extractCompanyPrefixFromSegment(segment)).find(Boolean) || "";
  const companyFromSeparatedSegment =
    segments.find((segment, index) => {
      if (looksLikeJobTitle(segment) || isGenericSiteName(segment, hostname)) {
        return false;
      }

      return segments
        .slice(index + 1)
        .map((nextSegment) => stripCompanyPrefixFromTitle(nextSegment, [segment]))
        .some((nextSegment) => looksLikeJobTitle(nextSegment));
    }) || "";
  const companyNameHint =
    companyFromSeparatedSegment ||
    (isGenericSiteName(normalizedSiteName, hostname) ? "" : normalizedSiteName) ||
    companyFromBracket ||
    hostnameToLabel(hostname);
  const cleanedSegments = segments
    .map((segment) => stripCompanyPrefixFromTitle(segment, [companyNameHint]))
    .filter(Boolean);

  const jobTitleHint =
    cleanedSegments.find((segment) => looksLikeJobTitle(segment)) ||
    stripCompanyPrefixFromTitle(normalizedTitle, [companyNameHint]) ||
    "공고 포지션";

  return {
    jobTitleHint,
    companyNameHint
  };
}

function countJobSignals(text: string): number {
  const lowered = text.toLowerCase();
  return JOB_SIGNAL_KEYWORDS.reduce(
    (count, keyword) => count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  );
}

function scoreTextQuality(text: string, title: string): number {
  let score = Math.min(text.length, 7000);
  const signalCount = countJobSignals(text);

  // 길이만으로 고르지 않고 채용 공고다운 신호어와 제목 품질을 함께 반영한다.
  score += signalCount * 180;

  if (looksLikeJobTitle(title)) {
    score += 120;
  }

  if (text.length >= STRONG_TEXT_LENGTH) {
    score += 220;
  }

  if (text.length < MIN_TEXT_LENGTH) {
    score -= signalCount >= 2 ? 220 : 700;
  } else if (text.length < STRONG_TEXT_LENGTH && signalCount === 0) {
    score -= 260;
  }

  return score;
}

function isStrongCandidate(
  candidate: ExtractedCandidate | null | undefined
): candidate is ExtractedCandidate {
  if (!candidate) {
    return false;
  }

  return (
    candidate.text.length >= 320 ||
    (candidate.text.length >= STRONG_TEXT_LENGTH && countJobSignals(candidate.text) >= 1) ||
    (candidate.text.length >= 50 &&
      countJobSignals(candidate.text) >= 2 &&
      looksLikeJobTitle(candidate.title))
  );
}

function isUsableCandidate(
  candidate: ExtractedCandidate | null | undefined
): candidate is ExtractedCandidate {
  return !!candidate && (candidate.text.length >= MIN_TEXT_LENGTH || countJobSignals(candidate.text) >= 2);
}

function scoreCandidate(text: string, selector: string): number {
  const lowered = text.toLowerCase();
  let score = Math.min(text.length, 7000);

  for (const keyword of [
    "자격",
    "우대",
    "기술",
    "requirements",
    "preferred",
    "qualifications",
    "responsibilities",
    "job description"
  ]) {
    if (lowered.includes(keyword)) {
      score += 220;
    }
  }

  if (selector === "body") {
    score -= 400;
  }

  if (text.length < 200) {
    score -= 300;
  }

  return score;
}

function extractTextFromHtml(html: string, url: URL, source: ExtractionSource): ExtractedCandidate {
  const $ = load(html);
  $("script, style, noscript, svg, img, video, audio, canvas, header, footer, nav, aside, form, iframe").remove();

  const title = normalizeLine(
    $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").first().text()
  );
  const siteName = normalizeLine(
    $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      hostnameToLabel(url.hostname)
  );

  const selectors = getSelectors(url.hostname.toLowerCase());
  const candidates = selectors
    .flatMap((selector) =>
      $(selector)
        .toArray()
        .map((node) => {
          const text = normalizeBlock($(node).text());
          return {
            selector,
            text,
            score: scoreCandidate(text, selector)
          };
        })
    )
    .filter((entry) => entry.text.length > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const text = best?.text ?? "";

  return {
    title,
    siteName,
    text,
    source,
    score: scoreTextQuality(text, title) + (best?.score ?? 0) + (source === "browser" ? 160 : 0)
  };
}

function parseJsonString(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseEmbeddedScript(rawScript: string): unknown[] {
  const script = rawScript.trim();
  if (!script) {
    return [];
  }

  const roots: unknown[] = [];
  const direct = parseJsonString(script);
  if (direct !== null) {
    roots.push(direct);
  }

  for (const pattern of JSON_ASSIGNMENT_PATTERNS) {
    const match = script.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const parsed = parseJsonString(match[1]);
    if (parsed !== null) {
      roots.push(parsed);
    }
  }

  return roots;
}

function getPrimaryString(value: unknown): string {
  if (typeof value === "string") {
    return normalizeTitleSegment(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const next = getPrimaryString(item);
      if (next) {
        return next;
      }
    }
    return "";
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const object = value as Record<string, unknown>;
  return (
    getPrimaryString(object.name) ||
    getPrimaryString(object.title) ||
    getPrimaryString(object.value) ||
    getPrimaryString(object.label)
  );
}

function collectTextValues(value: unknown): string[] {
  if (typeof value === "string") {
    const text = normalizeBlock(value);
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextValues(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const object = value as Record<string, unknown>;
  const label = getPrimaryString(object);
  return label ? [label] : [];
}

function getFieldString(object: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (!(key in object)) {
      continue;
    }

    const value = getPrimaryString(object[key]);
    if (value) {
      return value;
    }
  }

  return "";
}

function collectFieldTexts(object: Record<string, unknown>, keys: string[]): string[] {
  const texts = keys.flatMap((key) => {
    if (!(key in object)) {
      return [];
    }

    return collectTextValues(object[key]);
  });

  return [...new Set(texts)].filter(Boolean);
}

function buildEmbeddedCandidate(object: Record<string, unknown>): ExtractedCandidate | null {
  const typeName = [
    getPrimaryString(object["@type"]),
    getPrimaryString(object.type),
    getPrimaryString(object.__typename)
  ]
    .join(" ")
    .toLowerCase();

  const title = getFieldString(object, TITLE_KEYS);
  const siteName = getFieldString(object, COMPANY_KEYS);
  const text = collectFieldTexts(object, BODY_KEYS).join("\n");

  if (!title && !text) {
    return null;
  }

  let score = scoreTextQuality(text, title);

  if (typeName.includes("jobposting")) {
    score += 520;
  }

  if (siteName) {
    score += 80;
  }

  if (title && looksLikeJobTitle(title)) {
    score += 120;
  }

  if (score < 180) {
    return null;
  }

  return {
    title,
    siteName,
    text,
    source: "embedded",
    score
  };
}

function collectEmbeddedCandidates(root: unknown): ExtractedCandidate[] {
  const candidates: ExtractedCandidate[] = [];
  const visited = new WeakSet<object>();
  let visitCount = 0;

  // 상태 객체를 넓게 훑되 순회 상한을 둬 큰 payload에서도 안전하게 멈춘다.
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 8 || visitCount > 4000) {
      return;
    }

    const target = value as object;
    if (visited.has(target)) {
      return;
    }

    visited.add(target);
    visitCount += 1;

    if (Array.isArray(value)) {
      for (const item of value.slice(0, 80)) {
        visit(item, depth + 1);
      }
      return;
    }

    const object = value as Record<string, unknown>;
    const candidate = buildEmbeddedCandidate(object);
    if (candidate) {
      candidates.push(candidate);
    }

    for (const nested of Object.values(object).slice(0, 80)) {
      visit(nested, depth + 1);
    }
  };

  visit(root, 0);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const signature = `${candidate.title}::${candidate.text.slice(0, 240)}`;
    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function pickBestCandidate(
  candidates: Array<ExtractedCandidate | null | undefined>
): ExtractedCandidate | null {
  return candidates
    .filter((candidate): candidate is ExtractedCandidate => !!candidate && candidate.text.length > 0)
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function extractEmbeddedCandidateFromHtml(html: string, url: URL): ExtractedCandidate | null {
  const $ = load(html);
  const siteNameFromMeta = normalizeLine(
    $('meta[property="og:site_name"]').attr("content") ||
      $('meta[name="application-name"]').attr("content") ||
      hostnameToLabel(url.hostname)
  );
  const titleFromMeta = normalizeLine(
    $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").first().text()
  );

  const roots: unknown[] = [];
  $("script").each((_, node) => {
    const type = ($(node).attr("type") || "").toLowerCase();
    const id = ($(node).attr("id") || "").toLowerCase();
    const scriptText = $(node).html() ?? $(node).text() ?? "";

    if (
      !scriptText.trim() ||
      (!type.includes("json") &&
        id !== "__next_data__" &&
        !scriptText.includes("JobPosting") &&
        !scriptText.includes("__NEXT_DATA__") &&
        !scriptText.includes("__INITIAL_STATE__"))
    ) {
      return;
    }

    roots.push(...parseEmbeddedScript(scriptText));
  });

  const best = pickBestCandidate(roots.flatMap((root) => collectEmbeddedCandidates(root)));
  if (!best) {
    return null;
  }

  return {
    ...best,
    title: best.title || titleFromMeta,
    siteName: best.siteName || siteNameFromMeta
  };
}

function extractEmbeddedCandidateFromResponses(
  payloads: string[],
  url: URL,
  fallbackSiteName: string
): ExtractedCandidate | null {
  const best = pickBestCandidate(
    payloads.flatMap((payload) =>
      parseEmbeddedScript(payload).flatMap((root) => collectEmbeddedCandidates(root))
    )
  );

  if (!best) {
    return null;
  }

  return {
    ...best,
    siteName: best.siteName || fallbackSiteName || hostnameToLabel(url.hostname),
    title: best.title || hostnameToLabel(url.hostname)
  };
}

function formatBrowserFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Executable doesn't exist")) {
      return "동적 공고를 읽으려면 브라우저 실행 환경이 필요해요.";
    }

    return error.message;
  }

  return "브라우저 렌더링으로 공고를 다시 읽지 못했어요.";
}

async function extractCandidateWithBrowser(url: URL): Promise<BrowserFallbackResult> {
  let browser: Awaited<ReturnType<(typeof import("playwright"))["chromium"]["launch"]>> | null = null;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage({
      userAgent: USER_AGENT,
      viewport: { width: 1440, height: 1200 }
    });

    const jsonPayloads: string[] = [];

    await page.route("**/*", async (route) => {
      const resourceType = route.request().resourceType();
      if (resourceType === "font" || resourceType === "media") {
        await route.abort();
        return;
      }

      await route.continue();
    });

    page.on("response", (response) => {
      if (jsonPayloads.length >= 16) {
        return;
      }

      const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
      if (!contentType.includes("json")) {
        return;
      }

      void response
        .text()
        .then((text) => {
          if (!text.trim() || text.length > MAX_BODY_LENGTH / 2) {
            return;
          }

          jsonPayloads.push(text);
        })
        .catch(() => {});
    });

    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: BROWSER_TIMEOUT_MS });
    await page.waitForTimeout(1200);
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});

    // SPA 공고는 렌더링된 DOM, 내부 JSON 응답, 이미지 OCR 후보를 함께 비교해 가장 강한 후보를 고른다.
    const resolvedUrl = new URL(page.url());
    const renderedHtml = await page.content();
    const htmlCandidate = extractTextFromHtml(renderedHtml, resolvedUrl, "browser");
    const browserTitle = htmlCandidate.title;
    const browserSiteName = htmlCandidate.siteName;
    const browserNeedsImageOcr = !isStrongCandidate(htmlCandidate);
    const embeddedCandidate = extractEmbeddedCandidateFromResponses(
      jsonPayloads,
      resolvedUrl,
      browserSiteName
    );
    const imageOcrResult = browserNeedsImageOcr
      ? await extractImageOcrCandidateFromHtml(
          renderedHtml,
          resolvedUrl,
          getSelectors(resolvedUrl.hostname.toLowerCase()),
          browserTitle,
          browserSiteName,
          {
            refererUrl: resolvedUrl.toString()
          },
          920
        )
      : NO_IMAGE_OCR_ATTEMPT;
    const mergedCandidate = mergeCandidates(htmlCandidate, imageOcrResult.candidate, "browser", 220);

    return {
      candidate: pickBestCandidate([embeddedCandidate, mergedCandidate, imageOcrResult.candidate, htmlCandidate]),
      imageOcr: imageOcrResult
    };
  } catch (error) {
    return {
      candidate: null,
      imageOcr: NO_IMAGE_OCR_ATTEMPT,
      failure: formatBrowserFailure(error)
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}

function toFetchedCompanyPage(
  candidate: ExtractedCandidate,
  resolvedUrl: string,
  hostname: string,
  warning?: string
) {
  const title = candidate.title || hostnameToLabel(hostname);
  const siteName = candidate.siteName || hostnameToLabel(hostname);
  const hints = guessHints(title, siteName, hostname);

  return {
    url: resolvedUrl,
    title,
    companyNameHint: hints.companyNameHint,
    jobTitleHint: hints.jobTitleHint,
    text: candidate.text,
    ...(warning ? { warning } : {})
  };
}

export interface FetchedCompanyPage {
  url: string;
  title: string;
  companyNameHint: string;
  jobTitleHint: string;
  text: string;
  warning?: string;
}

export async function fetchCompanyPage(rawUrl: string): Promise<FetchedCompanyPage> {
  const url = assertAllowedUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, text/plain;q=0.9, application/json;q=0.8, */*;q=0.7"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new HttpError(
        response.status,
        "공고 페이지를 불러오지 못했어요.",
        `${response.status} ${response.statusText}`
      );
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const body = await response.text();

    if (!body.trim()) {
      throw new HttpError(422, "페이지 내용이 비어 있어요.");
    }

    if (body.length > MAX_BODY_LENGTH) {
      throw new HttpError(413, "페이지 내용이 너무 길어 불러오지 못했어요.");
    }

    const resolvedUrl = response.url || url.toString();
    const resolved = new URL(resolvedUrl);
    const cookieHeader = extractCookieHeader(response.headers);

    // 특화 도메인 우선 처리 후, 임베디드 JSON/HTML/브라우저 fallback 순서로 후보를 좁힌다.
    if (contentType.includes("text/plain")) {
      const plainTitle = normalizeLine(url.hostname);
      const hints = guessHints(plainTitle, plainTitle, url.hostname);

      return {
        url: resolvedUrl,
        title: plainTitle,
        companyNameHint: hints.companyNameHint,
        jobTitleHint: hints.jobTitleHint,
        text: normalizeBlock(body)
      };
    }

    if (contentType.includes("json") && !contentType.includes("html")) {
      const embeddedCandidate = extractEmbeddedCandidateFromResponses(
        [body],
        resolved,
        hostnameToLabel(resolved.hostname)
      );

      if (!isUsableCandidate(embeddedCandidate)) {
        throw new HttpError(
          422,
          "자동으로 공고 본문을 충분히 읽지 못했어요.",
          "공고 내용을 직접 붙여넣거나 txt 파일로 넣어 주세요."
        );
      }

      return toFetchedCompanyPage(embeddedCandidate, resolvedUrl, resolved.hostname);
    }

    if (contentType && !contentType.includes("text/html") && !contentType.includes("json")) {
      throw new HttpError(
        415,
        "HTML 공고 페이지가 아니어서 자동으로 읽지 못했어요.",
        "공고 내용을 직접 붙여넣어 주세요."
      );
    }

    if (isSaraminRelayUrl(resolved)) {
      const saraminResult = await fetchSaraminRelayCandidate(resolved, cookieHeader);
      const saraminWarning = buildImageOcrWarning(saraminResult.imageOcr);

      if (isUsableCandidate(saraminResult.candidate)) {
        return toFetchedCompanyPage(saraminResult.candidate, resolvedUrl, resolved.hostname, saraminWarning);
      }

      if (saraminWarning) {
        throw new HttpError(422, IMAGE_OCR_ERROR_MESSAGE, IMAGE_OCR_ERROR_DETAILS);
      }
    }

    if (isJobkoreaGiReadUrl(resolved)) {
      const jobkoreaResult = await fetchJobkoreaGiReadCandidate(resolved, body, cookieHeader);
      const jobkoreaWarning = buildImageOcrWarning(jobkoreaResult.imageOcr);

      if (isUsableCandidate(jobkoreaResult.candidate)) {
        return toFetchedCompanyPage(
          jobkoreaResult.candidate,
          resolvedUrl,
          resolved.hostname,
          jobkoreaWarning
        );
      }

      if (jobkoreaWarning) {
        throw new HttpError(422, IMAGE_OCR_ERROR_MESSAGE, IMAGE_OCR_ERROR_DETAILS);
      }
    }

    const embeddedCandidate = extractEmbeddedCandidateFromHtml(body, resolved);
    const htmlCandidate = extractTextFromHtml(body, resolved, "html");
    const staticTitle = htmlCandidate.title;
    const staticSiteName = htmlCandidate.siteName;
    const staticNeedsImageOcr = !isStrongCandidate(htmlCandidate);
    const staticImageResult = staticNeedsImageOcr
      ? await extractImageOcrCandidateFromHtml(
          body,
          resolved,
          getSelectors(resolved.hostname.toLowerCase()),
          staticTitle,
          staticSiteName,
          {
            cookieHeader,
            refererUrl: resolvedUrl
          },
          760
        )
      : NO_IMAGE_OCR_ATTEMPT;
    const staticMergedCandidate = mergeCandidates(htmlCandidate, staticImageResult.candidate, "html", 180);
    const staticBest = pickBestCandidate([
      embeddedCandidate,
      staticMergedCandidate,
      staticImageResult.candidate,
      htmlCandidate
    ]);
    const staticWarning = buildImageOcrWarning(staticImageResult);

    if (isStrongCandidate(staticBest)) {
      return toFetchedCompanyPage(staticBest, resolvedUrl, resolved.hostname, staticWarning);
    }

    const browserResult = await extractCandidateWithBrowser(resolved);
    const best = pickBestCandidate([browserResult.candidate, staticBest]);
    const warning = buildImageOcrWarning(staticImageResult, browserResult.imageOcr);

    if (!isUsableCandidate(best)) {
      if (warning) {
        throw new HttpError(422, IMAGE_OCR_ERROR_MESSAGE, IMAGE_OCR_ERROR_DETAILS);
      }

      throw new HttpError(
        422,
        "자동으로 공고 본문을 충분히 읽지 못했어요.",
        browserResult.failure || "공고 내용을 직접 붙여넣거나 txt 파일로 넣어 주세요."
      );
    }

    return toFetchedCompanyPage(best, resolvedUrl, resolved.hostname, warning);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "공고 페이지를 읽는 시간이 너무 오래 걸렸어요.");
    }

    throw new HttpError(
      502,
      "공고 페이지를 불러오는 중 문제가 생겼어요.",
      error instanceof Error ? error.message : undefined
    );
  } finally {
    clearTimeout(timeout);
  }
}
