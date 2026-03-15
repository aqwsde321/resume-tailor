import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());
const existsSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: existsSyncMock
  };
});

describe("company-image-ocr", () => {
  const originalPlatform = process.platform;
  const originalTesseractPath = process.env.TESSERACT_PATH;

  beforeEach(() => {
    vi.resetModules();
    execFileMock.mockReset();
    existsSyncMock.mockReset();
    process.env.TESSERACT_PATH = "/tmp/tesseract";
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: "linux"
    });
  });

  afterEach(() => {
    if (originalTesseractPath === undefined) {
      delete process.env.TESSERACT_PATH;
    } else {
      process.env.TESSERACT_PATH = originalTesseractPath;
    }

    Object.defineProperty(process, "platform", {
      configurable: true,
      value: originalPlatform
    });
  });

  it("linux에서 tesseract가 있으면 OCR 결과를 정규화한다", async () => {
    existsSyncMock.mockImplementation((value) => value === "/tmp/tesseract");
    execFileMock.mockImplementation((command, args, options, callback) => {
      callback(null, {
        stdout: "주요 업무 \n\n Java API 개발\r\n자격 요건\r\nJava 경험\n",
        stderr: ""
      });
    });

    const { extractTextFromImages, isImageOcrAvailable } = await import("@/server/company-image-ocr");

    expect(isImageOcrAvailable()).toBe(true);

    const result = await extractTextFromImages([
      {
        buffer: Buffer.from([137, 80, 78, 71]),
        contentType: "image/png",
        sourceUrl: "https://example.com/detail.png"
      }
    ]);

    expect(execFileMock).toHaveBeenCalledWith(
      "/tmp/tesseract",
      expect.arrayContaining(["stdout", "-l", "kor+eng", "--psm", "6"]),
      expect.any(Object),
      expect.any(Function)
    );
    expect(result).toEqual(["주요 업무\nJava API 개발\n자격 요건\nJava 경험"]);
  });

  it("linux에서 tesseract가 없으면 OCR을 비활성화한다", async () => {
    existsSyncMock.mockReturnValue(false);

    const { extractTextFromImages, isImageOcrAvailable } = await import("@/server/company-image-ocr");

    expect(isImageOcrAvailable()).toBe(false);

    const result = await extractTextFromImages([
      {
        buffer: Buffer.from([255, 216, 255]),
        contentType: "image/jpeg",
        sourceUrl: "https://example.com/detail.jpg"
      }
    ]);

    expect(result).toEqual([]);
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
