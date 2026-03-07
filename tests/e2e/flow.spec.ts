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
  await page.goto("/resume");
  const resumeSection = page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "이력서 다듬기" }) });

  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(resumeSection.getByLabel("희망 직무")).toHaveValue("Frontend Engineer");
  await expect(resumeSection.getByLabel("기술 스택 (쉼표로 구분)").first()).toHaveValue(
    "React, TypeScript, Next.js"
  );

  await page.getByRole("button", { name: "이력서 저장" }).click();
  await expect(page.getByRole("link", { name: "공고 정리로 가기" })).toBeVisible();
  await page.getByRole("link", { name: "공고 정리로 가기" }).click();

  const companySection = page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "공고 다듬기" }) });

  await page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.").fill("Beta Corp 채용공고 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(companySection.getByLabel("회사명")).toHaveValue("Beta Corp");
  await expect(companySection.getByLabel("포지션")).toHaveValue("Frontend Engineer");
  await page.getByRole("button", { name: "공고 저장" }).click();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toBeVisible();
  await page.getByRole("link", { name: "소개글 만들기로 가기" }).click();

  await page.getByRole("button", { name: "소개글 만들기" }).click();

  await expect(page.getByText("이 소개글의 근거")).toBeVisible();
  await expect(page.getByText("React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.")).toBeVisible();
  await expect(page.getByText("디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다.")).toBeVisible();
  await expect(page.getByText("React 기반 대시보드 경험의 프론트엔드 개발자")).toBeVisible();
  await expect(page.getByText("입사 후에도 관리자용 제품 화면과 내부 운영 도구를 빠르게 이해하고 사용자 경험 개선에 기여할 수 있습니다.")).toBeVisible();
  await expect(page.getByText("React", { exact: true })).toBeVisible();
  await expect(page.getByText("Next.js", { exact: true })).toBeVisible();
});
