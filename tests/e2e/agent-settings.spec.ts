import { test, expect } from "@playwright/test";
import { createEmptyWorkspace, type Workspace } from "../../src/entities/workspace/model/workspace";
import { mockModelCatalog } from "./helpers/model-catalog";
test("실행 도구와 모델은 선택 상자로 고르고 저장·새로고침 후에도 유지한다", async ({ page }) => {
  let stored: Workspace = createEmptyWorkspace();
  await mockModelCatalog(page);
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto("/workspace/settings");
  await expect(page.getByRole("combobox", { name: "Reasoning effort", exact: true })).toContainText("모델 기본값");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "test-model", exact: true }).click();
  await expect.poll(() => stored.settings.model).toBe("test-model");
  await page.getByRole("combobox", { name: "AI 실행 도구", exact: true }).click();
  await page.getByRole("option", { name: "Claude Code", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("Claude Code 기본 모델");
  await expect(page.getByRole("combobox", { name: "Effort", exact: true })).toContainText("모델 기본값");
  await page.getByRole("combobox", { name: "모델 선택", exact: true }).click();
  await page.getByRole("option", { name: "Sonnet", exact: true }).click();
  await expect.poll(() => stored.settings).toMatchObject({ provider: "claude", model: "sonnet" });
  await page.reload();
  await expect(page.getByRole("combobox", { name: "AI 실행 도구", exact: true })).toContainText("Claude Code");
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("Sonnet");
  await expect(page.locator("input[name=model-id]")).toHaveCount(0);
  await page.getByRole("combobox", { name: "AI 실행 도구", exact: true }).click();
  await page.getByRole("option", { name: "Codex", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "모델 선택", exact: true })).toContainText("Codex 기본 모델");
});

test("모델별 effort와 기본값을 표시하고 모델 변경 시 이전 단계를 전달하지 않는다", async ({ page }) => {
  let stored: Workspace = createEmptyWorkspace();
  await mockModelCatalog(page);
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "PUT") stored = { ...route.request().postDataJSON().workspace, revision: stored.revision + 1 };
    await route.fulfill({ json: { ok: true, data: stored } });
  });
  await page.goto("/workspace/settings");
  const models = page.getByRole("combobox", { name: "모델 선택", exact: true });
  const efforts = page.getByRole("combobox", { name: "Reasoning effort", exact: true });
  await models.click(); await page.getByRole("option", { name: "GPT-6.1 Terra", exact: true }).click();
  await expect(efforts).toContainText("모델 기본값 (low)");
  await efforts.click();
  await expect(page.getByRole("option", { name: "minimal", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "max", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "ultra", exact: true }).click();
  await expect.poll(() => stored.settings.modelReasoningEffort).toBe("ultra");
  await page.reload(); await expect(efforts).toContainText("ultra");
  await models.click(); await page.getByRole("option", { name: "GPT-6 Luna", exact: true }).click();
  await expect(efforts).toContainText("모델 기본값 (medium)");
  await expect.poll(() => stored.settings.modelReasoningEffort).toBe("");
  await efforts.click();
  await expect(page.getByRole("option", { name: "ultra", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "high", exact: true }).click();
  await expect.poll(() => stored.settings.modelReasoningEffort).toBe("high");
});
