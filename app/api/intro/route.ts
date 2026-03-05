import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillJson } from "@/lib/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/lib/http";
import { CompanySchema, IntroSchema, ResumeSchema, introOutputSchema } from "@/lib/schemas";
import type { ApiSuccess, Intro } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  resume: ResumeSchema,
  company: CompanySchema
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "generate-intro",
      inputText: [
        "output/resume.json 내용:",
        JSON.stringify(body.resume, null, 2),
        "",
        "output/company.json 내용:",
        JSON.stringify(body.company, null, 2)
      ].join("\n"),
      outputSchema: introOutputSchema
    });

    const validated = IntroSchema.parse(generated);

    const payload: ApiSuccess<Intro> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
