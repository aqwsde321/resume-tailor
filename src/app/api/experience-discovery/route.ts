import { z } from "zod";

import {
  AgentRunOptionsSchema,
  CompanySchema,
  ExperienceDiscoveryMessageSchema,
  ExperienceDiscoveryTurnSchema,
  ResumeSchema,
  experienceDiscoveryOutputSchema,
  projectEnrichmentOutputSchema,
} from "@/shared/lib/schemas";
import { runSkillJsonStream } from "@/server/codex-client";
import { HttpError, apiErrorResponse, normalizeApiError, parseJsonBody } from "@/server/http";
import { createSseResponse } from "@/server/sse";
import { parseTaskResult } from "@/server/task-result";
import type { ExperienceDiscoveryMessage, ResumeProjectItem } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema.optional(),
  requirement: z.string().trim().min(1).max(300),
  messages: z.array(ExperienceDiscoveryMessageSchema).max(16).default([]),
  projectIndex: z.number().int().nonnegative().optional(),
  agent: AgentRunOptionsSchema.optional()
});

function buildInputText(
  resume: unknown,
  company: unknown,
  requirement: string,
  messages: ExperienceDiscoveryMessage[],
  project?: ResumeProjectItem,
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
    ...(project ? ["[보완할 원본 프로젝트]", JSON.stringify(project, null, 2), ""] : []),
    "[이전 대화 기록]",
    JSON.stringify(messages, null, 2)
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);
    const project = body.projectIndex === undefined ? undefined : body.resume.projects[body.projectIndex];
    if (body.projectIndex !== undefined && (!body.company || !project)) {
      throw new HttpError(400, "공고와 보완할 원본 프로젝트를 확인해 주세요.");
    }

    return createSseResponse(async (send) => {
      const startedAt = Date.now();

      try {
        const generated = await runSkillJsonStream<unknown>({
          skillName: "discover-experience",
          inputText: buildInputText(body.resume, body.company ?? null, body.requirement, body.messages, project),
          outputSchema: project ? projectEnrichmentOutputSchema : experienceDiscoveryOutputSchema,
          signal: request.signal,
          ...body.agent,
          onLog: (payload) => send("log", payload)
        });

        const validated = parseTaskResult("경험 발굴", ExperienceDiscoveryTurnSchema, generated);
        if ((validated.revision && (!project || !body.messages.some(({ role }) => role === "user"))) || (project && validated.draft)) {
          throw new HttpError(502, "원본 프로젝트와 답변을 바탕으로 수정안을 작성해 주세요.");
        }
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
