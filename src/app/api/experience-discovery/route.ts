import { z } from "zod";

import {
  AgentRunOptionsSchema,
  CompanySchema,
  ExperienceDiscoveryMessageSchema,
  ExperienceDiscoveryTurnSchema,
  ResumeSchema,
  experienceDiscoveryOutputSchema
} from "@/shared/lib/schemas";
import { runSkillJsonStream } from "@/server/codex-client";
import { HttpError, apiErrorResponse, normalizeApiError, parseJsonBody } from "@/server/http";
import { createSseResponse } from "@/server/sse";
import { parseTaskResult } from "@/server/task-result";
import type { ExperienceDiscoveryMessage } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema,
  requirement: z.string().trim().min(1).max(300),
  messages: z.array(ExperienceDiscoveryMessageSchema).max(16).default([]),
  agent: AgentRunOptionsSchema.optional()
});

function buildInputText(
  resume: unknown,
  company: unknown,
  requirement: string,
  messages: ExperienceDiscoveryMessage[]
) {
  return [
    "[확정 이력서]",
    JSON.stringify(resume, null, 2),
    "",
    "[확정 채용공고]",
    JSON.stringify(company, null, 2),
    "",
    "[확인할 부족 요건]",
    requirement,
    "",
    "[이전 대화 기록]",
    JSON.stringify(messages, null, 2)
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    return createSseResponse(async (send) => {
      const startedAt = Date.now();

      try {
        const generated = await runSkillJsonStream<unknown>({
          skillName: "discover-experience",
          inputText: buildInputText(body.resume, body.company, body.requirement, body.messages),
          outputSchema: experienceDiscoveryOutputSchema,
          signal: request.signal,
          ...body.agent,
          onLog: (payload) => send("log", payload)
        });

        const validated = parseTaskResult("경험 발굴", ExperienceDiscoveryTurnSchema, generated);
        send("result", { data: validated });
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
