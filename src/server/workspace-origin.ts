import { HttpError } from "@/server/http";

// Next standalone은 내부 URL을 localhost로 재구성할 수 있다. 브라우저가
// 실제로 요청한 Host를 기준으로 비교하되 다른 사이트·포트는 허용하지 않는다.
export function assertWorkspaceSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const internal = new URL(request.url);
    const host = request.headers.get("host");
    const expected = host ? new URL(`${internal.protocol}//${host}`) : internal;
    if (expected.username || expected.password || (host && (expected.pathname !== "/" || expected.search || expected.hash))) throw new Error();
    if (new URL(origin).origin !== expected.origin || new URL(origin).origin !== origin) throw new Error();
  } catch {
    throw new HttpError(403, "이 앱에서 작업을 저장해 주세요.");
  }
}
