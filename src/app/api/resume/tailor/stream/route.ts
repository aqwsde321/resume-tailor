import { z } from "zod";

import {
  applyResumeTailoringPlan,
  buildResumeTailoringEvidence,
  buildResumeTailoringRequirements,
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
  const requirements = buildResumeTailoringRequirements(company);
  const safeResume = {
    ...resume,
    pdfProfileImageDataUrl: "",
    pdfProfileImageVisible: false
  };

  return [
    "[채용 공고]",
    JSON.stringify(company, null, 2),
    "",
    "[요건 ID 목록: 각 항목을 정확히 한 번씩 매칭할 것]",
    JSON.stringify(requirements, null, 2),
    "",
    "[원본 이력서: 사실을 추가하지 말고, 기존 내용을 재구성할 것]",
    JSON.stringify(safeResume, null, 2),
    "",
    "[인용 가능한 이력서 근거 목록]",
    JSON.stringify(evidence, null, 2),
    "",
    "[요건 매칭 규칙]",
    "- requirementMatches에는 위 요건 ID를 빠짐없이 각각 한 번만 넣고, 목록에 없는 ID는 만들지 않습니다.",
    "- matchType은 direct, transferable, adjacent, gap 중 하나로 분류하고 숫자 점수는 만들지 않습니다.",
    "- gap은 원본 이력서에 연결 근거가 없는 경우에만 사용하며 evidenceIds는 빈 배열로 둡니다.",
    "- direct, transferable, adjacent에는 실제 원본 근거 ID를 하나 이상 연결하고, reason에 연결 이유를 씁니다.",
    "- 약한 근거를 억지로 연결하지 말고, 요건 문구를 보유 사실처럼 맞춤 이력서에 추가하지 않습니다."
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

        if (!isResumeTailoringPlanValid(body.resume, body.company, plan)) {
          throw new HttpError(502, "맞춤 이력서 결과에 공고 요건 또는 원본 이력서에 없는 근거가 있어요.");
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
