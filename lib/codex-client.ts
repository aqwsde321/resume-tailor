import { Codex, type ThreadItem } from "@openai/codex-sdk";

import { HttpError } from "@/lib/http";
import { readSkillMarkdown } from "@/lib/skills";
import type { AgentRunOptions, SkillName, StreamLogPayload } from "@/lib/types";

type JsonSchema = Record<string, unknown>;

let codex: Codex | null = null;

function getCodexClient(): Codex {
  if (!codex) {
    codex = new Codex({
      codexPathOverride: process.env.CODEX_CLI_PATH ?? "codex"
    });
  }
  return codex;
}

function startThread(options?: AgentRunOptions) {
  return getCodexClient().startThread({
    ...(options?.model ? { model: options.model } : {}),
    ...(options?.modelReasoningEffort
      ? { modelReasoningEffort: options.modelReasoningEffort }
      : {}),
    workingDirectory: process.cwd(),
    skipGitRepoCheck: true,
    approvalPolicy: "never"
  });
}

let serialQueue: Promise<void> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = serialQueue.then(job, job);
  serialQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function buildPrompt(skillMarkdown: string, inputText: string): string {
  return [
    "당신은 SKILL.md 기반 JSON 파이프라인 엔진입니다.",
    "",
    "[중요 규칙]",
    "1) SKILL.md의 파일 입출력 지시(input/*.txt, output/*.json)는 실제 파일 접근 없이 아래 입력 텍스트를 해당 파일 내용으로 간주합니다.",
    "2) 출력은 반드시 outputSchema를 만족하는 JSON 객체 하나만 반환합니다.",
    "3) 코드펜스, 설명문, 주석을 절대 포함하지 않습니다.",
    "",
    "[SKILL.md]",
    skillMarkdown,
    "",
    "[입력 데이터]",
    inputText
  ].join("\n");
}

function parseFinalResponse<T>(finalResponse: unknown): T {
  if (typeof finalResponse === "string") {
    const trimmed = finalResponse.trim();
    if (trimmed.length === 0) {
      throw new HttpError(502, "Codex 응답이 비어 있습니다.");
    }

    try {
      return JSON.parse(trimmed) as T;
    } catch {
      throw new HttpError(502, "Codex 응답이 JSON 문자열이 아닙니다.");
    }
  }

  if (finalResponse && typeof finalResponse === "object") {
    return finalResponse as T;
  }

  throw new HttpError(502, "Codex 응답 형식이 올바르지 않습니다.");
}

function toUserFacingError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("auth") || lower.includes("login") || lower.includes("credential")) {
    return new HttpError(
      401,
      "Codex 인증이 필요합니다.",
      "터미널에서 `codex auth login` 후 서버를 재시작하세요."
    );
  }

  return new HttpError(502, "Codex 실행 중 오류가 발생했습니다.", message);
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function toItemLog(item: ThreadItem, lifecycle: "started" | "completed"): StreamLogPayload {
  switch (item.type) {
    case "reasoning": {
      const text = normalizeText(item.text);
      return {
        level: lifecycle === "completed" ? "success" : "info",
        phase: "reasoning",
        message:
          lifecycle === "completed"
            ? `분석 요약: ${truncate(text)}`
            : "모델이 분석을 시작했습니다."
      };
    }
    case "command_execution": {
      const statusText =
        lifecycle === "completed"
          ? ` (exit: ${item.exit_code ?? "?"}, status: ${item.status})`
          : "";
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "command",
        message: `명령 실행: ${item.command}${statusText}`
      };
    }
    case "mcp_tool_call": {
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "mcp",
        message: `MCP 호출: ${item.server}.${item.tool} (${item.status})`
      };
    }
    case "web_search": {
      return {
        level: "info",
        phase: "search",
        message: `검색: ${truncate(normalizeText(item.query), 80)}`
      };
    }
    case "todo_list": {
      return {
        level: "info",
        phase: "plan",
        message: `작업 계획 업데이트 (${item.items.length}개 단계)`
      };
    }
    case "file_change": {
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "patch",
        message: `파일 변경 ${item.changes.length}건 (${item.status})`
      };
    }
    case "error": {
      return {
        level: "error",
        phase: "error",
        message: item.message
      };
    }
    case "agent_message": {
      return {
        level: lifecycle === "completed" ? "success" : "info",
        phase: "response",
        message: lifecycle === "completed" ? "최종 응답 생성 완료" : "최종 응답 작성 중"
      };
    }
    default: {
      return {
        level: "info",
        phase: "unknown",
        message: `${lifecycle} 이벤트 수신`
      };
    }
  }
}

function emitLog(
  onLog: ((payload: StreamLogPayload) => void) | undefined,
  payload: StreamLogPayload
) {
  onLog?.(payload);
}

export async function runSkillJson<T>(params: {
  skillName: SkillName;
  inputText: string;
  outputSchema: JsonSchema;
  model?: string;
  modelReasoningEffort?: AgentRunOptions["modelReasoningEffort"];
}): Promise<T> {
  return enqueue(async () => {
    try {
      const skillMarkdown = await readSkillMarkdown(params.skillName);
      const thread = startThread({
        model: params.model,
        modelReasoningEffort: params.modelReasoningEffort
      });

      const turn = await thread.run(buildPrompt(skillMarkdown, params.inputText), {
        outputSchema: params.outputSchema
      });
      return parseFinalResponse<T>(turn.finalResponse);
    } catch (error) {
      throw toUserFacingError(error);
    }
  });
}

export async function runSkillJsonStream<T>(params: {
  skillName: SkillName;
  inputText: string;
  outputSchema: JsonSchema;
  onLog?: (payload: StreamLogPayload) => void;
  model?: string;
  modelReasoningEffort?: AgentRunOptions["modelReasoningEffort"];
}): Promise<T> {
  return enqueue(async () => {
    try {
      const skillMarkdown = await readSkillMarkdown(params.skillName);
      const thread = startThread({
        model: params.model,
        modelReasoningEffort: params.modelReasoningEffort
      });

      emitLog(params.onLog, {
        level: "info",
        phase: "start",
        message: `${params.skillName} 실행 시작`
      });
      emitLog(params.onLog, {
        level: "info",
        phase: "config",
        message: `실행 설정: model=${params.model ?? "config 기본값"}, reasoning=${
          params.modelReasoningEffort ?? "config 기본값"
        }`
      });

      const { events } = await thread.runStreamed(buildPrompt(skillMarkdown, params.inputText), {
        outputSchema: params.outputSchema
      });

      let finalResponse = "";
      let turnFailureMessage: string | null = null;

      for await (const event of events) {
        switch (event.type) {
          case "thread.started": {
            emitLog(params.onLog, {
              level: "info",
              phase: "thread",
              message: `스레드 시작: ${event.thread_id}`
            });
            break;
          }
          case "turn.started": {
            emitLog(params.onLog, {
              level: "info",
              phase: "turn",
              message: "모델 분석 시작"
            });
            break;
          }
          case "item.started": {
            emitLog(params.onLog, toItemLog(event.item, "started"));
            break;
          }
          case "item.updated": {
            if (event.item.type === "command_execution") {
              emitLog(params.onLog, {
                level: "info",
                phase: "command",
                message: `명령 진행중: ${event.item.command}`
              });
            }
            break;
          }
          case "item.completed": {
            emitLog(params.onLog, toItemLog(event.item, "completed"));
            if (event.item.type === "agent_message") {
              finalResponse = event.item.text;
            }
            break;
          }
          case "turn.completed": {
            emitLog(params.onLog, {
              level: "success",
              phase: "turn",
              message: `분석 완료 (input: ${event.usage.input_tokens}, output: ${event.usage.output_tokens})`
            });
            break;
          }
          case "turn.failed": {
            turnFailureMessage = event.error.message;
            emitLog(params.onLog, {
              level: "error",
              phase: "turn",
              message: `분석 실패: ${event.error.message}`
            });
            break;
          }
          case "error": {
            turnFailureMessage = event.message;
            emitLog(params.onLog, {
              level: "error",
              phase: "error",
              message: event.message
            });
            break;
          }
          default:
            break;
        }
      }

      if (turnFailureMessage) {
        throw new HttpError(502, "Codex 분석에 실패했습니다.", turnFailureMessage);
      }

      return parseFinalResponse<T>(finalResponse);
    } catch (error) {
      throw toUserFacingError(error);
    }
  });
}
