import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/jobs/search/route";
import { createPdfResumeFixture } from "../fixtures/pdf-fixture";

const resume = createPdfResumeFixture();

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("/api/jobs/search", () => {
  beforeEach(() => {
    vi.stubEnv("SARAMIN_ACCESS_KEY", "");
    vi.stubEnv("WORK24_OPEN_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports which official search providers have server-side keys without exposing them", async () => {
    vi.stubEnv("SARAMIN_ACCESS_KEY", "saramin-secret");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.providers).toEqual([
      { source: "saramin", configured: true },
      { source: "work24", configured: false }
    ]);
    expect(JSON.stringify(body)).not.toContain("saramin-secret");
  });

  it("normalizes Saramin and Work24 results and ranks them against resume evidence", async () => {
    vi.stubEnv("SARAMIN_ACCESS_KEY", "saramin-secret");
    vi.stubEnv("WORK24_OPEN_API_KEY", "work24-secret");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jobs: {
            total: "1",
            job: [
              {
                id: "101",
                active: 1,
                url: "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=101",
                company: { detail: { name: "Acme" } },
                position: {
                  title: "Backend Engineer",
                  location: { name: "서울" },
                  "job-type": { name: "정규직" },
                  "experience-level": { name: "경력 3년 이상", min: "3", max: "0" }
                },
                keyword: "Java,Spring Boot,PostgreSQL",
                salary: { name: "회사 내규" },
                "expiration-date": "2026-12-31",
                "posting-date": "2026-11-09T10:00:00+09:00"
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ).mockResolvedValueOnce(
      new Response(
        `<wantedRoot><total>1</total><wanted><wantedAuthNo>W-2026-1</wantedAuthNo><company>Acme Work</company><title>백엔드 개발자</title><indTpNm>소프트웨어 개발</indTpNm><jobsCd>12345</jobsCd><region>서울</region><career>경력 3년</career><empTpCd>10</empTpCd><wantedInfoUrl>https://www.work24.go.kr/work/job/1</wantedInfoUrl><closeDt>2026-12-20</closeDt><regDt>2026-11-08</regDt></wanted></wantedRoot>`,
        { status: 200, headers: { "content-type": "application/xml" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      query: "Backend Engineer",
      resume,
      sources: ["saramin", "work24"]
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toHaveLength(2);
    expect(body.data.results[0]).toMatchObject({
      id: "saramin-101",
      source: "saramin",
      companyName: "Acme",
      fit: "high",
      matchedSkills: ["Java", "Spring Boot", "PostgreSQL"]
    });
    expect(body.data.results[1]).toMatchObject({
      id: "work24-W-2026-1",
      source: "work24",
      companyName: "Acme Work",
      title: "백엔드 개발자",
      location: "서울",
      employmentType: "정규직",
      keywords: ["소프트웨어 개발"]
    });
    const saraminUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const work24Url = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(saraminUrl.searchParams.get("keywords")).toBe("Backend Engineer");
    expect(saraminUrl.searchParams.get("access-key")).toBe("saramin-secret");
    expect(work24Url.searchParams.get("keyword")).toBe("Backend Engineer");
    expect(work24Url.searchParams.get("authKey")).toBe("work24-secret");
    expect(JSON.stringify(body)).not.toContain("saramin-secret");
    expect(JSON.stringify(body)).not.toContain("work24-secret");
  });

  it("returns unconfigured providers as actionable statuses and does not call them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      query: "Backend Engineer",
      resume,
      sources: ["saramin", "work24"]
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toEqual([]);
    expect(body.data.providers).toEqual([
      { source: "saramin", state: "needs_key", resultCount: 0 },
      { source: "work24", state: "needs_key", resultCount: 0 }
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid search input before contacting job providers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ query: "", resume, sources: ["unknown"] });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
