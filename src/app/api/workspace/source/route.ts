import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, HttpError } from "@/server/http";
import { fetchCompanyPage } from "@/server/company-url-fetch";
import { fetchResumePage } from "@/server/resume-url-fetch";
import { saveAttachment } from "@/server/workspace-attachments";
import { extractUploadedSource, MAX_SOURCE_BYTES } from "@/server/source-extraction";
import { ReviewDocumentSchema, type ReviewDocument } from "@/entities/workspace/model/workspace";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > MAX_SOURCE_BYTES + 1024 * 1024) throw new HttpError(413, "파일은 20MB 이하로 올려 주세요.");
    const form = await request.formData();
    const kind = z.enum(["resume", "job"]).parse(form.get("kind"));
    const file = form.get("file");
    const url = String(form.get("url") ?? "").trim();
    const text = String(form.get("text") ?? "");
    let title = kind === "resume" ? "내 이력서" : "새 공고";
    let source: ReviewDocument["source"];
    const warnings: string[] = [];
    if (file instanceof File) {
      if (file.size > MAX_SOURCE_BYTES) throw new HttpError(413, "파일은 20MB 이하로 올려 주세요.");
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractUploadedSource({ name: file.name, buffer });
      const attachmentId = await saveAttachment(buffer, file.name, extracted.mime);
      const pages = [];
      for (const page of extracted.pages) {
        const raster = extracted.rasters.find((image) => image.page === page.page);
        const imageId = raster ? await saveAttachment(raster.buffer, `page-${page.page}`, extracted.type === "image" ? extracted.mime : "image/png") : undefined;
        pages.push({ ...page, imageId });
      }
      source = { type: extracted.type, attachmentId, originalText: extracted.text, pages };
      title = file.name;
      warnings.push(...extracted.warnings);
    } else if (url) {
      const page = kind === "resume" ? await fetchResumePage(url) : await fetchCompanyPage(url);
      source = { type: "url", url: page.url, originalText: page.text, pages: [] };
      title = page.title || title;
      if ("warning" in page && page.warning) warnings.push(String(page.warning));
    } else {
      if (!text.trim()) throw new HttpError(400, "자료를 입력해 주세요.");
      source = { type: "text", originalText: text, pages: [] };
    }
    const document = ReviewDocumentSchema.parse({ id: randomUUID(), kind, title, source, warnings, text: source.originalText.replace(/\r\n?/g, "\n"), annotations: [], proposal: null, history: [], updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, data: { document, warnings } });
  } catch (error) { return apiErrorResponse(error); }
}
