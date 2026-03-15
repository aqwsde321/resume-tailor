"use client";

import { AutoGrowTextarea } from "@/shared/ui/auto-grow-textarea";

import { ListTextarea } from "./list-textarea";
import type { ProjectsSectionFormProps } from "./section-form-types";

export function ProjectsSectionForm({
  exporting,
  onProjectTechStackTextChange,
  projectTechStackTexts,
  resume,
  updateResume
}: ProjectsSectionFormProps) {
  const updateProjectField = (
    index: number,
    key: "name" | "description" | "subtitle" | "link" | "linkLabel",
    value: string
  ) => {
    updateResume((current) => ({
      ...current,
      projects: current.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  return (
    <>
      {resume.projects.length === 0 && (
        <p className="muted-help">프로젝트가 없으면 이 영역은 PDF에서 숨겨집니다.</p>
      )}

      <div className="pdf-stack">
        {resume.projects.map((project, index) => (
          <div key={`project-${index}`} className="pdf-inline-card">
            <div className="pdf-inline-card-head">
              <strong>{project.name.trim() || `프로젝트 ${index + 1}`}</strong>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updateResume((current) => ({
                    ...current,
                    projects: current.projects.filter((_, itemIndex) => itemIndex !== index)
                  }))
                }
                disabled={exporting}
              >
                삭제
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>이름</span>
                <input
                  className="form-input"
                  value={project.name}
                  onChange={(event) => updateProjectField(index, "name", event.target.value)}
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>부제목</span>
                <input
                  className="form-input"
                  value={project.subtitle}
                  onChange={(event) => updateProjectField(index, "subtitle", event.target.value)}
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>설명</span>
                <AutoGrowTextarea
                  value={project.description}
                  onChange={(event) =>
                    updateProjectField(index, "description", event.target.value)
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>기술 스택</span>
                <AutoGrowTextarea
                  className="inline-list-textarea"
                  aria-label={`프로젝트 ${index + 1} 기술 스택`}
                  placeholder="예: Node.js, TypeScript, PostgreSQL"
                  value={projectTechStackTexts[index] ?? ""}
                  onChange={(event) => onProjectTechStackTextChange(index, event.target.value)}
                  minHeight={44}
                  disabled={exporting}
                />
              </label>

              <div className="form-grid two">
                <label className="field">
                  <span>링크 URL</span>
                  <input
                    className="form-input"
                    placeholder="예: https://github.com/qrqr/project"
                    value={project.link}
                    onChange={(event) => updateProjectField(index, "link", event.target.value)}
                    disabled={exporting}
                  />
                </label>

                <label className="field">
                  <span>링크 라벨</span>
                  <input
                    className="form-input"
                    placeholder="비워 두면 URL이 그대로 보입니다."
                    value={project.linkLabel}
                    onChange={(event) =>
                      updateProjectField(index, "linkLabel", event.target.value)
                    }
                    disabled={exporting}
                  />
                </label>
              </div>

              <label className="field">
                <span>하이라이트</span>
                <ListTextarea
                  value={project.highlights}
                  placeholder="한 줄이 항목 1개입니다."
                  onChange={(nextValues) =>
                    updateResume((current) => ({
                      ...current,
                      projects: current.projects.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, highlights: nextValues } : item
                      )
                    }))
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
