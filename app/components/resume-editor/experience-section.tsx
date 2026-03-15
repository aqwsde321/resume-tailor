"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { makeEmptyExperience } from "@/lib/resume-utils";
import type { Resume, ResumeExperienceItem } from "@/lib/types";

interface ResumeExperienceSectionProps {
  draft: Resume;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
  updateExperience: (index: number, key: keyof ResumeExperienceItem, value: string) => void;
}

export function ResumeExperienceSection({
  draft,
  syncDraft,
  uiBusy,
  updateExperience
}: ResumeExperienceSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">3. 경력</p>
          <h2>필요한 카드만 펼쳐서 수정</h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => syncDraft({ ...draft, experience: [...draft.experience, makeEmptyExperience()] })}
          disabled={uiBusy}
        >
          경력 추가
        </button>
      </div>

      {draft.experience.length === 0 && <p className="muted-help">아직 경력이 없어요.</p>}

      <div className="array-section">
        {draft.experience.map((item, index) => (
          <details
            key={`experience-${index}`}
            className="collapsible-section"
            open={draft.experience.length === 1}
          >
            <summary>
              <div className="resume-item-summary">
                <p className="card-kicker">경력 {index + 1}</p>
                <strong>{item.company.trim() || item.role.trim() || `경력 ${index + 1}`}</strong>
                <p>{item.period.trim() || "기간을 입력해 주세요."}</p>
              </div>
              <span className="inline-badge">{item.role.trim() || "역할 입력"}</span>
            </summary>

            <div className="collapsible-content">
              <div className="array-item-head">
                <span className="muted-help">
                  소개글에 반영할 핵심 역할과 문제 해결 경험만 남기면 충분합니다.
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      experience: draft.experience.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={uiBusy}
                >
                  삭제
                </button>
              </div>

              <div className="form-grid two">
                <label className="field">
                  <span>회사</span>
                  <input
                    className="form-input"
                    value={item.company}
                    onChange={(event) => updateExperience(index, "company", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field">
                  <span>담당 역할</span>
                  <input
                    className="form-input"
                    value={item.role}
                    onChange={(event) => updateExperience(index, "role", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>기간</span>
                  <input
                    className="form-input"
                    value={item.period}
                    onChange={(event) => updateExperience(index, "period", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>내용</span>
                  <AutoGrowTextarea
                    value={item.description}
                    onChange={(event) => updateExperience(index, "description", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
