import type { ApiFailure, StreamLogPayload } from "@/lib/types";

interface PostSseJsonOptions {
  onLog?: (payload: StreamLogPayload) => void;
}

// SSE는 data: 라인이 여러 줄로 올 수 있어, 한 레코드 안의 data 라인을 다시 합쳐서 파싱한다.
function parseSseRecord(raw: string): { event: string; payload: unknown } | null {
  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return null;
  }

  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    payload: JSON.parse(dataLines.join("\n"))
  };
}

function toErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "분석 스트림 오류가 발생했습니다.";
  }

  const maybeError = payload as { message?: unknown; details?: unknown };
  const message = typeof maybeError.message === "string" ? maybeError.message : "요청 실패";
  const details = typeof maybeError.details === "string" ? maybeError.details : "";
  const normalized = normalizeUserFacingMessage(message);

  if (normalized !== message) {
    return normalized;
  }

  return details ? `${message} (${details})` : message;
}

function normalizeUserFacingMessage(message: string): string {
  if (
    message.includes("결과를 받지 못했어요") ||
    message.includes("응답이 비어 있습니다") ||
    message.includes("스트리밍 결과를 수신하지 못했습니다.")
  ) {
    return "결과를 끝까지 받지 못했어요. 다시 시도해 주세요.";
  }

  if (
    message.includes("결과 형식을 확인하지 못했어요") ||
    message.includes("응답 데이터 검증에 실패했습니다.")
  ) {
    return `${message.replace("응답 데이터 검증에 실패했습니다.", "생성된 결과 형식을 확인하지 못했어요.")} 다시 시도해 주세요.`;
  }

  if (
    message.includes("JSON 문자열이 아닙니다") ||
    message.includes("응답 형식이 올바르지 않습니다") ||
    message.includes("스트리밍 응답 본문이 없습니다.")
  ) {
    return "생성된 결과를 읽지 못했어요. 다시 시도해 주세요.";
  }

  return message;
}

async function parseFailureResponse(response: Response): Promise<string> {
  try {
    const failure = (await response.json()) as ApiFailure;
    if (failure && typeof failure === "object" && !failure.ok && "error" in failure) {
      return toErrorMessage(failure.error);
    }
  } catch {
    return `요청 처리에 실패했어요. 다시 시도해 주세요. (${response.status})`;
  }

  return `요청 처리에 실패했어요. 다시 시도해 주세요. (${response.status})`;
}

export async function postSseJson<T>(
  url: string,
  body: unknown,
  options?: PostSseJsonOptions
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(await parseFailureResponse(response));
  }

  if (!response.body) {
    throw new Error(normalizeUserFacingMessage("스트리밍 응답 본문이 없습니다."));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    // 네트워크 청크 경계와 SSE 레코드 경계가 다를 수 있어, 완전한 레코드만 잘라 처리한다.
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary).replace(/\r/g, "");
      buffer = buffer.slice(boundary + 2);

      const record = parseSseRecord(chunk);
      if (record) {
        switch (record.event) {
          case "log": {
            if (record.payload && typeof record.payload === "object") {
              options?.onLog?.(record.payload as StreamLogPayload);
            }
            break;
          }
          case "result": {
            if (record.payload && typeof record.payload === "object") {
              const payload = record.payload as { data?: T };
              if (payload.data !== undefined) {
                // 중간 로그가 더 오더라도 최종 result 이벤트의 데이터를 반환값으로 유지한다.
                result = payload.data;
              }
            }
            break;
          }
          case "error": {
            throw new Error(toErrorMessage(record.payload));
          }
          default:
            break;
        }
      }

      boundary = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  if (result === null) {
    throw new Error(normalizeUserFacingMessage("스트리밍 결과를 수신하지 못했습니다."));
  }

  return result;
}
