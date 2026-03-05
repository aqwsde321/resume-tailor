import { NextResponse } from "next/server";
import { z } from "zod";

import { runSkillJson } from "@/lib/codex-client";
import { apiErrorResponse, parseJsonBody } from "@/lib/http";
import { CompanySchema, companyOutputSchema } from "@/lib/schemas";
import type { ApiSuccess, Company } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(1, "채용공고 텍스트를 입력해주세요.")
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const generated = await runSkillJson<unknown>({
      skillName: "company-to-json",
      inputText: `input/company.txt 내용:\n${body.text}`,
      outputSchema: companyOutputSchema
    });

    const validated = CompanySchema.parse(generated);

    const payload: ApiSuccess<Company> = {
      ok: true,
      data: validated
    };

    return NextResponse.json(payload);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
