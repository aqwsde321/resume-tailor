import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workspace/source/route";
import { fetchCompanyPage } from "@/server/company-url-fetch";
import { fetchResumePage } from "@/server/resume-url-fetch";
vi.mock("@/server/company-url-fetch", () => ({ fetchCompanyPage: vi.fn() }));
vi.mock("@/server/resume-url-fetch", () => ({ fetchResumePage: vi.fn() }));
vi.mock("@/server/workspace-attachments", () => ({ saveAttachment: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111") }));

describe("POST /api/workspace/source", () => {
  beforeEach(() => vi.clearAllMocks());
  it("추출 문서만 만들고 구조화나 AI 실행은 요청하지 않는다", async () => {
    const form = new FormData();
    form.set("kind", "resume"); form.set("text", "이력서 원문\n\n확인할 내용");
    const response = await POST(new Request("http://localhost/api/workspace/source", { method: "POST", body: form }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.document.text).toBe("이력서 원문\n\n확인할 내용");
    expect(payload.data.document.annotations).toEqual([]);
    expect(fetchResumePage).not.toHaveBeenCalled();
  });
  it("이력서와 공고 URL에 맞는 추출기를 사용한다", async () => {
    vi.mocked(fetchCompanyPage).mockResolvedValue({ url: "https://example.com/job", title: "공고", text: "개발자 채용", warning: "확인 필요" } as Awaited<ReturnType<typeof fetchCompanyPage>>);
    const form = new FormData(); form.set("kind", "job"); form.set("url", "https://example.com/job");
    const response = await POST(new Request("http://localhost/api/workspace/source", { method: "POST", body: form }));
    const payload = await response.json();
    expect(payload.data.document.source.url).toBe("https://example.com/job");
    expect(payload.data.warnings).toContain("확인 필요");
    expect(fetchResumePage).not.toHaveBeenCalled();
  });
});
