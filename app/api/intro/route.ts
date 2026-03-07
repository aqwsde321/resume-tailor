import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillJson } from "@/lib/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/lib/http";
import { buildIntroSkillInput, normalizeIntroWithGuidance } from "@/lib/intro-insights";
import { AgentRunOptionsSchema, CompanySchema, IntroSchema, ResumeSchema, introOutputSchema } from "@/lib/schemas";
import type { ApiSuccess, Intro } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema,
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "generate-intro",
      inputText: buildIntroSkillInput(body.resume, body.company),
      outputSchema: introOutputSchema,
      ...body.agent
    });

    const validated = normalizeIntroWithGuidance(IntroSchema.parse(generated), body.resume, body.company);

    const payload: ApiSuccess<Intro> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
