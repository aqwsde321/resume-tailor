import { test, expect } from "@playwright/test";
import { createEmptyWorkspace } from "../../src/entities/workspace/model/workspace";
import { createCompanyWork, newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { CompanySchema, ResumeSchema } from "../../src/shared/lib/schemas";

test("회사별 단계 전환은 댓글 초안을 보존하고 변경된 공고의 재확정을 요구한다", async ({ page }) => {
  const resume = ResumeSchema.parse({ name: "예시 개발자", summary: "기존 소개" });
  let stored = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "기존 소개"), resume);
  const work = createCompanyWork(stored.master!, newTextDocument("job", "예시 공고", "Java 개발자 채용"));
  work.company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "개발자", jobDescription: "Java 개발자 채용" });
  work.companySourceText = work.document.text;
  stored = { ...stored, works: [work] };
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  await expect(page.getByRole("button", { name: "맞춤 편집", exact: true })).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await expect(page.getByText("공고 원문 검토·수정", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "문서 전체에 댓글", exact: true }).click();
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("작성 중인 요청");
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "수정 댓글 작성" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "제출할 이력서 확인", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "수정 요청", exact: true })).toHaveValue("작성 중인 요청");
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).press("Escape");
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toContainText("Java 개발자 채용");
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "추출 문서", exact: true }).fill("수정된 공고");
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "공고 다시 검토", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "추출 문서", exact: true })).toHaveValue("수정된 공고");
  expect(await page.getByRole("region", { name: "공고 검토 단계", includeHidden: true }).count()).toBe(1);
  expect(await page.getByRole("region", { name: "맞춤 편집 단계", includeHidden: true }).count()).toBe(1);
});

async function companyWithDeferredAi(page: import("@playwright/test").Page) {
  const resume = ResumeSchema.parse({ name: "예시 개발자", summary: "기존 소개" });
  let stored = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "기존 소개"), resume);
  const work = createCompanyWork(stored.master!, newTextDocument("job", "예시 공고", "Java 개발자 채용"));
  work.company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "개발자" });
  work.companySourceText = work.document.text;
  work.intro = { oneLineIntro: "", shortIntro: "", longIntro: "사용자가 작성한 소개글", fitReasons: [], matchedSkills: [], gapNotes: [], missingButRelevant: [] };
  stored = { ...stored, works: [work] };
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  return { work, stored: () => stored };
}

test("맞춤 요청 중 공고가 바뀌면 이전 공고의 늦은 제안을 저장하지 않는다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/resume/tailor/stream", async (route) => {
    await delayed;
    const plan = { headline: { text: "이전 공고의 제목", evidenceIds: ["summary"] }, summary: { text: "이전 공고의 제안", evidenceIds: ["summary"] }, experience: [], projects: [], requirementMatches: [], skillIds: [], highlightIds: [], strengthIds: [] };
    await route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: { plan, resume: work.resume } })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  await page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true }).click();
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "추출 문서", exact: true }).fill("다른 공고로 수정");
  release();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "작업 중단", exact: true })).toHaveCount(0);
  await expect(page.getByText("이전 공고의 제안", { exact: true })).toHaveCount(0);
  expect(stored().works[0].tailoring).toBeFalsy();
});

test("소개글 재작성 중 사용자가 고친 문장은 늦은 응답으로 덮어쓰지 않는다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/intro", async (route) => {
    await delayed;
    await route.fulfill({ json: { ok: true, data: { ...work.intro, longIntro: "늦게 도착한 AI 소개글" } } });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  await page.getByText("소개글 · 선택 사항 · 작성됨", { exact: true }).click();
  await page.getByRole("button", { name: "소개글 다시 만들기", exact: true }).click();
  await page.getByRole("textbox", { name: "소개글", exact: true }).fill("지금 직접 고친 소개글");
  release();
  await expect(page.getByRole("button", { name: "소개글 다시 만들기", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "소개글", exact: true })).toHaveValue("지금 직접 고친 소개글");
  await expect.poll(() => stored().works[0].intro?.longIntro).toBe("지금 직접 고친 소개글");
});
