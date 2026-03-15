"use client";

import { AutoGrowTextarea } from "@/shared/ui/auto-grow-textarea";
import { parseInlineItems } from "@/shared/lib/list-input";
import type { Resume } from "@/shared/lib/types";

interface ResumeCoreSectionProps {
  bindRequiredFieldRef: (key: "desiredPosition" | "techStack") => (node: HTMLElement | null) => void;
  draft: Resume;
  syncDraft: (next: Resume) => void;
  techStackText: string;
  setTechStackText: (value: string) => void;
  uiBusy: boolean;
}

export function ResumeCoreSection({
  bindRequiredFieldRef,
  draft,
  syncDraft,
  techStackText,
  setTechStackText,
  uiBusy
}: ResumeCoreSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">1. 핵심 정보</p>
          <h2>소개글의 뼈대</h2>
        </div>
      </div>

      <div className="form-grid resume-core-grid">
        <label className="field">
          <span>이름</span>
          <input
            className="form-input"
            value={draft.name}
            onChange={(event) => syncDraft({ ...draft, name: event.target.value })}
            disabled={uiBusy}
          />
        </label>

        <label
          ref={bindRequiredFieldRef("desiredPosition")}
          className={`field ${!draft.desiredPosition.trim() ? "field-error" : ""}`}
        >
          <span>희망 직무</span>
          <input
            className="form-input"
            value={draft.desiredPosition}
            onChange={(event) => syncDraft({ ...draft, desiredPosition: event.target.value })}
            disabled={uiBusy}
          />
        </label>

        <label className="field">
          <span>경력 연차</span>
          <input
            className="form-input"
            type="number"
            min={0}
            value={draft.careerYears}
            onChange={(event) =>
              syncDraft({
                ...draft,
                careerYears: Number.isNaN(Number(event.target.value))
                  ? 0
                  : Math.max(0, Number(event.target.value))
              })
            }
            disabled={uiBusy}
          />
        </label>

        <div
          ref={bindRequiredFieldRef("techStack")}
          className={`field field-full ${draft.techStack.length === 0 ? "field-error" : ""}`}
        >
          <span>기술 스택</span>
          <input
            className="form-input inline-stack-input"
            type="text"
            value={techStackText}
            onChange={(event) => {
              const value = event.target.value;
              setTechStackText(value);
              syncDraft({ ...draft, techStack: parseInlineItems(value) });
            }}
            placeholder="예) Java, Spring Boot, MySQL, Redis, Docker"
            disabled={uiBusy}
          />
          <span className="field-help">쉼표로 구분해서 한 줄로 적으면 됩니다.</span>
        </div>

        <label className="field field-full">
          <span>요약</span>
          <AutoGrowTextarea
            value={draft.summary}
            onChange={(event) => syncDraft({ ...draft, summary: event.target.value })}
            disabled={uiBusy}
          />
        </label>
      </div>
    </section>
  );
}
