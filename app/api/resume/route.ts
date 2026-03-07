import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillJson } from "@/lib/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/lib/http";
import { AgentRunOptionsSchema, ResumeSchema, resumeOutputSchema } from "@/lib/schemas";
import type { ApiSuccess, Resume } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "이력서 텍스트를 입력해주세요."),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "resume-to-json",
      inputText: `input/resume.txt 내용:\n${body.text}`,
      outputSchema: resumeOutputSchema,
      ...body.agent
    });

    const validated = ResumeSchema.parse(generated);

    const payload: ApiSuccess<Resume> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
