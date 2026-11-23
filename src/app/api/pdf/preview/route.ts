import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_PDF_TEMPLATE_ID,
  PDF_PREVIEW_RENDER_VERSION,
  PDF_TEMPLATE_IDS
} from "@/entities/pdf/model/templates";
import {
  DEFAULT_PDF_THEME_ID,
  PDF_THEME_IDS
} from "@/entities/pdf/model/themes";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { buildResumeSvgPreview } from "@/server/pdf/build";
import { createPdfPreviewCacheKey, getCachedPdfPreview } from "@/server/pdf/preview-cache";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";

export const runtime = "nodejs";

const RequestSchema = z
  .object({
    resume: ResumeSchema,
    company: CompanySchema,
    intro: IntroSchema,
    templateId: z.enum(PDF_TEMPLATE_IDS).default(DEFAULT_PDF_TEMPLATE_ID),
    themeId: z.enum(PDF_THEME_IDS).default(DEFAULT_PDF_THEME_ID),
    customAccentHex: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    renderVersion: z.string().default(PDF_PREVIEW_RENDER_VERSION)
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    const firstPageOnly = new URL(request.url).searchParams.get("firstPageOnly") === "1";
    const cacheKey = createPdfPreviewCacheKey({ ...body, firstPageOnly });
    const preview = await getCachedPdfPreview(cacheKey, () =>
      buildResumeSvgPreview(
        body.resume,
        body.intro,
        body.company,
        body.templateId,
        body.themeId,
        body.customAccentHex,
        { firstPageOnly }
      )
    );

    return NextResponse.json({
      ok: true,
      data: preview
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
