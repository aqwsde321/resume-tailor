"use client";

interface LiveTaskModalProps {
  activeTaskLabel: string;
  busyProgressValue: number;
  busyStage: string | null;
  busyStageLabels: Record<string, string> | null;
  busyStageOrder: string[];
  canCancel: boolean;
  elapsedSeconds: number;
  isCancellingTask: boolean;
  isClosing: boolean;
  liveMessage: string;
  liveSubMessage?: string;
  onCancel: () => void;
}

export function LiveTaskModal({
  activeTaskLabel,
  busyProgressValue,
  busyStage,
  busyStageLabels,
  busyStageOrder,
  canCancel,
  elapsedSeconds,
  isCancellingTask,
  isClosing,
  liveMessage,
  liveSubMessage,
  onCancel
}: LiveTaskModalProps) {
  return (
    <section
      className={`live-log-modal ${isClosing ? "closing" : ""}`}
      aria-live="polite"
      role="dialog"
      aria-modal="true"
    >
      <div className="live-log-head">
        <div>
          <div className="live-log-title-row">
            <span className="live-log-spinner" aria-hidden="true" />
            <h2>{activeTaskLabel}</h2>
            {busyStage && busyStageLabels && (
              <span className="live-log-phase-pill">{busyStageLabels[busyStage]}</span>
            )}
          </div>
          <p className="live-log-copy">{liveMessage}</p>
          {!isCancellingTask && liveSubMessage && (
            <p className="live-log-subcopy">{liveSubMessage}</p>
          )}
        </div>
        <div className="live-log-actions">
          <span className="live-log-timer">{elapsedSeconds}초</span>
          <button type="button" className="secondary" onClick={onCancel} disabled={!canCancel}>
            {isCancellingTask ? "중단 중..." : "작업 중지"}
          </button>
        </div>
      </div>

      {busyStage && busyStageLabels && (
        <div className="live-progress" aria-label="작업 진행 상태">
          <div className="live-progress-track" aria-hidden="true">
            <div className="live-progress-fill" style={{ width: `${busyProgressValue}%` }} />
          </div>
          <ol className="live-progress-steps">
            {busyStageOrder.map((stage, index) => {
              const currentIndex = busyStageOrder.indexOf(busyStage);
              const status =
                index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";

              return (
                <li key={stage} className={`live-progress-step ${status}`}>
                  <span className="live-progress-dot" aria-hidden="true" />
                  <span>{busyStageLabels[stage]}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
