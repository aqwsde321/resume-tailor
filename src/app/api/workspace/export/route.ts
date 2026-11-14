import { z } from "zod";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";
import { PDF_TEMPLATE_IDS } from "@/entities/pdf/model/templates";
import { PDF_THEME_IDS } from "@/entities/pdf/model/themes";
import { apiErrorResponse, parseJsonBody } from "@/server/http";
import { buildResumePdf } from "@/server/pdf/build";
import { auditResumePdf } from "@/server/pdf/ats-audit";
import { saveAttachment } from "@/server/workspace-attachments";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, z.object({ resume: ResumeSchema, company: CompanySchema, intro: IntroSchema.nullish(), templateId: z.enum(PDF_TEMPLATE_IDS).default("classic"), themeId: z.enum(PDF_THEME_IDS).default("cobalt") }).strict());
    const intro = body.intro ?? IntroSchema.parse({ longIntro: body.resume.summary });
    const pdf = await buildResumePdf(body.resume, intro, body.company, body.templateId, body.themeId);
    const audit = await auditResumePdf(pdf, body.resume, body.company);
    const id = await saveAttachment(pdf, "resume.pdf", "application/pdf");
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=resume.pdf", "Cache-Control": "no-store", "X-Workspace-Attachment-ID": id, "X-Resume-Pdf-Ats-Audit": Buffer.from(JSON.stringify(audit)).toString("base64url") } });
  } catch (error) { return apiErrorResponse(error); }
}
