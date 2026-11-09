import { NextResponse } from "next/server";
import { z } from "zod";

import { APPLICATION_STATUS_OPTIONS, ApplicationStatusSchema } from "@/entities/application/model/application-record";
import {
  ApplicationFollowUpDraftSchema,
  FollowUpDraftContentSchema,
  FollowUpOccasionSchema,
  FOLLOW_UP_OCCASION_OPTIONS,
  followUpDraftOutputSchema
} from "@/entities/application/model/follow-up-draft";
import { runSkillJson } from "@/server/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { parseTaskResult } from "@/server/task-result";
import { AgentRunOptionsSchema, CompanySchema } from "@/shared/lib/schemas";
import type { ApiSuccess } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  occasion: FollowUpOccasionSchema,
  company: CompanySchema,
  status: ApplicationStatusSchema,
  notes: z.string().max(5000),
  nextAction: z.string().max(5000),
  agent: AgentRunOptionsSchema.optional()
});

function buildInputText(body: z.infer<typeof RequestSchema>) {
  const occasionLabel = FOLLOW_UP_OCCASION_OPTIONS.find((option) => option.id === body.occasion)?.label;
  const statusLabel = APPLICATION_STATUS_OPTIONS.find((option) => option.id === body.status)?.label;

  return [
    `[메일 목적]\n${occasionLabel}`,
    "",
    "[회사와 포지션]",
    `${body.company.companyName} · ${body.company.jobTitle}`,
    "",
    "[공고 정보]",
    body.company.jobDescription,
    "",
    `[현재 진행 상태]\n${statusLabel}`,
    "",
    "[지원자가 기록한 메모]",
    body.notes || "없음",
    "",
    "[다음 할 일]",
    body.nextAction || "없음"
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);
    const generated = await runSkillJson<unknown>({
      skillName: "write-follow-up",
      inputText: buildInputText(body),
      outputSchema: followUpDraftOutputSchema,
      ...body.agent
    });
    const content = parseTaskResult("후속 메일", FollowUpDraftContentSchema, generated);
    const data = ApplicationFollowUpDraftSchema.parse({
      ...content,
      occasion: body.occasion,
      generatedAt: new Date().toISOString()
    });
    const payload: ApiSuccess<typeof data> = { ok: true, data };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
