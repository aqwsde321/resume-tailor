"use client";
import type { AiTaskState } from "../hooks/use-ai-task";
import "./workspace-recovery.css";

export function AiTaskStatus({ task }: { task: AiTaskState }) {
  if (!task.busy && !task.error && !task.cancelled) return null;
  return <section className="workspace-task" aria-label="AI 작업 상태" aria-busy={task.busy}>
    <div>
      <strong role={task.error ? "alert" : "status"}>{task.busy ? `${task.label} 중` : task.cancelled ? "작업을 중단했습니다" : `${task.label} 실패`}</strong>
      {task.busy ? <><p>완료되면 결과를 확인할 수 있어요. 작업을 중단해도 현재 편집 내용은 유지됩니다.</p><span className="workspace-task-time" aria-label={`경과 시간 ${task.elapsedSeconds}초`}>{task.elapsedSeconds}초 경과</span></> : <p>{task.cancelled ? "중단한 요청의 결과는 반영되지 않습니다." : task.error}</p>}
    </div>
    <div className="workspace-recovery-actions">
      {task.busy ? <button type="button" onClick={task.cancel}>작업 중단</button> : <><button type="button" onClick={task.retry}>같은 요청 다시 시도</button><button type="button" onClick={task.clearError}>닫기</button></>}
    </div>
  </section>;
}
