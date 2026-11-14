import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/workspace/backup/route";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
import { newTextDocument } from "@/entities/workspace/model/operations";
import { readAttachment, saveAttachment } from "@/server/workspace-attachments";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("@/server/workspace-store", () => ({ createWorkspaceStore: () => mocks, WORKSPACE_DIRECTORY: "/unused-test-directory" }));
vi.mock("@/server/workspace-attachments", () => ({ readAttachment: vi.fn(), saveAttachment: vi.fn() }));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
describe("workspace backup", () => {
  beforeEach(() => vi.clearAllMocks());
  it("문서가 참조하는 실제 원본 파일도 백업에 포함한다", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const document = newTextDocument("resume", "원본", "내용"); document.source.attachmentId = id;
    mocks.read.mockResolvedValue({ ...createEmptyWorkspace(), master: { id, version: 1, document, resume: null, enrichment: [], updatedAt: new Date().toISOString() } });
    vi.mocked(readAttachment).mockResolvedValue({ name: "source.pdf", mime: "application/pdf", buffer: Buffer.from("%PDF-source") });
    const body = await (await GET()).json();
    expect(body.attachments[0].data).toBe(Buffer.from("%PDF-source").toString("base64"));
  });
  it("참조한 원본이 없는 백업은 기존 작업을 건드리지 않고 거절한다", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const document = newTextDocument("resume", "원본", "내용"); document.source.attachmentId = id;
    const workspace = { ...createEmptyWorkspace(), master: { id, version: 1, document, resume: null, enrichment: [], updatedAt: new Date().toISOString() } };
    const response = await POST(new Request("http://localhost/api/workspace/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "resume-workspace-backup-v1", workspace, attachments: [] }) }));
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled(); expect(saveAttachment).not.toHaveBeenCalled();
  });
});
