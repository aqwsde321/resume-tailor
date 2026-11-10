import { load } from "cheerio";
import { NextResponse } from "next/server";

import {
  JobSearchRequestSchema,
  rankJobListings,
  resolveJobSearchQuery,
  type JobListing,
  type JobProvider
} from "@/features/jobs/model/job-search";
import { apiErrorResponse, parseJsonBody } from "@/server/http";

export const runtime = "nodejs";

const PROVIDER_LABEL: Record<JobProvider, string> = {
  saramin: "사람인",
  ionejob: "i-ONE JOB"
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    const record = asRecord(value);
    return readText(record.name ?? record["#text"] ?? record.value);
  }

  return "";
}

function readOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseExperienceYears(label: string): { min: number | null; max: number | null } {
  if (!label || /신입|경력무관|무관/.test(label)) {
    return { min: /신입/.test(label) ? 0 : null, max: null };
  }

  const range = label.match(/(\d+)\s*[-~]\s*(\d+)\s*년/);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }

  const minimum = label.match(/(\d+)\s*년\s*(?:이상|↑|이상부터)/);
  if (minimum) {
    return { min: Number(minimum[1]), max: null };
  }

  const single = label.match(/(\d+)\s*년/);
  return single ? { min: Number(single[1]), max: Number(single[1]) } : { min: null, max: null };
}

function timestampDate(value: unknown): string {
  const raw = readText(value);
  if (!raw) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return raw;
  }

  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function normalizeExternalUrl(value: string, source: JobProvider): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const allowedDomain = source === "saramin" ? "saramin.co.kr" : "ibkonejob.co.kr";
    const isAllowedHost = hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);

    return ["http:", "https:"].includes(url.protocol) && isAllowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeSaraminJob(value: unknown): JobListing | null {
  const job = asRecord(value);
  const position = asRecord(job.position);
  const experience = asRecord(position["experience-level"]);
  const id = readText(job.id);
  const title = readText(position.title);
  const company = asRecord(job.company);
  const companyDetail = asRecord(company.detail);
  const companyName = readText(companyDetail.name ?? company.name);
  const url = normalizeExternalUrl(readText(job.url), "saramin");
  const activeValue = readText(job.active);
  const active = !activeValue || ["1", "true"].includes(activeValue.toLowerCase());

  if (!id || !title || !companyName || !url || !active) {
    return null;
  }

  const careerLabel = readText(experience.name ?? experience) || readText(position["experience-level"]);
  const parsedCareer = parseExperienceYears(careerLabel);
  const experienceMin = readOptionalNumber(experience.min);
  const experienceMax = readOptionalNumber(experience.max);
  const keywords = readText(job.keyword)
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);

  return {
    id: `saramin-${id}`,
    source: "saramin",
    title,
    companyName,
    url,
    keywords,
    location: readText(asRecord(position.location).name ?? position.location),
    employmentType: readText(position["job-type"]),
    careerLabel,
    careerMinYears: experienceMin ?? parsedCareer.min,
    careerMaxYears: experienceMax && experienceMax > 0 ? experienceMax : parsedCareer.max,
    salary: readText(job.salary),
    deadline: timestampDate(job["expiration-date"] ?? job["expiration-timestamp"]),
    postedAt: timestampDate(job["posting-date"] ?? job["posting-timestamp"]),
    active: true
  };
}

async function searchSaramin(query: string, accessKey: string): Promise<JobListing[]> {
  const url = new URL("https://oapi.saramin.co.kr/job-search");
  url.searchParams.set("access-key", accessKey);
  url.searchParams.set("keywords", query);
  url.searchParams.set("sort", "pd");
  url.searchParams.set("start", "0");
  url.searchParams.set("count", "50");
  url.searchParams.set("fields", "posting-date,expiration-date");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error("saramin-request-failed");
  }

  const payload = asRecord(await response.json());
  const apiError = asRecord(payload.result);
  if (readText(apiError.code)) {
    throw new Error("saramin-api-error");
  }

  const jobs = asRecord(payload.jobs).job;
  const jobList = Array.isArray(jobs) ? jobs : jobs ? [jobs] : [];
  return jobList.map(normalizeSaraminJob).filter((job): job is JobListing => Boolean(job));
}

function calendarDate(value: string): string {
  const raw = value.trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw;
}

function normalizeIoneJob(readValue: (tag: string) => string): JobListing | null {
  const value = readValue;
  const id = value("hireSn");
  const title = value("hireTitle");
  const companyName = value("cmpNm");
  const url = normalizeExternalUrl(value("jobUrl") || value("jobMobileUrl"), "ionejob");
  const careerLabel = value("jobCareerinfo");
  const career = parseExperienceYears(careerLabel);
  const careerMin = readOptionalNumber(value("jobCrrAbv"));
  const careerMax = readOptionalNumber(value("jobCrrBlw"));
  const keywords = value("jobCategory")
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (!id || !title || !companyName || !url) {
    return null;
  }

  return {
    id: `ionejob-${id}`,
    source: "ionejob",
    title,
    companyName,
    url,
    keywords,
    location: value("jobLocation"),
    employmentType: value("jobTypecond"),
    careerLabel,
    careerMinYears: careerMin ?? career.min,
    careerMaxYears: careerMax !== null ? (careerMax > 0 ? careerMax : null) : career.max,
    salary: value("jobSalary"),
    deadline: calendarDate(value("hireRcvEndYmd")),
    postedAt: calendarDate(value("regYmd")),
    active: true
  };
}

async function searchIoneJob(accessKey: string): Promise<JobListing[]> {
  const url = new URL("https://www.ibkonejob.co.kr/common/api/ionejobSearch.do");
  url.searchParams.set("authKey", accessKey);
  url.searchParams.set("nowPage", "1");
  url.searchParams.set("numPerPage", "100");
  url.searchParams.set("sortOrderBy", "DESC");

  const response = await fetch(url, {
    headers: { Accept: "application/xml, text/xml" },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error("ionejob-request-failed");
  }

  const $ = load(await response.text(), { xmlMode: true });
  return $("job-search > jobs")
    .toArray()
    .map((node) => normalizeIoneJob((tag) => $(node).children(tag).first().text().trim()))
    .filter((job): job is JobListing => Boolean(job));
}

function getProviderConfiguration() {
  return [
    { source: "saramin" as const, configured: Boolean(process.env.SARAMIN_ACCESS_KEY?.trim()) },
    { source: "ionejob" as const, configured: Boolean(process.env.IBK_ONEJOB_ACCESS_KEY?.trim()) }
  ];
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      providers: getProviderConfiguration()
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, JobSearchRequestSchema);
    const query = resolveJobSearchQuery(body.resume, body.query);
    const sourceResults = await Promise.all(
      body.sources.map(async (source) => {
        const accessKey =
          source === "saramin"
            ? process.env.SARAMIN_ACCESS_KEY?.trim()
            : process.env.IBK_ONEJOB_ACCESS_KEY?.trim();

        if (!accessKey) {
          return {
            source,
            status: { source, state: "needs_key" as const, resultCount: 0 },
            listings: [] as JobListing[]
          };
        }

        try {
          const listings =
            source === "saramin"
              ? await searchSaramin(query, accessKey)
              : await searchIoneJob(accessKey);
          return {
            source,
            status: { source, state: "success" as const, resultCount: listings.length },
            listings
          };
        } catch {
          return {
            source,
            status: {
              source,
              state: "failed" as const,
              resultCount: 0,
              message: `${PROVIDER_LABEL[source]} 공고를 가져오지 못했어요. API 키와 이용 상태를 확인해 주세요.`
            },
            listings: [] as JobListing[]
          };
        }
      })
    );

    return NextResponse.json({
      ok: true,
      data: {
        results: rankJobListings(body.resume, sourceResults.flatMap((result) => result.listings)),
        providers: sourceResults.map((result) => result.status)
      }
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
