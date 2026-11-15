export interface AgentModelOption { value: string; label: string }
export interface AgentModelCatalog {
  codex: AgentModelOption[];
  claude: AgentModelOption[];
  codexSource: "cache" | "default";
}
export const CLAUDE_MODEL_OPTIONS: AgentModelOption[] = [
  { value: "", label: "Claude Code 기본 모델" },
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
  { value: "fable", label: "Fable" },
];
export const DEFAULT_AGENT_MODELS: AgentModelCatalog = {
  codex: [{ value: "", label: "Codex 기본 모델" }],
  claude: CLAUDE_MODEL_OPTIONS,
  codexSource: "default",
};
