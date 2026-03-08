export type SseSend = (event: string, data: unknown) => void;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no"
} as const;

export function createSseResponse(run: (send: SseSend) => Promise<void>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SseSend = (event, data) => {
        // SSE는 "event + data + 빈 줄" 형식으로 보내야 클라이언트가 한 레코드로 읽는다.
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await run(send);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: SSE_HEADERS
  });
}
