import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HttpError } from "./http";
import type { AgentRunOptions } from "@/shared/lib/types";

interface ClaudeOptions extends AgentRunOptions {
  prompt: string;
  outputSchema: Record<string, unknown>;
  signal?: AbortSignal;
}
const MAX_OUTPUT_BYTES = 2_000_000;
export async function runClaudeJson<T>({ prompt, outputSchema, model, modelReasoningEffort, signal }: ClaudeOptions): Promise<T> {
  if (modelReasoningEffort === "ultra") throw new HttpError(400, "Claude Code는 ultra effort를 지원하지 않습니다.");
  if (signal?.aborted) throw new HttpError(499, "Claude Code 실행을 중단했습니다.");
  // An isolated directory prevents project context from being added to private input.
  const cwd = await mkdtemp(join(tmpdir(), "resume-tailor-claude-"));
  try {
    return await new Promise<T>((resolve, reject) => {
      const args = ["--print", "--output-format", "json", "--json-schema", JSON.stringify(outputSchema),
        "--tools", "", "--permission-mode", "dontAsk", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--setting-sources", "", "--safe-mode", "--no-session-persistence",
        ...(model ? ["--model", model] : []),
        ...(modelReasoningEffort ? ["--effort", modelReasoningEffort === "minimal" ? "low" : modelReasoningEffort] : []),
      ];
      const child = spawn(process.env.CLAUDE_CLI_PATH || "claude", args, { cwd, stdio: ["pipe", "pipe", "pipe"], shell: false });
      let stdout = ""; let stderr = ""; let bytes = 0; let settled = false;
      let forceKill: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        child.kill("SIGTERM");
        forceKill = setTimeout(() => child.kill("SIGKILL"), 3000);
        forceKill.unref();
      };
      const finish = (error?: Error, result?: T) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); signal?.removeEventListener("abort", abort);
        if (error) reject(error); else resolve(result as T);
      };
      const abort = () => { stop(); finish(new HttpError(499, "Claude Code 실행을 중단했습니다.")); };
      const timeout = setTimeout(() => { stop(); finish(new HttpError(504, "Claude Code 응답 시간이 초과되었습니다.")); }, 180_000);
      signal?.addEventListener("abort", abort, { once: true });
      child.on("error", () => finish(new HttpError(503, "Claude Code를 실행할 수 없습니다.", "Claude Code 설치와 CLAUDE_CLI_PATH 설정을 확인해 주세요.")));
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_OUTPUT_BYTES) { stop(); finish(new HttpError(502, "Claude Code 응답이 너무 큽니다.")); return; }
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: Buffer) => { if (stderr.length < 8000) stderr += chunk.toString(); });
      child.stdin.on("error", () => { stop(); finish(new HttpError(502, "Claude Code에 입력을 전달하지 못했습니다.")); });
      child.on("close", (code) => {
        clearTimeout(forceKill);
        if (settled) return;
        try {
          const envelope = JSON.parse(stdout);
          if (code !== 0 || envelope.is_error) {
            // Inspect for classification only; never return CLI output containing private input.
            if (/auth|login|log.?in|credential|oauth/i.test(`${envelope.result ?? ""} ${stderr}`)) {
              finish(new HttpError(401, "Claude Code 인증이 필요합니다.", "터미널에서 claude auth login을 실행한 뒤 다시 시도하세요."));
            } else finish(new HttpError(502, "Claude Code 분석에 실패했습니다.", "선택한 모델의 사용 권한과 Claude Code 실행 상태를 확인해 주세요."));
            return;
          }
          const result = envelope.structured_output ?? (typeof envelope.result === "string" ? JSON.parse(envelope.result) : null);
          if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid result");
          finish(undefined, result as T);
        } catch { finish(new HttpError(502, "Claude Code 응답이 올바른 JSON 형식이 아닙니다.")); }
      });
      if (signal?.aborted) abort();
      else child.stdin.end(prompt);
    });
  } finally { await rm(cwd, { recursive: true, force: true }); }
}
