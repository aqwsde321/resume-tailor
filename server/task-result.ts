import type { ZodType } from "zod";

import { HttpError } from "@/server/http";

export function ensureTaskResult(taskLabel: string, generated: unknown): unknown {
  if (generated === null || generated === undefined) {
    throw new HttpError(502, `${taskLabel} 결과를 받지 못했어요.`, "AI 응답이 비어 있습니다.");
  }

  if (typeof generated === "string" && generated.trim().length === 0) {
    throw new HttpError(502, `${taskLabel} 결과를 받지 못했어요.`, "AI 응답이 비어 있습니다.");
  }

  return generated;
}

export function parseTaskResult<T>(
  taskLabel: string,
  schema: ZodType<T>,
  generated: unknown
): T {
  const normalized = ensureTaskResult(taskLabel, generated);
  // 모델 응답은 믿지 않고, 각 단계별 스키마로 다시 검증한 뒤에만 다음 화면으로 넘긴다.
  const parsed = schema.safeParse(normalized);

  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join(" | ");

  throw new HttpError(502, `${taskLabel} 결과 형식을 확인하지 못했어요.`, details);
}
