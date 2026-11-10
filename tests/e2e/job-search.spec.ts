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

test("이력서 조건으로 공고를 검색하고 선택한 공고 원문을 맞춤 이력서 흐름에 넣는다", async ({ page }) => {
  await page.addInitScript((storedResume) => {
    window.localStorage.setItem(
      "resume-tailor.pipeline.v2",
      JSON.stringify({ resumeConfirmedJson: JSON.stringify(storedResume) })
    );
  }, resume);

  await page.route("**/api/jobs/search", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            providers: [
              { source: "saramin", configured: true },
              { source: "ionejob", configured: false }
            ]
          }
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          results: [
            {
              id: "saramin-101",
              source: "saramin",
              title: "Backend Engineer",
              companyName: "Acme",
              url: "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=101",
              keywords: ["Java", "Spring Boot", "PostgreSQL"],
              location: "서울",
              employmentType: "정규직",
              careerLabel: "경력 3년 이상",
              careerMinYears: 3,
              careerMaxYears: null,
              salary: "회사 내규",
              deadline: "2026-12-31",
              postedAt: "2026-11-09",
              active: true,
              relevanceScore: 100,
              fit: "high",
              matchedSkills: ["Java", "Spring Boot", "PostgreSQL"],
              reasons: ["희망 직무(Backend Engineer)가 공고 제목과 맞아요.", "Java, Spring Boot, PostgreSQL이 공고 키워드에 있어요."]
            }
          ],
          providers: [{ source: "saramin", state: "success", resultCount: 1 }]
        }
      })
    });
  });

  await page.route("**/api/company/fetch-url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: "https://www.saramin.co.kr/zf_user/jobs/view?rec_idx=101",
          title: "Backend Engineer 채용",
          companyNameHint: "Acme",
          jobTitleHint: "Backend Engineer",
          text: "Java와 Spring Boot 기반 주문 API를 개발합니다."
        }
      })
    });
  });

  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "내 이력서에 맞는 공고 찾기" })).toBeVisible();
  await expect(page.getByText("키 설정됨", { exact: true })).toBeVisible();
  await expect(page.getByText("사람인", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "i-ONE JOB 검색" })).toBeChecked();
  for (const excludedPortal of ["고용24", "원티드", "점핏", "잡코리아"]) {
    await expect(page.getByText(excludedPortal, { exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "공고 검색" }).click();

  const result = page.getByRole("article", { name: /Acme Backend Engineer/ });
  await expect(result).toContainText("높은 관련성");
  await expect(result).toContainText("Spring Boot");
  await result.getByRole("button", { name: "이 공고로 이력서 맞추기" }).click();

  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.")).toHaveValue(
    "Java와 Spring Boot 기반 주문 API를 개발합니다."
  );
});

test("검색 API 키가 없어도 공고 직접 비교 영역으로 이동할 수 있다", async ({ page }) => {
  await page.addInitScript((storedResume) => {
    window.localStorage.setItem(
      "resume-tailor.pipeline.v2",
      JSON.stringify({ resumeConfirmedJson: JSON.stringify(storedResume) })
    );
  }, resume);

  await page.route("**/api/jobs/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: [
            { source: "saramin", configured: false },
            { source: "ionejob", configured: false }
          ]
        }
      })
    });
  });

  await page.goto("/jobs");
  await expect(page.getByText("API 키 필요", { exact: true })).toHaveCount(2);
  await page.getByRole("link", { name: "공고 직접 비교하기" }).click();

  await expect(page.getByLabel("공고 원문")).toBeVisible();
  await expect(page.getByRole("button", { name: "공고 비교에 추가" })).toBeVisible();
});

test("지원 API 없이 붙여넣은 공고를 이력서와 비교하고 선택할 수 있다", async ({ page }) => {
  await page.addInitScript((storedResume) => {
    window.localStorage.setItem(
      "resume-tailor.pipeline.v2",
      JSON.stringify({ resumeConfirmedJson: JSON.stringify(storedResume) })
    );
  }, resume);

  await page.route("**/api/jobs/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          providers: [
            { source: "saramin", configured: false },
            { source: "ionejob", configured: false }
          ]
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
          companyDescription: "결제 플랫폼",
          jobTitle: "Backend Engineer",
          jobDescription: "주문 API를 개발합니다.",
          requirements: ["Java 서버 개발 경험"],
          preferredSkills: ["PostgreSQL 경험"],
          techStack: ["Java", "Spring Boot", "PostgreSQL"]
        }
      })
    });
  });

  let sourceFetchCount = 0;
  await page.route("**/api/company/fetch-url", async (route) => {
    sourceFetchCount += 1;
    await route.fulfill({ status: 500, body: "manual source must not be fetched" });
  });

  const postingText = "Acme Backend Engineer\nJava, Spring Boot, PostgreSQL로 주문 API를 개발합니다.";
  await page.goto("/jobs");
  await page.getByLabel("공고 원문").fill(postingText);
  await page.getByRole("button", { name: "공고 비교에 추가" }).click();

  const result = page.getByRole("article", { name: /Acme Backend Engineer/ });
  await expect(result).toContainText("직접 입력");
  await expect(result).toContainText("높은 관련성");
  await result.getByRole("button", { name: "이 공고로 이력서 맞추기" }).click();

  await expect(page).toHaveURL(/\/company$/);
  await expect(page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.")).toHaveValue(postingText);
  expect(sourceFetchCount).toBe(0);
});
