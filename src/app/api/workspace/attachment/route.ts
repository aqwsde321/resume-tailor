import { NextResponse } from "next/server";
import { apiErrorResponse, HttpError } from "@/server/http";
import { saveAttachment } from "@/server/workspace-attachments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024) throw new HttpError(400, "20MB 이하의 PDF가 필요합니다.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new HttpError(415, "PDF 파일을 확인해 주세요.");
    return NextResponse.json({ ok: true, data: { id: await saveAttachment(buffer, file.name, "application/pdf") } });
  } catch (error) { return apiErrorResponse(error); }
}
