"use client";

import { useCallback, useState } from "react";

import type { Company, Resume } from "@/shared/lib/types";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { usePipeline } from "@/entities/pipeline/model/pipeline-context";
import {
  type ResumeTailoringPlan,
  type ResumeTailoringResult
} from "@/entities/resume/model/resume-tailoring";
import { usePipelineStreamTask } from "@/shared/hooks/use-pipeline-stream-task";

export interface ResumeTailoringReview {
  plan: ResumeTailoringPlan;
  resume: Resume;
  sourceResume: Resume;
}

export function useResumeTailoringWorkflow(args: {
  company: Company | null;
  resume: Resume | null;
  setResume: (resume: Resume) => void;
}) {
  const { state } = usePipeline();
  const runStreamTask = usePipelineStreamTask();
  const [review, setReview] = useState<ResumeTailoringReview | null>(null);

  const generate = useCallback(async () => {
    if (!args.resume || !args.company) {
      return;
    }

    const sourceResume = structuredClone(args.resume);
    setReview(null);
    await runStreamTask<ResumeTailoringResult>({
      task: "resumeTailoring",
      endpoint: "/api/resume/tailor/stream",
      requestBody: {
        resume: {
          ...sourceResume,
          pdfProfileImageDataUrl: "",
          pdfProfileImageVisible: false
        },
        company: args.company,
        agent: toAgentRunOptions(state.agentSettings)
      },
      startMessage: `${args.company.companyName || "이 회사"} 공고에 맞게 이력서를 정리하고 있어요.`,
      successMessage: "회사 맞춤 이력서 초안을 준비했어요.",
      abortMessage: "회사 맞춤 이력서 생성을 중단했어요.",
      fallbackErrorMessage: "회사 맞춤 이력서를 만들지 못했어요.",
      onSuccess: (result) => {
        setReview({
          plan: result.plan,
          sourceResume,
          resume: {
            ...result.resume,
            pdfProfileImageDataUrl: sourceResume.pdfProfileImageDataUrl ?? "",
            pdfProfileImageVisible: sourceResume.pdfProfileImageVisible ?? false
          }
        });
      }
    });
  }, [args.company, args.resume, runStreamTask, state.agentSettings]);

  const apply = useCallback(() => {
    if (!review) {
      return;
    }

    args.setResume(review.resume);
    setReview(null);
  }, [args, review]);

  const dismiss = useCallback(() => setReview(null), []);

  return {
    review,
    generate,
    apply,
    dismiss,
    clearReview: dismiss,
    isGenerating: state.currentTask === "resumeTailoring"
  };
}
