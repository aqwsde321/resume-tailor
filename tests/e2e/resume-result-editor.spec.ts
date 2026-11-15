import { test, expect, type Page } from "@playwright/test";
import { createEmptyWorkspace } from "../../src/entities/workspace/model/workspace";
import { publishMasterResume, newTextDocument } from "../../src/entities/workspace/model/operations";
import { createResultDraft } from "../../src/entities/workspace/model/resume-result-draft";
import { ResumeSchema } from "../../src/shared/lib/schemas";
const resume = ResumeSchema.parse({ name: "예시 개발자", summary: "원래 소개", techStack: ["Java", "Spring", "Redis"], projects: [{ name: "서비스", description: "구현 경험", techStack: ["PostgreSQL"] }] });
async function setup(page: Page) {
  let stored = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본 PDF", "보존할 원문"), resume);
  stored.master!.resultDraft = createResultDraft(resume, "보존할 원문");
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto("/workspace/resume");
  return () => stored;
}
async function comment(page: Page, quote: string, instruction: string) {
  await page.getByRole("region", { name: "추출 문서", exact: true }).evaluate((element, quote) => {
    const text = element.textContent!; const start = text.indexOf(quote); if (start < 0) throw new Error("선택 문구 없음");
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); const range = document.createRange(); let offset = 0; let started = false; let node = walker.nextNode();
    while (node) { const length = node.textContent!.length; if (!started && start < offset + length) { range.setStart(node, start - offset); started = true; } if (started && start + quote.length <= offset + length) { range.setEnd(node, start + quote.length - offset); break; } offset += length; node = walker.nextNode(); }
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range); element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, quote);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill(instruction);
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
}

test("핵심 기술 선택·추가·이름 수정·순서를 초안에 저장하고 원본을 보존한다", async ({ page }) => {
  const stored = await setup(page);
  await expect(page.getByRole("region", { name: "핵심 기술 편집", exact: true })).toHaveCount(0);
  await expect(page.locator("[aria-current=step]")).toHaveText(/정리 결과 검토/);
  await page.getByRole("button", { name: "최종 확인으로", exact: true }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(/최종 확인/);
  await expect(page.getByRole("region", { name: "기술 편집 도구", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "기술 편집", exact: true }).click();
  await page.getByRole("button", { name: "Spring 선택 해제", exact: true }).click();
  await page.getByRole("textbox", { name: "기술 후보 검색", exact: true }).fill("post");
  await expect(page.getByRole("button", { name: "Spring 추가", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "PostgreSQL 추가", exact: true }).click();
  await page.getByRole("textbox", { name: "추가할 기술", exact: true }).fill("Kotlin");
  await page.getByRole("button", { name: "기술 추가", exact: true }).click();
  await page.getByRole("button", { name: "Kotlin 앞으로", exact: true }).click();
  await page.getByRole("button", { name: "Redis 이름 수정", exact: true }).click();
  await page.getByRole("textbox", { name: "수정할 기술명", exact: true }).fill("Redis Cache");
  await page.getByRole("button", { name: "기술명 저장", exact: true }).click();
  await expect.poll(() => stored().master?.resultDraft?.resume.techStack).toEqual(["Java", "Redis Cache", "Kotlin", "PostgreSQL"]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Spring 선택 해제", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "기술 편집 도구", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "공통 이력서로 확정", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.techStack).toEqual(["Java", "Redis Cache", "Kotlin", "PostgreSQL"]);
  expect(stored().master?.skillCatalog).toContain("Spring");
  expect(stored().master?.document.text).toBe("보존할 원문");
  expect(stored().master?.resume?.projects[0].techStack).toEqual(["PostgreSQL"]);
});

test("정리 결과에 댓글 두 개를 모아 적용하고 다시 구조화한 뒤 확정한다", async ({ page }) => {
  const stored = await setup(page);
  await page.route("**/api/workspace/review", (route) => {
    const { document } = route.request().postDataJSON(); const start = document.text.indexOf("원래 소개");
    return route.fulfill({ json: { ok: true, data: { sourceText: document.text, changes: [{ id: "intro", start, end: start + 5, before: "원래 소개", after: "검토한 소개", reason: "확인된 의미 유지", commentIds: document.annotations.map((item: { id: string }) => item.id) }], unresolved: [] } } });
  });
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: { ...resume, summary: "검토한 소개" } } }));
  expect(await page.getByRole("region", { name: "추출 문서", exact: true }).textContent()).toBe(stored().master!.resultDraft!.document.text);
  await comment(page, "원래 소개", "소개 문장을 정리해 주세요");
  await comment(page, "구현 경험", "프로젝트 근거를 유지해 주세요");
  await page.getByRole("button", { name: "댓글 2개", exact: true }).click();
  await page.getByRole("button", { name: "수정 요청 2개 반영", exact: true }).click();
  await page.getByRole("button", { name: "선택한 변경 적용", exact: true }).click();
  await expect(page.getByRole("button", { name: "최종 확인으로", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "수정한 결과 다시 정리", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toContainText("검토한 소개");
  await page.getByRole("button", { name: "최종 확인으로", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 확정", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.summary).toBe("검토한 소개");
  expect(stored().master?.document.text).toBe("보존할 원문");
});
