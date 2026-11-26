import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  await page.getByRole("region", { name: "공고 검토 단계", exact: true }).getByText("더보기", { exact: true }).click();
  await page.getByRole("button", { name: "문서 전체에 댓글", exact: true }).click();
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("작성 중인 요청");
  await page.getByRole("button", { name: "제출 내용 확인", exact: true }).click();
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
  await page.getByRole("button", { name: "제출 내용 확인", exact: true }).click();
  await page.getByText("PDF 상단 요약 · 선택 사항 · 작성됨", { exact: true }).click();
  await page.getByRole("button", { name: "PDF 상단 요약 만들기", exact: true }).click();
  await page.getByRole("textbox", { name: "PDF 상단 요약", exact: true }).fill("지금 직접 고친 소개글");
  release();
  await expect(page.getByRole("button", { name: "PDF 상단 요약 만들기", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "PDF 상단 요약", exact: true })).toHaveValue("지금 직접 고친 소개글");
  await expect.poll(() => stored().works[0].intro?.longIntro).toBe("지금 직접 고친 소개글");
});

test("고른 PDF를 지원 완료 기록에 고정하고 새 PDF를 출력한 뒤에도 같은 파일을 받는다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  const attachmentIds = Array.from({ length: 3 }, () => crypto.randomUUID());
  let exportCount = 0;
  let attachmentAvailable = false;
  await page.route("**/api/pdf/preview**", (route) => route.fulfill({ json: { ok: true, data: { pages: [] } } }));
  await page.route("**/api/workspace/export", (route) => {
    const id = attachmentIds[exportCount++];
    return route.fulfill({
      contentType: "application/pdf",
      headers: { "X-Workspace-Attachment-ID": id },
      body: `%PDF-${id}`,
    });
  });
  await page.route(`**/api/workspace/attachment/${attachmentIds[0]}`, (route) => attachmentAvailable
    ? route.fulfill({ contentType: "application/pdf", body: `%PDF-${attachmentIds[0]}` })
    : route.fulfill({ status: 404 }));

  await page.goto(`/workspace/companies/${work.id}`);
  const openExport = () => page.getByRole("button", { name: "PDF 디자인·다운로드", exact: true }).click();
  await openExport();
  await page.getByRole("button", { name: "Modern · Forest 선택", exact: true }).click();
  const exportPdf = async () => {
    const done = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF 생성·다운로드", exact: true }).click();
    await done;
  };
  await exportPdf();
  await page.getByRole("button", { name: "제출 내용 확인", exact: true }).click();
  await page.getByText("PDF 상단 요약 · 선택 사항 · 작성됨", { exact: true }).click();
  await page.getByRole("textbox", { name: "PDF 상단 요약", exact: true }).fill("나중에 수정한 소개글");
  await openExport();
  await exportPdf();
  await expect.poll(() => stored().works[0].artifacts?.length).toBe(2);

  const save = page.getByRole("button", { name: "지원 완료 기록", exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole("combobox", { name: "실제 제출한 PDF", exact: true }).selectOption(attachmentIds[0]);
  await expect(page.getByRole("link", { name: "선택한 PDF 확인", exact: true })).toHaveAttribute("href", `/api/workspace/attachment/${attachmentIds[0]}`);
  await page.getByText("최초 지원 메일 초안", { exact: true }).click();
  await page.getByRole("button", { name: "지원 메일 초안 만들기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "받는 사람", exact: true })).toBeEmpty();
  await page.getByRole("textbox", { name: "받는 사람", exact: true }).fill("jobs@example.com");
  await page.getByRole("textbox", { name: "메일 제목", exact: true }).fill("개발자 지원");
  await expect(page.getByRole("link", { name: "메일 앱에서 열기", exact: true })).toHaveAttribute("href", /^mailto:jobs@example\.com\?/);
  await expect(page.getByRole("link", { name: "첨부할 PDF 다운로드", exact: true })).toHaveAttribute("href", `/api/workspace/attachment/${attachmentIds[0]}`);
  await expect.poll(() => stored().works[0].applicationEmailDraft?.artifactId).toBe(attachmentIds[0]);
  await page.reload();
  await openExport();
  await expect(page.getByRole("combobox", { name: "실제 제출한 PDF", exact: true })).toHaveValue(attachmentIds[0]);
  await page.getByText("최초 지원 메일 초안 · 작성됨", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "메일 제목", exact: true })).toHaveValue("개발자 지원");

  await save.click();
  await expect(page.getByText("선택한 PDF를 불러오지 못했어요.", { exact: true })).toBeVisible();
  attachmentAvailable = true;
  await save.click();
  await expect(page.getByText("제출본을 고정했어요.", { exact: true })).toBeVisible();
  await exportPdf();
  await expect.poll(() => stored().works[0].artifacts?.length).toBe(3);
  await page.reload();
  await openExport();
  await expect(save).toHaveCount(0);
  const pinned = page.waitForEvent("download");
  await page.getByRole("button", { name: "고정한 제출본 다운로드", exact: true }).click();
  expect(await readFile(await (await pinned).path(), "utf8")).toBe(`%PDF-${attachmentIds[0]}`);

  await page.getByRole("link", { name: "지원 기록 보기", exact: true }).click();
  const record = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "예시 회사", exact: true }) });
  await expect(record).toHaveCount(1);
  await expect(record.getByRole("combobox", { name: "예시 회사 진행 상태" })).toHaveValue("applied");
  await record.getByText("저장한 자료 보기", { exact: true }).click();
  await expect(record.getByText("사용자가 작성한 소개글", { exact: true })).toBeVisible();
  await record.getByRole("combobox", { name: "예시 회사 진행 상태" }).selectOption("interviewing");
  const downloaded = page.waitForEvent("download");
  await record.getByRole("button", { name: "제출본 PDF 다운로드", exact: true }).click();
  const path = await (await downloaded).path();
  expect(await readFile(path, "utf8")).toBe(`%PDF-${attachmentIds[0]}`);
});

test("회사 편집은 한 문서에서 읽기와 댓글을 제공하고 내보내기는 내부 스크롤로 확인한다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"/>';
  await page.route("**/api/pdf/preview**", (route) => {
    const isThumbnail = new URL(route.request().url()).searchParams.get("firstPageOnly") === "1";
    return route.fulfill({ json: { ok: true, data: { pages: isThumbnail ? [svg] : [svg, svg] } } });
  });
  const attachmentId = crypto.randomUUID();
  await page.route("**/api/workspace/export", (route) => route.fulfill({
    contentType: "application/pdf",
    headers: { "X-Workspace-Attachment-ID": attachmentId },
    body: "%PDF-test"
  }));
  await page.goto(`/workspace/companies/${work.id}`);
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toBeVisible();
  await expect(page.locator(".company-detail-current > .studio-resume-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  const editor = page.locator("textarea[name=review-document]").filter({ visible: true });
  await editor.fill("## 소개\n\n작성 중인 회사별 문장");
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(editor).toHaveValue("## 소개\n\n작성 중인 회사별 문장");
  await page.getByRole("button", { name: "제출 내용 확인", exact: true }).click();
  await expect(page.getByRole("region", { name: "확인할 이력서 본문", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "확인할 이력서 본문", exact: true })).toHaveCSS("overflow-y", "auto");
  await page.getByRole("button", { name: "다음: PDF 디자인 선택", exact: true }).click();
  await expect(page.getByRole("button", { name: "PDF 디자인·다운로드", exact: true })).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("region", { name: "확인할 이력서 본문", exact: true })).toBeHidden();
  const download = page.getByRole("button", { name: "PDF 생성·다운로드", exact: true });
  await expect(download).toBeDisabled();
  await page.getByRole("button", { name: "Modern · Forest 상세보기", exact: true }).click();
  const detail = page.getByRole("dialog", { name: "Modern · Forest", exact: true });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole("img")).toHaveCount(2);
  await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
  await detail.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.locator("html")).not.toHaveCSS("overflow-y", "hidden");
  await expect(download).toBeDisabled();
  await page.getByRole("button", { name: "Modern · Forest 선택", exact: true }).click();
  await expect(download).toBeEnabled();
  await expect(page.getByText("선택한 디자인 · Modern · Forest", { exact: true })).toBeVisible();
  await expect.poll(() => stored().works[0]).toMatchObject({ pdfTemplateId: "modern", pdfThemeId: "forest" });
  await page.reload();
  await page.getByRole("button", { name: "PDF 디자인·다운로드", exact: true }).click();
  await expect(page.getByRole("button", { name: "Modern · Forest 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  const request = page.waitForRequest((request) => request.url().endsWith("/api/workspace/export"));
  const downloaded = page.waitForEvent("download");
  await download.click();
  expect((await request).postDataJSON()).toMatchObject({ templateId: "modern", themeId: "forest" });
  const filename = `${work.title}.pdf`;
  expect((await downloaded).suggestedFilename()).toBe(filename);
  await expect.poll(() => stored().works[0].artifacts).toEqual([
    expect.objectContaining({ id: attachmentId, name: filename })
  ]);
  await page.getByText("이전에 만든 PDF").click();
  await expect(page.getByRole("link", { name: filename })).toHaveAttribute("href", `/api/workspace/attachment/${attachmentId}`);
  await page.getByRole("button", { name: "제출 내용 확인", exact: true }).click();
  await expect(page.getByRole("region", { name: "확인할 이력서 본문", exact: true })).toBeVisible();
});

test("새 회사 공고 등록은 명시적으로 열고 닫아도 입력을 보존한다", async ({ page }) => {
  await companyWithDeferredAi(page);
  await page.goto("/workspace/companies");
  const toggle = page.getByRole("button", { name: "새 공고로 이력서 만들기", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByRole("textbox", { name: "원문", exact: true }).fill("입력 중인 공고");
  await toggle.click();
  await expect(page.getByRole("textbox", { name: "원문", exact: true })).toBeHidden();
  await toggle.click();
  await expect(page.getByRole("textbox", { name: "원문", exact: true })).toHaveValue("입력 중인 공고");
});

test("회사별 Markdown 문장에서 댓글을 달고 단계 왕복 후에도 유지한다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  await page.goto(`/workspace/companies/${work.id}`);
  const document = page.getByRole("region", { name: "추출 문서", exact: true });
  await document.locator("p").filter({ hasText: "기존 소개" }).evaluate((element) => {
    const range = element.ownerDocument.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByRole("textbox", { name: "수정 요청", exact: true }).fill("회사에 필요한 경험을 강조해 주세요");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect.poll(() => stored().works[0].resumeDocument?.annotations.length).toBe(1);
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "댓글 1개", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "댓글 1개", exact: true })).toBeVisible();
});

test("URL 공고 다시 불러오기는 회사 이력서와 댓글을 보존하고 재확정을 안내한다", async ({ page }) => {
  const { work, stored } = await companyWithDeferredAi(page);
  work.document.source = { ...work.document.source, type: "url", url: "https://www.wanted.co.kr/wd/123456" };
  work.resumeDocument = newTextDocument("resume", "편집본", "기존 회사별 이력서");
  work.resumeDocument.annotations = [{ id: crypto.randomUUID(), instruction: "기존 수정 요청", anchor: { type: "document" }, status: "pending", createdAt: new Date().toISOString() }];
  const next = newTextDocument("job", "전체 공고", "Java 개발자 채용\n우대사항\nSQL 경험\n혜택 및 복지\n교육비\n채용 전형\n면접");
  next.source = { ...next.source, type: "url", url: work.document.source.url };
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: next, warnings: [] } } }));
  const before = JSON.stringify(work.resume);
  await page.goto(`/workspace/companies/${work.id}`);
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await page.getByRole("button", { name: "공고 다시 불러오기", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toContainText("우대사항");
  await expect(page.getByText("공고 원문이 바뀌었습니다.", { exact: true })).toBeVisible();
  await expect.poll(() => stored().works[0].document.text).toBe(next.text);
  expect(JSON.stringify(stored().works[0].resume)).toBe(before);
  expect(stored().works[0].resumeDocument?.annotations).toEqual(work.resumeDocument.annotations);
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "댓글 1개", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await expect(page.getByRole("button", { name: "댓글 1개", exact: true })).toBeVisible();
});
