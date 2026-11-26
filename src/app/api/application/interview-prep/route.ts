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
  agent: AgentRunOptionsSchema.optional(),
  interviewRound: z.string().trim().min(1).max(100).optional()
});

function buildInputText(resume: unknown, company: unknown, interviewRound?: string) {
  return [
    "[확정 이력서]",
    JSON.stringify(resume, null, 2),
    "",
    "[확정 채용공고]",
    JSON.stringify(company, null, 2),
    ...(interviewRound ? ["", "[준비할 면접 차수의 이름]", JSON.stringify(interviewRound),
      "차수 이름은 면접 준비의 주제를 좁히는 정보입니다. 이름이 구체적이면 관련 질문을 우선하되 회사의 실제 전형이나 이력서 경험을 추정하지 마세요."] : []),
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);
    const generated = await runSkillJson<unknown>({
      skillName: "prepare-interview",
      inputText: buildInputText(body.resume, body.company, body.interviewRound),
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
