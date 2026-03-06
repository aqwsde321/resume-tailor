import { expect, test } from "@playwright/test";

function toSse(events: Array<{ event: string; data: unknown }>) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });

  await page.route("**/api/resume/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "이력서 구조화 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              name: "홍길동",
              summary: "React와 TypeScript 기반 프론트엔드 개발자",
              desiredPosition: "Frontend Engineer",
              careerYears: 4,
              techStack: ["React", "TypeScript", "Next.js"],
              experience: [
                {
                  company: "Acme",
                  role: "Frontend Engineer",
                  period: "2022-2025",
                  description: "사내 대시보드와 운영 도구를 개발했습니다."
                }
              ],
              projects: [
                {
                  name: "Admin Console",
                  description: "운영 데이터를 시각화하는 관리 도구를 구축했습니다.",
                  techStack: ["React", "Next.js", "TypeScript"]
                }
              ],
              achievements: ["대시보드 초기 로딩 성능 개선"],
              strengths: ["협업", "문제 해결"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 42 }
        }
      ])
    });
  });

  await page.route("**/api/company/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "채용공고 구조화 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              companyName: "Beta Corp",
              companyDescription: "B2B SaaS를 만드는 팀",
              jobTitle: "Frontend Engineer",
              jobDescription: "관리자용 제품 화면과 내부 운영 도구를 개발합니다.",
              requirements: ["React 실무 경험", "TypeScript 사용 경험", "대시보드 개발 경험"],
              preferredSkills: ["Next.js", "디자인 시스템 운영"],
              techStack: ["React", "TypeScript", "Next.js"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 35 }
        }
      ])
    });
  });

  await page.route("**/api/intro/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "자기소개 생성 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              oneLineIntro: "React 기반 대시보드 경험의 프론트엔드 개발자",
              shortIntro:
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품 개발을 맡아왔습니다. 운영 대시보드와 관리자 도구를 구축하며 데이터 중심 화면 설계 경험을 쌓았습니다. Beta Corp의 요구사항인 React, TypeScript, 대시보드 개발 경험과 직접 연결되는 이력이 있습니다.",
              fitReasons: [
                "React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.",
                "운영 대시보드 구축 경험이 채용공고의 데이터 중심 화면 개발 업무와 맞닿아 있습니다."
              ],
              matchedSkills: ["React", "TypeScript", "Next.js"],
              gapNotes: ["디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다."]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 28 }
        }
      ])
    });
  });
});

test("이력서 미확정이면 채용공고 단계가 차단된다", async ({ page }) => {
  await page.goto("/company");

  await expect(page.getByText("먼저 이력서 확정이 필요합니다.")).toBeVisible();
  await expect(page.getByText("선행 필요")).toBeVisible();
  await expect(page.getByRole("button", { name: "채용공고 분석 시작" })).toBeDisabled();
});

test("3단계 흐름을 완료하면 AI 근거와 소개문이 표시된다", async ({ page }) => {
  await page.goto("/resume");
  const resumeSection = page.locator("section.card").nth(1);
  const companySection = page.locator("section.card").nth(1);

  await page.getByPlaceholder("이력서 텍스트를 붙여넣으세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "이력서 분석 시작" }).click();

  await expect(resumeSection.getByLabel("이름")).toHaveValue("홍길동");
  await expect(resumeSection.getByLabel("희망 직무")).toHaveValue("Frontend Engineer");
  await expect(resumeSection.getByLabel("기술 스택 (쉼표 구분)").first()).toHaveValue(
    "React, TypeScript, Next.js"
  );

  await page.getByRole("button", { name: "이력서 정보 확정" }).click();
  await expect(page.getByText("STEP 2 채용공고로 이동")).toBeVisible();
  await page.getByRole("link", { name: "STEP 2 채용공고로 이동" }).click();

  await page.getByPlaceholder("채용공고 텍스트를 붙여넣으세요.").fill("Beta Corp 채용공고 원문");
  await page.getByRole("button", { name: "채용공고 분석 시작" }).click();

  await expect(companySection.getByLabel("회사명")).toHaveValue("Beta Corp");
  await expect(companySection.getByLabel("채용 직무")).toHaveValue("Frontend Engineer");
  await page.getByRole("button", { name: "채용공고 정보 확정" }).click();
  await expect(page.getByText("STEP 3 결과로 이동")).toBeVisible();
  await page.getByRole("link", { name: "STEP 3 결과로 이동" }).click();

  await page.getByRole("button", { name: "자기소개 생성" }).click();

  await expect(page.getByText("자기소개가 참조한 지원 근거")).toBeVisible();
  await expect(page.getByText("React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.")).toBeVisible();
  await expect(page.getByText("디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다.")).toBeVisible();
  await expect(page.getByText("React 기반 대시보드 경험의 프론트엔드 개발자")).toBeVisible();
  await expect(page.getByText("React", { exact: true })).toBeVisible();
  await expect(page.getByText("Next.js", { exact: true })).toBeVisible();
});
