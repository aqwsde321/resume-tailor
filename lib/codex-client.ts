import { Codex } from "@openai/codex-sdk";

import { readSkillMarkdown } from "@/lib/skills";
import { HttpError } from "@/lib/http";
import type { SkillName } from "@/lib/types";

type JsonSchema = Record<string, unknown>;

const codex = new Codex({
  cwd: process.cwd(),
  skipGitRepoCheck: true
});

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

export async function runSkillJson<T>(params: {
  skillName: SkillName;
  inputText: string;
  outputSchema: JsonSchema;
}): Promise<T> {
  return enqueue(async () => {
    try {
      const skillMarkdown = await readSkillMarkdown(params.skillName);
      const thread = codex.startThread({
        approvalMode: "full-auto"
      });

      const turn = await thread.run(buildPrompt(skillMarkdown, params.inputText), {
        outputSchema: params.outputSchema
      });

      const response =
        (turn as { finalResponse?: unknown }).finalResponse ??
        (turn as { response?: unknown }).response;

      return parseFinalResponse<T>(response);
    } catch (error) {
      throw toUserFacingError(error);
    }
  });
}
