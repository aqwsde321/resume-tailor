import { describe, expect, it } from "vitest";
import { normalizeAgentSettings, toAgentRunOptions } from "@/shared/lib/agent-settings";
describe("model settings", () => {
  it("사용자가 고른 모델을 저장하고 실제 AI 요청에 전달한다", () => {
    const settings = normalizeAgentSettings({ model: " selected-model ", modelReasoningEffort: "high" });
    expect(settings.model).toBe("selected-model");
    expect(toAgentRunOptions(settings)).toEqual({ model: "selected-model", modelReasoningEffort: "high" });
  });
  it("기본 모델 사용 시 빈 모델 ID를 전달하지 않는다", () => {
    expect(toAgentRunOptions(normalizeAgentSettings({ model: " ", modelReasoningEffort: "medium" }))).toEqual({ modelReasoningEffort: "medium" });
  });
});
