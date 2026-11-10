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
    vi.stubEnv("IBK_ONEJOB_ACCESS_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports which official search providers have server-side keys without exposing them", async () => {
    vi.stubEnv("SARAMIN_ACCESS_KEY", "saramin-secret");
    vi.stubEnv("IBK_ONEJOB_ACCESS_KEY", "ione-secret");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.providers).toEqual([
      { source: "saramin", configured: true },
      { source: "ionejob", configured: true }
    ]);
    expect(JSON.stringify(body)).not.toContain("saramin-secret");
    expect(JSON.stringify(body)).not.toContain("ione-secret");
  });

  it("normalizes Saramin results and ranks them against resume evidence", async () => {
    vi.stubEnv("SARAMIN_ACCESS_KEY", "saramin-secret");
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
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      query: "Backend Engineer",
      resume,
      sources: ["saramin"]
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]).toMatchObject({
      id: "saramin-101",
      source: "saramin",
      companyName: "Acme",
      fit: "high",
      matchedSkills: ["Java", "Spring Boot", "PostgreSQL"]
    });
    const saraminUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(saraminUrl.searchParams.get("keywords")).toBe("Backend Engineer");
    expect(saraminUrl.searchParams.get("access-key")).toBe("saramin-secret");
    expect(JSON.stringify(body)).not.toContain("saramin-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns unconfigured providers as actionable statuses and does not call them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      query: "Backend Engineer",
      resume,
      sources: ["saramin", "ionejob"]
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toEqual([]);
    expect(body.data.providers).toEqual([
      { source: "saramin", state: "needs_key", resultCount: 0 },
      { source: "ionejob", state: "needs_key", resultCount: 0 }
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes i-ONE JOB Open API results and ranks them against resume evidence", async () => {
    vi.stubEnv("IBK_ONEJOB_ACCESS_KEY", "ione-secret");
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        `<job-search><totalRow>1</totalRow><nowPage>1</nowPage><numPerPage>100</numPerPage><jobs><hireSn>45</hireSn><cmpNm>IBK Acme</cmpNm><hireTitle>Backend Engineer</hireTitle><hireRcvStYmd>20261101</hireRcvStYmd><hireRcvEndYmd>20261231</hireRcvEndYmd><regYmd>20261109</regYmd><jobCategory>Java,Spring Boot,PostgreSQL</jobCategory><jobCareerinfo>경력 3년 이상</jobCareerinfo><jobCrrAbv>3</jobCrrAbv><jobCrrBlw>0</jobCrrBlw><jobEdu>학력무관</jobEdu><jobTypecond>정규직</jobTypecond><jobLocation>서울</jobLocation><jobSalary>회사 내규</jobSalary><jobUrl>https://www.ibkonejob.co.kr/mb/job/view.do?hireSn=45</jobUrl></jobs></job-search>`,
        { status: 200, headers: { "content-type": "application/xml" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ query: "Backend Engineer", resume, sources: ["ionejob"] });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]).toMatchObject({
      id: "ionejob-45",
      source: "ionejob",
      companyName: "IBK Acme",
      title: "Backend Engineer",
      keywords: ["Java", "Spring Boot", "PostgreSQL"],
      careerMinYears: 3,
      careerMaxYears: null,
      fit: "high"
    });
    expect(body.data.providers).toEqual([{ source: "ionejob", state: "success", resultCount: 1 }]);
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("authKey")).toBe("ione-secret");
    expect(requestUrl.searchParams.get("nowPage")).toBe("1");
    expect(requestUrl.searchParams.get("numPerPage")).toBe("100");
    expect(requestUrl.searchParams.get("sortOrderBy")).toBe("DESC");
    expect(JSON.stringify(body)).not.toContain("ione-secret");
  });

  it("rejects providers that are not approved for personal API use", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({ query: "Backend Engineer", resume, sources: ["work24"] });

    expect(response.status).toBe(400);
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
