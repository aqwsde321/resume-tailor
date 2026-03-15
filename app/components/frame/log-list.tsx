"use client";

import { LEVEL_LABEL, PHASE_LABEL, TASK_LABEL } from "@/app/components/frame/frame-meta";
import type { PipelineLog } from "@/lib/types";

interface LogListProps {
  formatLogTime: (value: string) => string;
  logs: PipelineLog[];
}

export function LogList({ formatLogTime, logs }: LogListProps) {
  return (
    <ul className="log-list">
      {logs.map((log) => (
        <li key={log.id} className={`log-item ${log.level}`}>
          <div className="log-meta">
            <span className="log-badge task">{TASK_LABEL[log.task]}</span>
            <span className="log-badge phase">{PHASE_LABEL[log.phase] ?? PHASE_LABEL.unknown}</span>
            <span className={`log-badge level ${log.level}`}>{LEVEL_LABEL[log.level]}</span>
            <span className="log-time">{formatLogTime(log.at)}</span>
          </div>
          <p>{log.message}</p>
        </li>
      ))}
    </ul>
  );
}
