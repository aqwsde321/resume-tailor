import { z } from "zod";

import {
  applyResumeTailoringPlan,
  buildResumeTailoringEvidence,
  isResumeTailoringPlanValid,
  ResumeTailoringPlanSchema,
  ResumeTailoringResultSchema,
  resumeTailoringOutputSchema
} from "@/entities/resume/model/resume-tailoring";
import {
  AgentRunOptionsSchema,
  CompanySchema,
  ResumeSchema
} from "@/shared/lib/schemas";
import { runSkillJsonStream } from "@/server/codex-client";
import { HttpError, apiErrorResponse, normalizeApiError, parseJsonBody } from "@/server/http";
import { createSseResponse } from "@/server/sse";
import { parseTaskResult } from "@/server/task-result";

export const runtime = "nodejs";

const RequestSchema = z
  .object({
    resume: ResumeSchema,
    company: CompanySchema,
    agent: AgentRunOptionsSchema.optional()
  })
  .strict();

function buildInputText(resume: z.infer<typeof ResumeSchema>, company: z.infer<typeof CompanySchema>) {
  const evidence = buildResumeTailoringEvidence(resume);
  const safeResume = {
    ...resume,
    pdfProfileImageDataUrl: "",
    pdfProfileImageVisible: false
  };

  return [
    "[채용 공고]",
    JSON.stringify(company, null, 2),
    "",
    "[원본 이력서: 사실을 추가하지 말고, 기존 내용을 재구성할 것]",
    JSON.stringify(safeResume, null, 2),
    "",
    "[인용 가능한 이력서 근거 목록]",
    JSON.stringify(evidence, null, 2)
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, RequestSchema);

    return createSseResponse(async (send) => {
      const startedAt = Date.now();

      try {
        const generated = await runSkillJsonStream<unknown>({
          skillName: "tailor-resume",
          inputText: buildInputText(body.resume, body.company),
          outputSchema: resumeTailoringOutputSchema,
          signal: request.signal,
          ...body.agent,
          onLog: (payload) => send("log", payload)
        });
        const plan = parseTaskResult("맞춤 이력서", ResumeTailoringPlanSchema, generated);

        if (!isResumeTailoringPlanValid(body.resume, plan)) {
          throw new HttpError(502, "맞춤 이력서 결과에 원본에서 찾을 수 없는 항목이 있어요.");
        }

        const sourceWithoutProfileImage = {
          ...body.resume,
          pdfProfileImageDataUrl: "",
          pdfProfileImageVisible: false
        };
        const result = ResumeTailoringResultSchema.parse({
          plan,
          resume: applyResumeTailoringPlan(sourceWithoutProfileImage, plan)
        });

        send("result", {
          data: result
        });
        send("done", {
          ok: true,
          elapsedMs: Date.now() - startedAt
        });
      } catch (error) {
        const normalized = normalizeApiError(error);
        send("error", normalized);
        send("done", {
          ok: false,
          elapsedMs: Date.now() - startedAt
        });
      }
    }, { signal: request.signal });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
