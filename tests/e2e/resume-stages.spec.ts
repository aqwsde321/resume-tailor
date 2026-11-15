import { test, expect, type Page } from "@playwright/test";
import { createEmptyWorkspace, type Workspace } from "../../src/entities/workspace/model/workspace";
import { newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { ResumeSchema } from "../../src/shared/lib/schemas";
const resume = ResumeSchema.parse({ name: "예시", summary: "기존 소개", techStack: ["Java"] });
async function storage(page: Page, initial: Workspace) {
  let stored = initial;
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto("/workspace/resume");
  return () => stored;
}

test("저장된 이력서에서 원문 편집이 다시 나타나지 않고 명시적으로 수정에 진입한다", async ({ page }) => {
  await storage(page, publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "원문"), resume));
  await expect(page.getByRole("heading", { name: "저장된 공통 이력서", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "새 질문 받기", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이력서 수정하기", exact: true }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(/이력서 편집/);
  await expect(page.getByRole("button", { name: "새 질문 받기", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "공통 경험 보완", exact: true }).click();
  await expect(page.getByRole("button", { name: "새 질문 받기", exact: true })).toBeVisible();
  await expect(page.locator(".studio-paper-toolbar").getByRole("button", { name: "수정 되돌리기", exact: true })).toBeDisabled();
});

test("자료 확인에서는 추출 오류를 직접 고치고 댓글은 이력서 편집에서만 작성한다", async ({ page }) => {
  const document = newTextDocument("resume", "자료", "J a v a");
  const initial = { ...createEmptyWorkspace(), master: { id: crypto.randomUUID(), version: 1, document, resume: null, enrichment: [], updatedAt: new Date().toISOString() } };
  await storage(page, initial);
  await expect(page.locator("[aria-current=step]")).toHaveText(/자료 확인/);
  await expect(page.getByRole("button", { name: "댓글 0개", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.locator("textarea[name=review-document]").fill("Java");
  await page.getByRole("button", { name: "읽기", exact: true }).click();
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: resume } }));
  await page.getByRole("button", { name: "검토한 내용으로 이력서 정리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "이력서 편집", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "댓글 0개", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "공통 이력서 확인으로", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: "저장된 공통 이력서", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveCount(0);
});

test("수정 되돌리기는 문서 도구 모음에서 동작하고 원문 비교는 필요할 때만 연다", async ({ page }) => {
  await storage(page, publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "보관할 원문"), resume));
  await page.getByRole("button", { name: "이력서 수정하기", exact: true }).click();
  await page.getByRole("button", { name: "원본과 비교", exact: true }).click();
  await expect(page.getByRole("region", { name: "보관된 원본", exact: true })).toContainText("보관할 원문");
  await page.getByRole("button", { name: "검토 내용", exact: true }).click();
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  const editor = page.locator("textarea[name=review-document]");
  const original = await editor.inputValue();
  await editor.fill(original.replace("기존 소개", "고친 소개"));
  await page.getByRole("button", { name: "읽기·댓글", exact: true }).click();
  const undo = page.locator(".studio-paper-toolbar").getByRole("button", { name: "수정 되돌리기", exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText(original);
  await expect(undo).toBeDisabled();
});

test("저장본의 자료를 교체하면 자료 확인 상태를 새로고침 후에도 유지한다", async ({ page }) => {
  const stored = await storage(page, publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이전 자료", "이전 원문"), resume));
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("resume", "새 자료", "새 원문"), warnings: [] } } }));
  await page.getByRole("button", { name: "자료 교체", exact: true }).click();
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByRole("textbox", { name: "원문", exact: true }).fill("새 원문");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await expect.poll(() => stored().master?.sourceNeedsReview).toBe(true);
  await page.reload();
  await expect(page.locator("[aria-current=step]")).toHaveText(/자료 확인/);
  await expect(page.getByRole("heading", { name: "저장된 공통 이력서", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("새 원문");
  expect(stored().master?.resume?.summary).toBe("기존 소개");
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: resume } }));
  await page.getByRole("button", { name: "검토한 내용으로 이력서 정리", exact: true }).click();
  await page.getByRole("button", { name: "이전: 자료 확인", exact: true }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(/자료 확인/);
  expect(stored().master?.resume?.summary).toBe("기존 소개");
});
