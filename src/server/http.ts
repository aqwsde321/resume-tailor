import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import type { ApiFailure } from "@/shared/lib/types";

export class HttpError extends Error {
  status: number;
  details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function normalizeApiError(error: unknown): ApiFailure["error"] {
  if (error instanceof HttpError) {
    return {
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join(" | ");

    return {
      message: "응답 데이터 검증에 실패했습니다.",
      details
    };
  }

  const message = error instanceof Error ? error.message : "알 수 없는 서버 오류";
  return {
    message: "서버 처리 중 오류가 발생했습니다.",
    details: message
  };
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
        error: normalizeApiError(error)
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: normalizeApiError(error)
    },
    { status: 500 }
  );
}
