import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import type { ApiFailure } from "@/lib/types";

export class HttpError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    throw new HttpError(400, "JSON 본문 형식이 올바르지 않습니다.");
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join(" | ");

    throw new HttpError(400, "요청 데이터 검증에 실패했습니다.", details);
  }

  return parsed.data;
}

export function apiErrorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: error.message,
          details: error.details
        }
      },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "알 수 없는 서버 오류";

  return NextResponse.json(
    {
      ok: false,
      error: {
        message: "서버 처리 중 오류가 발생했습니다.",
        details: message
      }
    },
    { status: 500 }
  );
}
