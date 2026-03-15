"use client";

import { AutoGrowTextarea } from "@/shared/ui/auto-grow-textarea";
import { parseInlineItems, stringifyInlineList } from "@/shared/lib/list-input";
import { makeEmptyProject } from "@/entities/resume/model/resume-utils";
import type { Resume, ResumeProjectItem } from "@/shared/lib/types";

interface ResumeProjectsSectionProps {
  draft: Resume;
  projectTechStackTexts: string[];
  setProjectTechStackTexts: (updater: (current: string[]) => string[]) => void;
  syncDraft: (next: Resume) => void;
  uiBusy: boolean;
  updateProject: (
    index: number,
    key: keyof Pick<ResumeProjectItem, "name" | "description">,
    value: string
  ) => void;
  updateProjectTechStack: (index: number, techStack: string[]) => void;
}

export function ResumeProjectsSection({
  draft,
  projectTechStackTexts,
  setProjectTechStackTexts,
  syncDraft,
  uiBusy,
  updateProject,
  updateProjectTechStack
}: ResumeProjectsSectionProps) {
  return (
    <section className="card workflow-section-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">4. 프로젝트</p>
          <h2>핵심 설명과 사용 기술만 정리</h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => syncDraft({ ...draft, projects: [...draft.projects, makeEmptyProject()] })}
          disabled={uiBusy}
        >
          프로젝트 추가
        </button>
      </div>

      <p className="card-copy">
        링크와 출력 전용 정보는 step 4에서 다룹니다. 여기서는 핵심 설명만 남기면 됩니다.
      </p>

      {draft.projects.length === 0 && <p className="muted-help">아직 프로젝트가 없어요.</p>}

      <div className="array-section">
        {draft.projects.map((item, index) => (
          <details
            key={`project-${index}`}
            className="collapsible-section"
            open={draft.projects.length === 1}
          >
            <summary>
              <div className="resume-item-summary">
                <p className="card-kicker">프로젝트 {index + 1}</p>
                <strong>{item.name.trim() || `프로젝트 ${index + 1}`}</strong>
                <p>{item.techStack.length > 0 ? item.techStack.join(", ") : "기술 스택을 입력해 주세요."}</p>
              </div>
              <span className="inline-badge">{item.techStack.length}개 스택</span>
            </summary>

            <div className="collapsible-content">
              <div className="array-item-head">
                <span className="muted-help">
                  프로젝트 설명은 문제, 기여, 결과가 한 번에 보이도록 짧게 적는 편이 좋습니다.
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    syncDraft({
                      ...draft,
                      projects: draft.projects.filter((_, itemIndex) => itemIndex !== index)
                    })
                  }
                  disabled={uiBusy}
                >
                  삭제
                </button>
              </div>

              <div className="project-grid">
                <label className="field field-full">
                  <span>프로젝트 이름</span>
                  <input
                    className="form-input"
                    value={item.name}
                    onChange={(event) => updateProject(index, "name", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full project-description-field">
                  <span>내용</span>
                  <AutoGrowTextarea
                    className="project-description-textarea"
                    value={item.description}
                    onChange={(event) => updateProject(index, "description", event.target.value)}
                    disabled={uiBusy}
                  />
                </label>
                <label className="field field-full">
                  <span>기술 스택</span>
                  <input
                    className="form-input inline-stack-input"
                    type="text"
                    value={projectTechStackTexts[index] ?? stringifyInlineList(item.techStack)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setProjectTechStackTexts((current) => {
                        const nextValues = [...current];
                        nextValues[index] = value;
                        return nextValues;
                      });
                      updateProjectTechStack(index, parseInlineItems(value));
                    }}
                    placeholder="예) React, TypeScript, Docker"
                    disabled={uiBusy}
                  />
                  <span className="field-help">쉼표로 구분해서 입력하면 됩니다.</span>
                </label>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
