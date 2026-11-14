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
  await page.getByLabel("입력 방법").selectOption("text");
  await page.getByLabel("원문", { exact: true }).fill("J a v a 개발자");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await page.getByRole("region", { name: "추출 문서", exact: true }).evaluate((element) => {
    const node = element.firstChild!.firstChild!;
    const range = element.ownerDocument.createRange(); range.setStart(node, 0); range.setEnd(node, 7);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByLabel("수정 요청", { exact: true }).fill("Java로 합쳐줘");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect(page.locator(".review-document mark")).toHaveText("J a v a");
  await page.getByRole("button", { name: "수정 요청 1개 반영", exact: true }).click();
  await page.getByRole("button", { name: "선택한 변경 적용", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("Java 개발자");
  await page.getByRole("button", { name: "검토한 내용으로 이력서 정리", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 확정", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.name).toBe("예시 개발자");
  await page.reload();
  await expect(page.getByText("확정 이력서 · 버전 1", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "PDF 생성·다운로드", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true }).click();
  await page.getByRole("button", { name: "모든 표현 선택", exact: true }).click();
  await page.getByRole("button", { name: "선택한 표현 적용", exact: true }).click();
  await expect.poll(() => stored().works[0]?.resume?.summary).toBe("맞춤 소개");
  expect(model).toBe("test-model");
});
