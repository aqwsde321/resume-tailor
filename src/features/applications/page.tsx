"use client";

import { usePipeline } from "@/entities/pipeline/model/pipeline-context";
import { ApplicationsWorkspace } from "@/features/applications/ui/applications-workspace";
import { AppFrame } from "@/shared/ui/frame/app-frame";

export default function ApplicationsPage() {
  const { state } = usePipeline();

  return (
    <AppFrame
      step="resume"
      title="지원 기록"
      description="회사별로 저장한 이력서와 PDF를 다시 확인하고 지원 진행 상황을 관리합니다."
      layout="wide"
      showSaveSummary={false}
      showWorkflowSteps={false}
      applicationsActive
    >
      <ApplicationsWorkspace records={state.applications} />
    </AppFrame>
  );
}
