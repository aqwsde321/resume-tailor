import { NextResponse } from "next/server";
import { z } from "zod";

import {
  InterviewPrepContentSchema,
  interviewPrepOutputSchema
} from "@/entities/application/model/interview-prep";
import { runSkillJson } from "@/server/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { parseTaskResult } from "@/server/task-result";
import { AgentRunOptionsSchema, CompanySchema, ResumeSchema } from "@/shared/lib/schemas";
import type { ApiSuccess } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema,
  agent: AgentRunOptionsSchema.optional()
});

function buildInputText(resume: unknown, company: unknown) {
  return [
    "[확정 이력서]",
    JSON.stringify(resume, null, 2),
    "",
    "[확정 채용공고]",
    JSON.stringify(company, null, 2)
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);
    const generated = await runSkillJson<unknown>({
      skillName: "prepare-interview",
      inputText: buildInputText(body.resume, body.company),
      outputSchema: interviewPrepOutputSchema,
      ...body.agent
    });
    const content = parseTaskResult("면접 준비", InterviewPrepContentSchema, generated);
    const data = { ...content, generatedAt: new Date().toISOString() };
    const payload: ApiSuccess<typeof data> = { ok: true, data };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
