import { z } from "zod";

import { normalizeCompany } from "@/lib/company-normalize";
import { runSkillJsonStream } from "@/lib/codex-client";
import { HttpError, apiErrorResponse, normalizeApiError, parseJsonBody } from "@/lib/http";
import { AgentRunOptionsSchema, CompanySchema, companyOutputSchema } from "@/lib/schemas";
import { createSseResponse } from "@/lib/sse";
import { parseTaskResult } from "@/lib/task-result";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "채용공고 텍스트를 입력해주세요."),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    return createSseResponse(async (send) => {
      const startedAt = Date.now();

      try {
        const generated = await runSkillJsonStream<unknown>({
          skillName: "company-to-json",
          inputText: `input/company.txt 내용:\n${body.text}`,
          outputSchema: companyOutputSchema,
          signal: request.signal,
          ...body.agent,
          onLog: (payload) => send("log", payload)
        });

        const validated = normalizeCompany(parseTaskResult("공고", CompanySchema, generated));

        // 공고는 저장 전 한 번 더 정규화해 필수/우대/기술 스택을 안정적으로 맞춘다.
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
