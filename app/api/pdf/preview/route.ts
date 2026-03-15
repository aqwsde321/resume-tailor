import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, HttpError, parseJsonBody } from "@/server/http";
import { buildResumeSvgPreview } from "@/server/pdf/build";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";

export const runtime = "nodejs";

const RequestSchema = z
  .object({
    resume: ResumeSchema,
    company: CompanySchema,
    intro: IntroSchema
  })
  .strict();

function hasIntroContent(value: z.infer<typeof IntroSchema>) {
  return Boolean(value.oneLineIntro.trim() || value.shortIntro.trim() || value.longIntro.trim());
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    if (!hasIntroContent(body.intro)) {
      throw new HttpError(400, "소개글이 있어야 Typst 미리보기를 만들 수 있어요.");
    }

    const preview = await buildResumeSvgPreview(body.resume, body.intro, body.company);

    return NextResponse.json({
      ok: true,
      data: preview
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
