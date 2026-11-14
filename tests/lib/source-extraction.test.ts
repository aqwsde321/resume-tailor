import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractUploadedSource } from "@/server/source-extraction";
import { runDocumentTool } from "@/server/document-tools";
import { extractTextFromImages } from "@/server/company-image-ocr";

vi.mock("@/server/document-tools", () => ({ runDocumentTool: vi.fn() }));
vi.mock("@/server/company-image-ocr", () => ({ extractTextFromImages: vi.fn() }));
describe("uploaded source extraction", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("Markdown과 원문 줄바꿈을 유지하고 JSON 변환은 수행하지 않는다", async () => {
    const result = await extractUploadedSource({ name: "resume.md", buffer: Buffer.from("# 경력\n\n회사 A\n- Java") });
    expect(result.text).toBe("# 경력\n\n회사 A\n- Java");
    expect(result.type).toBe("markdown");
    expect(runDocumentTool).not.toHaveBeenCalled();
  });
  it("일반 PDF 페이지와 스캔 페이지를 따로 처리한다", async () => {
    vi.mocked(runDocumentTool).mockImplementation(async (command, args) => {
      if (command === "pdfinfo") return "Pages: 2\n";
      if (command === "pdftotext") return args.includes("1") ? "첫 페이지 Java와 Spring Boot를 사용한 백엔드 개발 경력" : "";
      return "";
    });
    vi.mocked(extractTextFromImages).mockResolvedValue(["스캔 페이지 Spring"]);
    // PDF 페이지 렌더링 결과를 읽는 부분만 대체한다.
    const result = await extractUploadedSource({ name: "resume.pdf", buffer: Buffer.from("%PDF-1.4"), readRaster: async () => Buffer.from("image") });
    expect(result.pages.map((page) => page.method)).toEqual(["text", "ocr"]);
    expect(result.text).toContain("스캔 페이지 Spring");
    expect(extractTextFromImages).toHaveBeenCalledTimes(1);
  });
  it("OCR이 실패해도 원문 재검토를 위해 페이지와 경고를 돌려준다", async () => {
    vi.mocked(extractTextFromImages).mockResolvedValue([]);
    const result = await extractUploadedSource({ name: "scan.png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
    expect(result.text).toBe("");
    expect(result.warnings).toHaveLength(1);
    expect(result.pages).toHaveLength(1);
  });
  it("지원하지 않는 파일과 20MB 초과 파일을 거절한다", async () => {
    await expect(extractUploadedSource({ name: "file.exe", buffer: Buffer.from("abc") })).rejects.toThrow();
    await expect(extractUploadedSource({ name: "file.txt", buffer: Buffer.alloc(21 * 1024 * 1024) })).rejects.toThrow();
  });
});
