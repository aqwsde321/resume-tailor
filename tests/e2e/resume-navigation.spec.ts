import { test, expect, type Page } from "@playwright/test";
import { createEmptyWorkspace, type Workspace } from "../../src/entities/workspace/model/workspace";
import { createCompanyWork, newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { CompanySchema, ResumeSchema } from "../../src/shared/lib/schemas";
const resume = ResumeSchema.parse({ name: "예시", summary: "기존 소개", techStack: ["Java"] });
async function setup(page: Page, initial?: Workspace) {
  let stored = initial ?? publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "자료 원문"), resume);
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "이력서 수정하기", exact: true }).click();
  return () => stored;
}
async function select(page: Page, quote: string) {
  await page.getByRole("region", { name: "추출 문서", exact: true }).evaluate((element, quote) => {
    const start = element.textContent!.indexOf(quote);
    const range = document.createRange(); const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let at = 0; let began = false; let node = walker.nextNode();
    while (node) { const size = node.textContent!.length; if (!began && start < at + size) { range.setStart(node, start - at); began = true; } if (began && start + quote.length <= at + size) { range.setEnd(node, start + quote.length - at); break; } at += size; node = walker.nextNode(); }
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, quote);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
}

test("상단·하단 단계 이동과 새로고침이 Markdown과 등록한 댓글을 보존하고 저장 차단 이유를 알린다", async ({ page }) => {
  const stored = await setup(page);
  const footer = await page.locator(".result-editor-footer:visible").boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  const editor = page.locator("textarea[name=review-document]:visible");
  const text = `${await editor.inputValue()}\n\n## 직접 편집\n\n보존할 내용`;
  await editor.fill(text);
  await page.getByRole("button", { name: "읽기·댓글", exact: true }).click();
  await select(page, "기존 소개");
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("소개 보완");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect.poll(() => stored().master?.resultDraft?.document.annotations.length).toBe(1);
  const id = stored().master!.resultDraft!.document.id;
  await page.getByRole("button", { name: "이전: 자료 확인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "추출 자료 확인", exact: true })).toBeVisible();
  await expect.poll(() => stored().master?.viewStep).toBe("source");
  await page.reload();
  await page.getByRole("button", { name: "이력서 편집 단계", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText(text);
  await expect(page.locator(".review-document:visible mark")).toHaveText("기존 소개");
  expect(stored().master!.resultDraft!.document.id).toBe(id);
  await page.getByRole("button", { name: "공통 이력서 저장 단계", exact: true }).click({ force: true });
  await expect(page.locator(".resume-navigation-message")).toContainText("댓글");
  await expect(page.getByRole("heading", { name: "이력서 편집", exact: true })).toBeVisible();
});

test("작성 중인 댓글도 단계 왕복 시 보존된다", async ({ page }) => {
  await setup(page);
  await select(page, "기존 소개");
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("아직 작성 중인 요청");
  await page.getByRole("button", { name: "자료 확인 단계", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "수정 댓글 작성", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "이력서 편집 단계", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "수정 요청", exact: true })).toHaveValue("아직 작성 중인 요청");
  await page.getByRole("button", { name: "취소", exact: true }).click();
});

test("좁은 화면은 원본 전용 패널에서 PDF 도구와 댓글을 지원하고 닫으면 편집기로 돌아온다", async ({ page }) => {
  await page.setViewportSize({ width: 967, height: 976 });
  const source = newTextDocument("resume", "예시.pdf", "원문");
  source.source = { type: "pdf", originalText: "원문", pages: [1, 2].map((page) => ({ page, text: "페이지", method: "text" as const, imageId: `00000000-0000-4000-8000-00000000000${page}` })) };
  await page.route("**/api/workspace/attachment/*", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="white"/></svg>' }));
  const stored = await setup(page, publishMasterResume(createEmptyWorkspace(), source, resume));
  await expect(page.getByRole("group", { name: "비교할 문서 선택", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "원본 열기", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "원본 자료", exact: true });
  await expect(panel).toBeVisible();
  await panel.getByRole("combobox", { name: "원본 페이지", exact: true }).click();
  await page.getByRole("option", { name: "2 / 2페이지", exact: true }).click();
  await panel.getByRole("combobox", { name: "원본 확대", exact: true }).click();
  await page.getByRole("option", { name: "150%", exact: true }).click();
  await panel.getByRole("button", { name: "원본 추가 도구", exact: true }).click();
  await page.getByRole("menuitem", { name: "현재 페이지에 댓글", exact: true }).click();
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("이 페이지 확인");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await panel.getByRole("button", { name: "원본 닫기", exact: true }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole("button", { name: "원본 열기", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "댓글 1개", exact: true })).toBeVisible();
  await expect.poll(() => stored().master?.resultDraft?.document.annotations[0]?.anchor).toMatchObject({ type: "region", page: 2 });
  await page.getByRole("button", { name: "원본 열기", exact: true }).click();
  await expect(panel.getByRole("combobox", { name: "원본 페이지", exact: true })).toContainText("2 / 2페이지");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
});

test("공통 경험 보완과 회사 공고별 보완의 적용 범위를 구분해 보여준다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "자료"), resume);
  const work = createCompanyWork(initial.master!, newTextDocument("job", "예시 공고", "Java 개발자"));
  work.company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "개발자" });
  work.companySourceText = work.document.text;
  initial.works = [work];
  await setup(page, initial);
  await page.getByRole("button", { name: "공통 경험 보완", exact: true }).click();
  await expect(page.getByText("회사에 관계없이 활용할 실제 경험을 질문으로 정리합니다.", { exact: false })).toBeVisible();
  await page.goto(`/workspace/companies/${work.id}`);
  await expect(page.getByRole("button", { name: "새 질문 받기", exact: true })).not.toBeVisible();
  await page.getByText("공고에 맞춰 경험 보완", { exact: true }).click();
  await expect(page.getByText("공통 이력서는 바뀌지 않습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "새 질문 받기", exact: true })).toBeVisible();
});
