"use client";

import type { ReactNode } from "react";

import { FrameShell } from "@/shared/ui/frame/frame-shell";
import { LiveTaskModal } from "@/shared/ui/frame/live-task-modal";
import { LogDrawer } from "@/shared/ui/frame/log-drawer";
import { LogList } from "@/shared/ui/frame/log-list";
import { StatusToast } from "@/shared/ui/frame/status-toast";
import { type StepKey } from "@/shared/ui/frame/frame-meta";
import { useAppFrameView } from "@/shared/ui/frame/use-app-frame-view";

interface AppFrameProps {
  step: StepKey;
  title: string;
  description: string;
  layout?: "default" | "wide";
  stickyShell?: boolean;
  showSaveSummary?: boolean;
  children: ReactNode;
}

export function AppFrame({
  step,
  title,
  description,
  layout = "default",
  stickyShell = true,
  showSaveSummary = true,
  children
}: AppFrameProps) {
  const {
    activeLiveTask,
    busyProgressValue,
    busyStage,
    busyStageLabels,
    busyStageOrder,
    cancelCurrentTask,
    elapsedSeconds,
    formatLogTime,
    hydrated,
    isWorking,
    liveMessage,
    liveModal,
    liveSubMessage,
    logExpanded,
    logs,
    latestSummary,
    saveSummaryItems,
    setLogExpanded,
    showLiveModal,
    state,
    statusTone,
    statusValue,
    steps,
    taskLabel
  } = useAppFrameView(step);

  if (!hydrated) {
    return (
      <main className="page" data-step={step}>
        <div className="backdrop" />
        <div className={`container ${layout === "wide" ? "container-wide" : ""}`}>
          <section className="card">
            <h2>불러오는 중...</h2>
            <p>저장된 내용을 읽고 있어요.</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`page ${showLiveModal ? "page-busy" : ""}`}
      aria-busy={isWorking}
      data-step={step}
    >
      <div className="backdrop" />
      {showLiveModal && (
        <div className={`busy-overlay ${liveModal.isClosing ? "closing" : ""}`} aria-hidden="true" />
      )}
      <div className={`container ${layout === "wide" ? "container-wide" : ""}`}>
        <FrameShell
          description={description}
          saveSummaryItems={saveSummaryItems}
          showSaveSummary={showSaveSummary}
          steps={steps}
          stickyShell={stickyShell}
          title={title}
        />

        {statusTone && statusValue && <StatusToast tone={statusTone} value={statusValue} />}

        {children}

        {logs.length > 0 && !state.currentTask && (
          <LogDrawer
            latestSummary={
              latestSummary ? (
                <p className="log-summary">
                  <strong>{latestSummary.taskLabel}</strong>
                  <span>{latestSummary.time}</span>
                  <span>{latestSummary.message}</span>
                </p>
              ) : null
            }
            logExpanded={logExpanded}
            logList={<LogList formatLogTime={formatLogTime} logs={logs} />}
            onToggle={() => setLogExpanded((prev) => !prev)}
          />
        )}
      </div>

      {activeLiveTask && (
        <LiveTaskModal
          activeTaskLabel={taskLabel ?? ""}
          busyProgressValue={busyProgressValue}
          busyStage={busyStage}
          busyStageLabels={busyStageLabels}
          busyStageOrder={busyStageOrder}
          canCancel={Boolean(state.currentTask) && !state.isCancellingTask}
          elapsedSeconds={elapsedSeconds}
          isCancellingTask={Boolean(state.isCancellingTask)}
          isClosing={liveModal.isClosing}
          liveMessage={liveMessage}
          liveSubMessage={liveSubMessage}
          onCancel={cancelCurrentTask}
        />
      )}
    </main>
  );
}
