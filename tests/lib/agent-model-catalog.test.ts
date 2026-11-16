import { afterEach, describe, expect, it, vi } from "vitest";
const readFile = vi.hoisted(() => vi.fn());
vi.mock("node:fs/promises", () => ({ readFile }));
import { getAgentModelCatalog } from "@/server/agent-model-catalog";
afterEach(() => vi.restoreAllMocks());
describe("모델 선택 목록", () => {
  it("Codex 공개 목록과 Claude 별칭만 반환하고 숨김 모델을 제외한다", async () => {
    readFile.mockResolvedValue(JSON.stringify({ models: [{ slug: "model-a", display_name: "Model A", visibility: "list" }, { slug: "internal", display_name: "Internal", visibility: "hide" }] }));
    const result = await getAgentModelCatalog();
    expect(result.codex.map((x) => x.value)).toEqual(["", "model-a"]);
    expect(result.claude.map((x) => x.value)).toEqual(["", "sonnet", "opus", "haiku", "fable"]);
  });
  it("캐시가 없어도 기본 모델을 선택할 수 있다", async () => {
    readFile.mockRejectedValue(new Error("missing"));
    const result = await getAgentModelCatalog();
    expect(result.codex).toEqual([{ value: "", label: "Codex 기본 모델" }]);
    expect(result.codexSource).toBe("default");
  });
});

it("모델별 지원 effort와 기본값을 그대로 제공한다", async () => {
  readFile.mockResolvedValue(JSON.stringify({ models: [{ slug: "gpt-6.1-terra", display_name: "GPT-6.1 Terra", visibility: "list", default_reasoning_level: "low", supported_reasoning_levels: ["low", "medium", "high", "xhigh", "max", "ultra"].map((effort) => ({ effort })) }, { slug: "small-model", visibility: "list", default_reasoning_level: "medium", supported_reasoning_levels: [{ effort: "medium" }, { effort: "high" }] }] }));
  const result = await getAgentModelCatalog();
  expect(result.codex[1]).toMatchObject({ defaultReasoningEffort: "low", reasoningEfforts: ["low", "medium", "high", "xhigh", "max", "ultra"] });
  expect(result.codex[2]).toMatchObject({ reasoningEfforts: ["medium", "high"] });
});
