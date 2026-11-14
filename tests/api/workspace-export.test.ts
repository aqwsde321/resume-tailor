import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workspace/export/route";
import { buildResumePdf } from "@/server/pdf/build";
import { auditResumePdf } from "@/server/pdf/ats-audit";
import { saveAttachment } from "@/server/workspace-attachments";
vi.mock("@/server/pdf/build", () => ({ buildResumePdf: vi.fn().mockResolvedValue(Buffer.from("%PDF-test")) }));
vi.mock("@/server/pdf/ats-audit", () => ({ auditResumePdf: vi.fn().mockResolvedValue({}) }));
vi.mock("@/server/workspace-attachments", () => ({ saveAttachment: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111") }));
describe("workspace PDF export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF-test"));
    vi.mocked(auditResumePdf).mockResolvedValue({} as Awaited<ReturnType<typeof auditResumePdf>>);
    vi.mocked(saveAttachment).mockResolvedValue("11111111-1111-4111-8111-111111111111");
  });
  it("소개글 생성 없이도 PDF를 출력하고 원본 요약을 유지한다", async () => {
    const response = await POST(new Request("http://localhost/api/workspace/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: { summary: "이력서 요약" }, company: {} }) }));
    expect(response.status, response.ok ? "" : await response.clone().text()).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(vi.mocked(buildResumePdf).mock.calls[0][1].longIntro).toBe("이력서 요약");
  });
});
