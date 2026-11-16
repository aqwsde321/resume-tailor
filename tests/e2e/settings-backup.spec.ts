import { test, expect } from "@playwright/test";
import { createEmptyWorkspace } from "../../src/entities/workspace/model/workspace";
import { mockModelCatalog } from "./helpers/model-catalog";

test("설정은 이전 가져오기를 제거하고 전체 작업 백업 범위와 다운로드·복원을 제공한다", async ({ page }) => {
  let stored = { ...createEmptyWorkspace(), legacyBackup: {} };
  await mockModelCatalog(page);
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { ok: true, data: stored } }));
  let restored = false;
  await page.route("**/api/workspace/backup", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().headers()["if-match"]).toBe(String(stored.revision));
      stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
      restored = true;
      await route.fulfill({ json: { ok: true, data: stored } });
    } else await route.fulfill({ headers: { "content-disposition": "attachment; filename=resume-workspace-backup.json" }, json: { format: "resume-workspace-backup-v1", workspace: stored, attachments: [] } });
  });
  await page.goto("/workspace/settings");
  await expect(page.getByRole("heading", { name: "이전 브라우저 자료 가져오기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "전체 작업 백업", exact: true })).toBeVisible();
  const scope = page.getByRole("list", { name: "백업에 포함되는 자료", exact: true });
  await expect(scope).toContainText("내 이력서");
  await expect(scope).toContainText("회사별 작업");
  await expect(scope).toContainText("댓글과 수정 이력");
  await expect(scope).toContainText("원본 파일과 PDF");
  await expect(scope).toContainText("AI 설정");
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "전체 작업 백업 다운로드", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("resume-workspace-backup.json");
  const restore = page.getByRole("button", { name: "전체 작업 복원", exact: true });
  await expect(restore).toBeDisabled();
  const bundle = { format: "resume-workspace-backup-v1", workspace: { ...stored, settings: { ...stored.settings, model: "test-model" } }, attachments: [] };
  await page.getByLabel("복원할 백업 파일", { exact: true }).setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(restore).toBeDisabled();
  const confirmed = page.getByRole("checkbox", { name: /현재 작업 전체를 백업 내용으로/ });
  await confirmed.check();
  await restore.click();
  await expect.poll(() => restored).toBe(true);
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("test-model");
  await expect(confirmed).not.toBeChecked();
});
