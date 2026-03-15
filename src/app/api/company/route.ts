import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeCompany } from "@/server/company-normalize";
import { runSkillJson } from "@/server/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { AgentRunOptionsSchema, CompanySchema, companyOutputSchema } from "@/shared/lib/schemas";
import { parseTaskResult } from "@/server/task-result";
import type { ApiSuccess, Company } from "@/shared/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "채용공고 텍스트를 입력해주세요."),
  agent: AgentRunOptionsSchema.optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "company-to-json",
      inputText: `input/company.txt 내용:\n${body.text}`,
      outputSchema: companyOutputSchema,
      ...body.agent
    });

    const validated = normalizeCompany(parseTaskResult("공고", CompanySchema, generated));

    const payload: ApiSuccess<Company> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
