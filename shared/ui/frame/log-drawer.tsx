"use client";

import type { ReactNode } from "react";

interface LogDrawerProps {
  latestSummary: ReactNode;
  logExpanded: boolean;
  logList: ReactNode;
  onToggle: () => void;
}

export function LogDrawer({
  latestSummary,
  logExpanded,
  logList,
  onToggle
}: LogDrawerProps) {
  return (
    <section className={`card log-drawer ${logExpanded ? "open" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">기록</p>
          <h2>지난 작업 기록</h2>
        </div>
        <button type="button" className="tertiary" onClick={onToggle}>
          {logExpanded ? "접기" : "기록 보기"}
        </button>
      </div>

      {logExpanded ? logList : latestSummary}
    </section>
  );
}
