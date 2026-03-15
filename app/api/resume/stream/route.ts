import { z } from "zod";

import { runSkillJsonStream } from "@/server/codex-client";
import { HttpError, apiErrorResponse, normalizeApiError, parseJsonBody } from "@/server/http";
import { AgentRunOptionsSchema, ResumeSchema, resumeOutputSchema } from "@/shared/lib/schemas";
import { createSseResponse } from "@/server/sse";
import { parseTaskResult } from "@/server/task-result";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "이력서 텍스트를 입력해주세요."),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    return createSseResponse(async (send) => {
      const startedAt = Date.now();

      try {
        const generated = await runSkillJsonStream<unknown>({
          skillName: "resume-to-json",
          inputText: `input/resume.txt 내용:\n${body.text}`,
          outputSchema: resumeOutputSchema,
          signal: request.signal,
          ...body.agent,
          onLog: (payload) => send("log", payload)
        });

        const validated = parseTaskResult("이력서", ResumeSchema, generated);

        // 클라이언트는 result 이벤트를 실제 데이터로 쓰고, done은 진행 상태 마무리에만 사용한다.
        send("result", {
          data: validated
        });
        send("done", {
          ok: true,
          elapsedMs: Date.now() - startedAt
        });
      } catch (error) {
        const normalized = normalizeApiError(error);
        send("error", normalized);
        send("done", {
          ok: false,
          elapsedMs: Date.now() - startedAt
        });
      }
    }, { signal: request.signal });
  } catch (error) {
    if (error instanceof HttpError) {
      return apiErrorResponse(error);
    }

    return apiErrorResponse(error);
  }
}
