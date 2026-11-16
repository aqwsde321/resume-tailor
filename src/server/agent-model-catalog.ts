import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_AGENT_MODELS, type AgentModelCatalog, type AgentModelOption } from "@/shared/lib/agent-models";
import { isModelReasoningEffort } from "@/shared/lib/agent-settings";
export async function getAgentModelCatalog(): Promise<AgentModelCatalog> {
  try {
    const raw = await readFile(join(process.env.CODEX_HOME || join(homedir(), ".codex"), "models_cache.json"), "utf8");
    if (raw.length > 2_000_000) return DEFAULT_AGENT_MODELS;
    const data = JSON.parse(raw);
    const options: AgentModelOption[] = [];
    const seen = new Set<string>();
    for (const model of Array.isArray(data.models) ? data.models : []) {
      if (model.visibility !== "list" || typeof model.slug !== "string" || !/^[a-zA-Z0-9._-]{1,120}$/.test(model.slug) || seen.has(model.slug)) continue;
      seen.add(model.slug);
      const entries: unknown[] | undefined = Array.isArray(model.supported_reasoning_levels) ? model.supported_reasoning_levels : undefined;
      const levels = entries?.flatMap((entry) => {
        const effort = entry && typeof entry === "object" && "effort" in entry ? entry.effort : undefined;
        return isModelReasoningEffort(effort) ? [effort] : [];
      });
      const reasoningEfforts = levels ? [...new Set(levels)] : undefined;
      const defaultReasoningEffort = isModelReasoningEffort(model.default_reasoning_level) && reasoningEfforts?.includes(model.default_reasoning_level) ? model.default_reasoning_level : undefined;
      options.push({ value: model.slug, label: typeof model.display_name === "string" ? model.display_name.slice(0, 120) : model.slug,
        ...(reasoningEfforts ? { reasoningEfforts } : {}), ...(defaultReasoningEffort ? { defaultReasoningEffort } : {}),
      });
      if (options.length >= 100) break;
    }
    return { ...DEFAULT_AGENT_MODELS, codex: [...DEFAULT_AGENT_MODELS.codex, ...options], codexSource: options.length ? "cache" : "default" };
  } catch { return DEFAULT_AGENT_MODELS; }
}
