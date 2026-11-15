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

test("완성본에서 핵심 기술에 댓글로 수정 요청하고 최종 확인은 읽기 전용으로 보여준다", async ({ page }) => {
  const stored = await setup(page);
  const documentRegion = page.getByRole("region", { name: "추출 문서", exact: true });
  await expect(documentRegion.getByRole("article", { name: "정리된 이력서", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이력서 편집", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "정리 결과 수정", exact: true })).toHaveCount(0);
  expect(await documentRegion.textContent()).toBe(stored().master!.resultDraft!.document.text);
  await page.route("**/api/workspace/review", (route) => {
    const { document } = route.request().postDataJSON();
    const before = "- Java\n- Spring\n- Redis";
    const start = document.text.indexOf(before);
    expect(document.annotations[0].anchor).toMatchObject({ type: "text", quote: "Java", start: start + 2 });
    return route.fulfill({ json: { ok: true, data: { sourceText: document.text, changes: [{ id: "skills", start, end: start + before.length, before, after: "- Spring\n- Redis", reason: "핵심 기술 선택 변경", commentIds: document.annotations.map((item: { id: string }) => item.id) }], unresolved: [] } } });
  });
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: { ...resume, techStack: ["Spring", "Redis"] } } }));
  await comment(page, "Java", "핵심 기술에서 Java를 빼 주세요. 프로젝트 사용 기술은 유지해 주세요.");
  await expect.poll(() => stored().master?.resultDraft?.document.annotations.length).toBe(1);
  await page.reload();
  await expect(documentRegion.locator("mark")).toHaveText("Java");
  await page.getByRole("button", { name: "댓글 1개", exact: true }).click();
  await page.getByRole("button", { name: "수정 요청 1개 반영", exact: true }).click();
  await page.getByRole("button", { name: "선택한 변경 적용", exact: true }).click();
  await page.getByRole("button", { name: "수정한 결과 다시 정리", exact: true }).click();
  await expect.poll(() => stored().master?.resultDraft?.resume.techStack).toEqual(["Spring", "Redis"]);
  const reviewedText = await documentRegion.textContent();
  await page.getByRole("button", { name: "공통 이력서 확인으로", exact: true }).click();
  await expect(page.locator("[aria-current=step]")).toHaveText(/공통 이력서 저장/);
  await expect(page.getByRole("button", { name: "기술 편집", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "읽기·댓글", exact: true })).toHaveCount(0);
  expect(await page.getByRole("article", { name: "정리된 이력서", exact: true }).first().textContent()).toBe(reviewedText);
  await expect.poll(() => stored().master?.resultDraft?.stage).toBe("confirm");
  await page.reload();
  await expect(page.getByRole("button", { name: "이전: 이력서 편집", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "공통 이력서로 저장", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.techStack).toEqual(["Spring", "Redis"]);
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
  await expect(page.getByRole("button", { name: "공통 이력서 확인으로", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "수정한 결과 다시 정리", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toContainText("검토한 소개");
  await page.getByRole("button", { name: "공통 이력서 확인으로", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 저장", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.summary).toBe("검토한 소개");
  expect(stored().master?.document.text).toBe("보존할 원문");
});

test("Markdown 목차 위계를 직접 바꿔도 댓글 위치와 저장한 위계를 보존한다", async ({ page }) => {
  const stored = await setup(page);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  const editor = page.locator("textarea[name=review-document]");
  const markdown = (await editor.inputValue()).replace("## 프로젝트", "### 프로젝트").replace("### 서비스", "#### 서비스").replace("구현 경험", "**구현 경험**");
  await editor.fill(markdown);
  await page.getByRole("button", { name: "읽기·댓글", exact: true }).click();
  const region = page.getByRole("region", { name: "추출 문서", exact: true });
  await expect(region.getByRole("heading", { name: "프로젝트", level: 3, exact: true })).toBeVisible();
  await expect(region.getByRole("heading", { name: "서비스", level: 4, exact: true })).toBeVisible();
  await expect(region.locator("strong")).toHaveText("**구현 경험**");
  await comment(page, "구현 경험", "구체적인 역할을 확인해 주세요");
  await expect.poll(() => stored().master?.resultDraft?.document.annotations.length).toBe(1);
  const anchor = stored().master!.resultDraft!.document.annotations[0].anchor;
  expect(anchor).toMatchObject({ type: "text", start: markdown.indexOf("구현 경험"), quote: "구현 경험" });
  await page.reload();
  await expect(region.locator("mark")).toHaveText("구현 경험");
  // 댓글을 삭제하고 다시 구조화해도 사용자가 편집한 제목 위계를 덮어쓰지 않는다.
  await page.getByRole("button", { name: "댓글 1개", exact: true }).click();
  await page.getByRole("button", { name: "댓글 삭제", exact: true }).click();
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: resume } }));
  await page.getByRole("button", { name: "수정한 결과 다시 정리", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서 확인으로", exact: true }).click();
  await expect(page.getByRole("heading", { name: "서비스", level: 4, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "공통 이력서로 저장", exact: true }).click();
  await expect.poll(() => stored().master?.reviewMarkdown).toBe(markdown);
  await page.reload();
  await expect(page.getByRole("heading", { name: "저장된 공통 이력서", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "서비스", level: 4, exact: true })).toBeVisible();
});
