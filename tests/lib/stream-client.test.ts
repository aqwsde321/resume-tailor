import { afterEach, describe, expect, it, vi } from "vitest";

import { isAbortError, postSseJson } from "@/lib/client/stream-client";

function toSse(events: Array<{ event: string; data: unknown }>) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

describe("postSseJson", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("응답 형식 오류 메시지를 사용자용 문장으로 바꾼다", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        toSse([
          {
            event: "error",
            data: {
              message: "소개글 결과 형식을 확인하지 못했어요.",
              details: "oneLineIntro: Expected string"
            }
          },
          {
            event: "done",
            data: { ok: false, elapsedMs: 10 }
          }
        ]),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        }
      )
    );

    await expect(postSseJson("/api/test", {})).rejects.toThrow(
      "소개글 결과 형식을 확인하지 못했어요. 다시 시도해 주세요."
    );
  });

  it("스트림 본문이 없으면 읽기 실패 문구를 돌려준다", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(postSseJson("/api/test", {})).rejects.toThrow(
      "생성된 결과를 읽지 못했어요. 다시 시도해 주세요."
    );
  });

  it("결과 이벤트 없이 스트림이 끝나면 재시도 문구를 돌려준다", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        toSse([
          {
            event: "log",
            data: { level: "info", phase: "turn", message: "분석 중" }
          },
          {
            event: "done",
            data: { ok: true, elapsedMs: 12 }
          }
        ]),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        }
      )
    );

    await expect(postSseJson("/api/test", {})).rejects.toThrow(
      "결과를 끝까지 받지 못했어요. 다시 시도해 주세요."
    );
  });

  it("실패 응답이 JSON이 아니어도 일반 오류 문구를 돌려준다", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("server exploded", { status: 502 }));

    await expect(postSseJson("/api/test", {})).rejects.toThrow(
      "요청 처리에 실패했어요. 다시 시도해 주세요. (502)"
    );
  });

  it("abort signal을 그대로 전달하고 중단 오류를 구분할 수 있다", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("The operation was aborted.", "AbortError");

    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(postSseJson("/api/test", {}, { signal: controller.signal })).rejects.toBe(abortError);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        signal: controller.signal
      })
    );
    expect(isAbortError(abortError)).toBe(true);
  });
});
