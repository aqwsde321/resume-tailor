import { mockModelCatalog } from "./helpers/model-catalog";
import { test, expect } from "@playwright/test";
import { createCompanyWork, newTextDocument, publishMasterResume } from "../../src/entities/workspace/model/operations";
import { CompanySchema, ResumeSchema } from "../../src/shared/lib/schemas";
import { createEmptyWorkspace } from "../../src/entities/workspace/model/workspace";

test("처음 불러오기 실패는 저장 실패와 구분하고 다시 불러올 수 있다", async ({ page }) => {
  let fail = true;
  await page.route("**/api/workspace", (route) => route.fulfill(fail
    ? { status: 503, json: { ok: false, error: { message: "일시적인 연결 오류" } } }
    : { json: { ok: true, data: createEmptyWorkspace() } }));
  await mockModelCatalog(page);
  await page.goto("/workspace/settings");
  await expect(page.getByRole("heading", { name: "자료를 불러오지 못했습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "편집 내용 복구 파일 저장" })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI 실행 설정" })).toBeVisible();
});

test("저장 실패 후 입력을 유지하고 최신 편집본을 다시 저장한다", async ({ page }) => {
  let stored = createEmptyWorkspace();
  let fail = true;
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") {
      if (fail) return route.fulfill({ status: 503, json: { ok: false, error: { message: "연결 오류" } } });
      stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    }
    return route.fulfill({ json: { ok: true, data: stored } });
  });
  await mockModelCatalog(page);
  await page.goto("/workspace/settings");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "first-model", exact: true }).click();
  await expect(page.getByRole("heading", { name: "편집 내용을 저장하지 못했습니다" })).toBeVisible();
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "latest-model", exact: true }).click();
  fail = false;
  await page.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect.poll(() => stored.settings.model).toBe("latest-model");
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("latest-model");
});

test("409 충돌은 덮어쓰지 않고 복구 파일 저장 후 명시적으로 다시 불러온다", async ({ page }) => {
  let writes = 0;
  let reads = 0;
  await page.route("**/api/workspace", (route) => {
    if (route.request().method() === "PUT") {
      writes += 1;
      return route.fulfill({ status: 409, json: { ok: false, error: { message: "다른 탭에서 수정" } } });
    }
    reads += 1;
    return route.fulfill({ json: { ok: true, data: createEmptyWorkspace() } });
  });
  await mockModelCatalog(page);
  await page.goto("/workspace/settings");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "local-model", exact: true }).click();
  await expect(page.getByRole("heading", { name: "다른 창에서 자료가 변경되었습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 저장", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "서버 자료 다시 불러오기", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "서버 자료로 바꾸기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "편집본을 보관했고 서버 자료 불러오기" })).toBeDisabled();
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("local-model");
  expect(reads).toBe(1);
  expect(writes).toBe(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "편집 내용 복구 파일 저장" }).click();
  await download;
  await page.getByRole("button", { name: "서버 자료 다시 불러오기", exact: true }).click();
  await page.getByRole("button", { name: "편집본을 보관했고 서버 자료 불러오기" }).click();
  await expect.poll(() => reads).toBe(2);
  expect(writes).toBe(1);
});


test("공고 정리 요청을 중단하면 늦은 결과를 표시하지 않고 같은 요청을 재시도한다", async ({ page }) => {
  const initial = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "예시 이력서", "Java 개발 경험"), ResumeSchema.parse({ name: "예시 개발자" }));
  const work = createCompanyWork(initial.master!, newTextDocument("job", "예시 공고", "백엔드 개발자 모집"));
  initial.works.push(work);
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { ok: true, data: initial } }));
  let requests = 0;
  let releaseFirst!: () => void;
  const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const company = CompanySchema.parse({ companyName: "재시도 회사", jobTitle: "백엔드 개발자" });
  await page.route("**/api/company", async (route) => {
    requests += 1;
    if (requests === 1) {
      await firstBlocked;
      // The fetch was aborted; the transport can reject fulfillment of that request.
      await route.fulfill({ json: { ok: true, data: { ...company, companyName: "중단된 결과" } } }).catch(() => undefined);
      return;
    }
    await route.fulfill({ json: { ok: true, data: company } });
  });
  await page.goto(`/workspace/companies/${work.id}`);
  await page.getByRole("button", { name: "검토한 공고 정리", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await page.getByRole("button", { name: "작업 중단", exact: true }).click();
  await expect(page.getByText("작업을 중단했습니다", { exact: true })).toBeVisible();
  releaseFirst();
  await expect(page.getByRole("heading", { name: "정리된 공고 확인" })).toHaveCount(0);
  await page.getByRole("button", { name: "같은 요청 다시 시도", exact: true }).click();
  await expect(page.getByRole("heading", { name: "재시도 회사 · 백엔드 개발자" })).toBeVisible();
  await expect(page.getByText("중단된 결과", { exact: true })).toHaveCount(0);
  expect(requests).toBe(2);
});
