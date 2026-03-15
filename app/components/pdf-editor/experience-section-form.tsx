"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";

import type { SharedSectionProps } from "./section-form-types";

export function ExperienceSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  const updateExperienceField = (
    index: number,
    key: "company" | "role" | "period" | "description",
    value: string
  ) => {
    updateResume((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  return (
    <>
      {resume.experience.length === 0 && (
        <p className="muted-help">경력이 없으면 이 영역은 PDF에서 숨겨집니다.</p>
      )}

      <div className="pdf-stack">
        {resume.experience.map((item, index) => (
          <div key={`experience-${index}`} className="pdf-inline-card">
            <div className="pdf-inline-card-head">
              <strong>{item.role.trim() || item.company.trim() || `경력 ${index + 1}`}</strong>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updateResume((current) => ({
                    ...current,
                    experience: current.experience.filter((_, itemIndex) => itemIndex !== index)
                  }))
                }
                disabled={exporting}
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
                  onChange={(event) =>
                    updateExperienceField(index, "company", event.target.value)
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>역할</span>
                <input
                  className="form-input"
                  value={item.role}
                  onChange={(event) => updateExperienceField(index, "role", event.target.value)}
                  disabled={exporting}
                />
              </label>

              <label className="field field-full">
                <span>기간</span>
                <input
                  className="form-input"
                  value={item.period}
                  onChange={(event) =>
                    updateExperienceField(index, "period", event.target.value)
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field field-full">
                <span>설명</span>
                <AutoGrowTextarea
                  value={item.description}
                  onChange={(event) =>
                    updateExperienceField(index, "description", event.target.value)
                  }
                  disabled={exporting}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
