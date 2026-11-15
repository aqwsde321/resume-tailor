import { describe, expect, it } from "vitest";
import { assertWorkspaceSameOrigin } from "@/server/workspace-origin";

describe("workspace request origin", () => {
  it("standalone 내부 URL과 달라도 실제 요청 Host와 같은 출처이면 허용한다", () => {
    const request = new Request("http://localhost:3002/api/workspace", { headers: { host: "127.0.0.1:3002", origin: "http://127.0.0.1:3002" } });
    expect(() => assertWorkspaceSameOrigin(request)).not.toThrow();
  });
  it("다른 사이트와 다른 포트에서 보내는 쓰기 요청은 거절한다", () => {
    for (const origin of ["http://evil.example", "http://127.0.0.1:4000", "null"]) {
      expect(() => assertWorkspaceSameOrigin(new Request("http://localhost:3002/api/workspace", { headers: { host: "127.0.0.1:3002", origin } }))).toThrow();
    }
  });
  it("Origin이 없는 서버 요청과 기본 포트 표기는 처리한다", () => {
    expect(() => assertWorkspaceSameOrigin(new Request("http://localhost/api/workspace"))).not.toThrow();
    expect(() => assertWorkspaceSameOrigin(new Request("http://localhost/api/workspace", { headers: { host: "localhost:80", origin: "http://localhost" } }))).not.toThrow();
  });
});
