import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchCompanyPage } from "@/server/company-url-fetch";
import { apiErrorResponse, parseJsonBody } from "@/server/http";

export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().trim().url("공고 URL 형식이 올바르지 않습니다.")
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);
    const data = await fetchCompanyPage(body.url);

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
