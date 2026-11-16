"use client";
import { useEffect, useState } from "react";
import { Selector } from "@astryxdesign/core/Selector";
import type { AgentSettings } from "@/shared/lib/types";
import { DEFAULT_AGENT_MODELS, type AgentModelCatalog } from "@/shared/lib/agent-models";
import { MODEL_REASONING_EFFORT_VALUES, isModelReasoningEffort } from "@/shared/lib/agent-settings";
import { workspaceRequest } from "../api";
import { StudioIcon } from "./studio-icon";
const DEFAULT_MODEL = "__default__";
export function AgentSettingsPanel({ settings, onChange }: { settings: AgentSettings; onChange: (settings: AgentSettings) => void }) {
  const [catalog, setCatalog] = useState<AgentModelCatalog>(DEFAULT_AGENT_MODELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void workspaceRequest<AgentModelCatalog>("/api/workspace/agent-models", { signal: controller.signal }).then(setCatalog).catch(() => {
      if (!controller.signal.aborted) setError("모델 목록을 불러오지 못했습니다. 기본 모델과 기존 선택은 사용할 수 있습니다.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const provider = settings.provider ?? "codex";
  const models = [...catalog[provider]];
  const legacy = Boolean(settings.model && !models.some((model) => model.value === settings.model));
  if (legacy) models.push({ value: settings.model, label: `${settings.model} · 기존 선택` });
  const efforts = MODEL_REASONING_EFFORT_VALUES.filter((value) => provider !== "claude" || value !== "minimal");
  return <section className="card settings-ai-panel" aria-labelledby="ai-settings-title">
    <header className="settings-section-heading"><span className="settings-section-icon"><StudioIcon name="sparkle" size={20} /></span><div><h2 id="ai-settings-title">AI 실행 설정</h2><p>사용할 도구와 모델을 고르세요. 변경 사항은 자동 저장됩니다.</p></div></header>
    <div className="settings-ai-fields">
      <Selector label="AI 실행 도구" value={provider} options={[{ value: "codex", label: "Codex" }, { value: "claude", label: "Claude Code" }]} onChange={(value) => {
        if (value !== "codex" && value !== "claude") return;
        onChange({ provider: value, model: "", modelReasoningEffort: "medium" });
      }} />
      <Selector label="모델 선택" value={settings.model || DEFAULT_MODEL} isDisabled={loading} options={models.map((model) => ({ ...model, value: model.value || DEFAULT_MODEL }))} onChange={(value) => onChange({ ...settings, model: value === DEFAULT_MODEL ? "" : value })} />
      <Selector label={provider === "claude" ? "Effort" : "Reasoning effort"} value={provider === "claude" && settings.modelReasoningEffort === "minimal" ? "low" : settings.modelReasoningEffort || "medium"} options={efforts.map((value) => ({ value, label: value }))} onChange={(value) => { if (isModelReasoningEffort(value)) onChange({ ...settings, modelReasoningEffort: value }); }} />
    </div>
    {loading && <p role="status">모델 목록을 불러오는 중입니다.</p>}
    {error && <p role="status">{error}</p>}
    <div className="settings-ai-note"><strong>{provider === "claude" ? "Claude Code 로그인 사용" : "Codex 로그인 사용"}</strong><p>{provider === "claude" ? "이 컴퓨터의 Claude Code CLI로 실행합니다. Sonnet·Opus·Haiku·Fable은 CLI가 해석하는 모델 별칭이며, 계정에 따라 사용 가능 여부가 다릅니다." : catalog.codexSource === "cache" ? "이 컴퓨터의 Codex 모델 목록을 사용합니다. 실제 이용 권한은 실행 시 확인됩니다." : "Codex 모델 목록이 아직 없어 기본 모델을 표시합니다. Codex에서 모델 목록을 갱신한 뒤 이 화면을 다시 열어 주세요."}</p><p>이력서·공고 정리, 댓글 반영, 경험 보완과 회사별 맞춤 생성에 공통 적용합니다.</p>{legacy && <p>이전에 저장한 모델을 유지했습니다. 목록에서 다른 모델을 선택할 수 있습니다.</p>}</div>
  </section>;
}
