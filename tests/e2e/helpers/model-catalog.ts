import type { Page } from "@playwright/test";
export async function mockModelCatalog(page: Page) {
  await page.route("**/api/workspace/agent-models", (route) => route.fulfill({ json: { ok: true, data: {
    codex: [{ value: "", label: "Codex 기본 모델" }, ...["test-model", "first-model", "latest-model", "local-model"].map((value) => ({ value, label: value }))],
    claude: [{ value: "", label: "Claude Code 기본 모델" }, { value: "sonnet", label: "Sonnet" }, { value: "opus", label: "Opus" }], codexSource: "cache",
  } } }));
}
