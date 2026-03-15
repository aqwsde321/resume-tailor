import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillJson } from "@/server/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { buildIntroSkillInput, normalizeIntroWithGuidance } from "@/entities/intro/model/intro-insights";
import {
  AgentRunOptionsSchema,
  CompanySchema,
  IntroSchema,
  IntroToneSchema,
  ResumeSchema,
  introOutputSchema
} from "@/shared/lib/schemas";
import { parseTaskResult } from "@/server/task-result";
import type { ApiSuccess, Intro } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema,
  tone: IntroToneSchema.optional(),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "generate-intro",
      inputText: buildIntroSkillInput(body.resume, body.company, body.tone),
      outputSchema: introOutputSchema,
      ...body.agent
    });

    const validated = normalizeIntroWithGuidance(
      parseTaskResult("소개글", IntroSchema, generated),
      body.resume,
      body.company
    );

    const payload: ApiSuccess<Intro> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
