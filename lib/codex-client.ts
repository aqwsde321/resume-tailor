import { Codex, type ThreadItem } from "@openai/codex-sdk";

import { formatReasoningEffortValue } from "@/lib/agent-settings";
import { HttpError } from "@/lib/http";
import { readSkillMarkdown } from "@/lib/skills";
import type { AgentRunOptions, SkillName, StreamLogPayload } from "@/lib/types";

type JsonSchema = Record<string, unknown>;

const SKILL_LABEL: Record<SkillName, string> = {
  "resume-to-json": "이력서 정리",
  "company-to-json": "공고 정리",
  "generate-intro": "소개글 만들기"
};

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

// 한 번에 여러 Codex 실행이 겹치면 로그/응답 추적이 꼬일 수 있어 요청을 직렬화한다.
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = serialQueue.then(job, job);
  serialQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// SKILL.md의 파일 입출력 규칙을 실제 파일 대신 프롬프트 안의 가상 입력으로 치환한다.
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
            ? `해석 요약: ${truncate(text)}`
            : "입력 내용을 해석하고 있습니다."
      };
    }
    case "command_execution": {
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "command",
        message:
          lifecycle === "completed"
            ? `보조 명령 실행 완료 (${item.status}, exit ${item.exit_code ?? "?"})`
            : "보조 명령을 실행하고 있습니다."
      };
    }
    case "mcp_tool_call": {
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "mcp",
        message: `도구 호출 ${item.status === "completed" ? "완료" : "진행"}: ${item.server}.${item.tool}`
      };
    }
    case "web_search": {
      return {
        level: "info",
        phase: "search",
        message: `참조 검색: ${truncate(normalizeText(item.query), 80)}`
      };
    }
    case "todo_list": {
      return {
        level: "info",
        phase: "plan",
        message: `작업 계획 정리 (${item.items.length}개 단계)`
      };
    }
    case "file_change": {
      return {
        level: item.status === "failed" ? "error" : "info",
        phase: "patch",
        message: `중간 산출물 점검 ${item.changes.length}건 (${item.status})`
      };
    }
    case "error": {
      return {
        level: "error",
        phase: "error",
        message: `실행 오류: ${item.message}`
      };
    }
    case "agent_message": {
      return {
        level: lifecycle === "completed" ? "success" : "info",
        phase: "response",
        message: lifecycle === "completed" ? "결과 문장 정리 완료" : "결과 문장을 정리하고 있습니다."
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
        message: `${SKILL_LABEL[params.skillName]} 준비를 시작합니다.`
      });
      emitLog(params.onLog, {
        level: "info",
        phase: "config",
        message: `실행 설정 확인 · 생각 깊이 ${formatReasoningEffortValue(params.modelReasoningEffort ?? "medium")}`
      });

      const { events } = await thread.runStreamed(buildPrompt(skillMarkdown, params.inputText), {
        outputSchema: params.outputSchema
      });

      let finalResponse = "";
      let turnFailureMessage: string | null = null;

      // 스트림 이벤트를 사용자 로그로 바꾸고, 마지막 agent_message를 최종 JSON 후보로 잡는다.
      for await (const event of events) {
        switch (event.type) {
          case "thread.started": {
            emitLog(params.onLog, {
              level: "info",
              phase: "thread",
              message: `실행 세션 연결 완료`
            });
            break;
          }
          case "turn.started": {
            emitLog(params.onLog, {
              level: "info",
              phase: "turn",
              message: "분석 단계를 시작합니다."
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
                message: "보조 명령을 계속 실행하고 있습니다."
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
              message: `분석 완료 · 입력 ${event.usage.input_tokens} / 출력 ${event.usage.output_tokens} 토큰`
            });
            break;
          }
          case "turn.failed": {
            turnFailureMessage = event.error.message;
            emitLog(params.onLog, {
              level: "error",
              phase: "turn",
              message: `분석 단계 실패: ${event.error.message}`
            });
            break;
          }
          case "error": {
            turnFailureMessage = event.message;
            emitLog(params.onLog, {
              level: "error",
              phase: "error",
              message: `실행 중 오류: ${event.message}`
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
