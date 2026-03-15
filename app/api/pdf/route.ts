import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, HttpError, parseJsonBody } from "@/server/http";
import { buildPdfContentDisposition, buildResumePdf } from "@/server/pdf/build";
import { buildPdfDownloadName } from "@/entities/pdf/model/view-model";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";

export const runtime = "nodejs";

const IntroSourceSchema = z
  .object({
    resumeConfirmedJson: z.string().trim().min(1),
    companyConfirmedJson: z.string().trim().min(1)
  })
  .strict();

const RequestSchema = z
  .object({
    resume: ResumeSchema,
    company: CompanySchema,
    intro: IntroSchema,
    introSource: IntroSourceSchema,
    resumeSnapshot: z.string().trim().min(1),
    companySnapshot: z.string().trim().min(1)
  })
  .strict();

function hasIntroContent(value: z.infer<typeof IntroSchema>) {
  return Boolean(value.oneLineIntro.trim() || value.shortIntro.trim() || value.longIntro.trim());
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    if (!hasIntroContent(body.intro)) {
      throw new HttpError(400, "소개글을 먼저 만들어 주세요.");
    }

    if (
      body.introSource.resumeConfirmedJson !== body.resumeSnapshot ||
      body.introSource.companyConfirmedJson !== body.companySnapshot
    ) {
      throw new HttpError(409, "이력서나 공고가 바뀌었어요. 소개글을 다시 만든 뒤 PDF를 내보내 주세요.");
    }

    const pdf = await buildResumePdf(body.resume, body.intro, body.company);
    const filename = buildPdfDownloadName(body.company, body.resume);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": buildPdfContentDisposition(filename),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
