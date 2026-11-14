import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractTextFromImages } from "@/server/company-image-ocr";
import { runDocumentTool } from "@/server/document-tools";
import { HttpError } from "@/server/http";

export interface ExtractedSource {
  type: "text" | "markdown" | "pdf" | "image";
  mime: string;
  text: string;
  pages: { page: number; text: string; method: "text" | "ocr" }[];
  rasters: { page: number; buffer: Buffer }[];
  warnings: string[];
}
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export async function extractUploadedSource(input: {
  name: string;
  buffer: Buffer;
  readRaster?: (filename: string) => Promise<Buffer>;
}): Promise<ExtractedSource> {
  if (input.buffer.length > MAX_SOURCE_BYTES) throw new HttpError(413, "파일은 20MB 이하로 올려 주세요.");
  const extension = path.extname(input.name).toLowerCase();
  const result: ExtractedSource = { type: "text", mime: "text/plain", text: "", pages: [], rasters: [], warnings: [] };
  if ([".txt", ".md", ".markdown"].includes(extension)) {
    result.type = extension === ".txt" ? "text" : "markdown";
    result.text = input.buffer.toString("utf8").replace(/^\uFEFF/, "");
    if (result.text.length > 500000) throw new HttpError(413, "본문은 50만 자 이하로 올려 주세요.");
    return result;
  }
  const isPdf = extension === ".pdf" && input.buffer.subarray(0, 5).toString() === "%PDF-";
  const isPng = [".png"].includes(extension) && input.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = [".jpg", ".jpeg"].includes(extension) && input.buffer[0] === 255 && input.buffer[1] === 216;
  const isWebp = extension === ".webp" && input.buffer.subarray(0, 4).toString() === "RIFF" && input.buffer.subarray(8, 12).toString() === "WEBP";
  if (!isPdf && !isPng && !isJpeg && !isWebp) throw new HttpError(415, "PDF, PNG, JPEG, WebP, TXT, Markdown 파일을 지원합니다. 파일 형식도 확인해 주세요.");
  if (!isPdf) {
    result.type = "image";
    result.mime = isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp";
    const texts = await extractTextFromImages([{ buffer: input.buffer, contentType: result.mime }]);
    result.text = texts.join("\n");
    result.pages.push({ page: 1, text: result.text, method: "ocr" });
    result.rasters.push({ page: 1, buffer: input.buffer });
    if (!result.text.trim()) result.warnings.push("이미지의 글자를 읽지 못했습니다. 원본을 확인하고 내용을 직접 입력하거나 OCR 도구 설치를 확인해 주세요.");
    return result;
  }
  result.type = "pdf";
  result.mime = "application/pdf";
  const temp = await mkdtemp(path.join(os.tmpdir(), "resume-source-"));
  try {
    const filename = path.join(temp, "source.pdf");
    await writeFile(filename, input.buffer);
    const info = await runDocumentTool("pdfinfo", [filename]);
    const pageCount = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!pageCount || pageCount > 40) throw new HttpError(422, "PDF는 1~40페이지까지 지원합니다.");
    for (let page = 1; page <= pageCount; page++) {
      const text = (await runDocumentTool("pdftotext", ["-f", String(page), "-l", String(page), "-layout", filename, "-"])).replace(/\f/g, "").trim();
      const raster = path.join(temp, `page-${page}`);
      await runDocumentTool("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-scale-to", "1600", "-png", filename, raster]);
      const buffer = await (input.readRaster ?? readFile)(`${raster}.png`);
      result.rasters.push({ page, buffer });
      const needsOcr = text.replace(/\s/g, "").length < 20;
      const ocrText = needsOcr ? (await extractTextFromImages([{ buffer, contentType: "image/png" }])).join("\n") : "";
      const pageText = ocrText || text;
      result.pages.push({ page, text: pageText, method: needsOcr && ocrText ? "ocr" : "text" });
      if (needsOcr && !ocrText) result.warnings.push(`${page}페이지: OCR 결과가 없거나 빈 페이지입니다. 원본과 추출 문서를 확인해 주세요.`);
    }
    result.text = result.pages.map((page) => page.text).join("\n\n");
    if (result.text.length > 500000) throw new HttpError(413, "추출 본문이 50만 자를 초과했습니다.");
    return result;
  } finally { await rm(temp, { recursive: true, force: true }); }
}
