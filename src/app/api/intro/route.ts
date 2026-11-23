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
  purpose: z.literal("pdf-summary").optional(),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    if (body.purpose === "pdf-summary") {
      const generated = await runSkillJson<unknown>({
        skillName: "pdf-summary",
        inputText: JSON.stringify({ resume: body.resume, company: body.company }),
        outputSchema: {
          type: "object",
          properties: { sentences: { type: "array", items: { type: "string" } } },
          required: ["sentences"],
          additionalProperties: false
        },
        ...body.agent
      });
      const schema = z.object({ sentences: z.array(z.string().trim().min(1).max(120)).min(2).max(3) }).strict();
      const { sentences } = parseTaskResult("PDF 상단 요약", schema, generated);
      return NextResponse.json({ ok: true, data: IntroSchema.parse({ longIntro: sentences.join(" ") }) });
    }

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
