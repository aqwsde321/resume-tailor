"use client";

import type { ReactNode } from "react";

import type { RefreshReasonBadge } from "@/lib/result-view";

interface IntroActionCardProps {
  actionControls: ReactNode;
  actionDescription: string;
  actionHeading: string;
  freshnessTone: "info" | "ok" | "warn";
  isWorking: boolean;
  refreshReasonBadges: RefreshReasonBadge[];
}

export function IntroActionCard({
  actionControls,
  actionDescription,
  actionHeading,
  freshnessTone,
  isWorking,
  refreshReasonBadges
}: IntroActionCardProps) {
  return (
    <section className={`card card-accent workflow-main-card ${isWorking ? "card-processing" : ""}`}>
      <div className="card-head">
        <div>
          <p className="card-kicker">만들기</p>
          <h2>소개글 만들기</h2>
        </div>
      </div>

      <div className="action-panel">
        <div className={`action-copy intro-action-copy ${freshnessTone}`}>
          <strong>{actionHeading}</strong>
          {actionDescription && <span>{actionDescription}</span>}
          {refreshReasonBadges.length > 0 && (
            <div className="reason-chip-row">
              {refreshReasonBadges.map((badge) => (
                <span
                  key={badge.key}
                  className={`reason-chip ${badge.key === "resume" ? "resume" : "company"}`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="action-controls">{actionControls}</div>
      </div>
    </section>
  );
}
