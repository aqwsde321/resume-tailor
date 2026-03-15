import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const BASE_URL = process.env.README_CAPTURE_BASE_URL ?? "http://127.0.0.1:3301";
const OUTPUT_ROOT = path.resolve(process.cwd(), "tmp/readme-gif-build");
const FRAMES_ROOT = path.join(OUTPUT_ROOT, "frames");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");

function toSse(events) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureCleanDir(targetPath) {
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(targetPath, { recursive: true });
}

async function applyMockRoutes(page) {
  await page.route("**/api/resume/stream", async (route) => {
    await sleep(900);
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
              techStack: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
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
          data: { ok: true, elapsedMs: 920 }
        }
      ])
    });
  });

  await page.route("**/api/company/stream", async (route) => {
    await sleep(900);
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
              techStack: ["React", "TypeScript", "Next.js", "Tailwind CSS"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 910 }
        }
      ])
    });
  });

  await page.route("**/api/intro/stream", async (route) => {
    await sleep(1100);
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
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품 개발을 맡아왔습니다.",
              longIntro:
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품을 꾸준히 개발해 왔습니다. 운영 대시보드와 관리자 도구를 만들며 복잡한 데이터를 사용자가 이해하기 쉬운 화면으로 정리하는 경험을 쌓았습니다. Beta Corp의 요구사항인 React 실무 경험, TypeScript 사용 경험, 대시보드 개발 경험과 직접 연결되는 이력이 있습니다.",
              fitReasons: [
                "React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.",
                "운영 대시보드 구축 경험이 데이터 중심 화면 개발 업무와 맞닿아 있습니다."
              ],
              matchedSkills: ["React", "TypeScript", "Next.js"],
              gapNotes: ["디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다."],
              missingButRelevant: [
                "우대 조건 'Next.js 경험'은 Admin Console 프로젝트 근거를 써서 한 문장 더 보강할 수 있습니다."
              ]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 1110 }
        }
      ])
    });
  });

  await page.route("**/api/pdf/preview", async (route) => {
    const requestBody = route.request().postDataJSON();
    const intro = requestBody.intro?.longIntro || "";
    const resume = requestBody.resume || {};
    const highlights = Array.isArray(resume.pdfHighlights) ? resume.pdfHighlights : [];
    const frontendSkills = Array.isArray(resume.techStack)
      ? resume.techStack.filter((item) =>
          ["react", "next.js", "typescript", "tailwind css"].includes(String(item).toLowerCase())
        )
      : [];
    const svgLines = [
      `<text x="48" y="60" font-size="24" font-weight="700">${resume.name || "홍길동"}</text>`,
      `<text x="48" y="90" font-size="14">${resume.desiredPosition || "Frontend Engineer"}</text>`,
      `<text x="48" y="138" font-size="12">${intro}</text>`,
      `<text x="48" y="230" font-size="16" font-weight="700">Skills</text>`,
      `<text x="48" y="258" font-size="12">Frontend: ${frontendSkills.join(", ")}</text>`,
      ...highlights.map(
        (item, index) =>
          `<text x="48" y="${300 + index * 24}" font-size="12">${item}</text>`
      )
    ].join("");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          pages: [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123"><rect width="794" height="1123" fill="white"/>${svgLines}</svg>`
          ]
        }
      })
    });
  });
}

async function takeFrame(page, stepKey, frames, label, duration = 1200) {
  const index = String(frames.length + 1).padStart(2, "0");
  const fileName = `${stepKey}-${index}.png`;
  const filePath = path.join(FRAMES_ROOT, fileName);
  await page.screenshot({
    path: filePath,
    animations: "disabled",
    caret: "hide",
    type: "png"
  });
  frames.push({ file: filePath, label, duration });
}

async function captureStepOne(page) {
  const frames = [];
  await page.goto(`${BASE_URL}/resume`);
  await page.locator("body").evaluate(() => window.scrollTo(0, 0));
  await takeFrame(page, "step1", frames, "초기 화면", 1000);

  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await takeFrame(page, "step1", frames, "원문 입력", 900);

  await page.getByRole("button", { name: "내용 정리" }).click();
  await page.locator(".live-log-modal").waitFor({ state: "visible" });
  await takeFrame(page, "step1", frames, "AI 정리", 900);

  await page.getByLabel("희망 직무").waitFor();
  await takeFrame(page, "step1", frames, "정리 결과 확인", 1300);

  await page.getByRole("button", { name: "이력서 저장" }).click();
  await page.getByRole("link", { name: "공고 정리로 가기" }).waitFor();
  await takeFrame(page, "step1", frames, "저장 완료", 1500);

  return frames;
}

async function captureStepTwo(page) {
  const frames = [];
  await page.getByRole("link", { name: "공고 정리로 가기" }).click();
  await page.waitForURL("**/company");
  await page.locator("body").evaluate(() => window.scrollTo(0, 0));
  await takeFrame(page, "step2", frames, "초기 화면", 1000);

  await page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.").fill("Beta Corp 채용공고 원문");
  await takeFrame(page, "step2", frames, "원문 입력", 900);

  await page.getByRole("button", { name: "내용 정리" }).click();
  await page.locator(".live-log-modal").waitFor({ state: "visible" });
  await takeFrame(page, "step2", frames, "AI 정리", 900);

  await page.getByLabel("회사명").waitFor();
  await takeFrame(page, "step2", frames, "정리 결과 확인", 1300);

  await page.getByRole("button", { name: "공고 저장" }).click();
  await page.getByRole("link", { name: "소개글 만들기로 가기" }).waitFor();
  await takeFrame(page, "step2", frames, "저장 완료", 1500);

  return frames;
}

async function captureStepThree(page) {
  const frames = [];
  await page.getByRole("link", { name: "소개글 만들기로 가기" }).click();
  await page.waitForURL("**/result");
  await page.locator("body").evaluate(() => window.scrollTo(0, 0));
  await takeFrame(page, "step3", frames, "결과 준비 전", 1000);

  await page.getByRole("button", { name: "소개글 만들기" }).click();
  await page.locator(".live-log-modal").waitFor({ state: "visible" });
  await takeFrame(page, "step3", frames, "AI 생성", 1000);

  await page.getByText("이 소개글의 근거").waitFor();
  await takeFrame(page, "step3", frames, "결과 확인", 1600);

  return frames;
}

async function captureStepFour(page) {
  const frames = [];
  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();
  await page.waitForURL("**/pdf");
  await page.locator("body").evaluate(() => window.scrollTo(0, 0));
  await takeFrame(page, "step4", frames, "초기 화면", 1000);

  await page.locator(".pdf-editor-chip").filter({ hasText: "Header" }).click();
  await page.locator(".pdf-editor-modal").waitFor({ state: "visible" });
  await takeFrame(page, "step4", frames, "섹션 수정", 1000);

  await page.locator(".pdf-editor-modal").getByLabel("이름").fill("홍길동 PDF");
  await takeFrame(page, "step4", frames, "수정 중", 900);

  await page.locator(".pdf-editor-modal").getByRole("button", { name: "닫기" }).click();
  await page.getByText("홍길동 PDF").waitFor();
  await takeFrame(page, "step4", frames, "미리보기 반영", 1200);

  await page.evaluate(() =>
    document.querySelector(".pdf-workspace-footer")?.scrollIntoView({ block: "center" })
  );
  await takeFrame(page, "step4", frames, "PDF 내보내기", 1500);

  return frames;
}

async function main() {
  await ensureCleanDir(OUTPUT_ROOT);
  await mkdir(FRAMES_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  await applyMockRoutes(page);
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    steps: {
      step1: await captureStepOne(page),
      step2: await captureStepTwo(page),
      step3: await captureStepThree(page),
      step4: await captureStepFour(page)
    }
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
