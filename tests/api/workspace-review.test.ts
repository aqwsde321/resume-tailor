import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workspace/review/route";
import { runSkillJson } from "@/server/codex-client";
vi.mock("@/server/codex-client", () => ({ runSkillJson: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const document = {
  id, kind: "resume", title: "검토", source: { type: "text", originalText: "회사 A\n\nJ a v a", pages: [] },
  text: "회사 A\n\nJ a v a", annotations: [{ id, instruction: "Java로 합쳐줘", anchor: { type: "text", start: 6, end: 13, quote: "J a v a" }, status: "pending", createdAt: new Date().toISOString() }],
  proposal: null, history: [], updatedAt: new Date().toISOString(),
};
const request = (value: unknown) => new Request("http://localhost/api/workspace/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: value }) });
describe("batch annotation review", () => {
  beforeEach(() => vi.clearAllMocks());
  it("AI는 문단 ID로 변경을 제안하고 서버가 실제 원문 위치를 연결한다", async () => {
    vi.mocked(runSkillJson).mockResolvedValue({ changes: [{ blockId: "block-1", after: "Java", reason: "표기 수정", commentIds: [id] }], unresolved: [] });
    const response = await POST(request(document));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.changes[0]).toMatchObject({ start: 6, end: 13, before: "J a v a", after: "Java" });
    expect(document.text).toBe("회사 A\n\nJ a v a");
  });
  it("선택한 글자가 현재 문서와 다르면 AI 호출 전에 막는다", async () => {
    const response = await POST(request({ ...document, text: "변경된 문서" }));
    expect(response.status).toBe(409);
    expect(runSkillJson).not.toHaveBeenCalled();
  });
  it("없는 댓글이나 문단을 인용한 결과는 적용 가능한 제안으로 내보내지 않는다", async () => {
    vi.mocked(runSkillJson).mockResolvedValue({ changes: [{ blockId: "missing", after: "내용", reason: "수정", commentIds: [id] }], unresolved: [] });
    expect((await POST(request(document))).status).toBe(502);
  });
});
