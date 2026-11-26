import { mockModelCatalog } from "./helpers/model-catalog";
import { test, expect, type Page } from "@playwright/test";
import { createEmptyWorkspace, type Workspace } from "../../src/entities/workspace/model/workspace";
import { createCompanyWork, newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { createResultDraft } from "../../src/entities/workspace/model/resume-result-draft";
import { CompanySchema, ResumeSchema } from "../../src/shared/lib/schemas";
const resume = ResumeSchema.parse({ name: "예시 개발자", summary: "원본 소개", desiredPosition: "백엔드 개발자", techStack: ["Java"] });
async function mockStorage(page: Page, initial = createEmptyWorkspace()) {
  // 문서 도구 동작은 저장본이 아닌 명시적인 이력서 편집 초안에서 검증한다.
  if (initial.master?.resume) {
    const document = initial.master.document;
    initial = { ...initial, master: { ...initial.master, resultDraft: { ...createResultDraft(initial.master.resume, document.text, [], true, document.text), document: { ...document, source: { ...document.source, type: "markdown" } } } } };
  }
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
test("자료는 직접 확인하고 댓글은 이력서 편집에서 반영한 뒤 저장한다", async ({ page }) => {
  const stored = await mockStorage(page);
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("resume", "새 이력서", "J a v a 개발자"), warnings: [] } } }));
  await page.route("**/api/resume", (route) => route.fulfill({ json: { ok: true, data: { ...resume, summary: "Java 개발자" } } }));
  await page.route("**/api/workspace/review", (route) => {
    const { document } = route.request().postDataJSON();
    const start = document.text.indexOf("Java 개발자");
    return route.fulfill({ json: { ok: true, data: { sourceText: document.text, unresolved: [], changes: [{ id: "wording", start, end: start + "Java 개발자".length, before: "Java 개발자", after: "Java 백엔드 개발자", reason: "표현 정리", commentIds: document.annotations.map((item: { id: string }) => item.id) }] } } });
  });
  await page.goto("/workspace/resume");
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByLabel("원문", { exact: true }).fill("J a v a 개발자");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await expect(page.getByRole("button", { name: "댓글 0개", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.locator("textarea[name=review-document]").fill("Java 개발자");
  await page.getByRole("button", { name: "읽기", exact: true }).click();
  await page.getByRole("button", { name: "검토한 내용으로 이력서 정리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "이력서 편집", exact: true })).toBeVisible();
  const text = await page.getByRole("region", { name: "추출 문서", exact: true }).textContent();
  const start = text!.indexOf("Java 개발자");
  await selectDocumentText(page, start, start + "Java 개발자".length);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByLabel("수정 요청", { exact: true }).fill("백엔드 역할로 표현해 줘");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await page.getByRole("button", { name: "댓글 1개", exact: true }).click();
  await page.getByRole("button", { name: "수정 요청 1개 반영", exact: true }).click();
  await page.getByRole("button", { name: "선택한 변경 적용", exact: true }).click();
  await page.getByRole("button", { name: "수정한 결과 다시 정리", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서 확인으로", exact: true }).click();
  await page.getByRole("button", { name: "공통 이력서로 저장", exact: true }).click();
  await expect.poll(() => stored().master?.resume?.name).toBe("예시 개발자");
  await page.reload();
  await expect(page.getByRole("heading", { name: "저장된 공통 이력서", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveCount(0);
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
  expect(stored().master!.resultDraft!.document.annotations).toHaveLength(0);
  await selectDocumentText(page, 0, 3);
  await page.getByRole("button", { name: "댓글 쓰기", exact: true }).click();
  await page.getByLabel("수정 요청", { exact: true }).fill("등록할 수정 요청");
  await page.getByRole("button", { name: "댓글 추가", exact: true }).click();
  await expect.poll(() => stored().master!.resultDraft!.document.annotations.length).toBe(1);
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
  await expect(page.getByRole("button", { name: "댓글 0개", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "직접 편집", exact: true }).click();
  await page.getByRole("textbox", { name: "추출 문서", exact: true }).fill("직접 수정한 이력서");
  await page.getByRole("button", { name: "읽기", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("직접 수정한 이력서");
});

test("AI 질문으로 모은 두 경험을 검토하고 기존 프로젝트 보완과 새 항목 추가를 함께 적용한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "원본 자료"), ResumeSchema.parse({ ...resume, projects: [{ name: "기존 프로젝트", description: "API 구현" }] }));
  const job = newTextDocument("job", "예시 공고", "운영 담당");
  const work = { ...createCompanyWork(initial.master!, job), company: CompanySchema.parse({ companyName: "예시 회사" }), companySourceText: job.text };
  const stored = await mockStorage(page, { ...initial, works: [work] });
  let question = 0;
  await page.route("**/api/experience-discovery", (route) => {
    const body = route.request().postDataJSON();
    expect(body.company).toBeUndefined();
    if (!body.messages.length) question++;
    const result = body.messages.length ? { status: "draft", message: "내용을 확인해 주세요.", draft: { category: "project", title: `경험 ${question}`, organization: "", role: "개발자", period: "2025", description: `추가 사실 ${question}`, techStack: ["Java"] } } : { status: "question", message: "직접 맡은 역할은 무엇인가요?", draft: null };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: result })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "공통 경험 보완", exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await page.getByRole("button", { name: "새 질문 받기", exact: true }).click();
    await page.getByRole("textbox", { name: "내 답변", exact: true }).fill(`실제로 수행한 경험 ${index + 1}`);
    await page.getByRole("button", { name: "답변 보내기", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "이 경험 반영", exact: true })).toHaveCount(index + 1);
  }
  await page.getByRole("textbox", { name: "사용 기술", exact: true }).first().fill("Java, Kafka");
  await page.getByRole("button", { name: "확인한 근거로 저장", exact: true }).first().click();
  await expect.poll(() => stored().confirmedExperiences?.[0].draft.techStack).toEqual(["Java", "Kafka"]);
  await page.getByRole("combobox", { name: "반영할 위치", exact: true }).first().selectOption("project:0");
  for (const checkbox of await page.getByRole("checkbox", { name: "이 경험 반영", exact: true }).all()) await checkbox.check();
  await page.getByRole("button", { name: "선택한 경험을 모아서 반영", exact: true }).click();
  await expect.poll(() => stored().master?.resultDraft?.resume.projects.length).toBe(2);
  expect(stored().master?.resultDraft?.resume.projects[0].description).toContain("API 구현");
  expect(stored().master?.resultDraft?.resume.projects[0].description).toContain("추가 사실 1");
  expect(stored().master?.resume?.projects).toHaveLength(1);
  expect(stored().master?.document.source.originalText).toBe("원본 자료");
  await page.getByText("반영한 경험 2개", { exact: true }).click();
  const accepted = page.getByRole("article").filter({ has: page.getByText("경험 2", { exact: true }) });
  await accepted.getByRole("button", { name: "확인한 근거로 저장", exact: true }).click();
  await expect.poll(() => stored().confirmedExperiences?.map(({ draft }) => draft.title)).toEqual(["경험 2", "경험 1"]);


  await page.route("**/api/resume/tailor/stream", (route) => {
    const { resume, confirmedExperiences } = route.request().postDataJSON();
    expect(confirmedExperiences).toEqual(stored().confirmedExperiences);
    const factId = `confirmed-${confirmedExperiences.find((fact: { draft: { title: string } }) => fact.draft.title === "경험 1").id}`;
    const plan = { headline: { text: "Kafka 기반 경험", evidenceIds: [factId] }, summary: { text: "맞춤 소개", evidenceIds: [factId] }, experience: [], projects: [], requirementMatches: [], skillIds: [], highlightIds: [], strengthIds: [] };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: { plan, resume } })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  await page.getByText("다른 원본으로 제안 받기", { exact: true }).click();
  await page.getByRole("button", { name: "공통 원본으로 맞춤 제안 받기" }).click();
  const review = page.getByRole("region", { name: "회사 맞춤 변경 검토" });
  const headline = review.getByRole("article").filter({ has: page.getByRole("checkbox", { name: "한 줄 소개", exact: true }) });
  await expect(headline.getByText("Kafka 기반 경험")).toBeVisible();
  await headline.getByText("제안에 사용한 원본 근거 1개").click();
  await expect(headline.getByText("확인한 경험 · 경험 1")).toBeVisible();
  await expect(headline.getByText("연결된 원본에서 확인되지 않는 표현")).toHaveCount(0);
});

test("회사별 공고를 확정하면 소개글 없이 PDF를 만들 수 있고 모델 설정이 맞춤 요청에 전달된다", async ({ page }) => {
  const source = { ...resume, summary: "응답 시간을 개선했습니다." };
  const initial: Workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "내 이력서", "개발 경력"), source);
  const stored = await mockStorage(page, initial);
  const company = { companyName: "예시 회사", jobTitle: "백엔드 개발자", companyDescription: "", jobDescription: "API 개발", requirements: ["Java"], preferredSkills: [], techStack: ["Java"] };
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("job", "새 공고", "예시 회사 Java 채용"), warnings: [] } } }));
  await page.route("**/api/company", (route) => route.fulfill({ json: { ok: true, data: company } }));
  let model = "";
  await page.route("**/api/resume/tailor/stream", (route) => {
    const request = route.request().postDataJSON(); model = request.agent.model;
    const plan = { headline: { text: "Kubernetes로 응답 시간을 40% 개선", evidenceIds: ["summary"] }, summary: { text: "맞춤 소개", evidenceIds: ["summary"] }, experience: [], projects: [], requirementMatches: [], skillIds: [], highlightIds: [], strengthIds: [] };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: { plan, resume: request.resume } })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await mockModelCatalog(page);
  await page.goto("/workspace/settings");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "test-model", exact: true }).click();
  await expect.poll(() => stored().settings.model).toBe("test-model");
  await page.getByRole("link", { name: "회사별 이력서", exact: true }).click();
  await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
  await page.getByLabel("원문", { exact: true }).fill("예시 회사 Java 채용");
  await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  await page.getByRole("button", { name: "검토한 공고 정리", exact: true }).click();
  await page.getByRole("button", { name: "이 공고로 확정", exact: true }).click();
  await page.getByRole("button", { name: "PDF 디자인·다운로드", exact: true }).click();
  await page.getByRole("button", { name: "Classic · Cobalt 선택", exact: true }).click();
  await expect(page.getByRole("button", { name: "PDF 생성·다운로드", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "맞춤 편집", exact: true }).click();
  await page.getByRole("button", { name: "현재 편집본으로 맞춤 제안 받기", exact: true }).click();
  const review = page.getByRole("region", { name: "회사 맞춤 변경 검토" });
  const warning = review.getByText("연결된 원본에서 확인되지 않는 표현", { exact: true });
  await expect(warning).toHaveCount(1);
  const flagged = review.getByRole("article").filter({ has: page.getByRole("checkbox", { name: "한 줄 소개", exact: true }) });
  await expect(flagged.getByText("연결된 원본에서 확인되지 않는 표현", { exact: true })).toBeVisible();
  await expect(flagged.getByText("수치 40%", { exact: true })).toBeVisible();
  await expect(flagged.getByText("기술 Kubernetes", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "변경 전체 선택", exact: true }).click();
  const apply = review.getByRole("button", { name: /선택한 \d+개 변경 반영/ });
  await flagged.getByRole("button", { name: "문구 수정", exact: true }).click();
  const wording = flagged.getByRole("textbox", { name: "수정할 문구" });
  const recheck = flagged.getByRole("button", { name: "수정 후 근거 다시 확인" });
  await expect(wording).toBeFocused();
  await expect(apply).toBeDisabled();
  await wording.fill("   ");
  await expect(recheck).toBeDisabled();
  await wording.fill("응답 시간을 25% 개선");
  await recheck.click();
  await expect(flagged.getByText("수치 25%", { exact: true })).toBeVisible();
  await expect(flagged.getByText("수치 40%", { exact: true })).toHaveCount(0);
  await expect(flagged.getByText("기술 Kubernetes", { exact: true })).toHaveCount(0);
  await flagged.getByRole("button", { name: "문구 수정", exact: true }).click();
  await wording.fill("응답 시간 개선");
  await recheck.click();
  await expect(flagged.getByText("수치·기술 추가 경고 없음", { exact: true })).toBeVisible();
  await expect(warning).toHaveCount(0);
  await apply.click();
  await expect.poll(() => stored().works[0]?.resume?.headline).toBe("응답 시간 개선");
  await expect.poll(() => stored().works[0]?.resume?.summary).toBe("맞춤 소개");
  await page.reload();
  const coverage = page.getByRole("region", { name: "공고 요건 충족 현황" });
  await expect(coverage).toContainText("필수 1개");
  await coverage.getByText("공고 요건과 경험 연결", { exact: true }).click();
  await expect(coverage).toContainText("최근 맞춤 제안에서 사용한 이력서 근거입니다.");
  expect(model).toBe("test-model");
});

test("자료 교체는 별도 창에서 안내하고 취소하면 기존 문서를 유지한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "내 이력서.md", "기존 문서"), resume);
  const stored = await mockStorage(page, initial);
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "자료 확인 단계", exact: true }).click();
  await page.getByRole("button", { name: "자료 교체", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "이력서 자료 교체", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("새 자료를 추출하면 현재 검토 문서와 수정 댓글이 교체됩니다.");
  await page.getByRole("button", { name: "교체 취소", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("기존 문서");
  expect(stored().master?.document.text).toBe("기존 문서");
});

test("공고 요건에서 경험 보완을 시작하고 해당 경험 없음 기록을 취소할 수 있다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "개발 경력"), resume);
  const document = newTextDocument("job", "예시 공고", "Kubernetes 운영 경험");
  const company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "백엔드 개발자", requirements: [document.text] });
  const work = createCompanyWork(initial.master!, document);
  const plan = {
    headline: { text: "맞춤 제목", evidenceIds: ["summary"] },
    summary: { text: "맞춤 소개", evidenceIds: ["summary"] },
    experience: [], projects: [], skillIds: [], highlightIds: [], strengthIds: [],
    requirementMatches: [{ requirementId: "requirement-1", matchType: "gap" as const, evidenceIds: [], reason: "원본에 운영 경험이 없습니다." }],
  };
  const stored = await mockStorage(page, { ...initial, works: [{
    ...work, company, companySourceText: document.text,
    tailoring: { plan, sourceResume: resume, editingSnapshot: resume, resume },
  }] });
  await page.route("**/api/experience-discovery", (route) => {
    expect(route.request().postDataJSON().requirement).toBe(document.text);
    const result = { status: "question", message: "직접 맡은 운영 업무가 있었나요?", draft: null };
    return route.fulfill({ contentType: "text/event-stream", body: `event: result\ndata: ${JSON.stringify({ data: result })}\n\nevent: done\ndata: {"ok":true}\n\n` });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  const coverage = page.getByRole("region", { name: "공고 요건 충족 현황" });
  await expect(coverage).toContainText("필수 1개 · 직접 근거 0개 · 관련 경험 0개 · 미확인 1개");
  await page.getByRole("button", { name: "공고 검토", exact: true }).click();
  await coverage.getByText("공고 요건과 경험 연결", { exact: true }).click();
  await coverage.getByRole("button", { name: "이 경험 확인하기", exact: true }).click();
  const topic = page.getByRole("textbox", { name: "보완할 내용", exact: true });
  await expect(topic).toHaveValue(document.text);
  await expect(topic).toBeFocused();
  await page.getByRole("button", { name: "새 질문 받기", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "내 답변", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "해당 경험 없음", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "내 답변", exact: true })).toHaveCount(0);
  await expect.poll(() => stored().works[0].knownGaps).toEqual([document.text]);
  await page.reload();
  await page.getByText("공고 요건과 경험 연결", { exact: false }).click();
  await expect(page.getByText("해당 경험 없음", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "이 경험 확인하기", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "기록 취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "이 경험 확인하기", exact: true })).toBeVisible();
  await expect.poll(() => stored().works[0].knownGaps).toEqual([]);
});

test("원본 비교는 최초 원문과 편집본을 구분하고 댓글 보조 도구는 더보기에서 연다", async ({ page }) => {
  const document = newTextDocument("resume", "내 이력서.md", "최초 원문");
  document.text = "수정 중인 내용";
  await mockStorage(page, publishMasterResume(createEmptyWorkspace(), document, resume));
  await page.goto("/workspace/resume");
  await expect(page.getByRole("region", { name: "보관된 원본", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "원본과 비교", exact: true }).click();
  await expect(page.getByRole("region", { name: "보관된 원본", exact: true })).toContainText("최초 원문");
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toHaveText("수정 중인 내용");
  await expect(page.getByRole("button", { name: "문서 전체에 댓글", exact: true })).not.toBeVisible();
  await page.getByText("더보기", { exact: true }).click();
  await page.getByRole("button", { name: "문서 전체에 댓글", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "수정 댓글 작성", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("dialog", { name: "원본 자료", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "원본 닫기", exact: true }).click();
  await expect(page.getByRole("region", { name: "추출 문서", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "원본 열기", exact: true }).click();
  await expect(page.getByRole("region", { name: "보관된 원본", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "원본 열기", exact: true })).toBeFocused();
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("PDF 원본 비교는 페이지 이동과 확대를 제공한다", async ({ page }) => {
  const document = newTextDocument("resume", "예시.pdf", "추출한 PDF 내용");
  document.source = { type: "pdf", originalText: "PDF 원문", attachmentId: "00000000-0000-4000-8000-000000000001", pages: [{ page: 1, text: "첫 페이지", method: "text", imageId: "00000000-0000-4000-8000-000000000002" }, { page: 2, text: "둘째 페이지", method: "ocr", imageId: "00000000-0000-4000-8000-000000000003" }] };
  await mockStorage(page, publishMasterResume(createEmptyWorkspace(), document, resume));
  await page.goto("/workspace/resume");
  await page.getByRole("button", { name: "원본과 비교", exact: true }).click();
  await page.getByRole("button", { name: "다음 원본 페이지", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "원본 페이지", exact: true })).toContainText("2 / 2페이지");
  await page.getByRole("combobox", { name: "원본 페이지", exact: true }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "원본 페이지", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "다음 원본 페이지", exact: true })).toBeDisabled();
  await expect(page.getByRole("img", { name: "원본 2페이지. 드래그로 영역을 선택할 수 있습니다.", exact: true })).toHaveAttribute("src", /000000000003/);
  await page.getByRole("combobox", { name: "원본 확대", exact: true }).click();
  await page.getByRole("option", { name: "150%", exact: true }).click();
  await expect(page.locator(".source-region")).toHaveAttribute("style", /150%/);
  await page.getByRole("button", { name: "원본 추가 도구", exact: true }).click();
  await page.getByRole("menuitem", { name: "현재 페이지에 댓글", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "수정 댓글 작성", exact: true });
  await expect(composer).toBeVisible();
  expect((await composer.boundingBox())!.x).toBeGreaterThan(100);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("button", { name: "원본 추가 도구", exact: true })).toBeFocused();
});

test("긴 원문 비교는 양쪽 패널 높이를 맞추고 내부에서 스크롤한다", async ({ page }) => {
  const document = newTextDocument("resume", "긴 자료", "비교할 내용입니다.\n\n".repeat(200));
  await mockStorage(page, publishMasterResume(createEmptyWorkspace(), document, resume));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/workspace/resume");
  expect((await page.locator(".studio-document-column:visible").boundingBox())!.height).toBeLessThanOrEqual(760);
  await page.getByRole("button", { name: "원본과 비교", exact: true }).click();
  const original = await page.locator(".review-original-panel").boundingBox();
  const review = await page.locator(".studio-document-column:visible").boundingBox();
  expect(Math.abs(original!.height - review!.height)).toBeLessThan(2);
  expect(review!.height).toBeLessThanOrEqual(760);
  for (const selector of [".source-original", ".review-document"]) {
    expect(await page.locator(`${selector}:visible`).evaluate((element) => element.scrollHeight > element.clientHeight && getComputedStyle(element).overflowY === "auto")).toBe(true);
  }
});

test("중복 공고 알림에서 기존 작업을 열거나 별도 작업을 만들 수 있다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "개발 경력"), resume);
  const text = "예시 회사에서 백엔드 개발자를 채용합니다. 결제 API 개발과 운영을 담당합니다.";
  const document = newTextDocument("job", "기존 공고", text);
  const work = createCompanyWork(initial.master!, document);
  const stored = await mockStorage(page, { ...initial, works: [work] });
  await page.route("**/api/workspace/source", (route) => route.fulfill({ json: { ok: true, data: { document: newTextDocument("job", "같은 공고", text), warnings: [] } } }));

  const enterPosting = async () => {
    await page.goto("/workspace/companies");
    await page.getByRole("button", { name: "새 공고로 이력서 만들기", exact: true }).click();
    await page.getByRole("tab", { name: "텍스트·Markdown", exact: true }).click();
    await page.getByRole("textbox", { name: "원문", exact: true }).fill(text);
    await page.getByRole("button", { name: "내용 추출", exact: true }).click();
  };
  await enterPosting();
  const duplicate = page.getByRole("region", { name: "중복 공고 확인", exact: true });
  await expect(duplicate).toContainText("같은 공고 본문");
  expect(stored().works).toHaveLength(1);
  await duplicate.getByRole("link", { name: "기존 작업 열기 · 기존 공고", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(work.id + "$"));
  expect(stored().works).toHaveLength(1);

  await enterPosting();
  await duplicate.getByRole("button", { name: "새 작업으로 등록", exact: true }).click();
  await expect.poll(() => stored().works.length).toBe(2);
  await expect(page).toHaveURL(new RegExp(stored().works[0].id + "$"));
});
