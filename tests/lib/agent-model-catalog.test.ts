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
