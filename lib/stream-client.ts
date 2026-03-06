import type { ApiFailure, StreamLogPayload } from "@/lib/types";

interface PostSseJsonOptions {
  onLog?: (payload: StreamLogPayload) => void;
}

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

  return details ? `${message} (${details})` : message;
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
    const failure = (await response.json()) as ApiFailure;
    throw new Error(toErrorMessage(failure.error));
  }

  if (!response.body) {
    throw new Error("스트리밍 응답 본문이 없습니다.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

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
    throw new Error("스트리밍 결과를 수신하지 못했습니다.");
  }

  return result;
}
