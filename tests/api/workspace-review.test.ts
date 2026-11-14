import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/workspace/review/route";
import { runSkillJson } from "@/server/codex-client";
import { readAttachment } from "@/server/workspace-attachments";
import { cropSourceRegion } from "@/server/source-region";
import { extractTextFromImages } from "@/server/company-image-ocr";
vi.mock("@/server/codex-client", () => ({ runSkillJson: vi.fn() }));
vi.mock("@/server/workspace-attachments", () => ({ readAttachment: vi.fn() }));
vi.mock("@/server/source-region", () => ({ cropSourceRegion: vi.fn() }));
vi.mock("@/server/company-image-ocr", () => ({ extractTextFromImages: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const document = {
  id, kind: "resume", title: "검토", source: { type: "text", originalText: "회사 A\n\nJ a v a", pages: [] },
  text: "회사 A\n\nJ a v a", annotations: [{ id, instruction: "Java로 합쳐줘", anchor: { type: "text", start: 6, end: 13, quote: "J a v a" }, status: "pending", createdAt: new Date().toISOString() }],
  proposal: null, history: [], updatedAt: new Date().toISOString(),
};
const request = (value: unknown) => new Request("http://localhost/api/workspace/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document: value }) });
describe("batch annotation review", () => {
  beforeEach(() => vi.clearAllMocks());
  it("페이지 전체가 아닌 선택한 이미지 영역의 OCR 결과를 댓글 판단에 전달한다", async () => {
    vi.mocked(readAttachment).mockResolvedValue({ buffer: Buffer.from("page"), name: "page.png", mime: "image/png" });
    vi.mocked(cropSourceRegion).mockResolvedValue(Buffer.from("selected-region"));
    vi.mocked(extractTextFromImages).mockResolvedValue(["선택 영역의 실제 내용"]);
    vi.mocked(runSkillJson).mockResolvedValue({ changes: [{ blockId: "block-1", after: "Java", reason: "선택 영역 확인", commentIds: [id] }], unresolved: [] });
    const regionDocument = { ...document, source: { ...document.source, pages: [{ page: 1, text: "전체 페이지", method: "ocr", imageId: id }] }, annotations: [{ ...document.annotations[0], anchor: { type: "region", page: 1, x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }] };
    expect((await POST(request(regionDocument))).status).toBe(200);
    expect(vi.mocked(runSkillJson).mock.calls[0][0].inputText).toContain("선택 영역의 실제 내용");
    expect(vi.mocked(extractTextFromImages).mock.calls[0][0][0].buffer.toString()).toBe("selected-region");
  });
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
