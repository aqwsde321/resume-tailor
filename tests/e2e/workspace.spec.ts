import { test, expect, type Page } from "@playwright/test";
import { createEmptyWorkspace, type Workspace } from "../../src/entities/workspace/model/workspace";
import { newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { ResumeSchema } from "../../src/shared/lib/schemas";
const resume = ResumeSchema.parse({ name: "예시 개발자", summary: "원본 소개", desiredPosition: "백엔드 개발자", techStack: ["Java"] });
async function mockStorage(page: Page, initial = createEmptyWorkspace()) {
  let stored = initial;
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      if (body.expectedRevision !== stored.revision) return route.fulfill({ status: 409, json: { ok: false, error: { message: "동시 저장" } } });
      stored = { ...body.workspace, revision: stored.revision + 1 };
    }
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  return () => stored;
}
async function selectDocumentText(page: Page, start: number, end: number) {
  await page.getByRole("region", { name: "추출 문서", exact: true }).evaluate((element, offsets) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = element.ownerDocument.createRange(); let offset = 0; let started = false; let node = walker.nextNode();
    while (node) {
      const length = node.textContent?.length ?? 0;
      if (!started && offsets.start < offset + length) { range.setStart(node, offsets.start - offset); started = true; }
      if (started && offsets.end <= offset + length) { range.setEnd(node, offsets.end - offset); break; }
      offset += length; node = walker.nextNode();
    }
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range); element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }, { start, end });
}
test("추출 문서에 댓글을 모아 반영한 뒤 공통 이력서로 확정하고 다시 불러온다", async ({ page }) => {
  const stored = await mockStorage(page);
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("resume", "새 이력서", "J a v a 개발자"), warnings: [] } } }));
  await page.route("**/api/workspace/review", (route) => {
    const body = route.request().postDataJSON();
    expect(body.document.annotations[0].anchor).toMatchObject({ type: "text", quote: "J a v a" });
    return route.fulfill({ json: { ok: true, data: { sourceText: body.document.text, unresolved: [], changes: [{ id: "document", start: 0, end: body.document.text.length, before: body.document.text, after: "Java 개발자", reason: "문자 병합", commentIds: body.document.annotations.map((comment: { id: string }) => comment.id) }] } } });
  });
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: resume } }));
  await page.goto("/workspace/resume");
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByLabel("원문", { exact: true }).fill("J a v a 개발자");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "수정 요청", exact: true })).toHaveCount(0);
  await page.getByRole("region", { name: "추출 문서", exact: true }).evaluate((element) => {
    const node = element.firstChild!.firstChild!;
    const range = element.ownerDocument.createRange(); range.setStart(node, 0); range.setEnd(node, 7);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByLabel("수정 요청", { exact: true }).fill("Java로 합쳐줘");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect(page.locator(".review-document mark")).toHaveText("J a v a");
  await expect(page.getByRole("textbox", { name: "수정 요청", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "수정 댓글", exact: true })).toHaveCount(0);
  await selectDocumentText(page, 8, 11);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByLabel("수정 요청", { exact: true }).fill("직무 표현도 확인해줘");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await page.getByRole("button", { name: "댓글 2개", exact: true }).click();
  await page.getByRole("button", { name: "수정 요청 2개 반영", exact: true }).click();
  await page.getByRole("button", { name: "선택한 변경 적용", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("Java 개발자");
  await page.getByRole("button", { name: "검토한 내용으로 이력서 정리", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 확정", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.name).toBe("예시 개발자");
  await page.reload();
  await expect(page.getByText("확정 이력서 · 버전 1", { exact: true })).toBeVisible();
});

test("모바일 댓글 작성은 선택 후에만 열리고 취소·등록·다시 열기를 지원한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "선택할 문장입니다."), resume);
  const stored = await mockStorage(page, initial);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/resume");
  await selectDocumentText(page, 0, 3);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("region", { name: "추출 문서", exact: true }).press("Escape");
  await expect(page.getByRole("button", { name: "댓글 쓰기", exact: true })).toHaveCount(0);
  await selectDocumentText(page, 0, 3);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "수정 요청", exact: true })).toBeFocused();
  const box = await page.getByRole("dialog", { name: "수정 댓글 작성" }).boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(391);
  expect(box!.y + box!.height).toBeLessThanOrEqual(845);
  await page.getByLabel("수정 요청", { exact: true }).fill("취소할 내용");
  await page.getByLabel("수정 요청", { exact: true }).press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".review-document mark")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "댓글 쓰기", exact: true })).toHaveCount(0);
  expect(stored().master!.document.annotations).toHaveLength(0);
  await selectDocumentText(page, 0, 3);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByLabel("수정 요청", { exact: true }).fill("등록할 수정 요청");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect.poll(() => stored().master!.document.annotations.length).toBe(1);
  await page.reload();
  await expect(page.locator(".review-document .comment-mark")).toHaveText("선택할");
  await expect(page.getByRole("complementary", { name: "수정 댓글", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "댓글 보기: 선택할", exact: true }).focus();
  await page.getByRole("button", { name: "댓글 보기: 선택할", exact: true }).press("Enter");
  await expect(page.getByRole("complementary", { name: "수정 댓글", exact: true })).toBeVisible();
  await expect(page.locator(".comment-mark")).toHaveAttribute("data-active", "true");
  await page.getByRole("button", { name: "댓글 목록 닫기", exact: true }).click();
  await expect(page.locator(".comment-mark")).toHaveAttribute("data-active", "false");
});

test("겹치는 댓글은 개수를 표시하고 편집 중인 댓글을 문서에서 강조한다", async ({ page }) => {
  const document = newTextDocument("resume", "댓글 확인", "동일한 문장");
  document.annotations = ["첫 번째 정정", "두 번째 정정"].map((instruction) => ({ id: crypto.randomUUID(), instruction, anchor: { type: "text", start: 0, end: 3, quote: "동일한" }, status: "pending", createdAt: new Date().toISOString() }));
  await mockStorage(page, publishMasterResume(createEmptyWorkspace(), document, resume));
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "댓글 2개 보기: 동일한", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "수정 댓글", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "댓글 내용", exact: true }).nth(1).focus();
  await expect(page.locator(".review-comment[data-active=true] textarea")).toHaveValue("두 번째 정정");
});

test("내 이력서 등록은 키보드 탭 이동과 작은 화면에서 사용할 수 있다", async ({ page }) => {
  await mockStorage(page);
  const longText = "긴문서본문".repeat(100);
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("resume", "긴파일명".repeat(35), longText), warnings: [] } } }));
  await page.goto("/workspace/resume");
  const fileTab = page.getByRole("tab", { name: "파일 업로드", exact: true });
  await expect(fileTab).toHaveAttribute("aria-selected", "true");
  await fileTab.focus();
  await fileTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "URL", exact: true })).toBeFocused();
  await expect(page.getByRole("textbox", { name: "원본 URL", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tab", { name: "URL", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "원본 URL", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByRole("textbox", { name: "원문", exact: true }).fill(longText);
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText(longText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const documentBox = await page.getByRole("region", { name: "추출 문서", exact: true }).boundingBox();
  await page.getByRole("button", { name: "댓글 0개", exact: true }).click();
  const comments = await page.getByRole("complementary", { name: "수정 댓글", exact: true }).boundingBox();
  expect(comments!.y).toBeGreaterThanOrEqual(documentBox!.y + documentBox!.height);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "추출 문서", exact: true }).fill("직접 수정한 이력서");
  await page.getByRole("button", { name: "읽기·댓글", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("직접 수정한 이력서");
});

test("AI 질문으로 모은 두 경험을 검토하고 기존 프로젝트 보완과 새 항목 추가를 함께 적용한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "원본 자료"), ResumeSchema.parse({ ...resume, projects: [{ name: "기존 프로젝트", description: "API 구현" }] }));
  const stored = await mockStorage(page, initial);
  let question = 0;
  await page.route("**/api/experience-discovery", (route) => {
    const body = route.request().postDataJSON();
    expect(body.company).toBeUndefined();
    if (!body.messages.length) question++;
    const result = body.messages.length ? { status: "draft", message: "내용을 확인해 주세요.", draft: { category: "project", title: `경험 ${question}`, organization: "", role: "개발자", period: "2025", description: `추가 사실 ${question}`, techStack: ["Java"] } } : { status: "question", message: "직접 맡은 역할은 무엇인가요?", draft: null };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: result })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto("/workspace/resume");
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: "새 질문 받기", exact: true }).click();
    await page.getByRole("textbox", { name: "내 답변", exact: true }).fill(`실제로 수행한 경험 ${index + 1}`);
    await page.getByRole("button", { name: "답변 보내기", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "이 경험 반영", exact: true })).toHaveCount(index + 1);
  }
  await page.getByRole("combobox", { name: "반영할 위치", exact: true }).first().selectOption("project:0");
  for (const checkbox of await page.getByRole("checkbox", { name: "이 경험 반영", exact: true }).all()) await checkbox.check();
  await page.getByRole("button", { name: "선택한 경험을 모아서 반영", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.projects.length).toBe(2);
  expect(stored().master?.resume?.projects[0].description).toContain("API 구현");
  expect(stored().master?.resume?.projects[0].description).toContain("추가 사실 1");
  expect(stored().master?.document.source.originalText).toBe("원본 자료");
});

test("회사별 공고를 확정하면 소개글 없이 PDF를 만들 수 있고 모델 설정이 맞춤 요청에 전달된다", async ({ page }) => {
  const initial: Workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "내 이력서", "개발 경력"), resume);
  const stored = await mockStorage(page, initial);
  const company = { companyName: "예시 회사", jobTitle: "백엔드 개발자", companyDescription: "", jobDescription: "API 개발", requirements: ["Java"], preferredSkills: [], techStack: ["Java"] };
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("job", "새 공고", "예시 회사 Java 채용"), warnings: [] } } }));
  await page.route("**/api/company", (route) => route.fulfill({ json: { ok: true, data: company } }));
  let model = "";
  await page.route("**/api/resume/tailor/stream", (route) => {
    const request = route.request().postDataJSON(); model = request.agent.model;
    const plan = { headline: { text: "맞춤 제목", evidenceIds: ["summary"] }, summary: { text: "맞춤 소개", evidenceIds: ["summary"] }, experience: [], projects: [], requirementMatches: [], skillIds: [], highlightIds: [], strengthIds: [] };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: { plan, resume: request.resume } })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto("/workspace/settings");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).selectOption("direct");
  await page.getByLabel("모델 ID", { exact: true }).fill("test-model");
  await expect.poll(() => stored().settings.model).toBe("test-model");
  await page.getByRole("link", { name: "회사별 이력서", exact: true }).click();
  await page.getByLabel("입력 방법").selectOption("text");
  await page.getByLabel("원문", { exact: true }).fill("예시 회사 Java 채용");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await page.getByRole("button", { name: "검토한 공고 정리", exact: true }).click();
  await page.getByRole("button", { name: "이 공고로 확정", exact: true }).click();
  await page.getByRole("button", { name: "내보내기", exact: true }).click();
  await expect(page.getByRole("button", { name: "PDF 생성·다운로드", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true }).click();
  await page.getByRole("button", { name: "변경 전체 선택", exact: true }).click();
  await page.getByRole("button", { name: /선택한 \d+개 변경 반영/ }).click();
  await expect.poll(() => stored().works[0]?.resume?.summary).toBe("맞춤 소개");
  expect(model).toBe("test-model");
});

test("자료 교체는 별도 창에서 안내하고 취소하면 기존 문서를 유지한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "내 이력서.md", "기존 문서"), resume);
  const stored = await mockStorage(page, initial);
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "자료 교체", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이력서 자료 교체", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("새 자료를 추출하면 현재 검토 문서와 수정 댓글이 교체됩니다.");
  await page.getByRole("button", { name: "교체 취소", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("기존 문서");
  expect(stored().master?.document.text).toBe("기존 문서");
});
