import { isIP } from "node:net";

import { load } from "cheerio";
import { chromium } from "playwright";

import { HttpError } from "@/lib/http";

const FETCH_TIMEOUT_MS = 10000;
const BROWSER_TIMEOUT_MS = 12000;
const MAX_BODY_LENGTH = 2_000_000;
const MIN_TEXT_LENGTH = 120;
const STRONG_TEXT_LENGTH = 260;
const NOTION_API_BASE = "https://www.notion.so/api/v3";
const USER_AGENT =
  "Mozilla/5.0 (compatible; ResumeTailorBot/1.0; +https://localhost/resume-tailor)";

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

const RESUME_SIGNAL_KEYWORDS = [
  "experience",
  "projects",
  "project",
  "skills",
  "tech stack",
  "tech",
  "portfolio",
  "summary",
  "achievement",
  "achievements",
  "profile",
  "frontend",
  "backend",
  "fullstack",
  "product engineer",
  "developer",
  "engineer",
  "경력",
  "프로젝트",
  "기술",
  "기술 스택",
  "포트폴리오",
  "이력서",
  "요약",
  "성과",
  "강점",
  "프론트엔드",
  "백엔드",
  "풀스택",
  "개발자",
  "엔지니어"
];

const PROFILE_NOISE_KEYWORDS = [
  "portfolio",
  "resume",
  "profile",
  "blog",
  "notion",
  "github",
  "velog",
  "tistory",
  "브로그",
  "블로그",
  "포트폴리오",
  "이력서",
  "노션",
  "깃허브"
];

const RESUME_NOISE_LINE_PATTERNS = [
  /^콘텐츠로 건너뛰기$/i,
  /^가입 또는 로그인하기$/i,
  /^거의 다 됐습니다\./i
];

const GENERIC_SITE_NAMES = new Set([
  "github",
  "githubio",
  "notion",
  "notionsite",
  "velog",
  "tistory",
  "medium",
  "brunch",
  "blog"
]);

const ROLE_PATTERN =
  /frontend|backend|fullstack|full-stack|software|product|web|mobile|ios|android|data|ai|ml|devops|platform|engineer|developer|designer|manager|pm|qa|sre|researcher|analyst|프론트엔드|백엔드|풀스택|웹|모바일|개발자|엔지니어|디자이너|매니저|기획|데이터|플랫폼|프로덕트/i;

const DOMAIN_SELECTORS: Array<{
  match: (hostname: string) => boolean;
  selectors: string[];
}> = [
  {
    match: (hostname) => hostname.includes("notion.site") || hostname.includes("notion.so"),
    selectors: ["main", "[role='main']", ".notion-page-content", ".super-content", "article"]
  },
  {
    match: (hostname) => hostname.includes("github.io"),
    selectors: ["main", "article", ".markdown-body", ".container", ".Layout-main"]
  },
  {
    match: (hostname) => hostname.includes("velog.io") || hostname.includes("medium.com"),
    selectors: ["main", "article", "[data-testid='storyContent']", ".atom-one"]
  },
  {
    match: (hostname) => hostname.includes("tistory.com") || hostname.includes("brunch.co.kr"),
    selectors: ["main", "article", ".tt_article_useless_p_margin", ".wrap_body", ".wrap_view_article"]
  }
];

const GENERIC_SELECTORS = [
  "main",
  "article",
  "[role='main']",
  ".markdown-body",
  ".post-content",
  ".entry-content",
  ".content",
  "body"
];

type ExtractionSource = "html" | "browser";

interface ExtractedResumeCandidate {
  title: string;
  siteName: string;
  text: string;
  primaryHeading: string;
  secondaryHeading: string;
  source: ExtractionSource;
  score: number;
}

export interface FetchedResumePage {
  url: string;
  title: string;
  nameHint: string;
  desiredPositionHint: string;
  text: string;
}

interface NotionCursor {
  stack?: unknown;
  cellId?: string;
}

interface NotionBlockValue {
  id?: string;
  type?: string;
  properties?: {
    title?: unknown;
  };
  content?: string[];
}

interface NotionBlockEntry {
  value?: NotionBlockValue;
}

interface NotionPageMetaResponse {
  pageId?: string;
  spaceName?: string;
  requireLogin?: boolean;
}

interface NotionChunkResponse {
  cursors?: NotionCursor[];
  recordMap?: {
    block?: Record<string, NotionBlockEntry>;
  };
}

function isPrivateIpv4(value: string): boolean {
  if (value.startsWith("10.") || value.startsWith("127.") || value.startsWith("169.254.")) {
    return true;
  }

  if (value.startsWith("192.168.")) {
    return true;
  }

  const [first, second] = value.split(".").map((part) => Number(part));
  return first === 172 && second >= 16 && second <= 31;
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

function normalizeBlock(value: string): string {
  const lines = stripHtmlTags(value)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 1)
    .filter((line) => !RESUME_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line)));

  const deduped: string[] = [];
  for (const line of lines) {
    const previous = deduped[deduped.length - 1];
    if (line !== previous) {
      deduped.push(line);
    }
  }

  return deduped.join("\n");
}

function isNotionHostname(hostname: string) {
  return hostname.includes("notion.so") || hostname.includes("notion.site");
}

function normalizeTitleSegment(value: string): string {
  return normalizeLine(stripHtmlTags(value))
    .replace(/\b(portfolio|resume|profile|blog)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hostnameToLabel(hostname: string): string {
  return hostname.replace(/^www\./, "").split(".").slice(0, 2).join(".");
}

function normalizeHintToken(value: string): string {
  return normalizeTitleSegment(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function normalizeNotionPageId(value: string) {
  const compact = value.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    return "";
  }

  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

function extractNotionPageId(pathname: string) {
  const match = pathname.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match ? normalizeNotionPageId(match[1]) : "";
}

function splitTitleSegments(title: string): string[] {
  return title
    .split(/\s*\|\s*|\s*·\s*|\s*–\s*|\s*:\s*|\s+-\s+/g)
    .map((segment) => normalizeTitleSegment(segment))
    .filter(Boolean);
}

function flattenNotionTitle(title: unknown): string {
  if (!Array.isArray(title)) {
    return "";
  }

  return title
    .map((item) => (Array.isArray(item) ? String(item[0] ?? "") : ""))
    .join("");
}

function stripProfileNoise(value: string): string {
  let cleaned = normalizeTitleSegment(value);

  for (const keyword of PROFILE_NOISE_KEYWORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${keyword}\\b`, "gi"), "").trim();
  }

  cleaned = cleaned
    .replace(/\s*님의?\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

function looksLikeDesiredPosition(value: string): boolean {
  const cleaned = stripProfileNoise(value);
  if (!cleaned || cleaned.length > 60) {
    return false;
  }

  if (/[.!?。！？]$/.test(cleaned)) {
    return false;
  }

  if (/입니다$|했습니다$|합니다$|싶습니다$|해왔습니다$|중입니다$/.test(cleaned)) {
    return false;
  }

  return ROLE_PATTERN.test(cleaned);
}

function looksLikeName(value: string): boolean {
  const cleaned = stripProfileNoise(value);
  if (!cleaned || cleaned.length > 40 || cleaned.length < 2) {
    return false;
  }

  if (looksLikeDesiredPosition(cleaned) || /\d/.test(cleaned)) {
    return false;
  }

  if (cleaned.includes("@") || cleaned.includes("/") || cleaned.includes("http")) {
    return false;
  }

  if (/^[가-힣]{2,5}$/.test(cleaned)) {
    return true;
  }

  return /^[A-Za-z]+(?: [A-Za-z]+){0,2}$/.test(cleaned);
}

function getSelectors(hostname: string): string[] {
  const matched = DOMAIN_SELECTORS.find((entry) => entry.match(hostname));
  return matched ? [...matched.selectors, ...GENERIC_SELECTORS] : GENERIC_SELECTORS;
}

function countResumeSignals(text: string): number {
  const lowered = text.toLowerCase();
  return RESUME_SIGNAL_KEYWORDS.reduce(
    (count, keyword) => count + (lowered.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  );
}

function scoreTextQuality(text: string, title: string, primaryHeading: string): number {
  let score = Math.min(text.length, 8000);
  const signalCount = countResumeSignals(text);

  score += signalCount * 120;

  if (looksLikeDesiredPosition(title) || looksLikeDesiredPosition(primaryHeading)) {
    score += 160;
  }

  if (looksLikeName(primaryHeading)) {
    score += 120;
  }

  if (text.length >= STRONG_TEXT_LENGTH) {
    score += 220;
  }

  if (text.length < MIN_TEXT_LENGTH) {
    score -= signalCount >= 2 ? 160 : 700;
  }

  return score;
}

function scoreCandidate(text: string, selector: string, primaryHeading: string): number {
  let score = Math.min(text.length, 7000);

  score += countResumeSignals(text) * 100;

  if (looksLikeName(primaryHeading) || looksLikeDesiredPosition(primaryHeading)) {
    score += 140;
  }

  if (selector === "body") {
    score -= 420;
  }

  if (text.length < 200) {
    score -= 280;
  }

  return score;
}

function extractTextFromHtml(html: string, url: URL, source: ExtractionSource): ExtractedResumeCandidate {
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
          const root = $(node);
          const text = normalizeBlock(root.text());
          const primaryHeading = normalizeTitleSegment(
            root.find("h1").first().text() || $("h1").first().text()
          );
          const secondaryHeading = normalizeTitleSegment(
            root.find("h2, h3, .subtitle, .tagline").first().text() || $("h2, h3").first().text()
          );

          return {
            selector,
            text,
            primaryHeading,
            secondaryHeading,
            score: scoreCandidate(text, selector, primaryHeading)
          };
        })
    )
    .filter((entry) => entry.text.length > 0)
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const text = best?.text ?? normalizeBlock($("body").text());
  const primaryHeading = best?.primaryHeading ?? normalizeTitleSegment($("h1").first().text());
  const secondaryHeading =
    best?.secondaryHeading ?? normalizeTitleSegment($("h2, h3, .subtitle, .tagline").first().text());

  return {
    title,
    siteName,
    text,
    primaryHeading,
    secondaryHeading,
    source,
    score:
      scoreTextQuality(text, title, primaryHeading) +
      (best?.score ?? 0) +
      (source === "browser" ? 140 : 0)
  };
}

function isUsableCandidate(
  candidate: ExtractedResumeCandidate | null | undefined
): candidate is ExtractedResumeCandidate {
  if (!candidate) {
    return false;
  }

  return candidate.text.length >= MIN_TEXT_LENGTH || countResumeSignals(candidate.text) >= 2;
}

async function fetchBrowserCandidate(url: string): Promise<ExtractedResumeCandidate | null> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({
      headless: true
    });

    const page = await browser.newPage({
      userAgent: USER_AGENT
    });

    await page.route("**/*", (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      if (["image", "media", "font"].includes(resourceType)) {
        return route.abort();
      }

      return route.continue();
    });

    page.on("dialog", (dialog) => void dialog.dismiss());
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS
    });

    await page.waitForLoadState("networkidle", {
      timeout: 2500
    }).catch(() => {});
    await page.waitForTimeout(700);

    const renderedHtml = await page.content();
    const finalUrl = page.url();
    const resolvedUrl = assertAllowedUrl(finalUrl);

    return extractTextFromHtml(renderedHtml, resolvedUrl, "browser");
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

function shouldTryBrowserFallback(hostname: string, htmlCandidate: ExtractedResumeCandidate) {
  return !isUsableCandidate(htmlCandidate);
}

function pickBetterCandidate(
  htmlCandidate: ExtractedResumeCandidate,
  browserCandidate: ExtractedResumeCandidate | null
) {
  if (!browserCandidate) {
    return htmlCandidate;
  }

  return browserCandidate.score > htmlCandidate.score ? browserCandidate : htmlCandidate;
}

function takeFirstMatch(values: string[], predicate: (value: string) => boolean): string {
  return values.find((value) => predicate(value)) ?? "";
}

function guessResumeHints(candidate: ExtractedResumeCandidate, hostname: string) {
  const titleSegments = splitTitleSegments(candidate.title);
  const primaryHeadingSegments = splitTitleSegments(candidate.primaryHeading);
  const textLines = candidate.text
    .split("\n")
    .map((line) => normalizeTitleSegment(line))
    .filter(Boolean)
    .slice(0, 10);
  const siteToken = normalizeHintToken(candidate.siteName);
  const siteIsGeneric =
    !siteToken ||
    GENERIC_SITE_NAMES.has(siteToken) ||
    siteToken === normalizeHintToken(hostnameToLabel(hostname));

  const nameCandidates = [
    ...primaryHeadingSegments,
    candidate.primaryHeading,
    ...titleSegments,
    ...textLines,
    ...(siteIsGeneric ? [] : [candidate.siteName])
  ].map((value) => stripProfileNoise(value));
  const desiredPositionCandidates = [
    candidate.secondaryHeading,
    ...primaryHeadingSegments,
    ...titleSegments,
    ...textLines,
    candidate.primaryHeading
  ].map((value) => stripProfileNoise(value));

  const nameHint = takeFirstMatch(nameCandidates, looksLikeName);
  const desiredPositionHint = takeFirstMatch(desiredPositionCandidates, looksLikeDesiredPosition);

  return {
    nameHint,
    desiredPositionHint: desiredPositionHint || "확인 필요"
  };
}

function toFetchedResumePage(candidate: ExtractedResumeCandidate, resolvedUrl: string, hostname: string) {
  const title = candidate.title || candidate.primaryHeading || hostnameToLabel(hostname);
  const hints = guessResumeHints(candidate, hostname);

  return {
    url: resolvedUrl,
    title,
    nameHint: hints.nameHint,
    desiredPositionHint: hints.desiredPositionHint,
    text: candidate.text
  } satisfies FetchedResumePage;
}

async function fetchNotionPageMeta(pageId: string): Promise<NotionPageMetaResponse> {
  const response = await fetch(`${NOTION_API_BASE}/getPublicPageData`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    },
    body: JSON.stringify({
      type: "block-space",
      name: "page",
      blockId: pageId,
      requestedOnPublicDomain: false,
      showMoveTo: false,
      saveParent: false,
      shouldDuplicate: false,
      projectManagementLaunch: false,
      configureOpenInDesktopApp: false,
      mobileData: {
        isPush: false
      },
      demoWorkspaceMode: false
    })
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      "노션 페이지 정보를 읽지 못했어요.",
      `${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as NotionPageMetaResponse;
}

async function loadNotionChunk(pageId: string, cursor: NotionCursor | null) {
  const response = await fetch(`${NOTION_API_BASE}/loadCachedPageChunkV2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    },
    body: JSON.stringify({
      page: {
        id: pageId
      },
      cursor: cursor ?? {
        stack: []
      },
      verticalColumns: false
    })
  });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      "노션 페이지 본문을 읽지 못했어요.",
      `${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as NotionChunkResponse;
}

function collectNotionTextLines(
  blockId: string,
  blocks: Record<string, NotionBlockEntry>,
  lines: string[],
  visited: Set<string>
) {
  if (visited.has(blockId)) {
    return;
  }

  visited.add(blockId);
  const block = blocks[blockId]?.value;
  if (!block) {
    return;
  }

  const type = block.type ?? "";
  const title = normalizeBlock(flattenNotionTitle(block.properties?.title));

  if (
    title &&
    !["page", "divider", "column", "column_list", "image", "file", "video", "audio", "pdf"].includes(type) &&
    !RESUME_NOISE_LINE_PATTERNS.some((pattern) => pattern.test(title))
  ) {
    lines.push(title);
  }

  for (const childId of block.content ?? []) {
    collectNotionTextLines(childId, blocks, lines, visited);
  }
}

async function fetchResumeFromNotion(url: URL): Promise<FetchedResumePage | null> {
  const pageId = extractNotionPageId(url.pathname);
  if (!pageId) {
    return null;
  }

  const pageMeta = await fetchNotionPageMeta(pageId);
  if (pageMeta.requireLogin) {
    throw new HttpError(403, "로그인이 필요한 노션 페이지는 읽을 수 없어요.");
  }

  const blocks: Record<string, NotionBlockEntry> = {};
  let cursor: NotionCursor | null = null;

  while (true) {
    const chunk = await loadNotionChunk(pageId, cursor);
    Object.assign(blocks, chunk.recordMap?.block ?? {});

    const nextCursor = Array.isArray(chunk.cursors) && chunk.cursors.length > 0 ? chunk.cursors[0] : null;
    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  const pageBlock = blocks[pageId]?.value;
  const title = normalizeTitleSegment(flattenNotionTitle(pageBlock?.properties?.title) || pageMeta.spaceName || "");
  const lines: string[] = [];
  const visited = new Set<string>();

  for (const childId of pageBlock?.content ?? []) {
    collectNotionTextLines(childId, blocks, lines, visited);
  }

  const text = normalizeBlock(lines.join("\n"));
  if (text.length < MIN_TEXT_LENGTH) {
    return null;
  }

  const candidate: ExtractedResumeCandidate = {
    title,
    siteName: normalizeTitleSegment(pageMeta.spaceName ?? hostnameToLabel(url.hostname)),
    text,
    primaryHeading: title,
    secondaryHeading: lines[0] ?? "",
    source: "html",
    score: scoreTextQuality(text, title, title) + 400
  };

  return toFetchedResumePage(candidate, url.toString(), url.hostname.toLowerCase());
}

export async function fetchResumePage(rawUrl: string): Promise<FetchedResumePage> {
  const url = assertAllowedUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    if (isNotionHostname(url.hostname.toLowerCase())) {
      const notionResult = await fetchResumeFromNotion(url);
      if (notionResult) {
        return notionResult;
      }
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, text/plain;q=0.9, text/markdown;q=0.9, */*;q=0.6"
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new HttpError(
        response.status,
        "이력서 페이지를 불러오지 못했어요.",
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
    const resolved = assertAllowedUrl(resolvedUrl);

    if (
      contentType.includes("text/plain") ||
      contentType.includes("text/markdown") ||
      contentType.includes("application/octet-stream")
    ) {
      const text = normalizeBlock(body);
      if (text.length < MIN_TEXT_LENGTH) {
        throw new HttpError(422, "이력서 본문이 너무 짧아 불러오지 못했어요.");
      }

      const hostname = resolved.hostname.toLowerCase();
      const title = hostnameToLabel(hostname);
      const candidate: ExtractedResumeCandidate = {
        title,
        siteName: title,
        text,
        primaryHeading: "",
        secondaryHeading: "",
        source: "html",
        score: scoreTextQuality(text, title, "")
      };

      return toFetchedResumePage(candidate, resolvedUrl, hostname);
    }

    const htmlCandidate = extractTextFromHtml(body, resolved, "html");
    const browserCandidate = shouldTryBrowserFallback(resolved.hostname.toLowerCase(), htmlCandidate)
      ? await fetchBrowserCandidate(resolvedUrl)
      : null;
    const candidate = pickBetterCandidate(htmlCandidate, browserCandidate);

    if (!isUsableCandidate(candidate)) {
      throw new HttpError(422, "이력서 본문을 충분히 읽지 못했어요.");
    }

    return toFetchedResumePage(candidate, resolvedUrl, resolved.hostname.toLowerCase());
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(504, "이력서 페이지를 읽는 시간이 너무 오래 걸렸어요.");
    }

    throw new HttpError(502, "이력서 페이지를 읽는 중 문제가 생겼어요.");
  } finally {
    clearTimeout(timeout);
  }
}
