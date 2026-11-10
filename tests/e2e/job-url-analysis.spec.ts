import { expect, test } from "@playwright/test";

const resume = {
  name: "홍길동",
  headline: "백엔드 개발자",
  summary: "Java와 Spring Boot 기반 서비스 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 3,
  careerDurationText: "3년",
  pdfProfileImageDataUrl: "",
  pdfProfileImageVisible: false,
  contacts: [],
  techStack: ["Java", "Spring Boot", "PostgreSQL"],
  experience: [
    {
      company: "Acme",
      role: "Backend Engineer",
      period: "2023-2026",
      description: "주문 API와 운영 도구를 개발했습니다."
    }
  ],
  projects: [],
  achievements: [],
  pdfHighlights: [],
  strengths: [],
  pdfStrengths: []
};

test("사용자가 준 공고 URL을 읽고 분석한 뒤 맞춤 이력서 흐름으로 넘긴다", async ({ page }) => {
  await page.addInitScript((storedResume) => {
    window.localStorage.setItem(
      "resume-tailor.pipeline.v2",
      JSON.stringify({ resumeConfirmedJson: JSON.stringify(storedResume) })
    );
  }, resume);

  let searchRequests = 0;
  await page.route("**/api/jobs/search", async (route) => {
    searchRequests += 1;
    await route.fulfill({ status: 500, body: "자동 검색은 지원하지 않습니다." });
  });
  await page.route("**/api/company/fetch-url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: "https://jobs.example.com/backend-101",
          title: "Backend Engineer 채용",
          companyNameHint: "Acme",
          jobTitleHint: "Backend Engineer",
          text: "Java와 Spring Boot 기반 주문 API 개발. 필수 요건: PostgreSQL 경험."
        }
      })
    });
  });
  await page.route("**/api/company", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          companyName: "Acme",
          companyDescription: "주문 관리 서비스",
          jobTitle: "Backend Engineer",
          jobDescription: "Java와 Spring Boot 기반 주문 API 개발",
          requirements: ["PostgreSQL 경험"],
          preferredSkills: [],
          techStack: ["Java", "Spring Boot", "PostgreSQL"]
        }
      })
    });
  });

  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "URL로 공고 분석" })).toBeVisible();
  await expect(page.getByText("사람인", { exact: true })).toHaveCount(0);
  await expect(page.getByText("i-ONE JOB", { exact: true })).toHaveCount(0);

  await page.getByLabel("공고 링크").fill("https://jobs.example.com/backend-101");
  await page.getByRole("button", { name: "공고 분석" }).click();

  const result = page.getByRole("article", { name: /Acme Backend Engineer/ });
  await expect(result).toContainText("높은 관련성");
  await expect(result).toContainText("PostgreSQL");
  await expect(result).toContainText("회사 소개");
  await expect(result).toContainText("기술 스택");
  await expect(result).toContainText("Java와 Spring Boot 기반 주문 API 개발");
  await result.getByRole("button", { name: "이 공고로 이력서 맞추기" }).click();

  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.")).toHaveValue(
    "Java와 Spring Boot 기반 주문 API 개발. 필수 요건: PostgreSQL 경험."
  );
  expect(searchRequests).toBe(0);
});

test("공고 URL 형식이 아니면 요청하지 않고 입력을 안내한다", async ({ page }) => {
  await page.addInitScript((storedResume) => {
    window.localStorage.setItem(
      "resume-tailor.pipeline.v2",
      JSON.stringify({ resumeConfirmedJson: JSON.stringify(storedResume) })
    );
  }, resume);

  let fetchRequests = 0;
  await page.route("**/api/company/fetch-url", async (route) => {
    fetchRequests += 1;
    await route.fulfill({ status: 500 });
  });

  await page.goto("/jobs");
  await page.getByLabel("공고 링크").fill("not a url");
  await page.getByRole("button", { name: "공고 분석" }).click();

  await expect(page.getByText("공고 URL은 http 또는 https 주소로 입력해 주세요.")).toBeVisible();
  expect(fetchRequests).toBe(0);
});
