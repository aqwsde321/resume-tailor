import type { AgentRunOptions, AgentSettings, ModelReasoningEffort } from "@/shared/lib/types";

export const MODEL_REASONING_EFFORT_VALUES = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
] as const satisfies readonly ModelReasoningEffort[];

export const MODEL_REASONING_EFFORT_LABELS: Record<ModelReasoningEffort, string> = {
  minimal: "가볍게",
  low: "낮게",
  medium: "보통",
  high: "높게",
  xhigh: "깊게"
};

export function isModelReasoningEffort(value: unknown): value is ModelReasoningEffort {
  return typeof value === "string" && MODEL_REASONING_EFFORT_VALUES.includes(value as ModelReasoningEffort);
}

export function normalizeAgentSettings(raw: unknown): AgentSettings {
  if (!raw || typeof raw !== "object") {
    return {
      model: "",
      modelReasoningEffort: "medium"
    };
  }

  const value = raw as Partial<AgentSettings>;

  return {
    model: "",
    modelReasoningEffort: isModelReasoningEffort(value.modelReasoningEffort)
      ? value.modelReasoningEffort
      : "medium"
  };
}

export function toAgentRunOptions(settings: AgentSettings): AgentRunOptions {
  return {
    modelReasoningEffort: settings.modelReasoningEffort || "medium"
  };
}

export function formatReasoningEffortValue(value: AgentSettings["modelReasoningEffort"]): string {
  return MODEL_REASONING_EFFORT_LABELS[value || "medium"];
}
