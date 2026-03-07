import { expect, test, type Page } from "@playwright/test";

function toSse(events: Array<{ event: string; data: unknown }>) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

function getResumeReviewSection(page: Page) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "이력서 다듬기" }) });
}

function getCompanyReviewSection(page: Page) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "공고 다듬기" }) });
}

async function completeResumeStep(page: Page) {
  await page.goto("/resume");
  const resumeSection = getResumeReviewSection(page);

  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(resumeSection.getByLabel("희망 직무")).toHaveValue("Frontend Engineer");
  await expect(resumeSection.locator(".tag-chip").filter({ hasText: "React" }).first()).toBeVisible();
  await expect(resumeSection.locator(".tag-chip").filter({ hasText: "TypeScript" }).first()).toBeVisible();

  await page.getByRole("button", { name: "이력서 저장" }).click();
  await expect(page.getByRole("link", { name: "공고 정리로 가기" })).toBeVisible();
}

async function completeCompanyStep(page: Page) {
  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);

  await page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.").fill("Beta Corp 채용공고 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(companySection.getByLabel("회사명")).toHaveValue("Beta Corp");
  await expect(companySection.getByLabel("포지션")).toHaveValue("Frontend Engineer");
  await expect(companySection.locator(".list-preview li").filter({ hasText: "React 실무 경험" })).toBeVisible();

  await page.getByRole("button", { name: "공고 저장" }).click();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toBeVisible();
}

async function generateIntro(page: Page) {
  await page.goto("/result");
  await page.getByRole("button", { name: "소개글 만들기" }).click();

  await expect(page.getByText("이 소개글의 근거")).toBeVisible();
  await expect(page.getByText("지금 결과가 최신이에요.")).toBeVisible();
}

async function completeIntroFlow(page: Page) {
  await completeResumeStep(page);
  await completeCompanyStep(page);
  await generateIntro(page);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("__resume_make_e2e_init__")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__resume_make_e2e_init__", "1");
    }
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
              longIntro:
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품을 꾸준히 개발해 왔습니다. 운영 대시보드와 관리자 도구를 만들며 복잡한 데이터를 사용자가 이해하기 쉬운 화면으로 정리하는 경험을 쌓았습니다. 특히 관리 화면에서 필요한 상태 흐름과 화면 구조를 설계하고, Next.js와 TypeScript 기반 코드베이스를 안정적으로 운영해 온 점이 강점입니다. Beta Corp의 요구사항인 React 실무 경험, TypeScript 사용 경험, 대시보드 개발 경험과 직접 연결되는 이력이 있으며, 협업 과정에서도 요구사항을 빠르게 정리해 화면으로 옮겨 왔습니다. 입사 후에도 관리자용 제품 화면과 내부 운영 도구를 빠르게 이해하고 사용자 경험 개선에 기여할 수 있습니다.",
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

  await expect(page.getByText("먼저 이력서를 저장해 주세요.")).toBeVisible();
  await expect(page.getByText("대기")).toBeVisible();
  await expect(page.getByRole("button", { name: "내용 정리" })).toBeDisabled();
});

test("3단계 흐름을 완료하면 AI 근거와 소개문이 표시된다", async ({ page }) => {
  await completeIntroFlow(page);

  const anchorSection = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "공고와 연결한 내 경험" })
  });

  await expect(anchorSection.getByRole("heading", { name: "공고와 연결한 내 경험" })).toBeVisible();
  await expect(anchorSection.locator(".anchor-type.requirement").first()).toBeVisible();
  await expect(anchorSection.getByText("React 실무 경험")).toBeVisible();
  await expect(
    anchorSection
      .getByText("프로젝트: Admin Console / 운영 데이터를 시각화하는 관리 도구를 구축했습니다. / 기술: React, Next.js, TypeScript")
      .first()
  ).toBeVisible();
  await expect(page.getByText("이 소개글의 근거")).toBeVisible();
  await expect(
    page.getByText("React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.")
  ).toBeVisible();
  await expect(page.getByText("디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다.")).toBeVisible();
  await expect(page.getByText("React 기반 대시보드 경험의 프론트엔드 개발자")).toBeVisible();
  await expect(
    page.getByText("입사 후에도 관리자용 제품 화면과 내부 운영 도구를 빠르게 이해하고 사용자 경험 개선에 기여할 수 있습니다.")
  ).toBeVisible();
  await expect(page.locator(".keyword-chip").filter({ hasText: "React" }).first()).toBeVisible();
  await expect(page.locator(".keyword-chip").filter({ hasText: "Next.js" }).first()).toBeVisible();
});

test("실행 중 로그 모달이 보이고 완료 후 하단 기록 패널에서 다시 확인할 수 있다", async ({ page }) => {
  await page.unroute("**/api/resume/stream");
  await page.route("**/api/resume/stream", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "이력서 구조화 시작" }
        },
        {
          event: "log",
          data: { level: "success", phase: "response", message: "이력서 초안 정리 완료" }
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
              experience: [],
              projects: [],
              achievements: ["대시보드 초기 로딩 성능 개선"],
              strengths: ["협업", "문제 해결"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 420 }
        }
      ])
    });
  });

  await page.goto("/resume");
  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  const liveLogModal = page.locator(".live-log-modal");
  await expect(liveLogModal).toBeVisible();
  await expect(liveLogModal.getByText("실행 중")).toBeVisible();
  await expect(liveLogModal.getByRole("heading", { name: "이력서 정리" })).toBeVisible();

  await expect(page.getByRole("button", { name: "이력서 저장" })).toBeEnabled();
  await expect(liveLogModal).toHaveCount(0);

  const logDrawer = page.locator(".log-drawer");
  await expect(logDrawer).toBeVisible();
  await expect(logDrawer.getByText("이력서 초안 정리 완료")).toBeVisible();

  await page.getByRole("button", { name: "기록 보기" }).click();
  await expect(page.getByRole("heading", { name: "지난 작업 기록" })).toBeVisible();
  await expect(logDrawer.getByText("이력서 구조화 시작")).toBeVisible();
  await expect(logDrawer.getByText("이력서 초안 정리 완료")).toBeVisible();
});

test("이력서를 수정하고 저장하면 공고와 소개글이 다시 저장 필요 상태가 된다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.goto("/resume");
  const resumeSection = getResumeReviewSection(page);

  await resumeSection.getByLabel("희망 직무").fill("Senior Frontend Engineer");
  await expect(resumeSection.getByText("수정됨")).toBeVisible();
  await page.getByRole("button", { name: "이력서 저장" }).click();

  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);
  await expect(companySection.getByText("수정됨")).toBeVisible();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toHaveCount(0);

  await page.goto("/result");
  await expect(page.getByRole("heading", { name: "먼저 저장해 주세요." })).toBeVisible();
  await expect(page.getByRole("button", { name: "소개글 만들기" })).toBeDisabled();
});

test("공고를 수정하고 다시 저장하면 소개글에 공고 변경 stale 이유가 표시된다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);

  await companySection.getByLabel("포지션").fill("Senior Frontend Engineer");
  await expect(companySection.getByText("수정됨")).toBeVisible();
  await page.getByRole("button", { name: "공고 저장" }).click();

  await page.goto("/result");
  await expect(page.getByText("소개글 다시 만들기 필요")).toBeVisible();
  await expect(page.getByText("최신 내용으로 다시 만들 차례예요.")).toBeVisible();
  await expect(page.getByText("공고가 바뀌었어요.")).toBeVisible();
  await expect(page.locator(".reason-chip").filter({ hasText: "공고 변경" })).toBeVisible();

  await page.getByRole("button", { name: "소개글 만들기" }).click();

  await expect(page.getByText("지금 결과가 최신이에요.")).toBeVisible();
  await expect(page.locator(".reason-chip").filter({ hasText: "공고 변경" })).toHaveCount(0);
});
