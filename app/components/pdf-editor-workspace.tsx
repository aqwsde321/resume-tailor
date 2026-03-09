"use client";

import { useEffect, useMemo, useState } from "react";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { TagInput } from "@/app/components/tag-input";
import { parseListText, stringifyLineList } from "@/lib/list-input";
import { buildTypstResumeDocument, formatPdfContactDisplay } from "@/lib/pdf/view-model";
import {
  makeEmptyContact,
  makeEmptyExperience,
  makeEmptyProject
} from "@/lib/resume-utils";
import type { Company, Intro, Resume } from "@/lib/types";

interface PdfEditorWorkspaceProps {
  company: Company;
  error: string;
  exporting: boolean;
  intro: Intro;
  onCompanyChange: (nextCompany: Company) => void;
  onExport: () => void;
  onIntroChange: (nextIntro: Intro) => void;
  onResumeChange: (nextResume: Resume) => void;
  resume: Resume;
}

interface ListTextareaProps {
  disabled: boolean;
  onChange: (nextValues: string[]) => void;
  placeholder?: string;
  value: string[];
}

type TypstPreviewStatus = "idle" | "rendering" | "ready" | "error";

interface TypstPreviewState {
  error: string;
  pages: string[];
  status: TypstPreviewStatus;
}

function ListTextarea({ disabled, onChange, placeholder, value }: ListTextareaProps) {
  const canonicalValue = useMemo(() => stringifyLineList(value), [value]);
  const [draft, setDraft] = useState(canonicalValue);

  useEffect(() => {
    setDraft(canonicalValue);
  }, [canonicalValue]);

  return (
    <AutoGrowTextarea
      className="list-textarea"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        onChange(parseListText(nextValue));
      }}
      disabled={disabled}
    />
  );
}

export function PdfEditorWorkspace({
  company,
  error,
  exporting,
  intro,
  onCompanyChange,
  onExport,
  onIntroChange,
  onResumeChange,
  resume
}: PdfEditorWorkspaceProps) {
  const preview = buildTypstResumeDocument(resume, intro, company);
  const [typstPreview, setTypstPreview] = useState<TypstPreviewState>({
    error: "",
    pages: [],
    status: "idle"
  });
  const previewRequestBody = useMemo(
    () =>
      JSON.stringify({
        resume,
        intro,
        company
      }),
    [company, intro, resume]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setTypstPreview((current) => ({
        ...current,
        error: "",
        status: "rendering"
      }));

      try {
        const response = await fetch("/api/pdf/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: previewRequestBody,
          signal: controller.signal
        });

        const payload = (await response.json()) as
          | { ok: true; data: { pages: string[] } }
          | { ok: false; error: { message: string; details?: string } };

        if (!response.ok || !payload.ok) {
          const message = payload.ok ? "Typst 미리보기를 불러오지 못했어요." : payload.error.details || payload.error.message;
          throw new Error(message);
        }

        setTypstPreview({
          error: "",
          pages: payload.data.pages,
          status: "ready"
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setTypstPreview((current) => ({
          error: error instanceof Error ? error.message : "Typst 미리보기를 불러오지 못했어요.",
          pages: current.pages,
          status: "error"
        }));
      }
    }, 240);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [previewRequestBody]);

  const updateResume = (updater: (current: Resume) => Resume) => {
    onResumeChange(updater(resume));
  };

  const updateContact = (index: number, key: "label" | "value" | "url", value: string) => {
    updateResume((current) => ({
      ...current,
      contacts: current.contacts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

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

  const updateProjectTechStack = (index: number, techStack: string[]) => {
    updateResume((current) => ({
      ...current,
      projects: current.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, techStack } : item
      )
    }));
  };

  return (
    <section className="pdf-workspace">
      {error && <p className="status error">{error}</p>}

      <div className="pdf-workspace-grid">
        <div className="pdf-editor-pane">
          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Header</p>
                <h3>상단 헤더</h3>
              </div>
              <span className="inline-badge">첫 화면 기준</span>
            </div>

            <div className="form-grid pdf-form-grid-header">
              <label className="field">
                <span>이름</span>
                <input
                  className="form-input"
                  value={resume.name}
                  onChange={(event) =>
                    updateResume((current) => ({ ...current, name: event.target.value }))
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>희망 직무</span>
                <input
                  className="form-input"
                  value={resume.desiredPosition}
                  onChange={(event) =>
                    updateResume((current) => ({ ...current, desiredPosition: event.target.value }))
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>경력 기간</span>
                <input
                  className="form-input"
                  value={resume.careerDurationText}
                  onChange={(event) =>
                    updateResume((current) => ({
                      ...current,
                      careerDurationText: event.target.value
                    }))
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field field-full">
                <span>헤드라인</span>
                <input
                  className="form-input"
                  value={resume.headline}
                  onChange={(event) =>
                    updateResume((current) => ({ ...current, headline: event.target.value }))
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field">
                <span>타깃 회사명</span>
                <input
                  className="form-input"
                  value={company.companyName}
                  onChange={(event) =>
                    onCompanyChange({
                      ...company,
                      companyName: event.target.value
                    })
                  }
                  disabled={exporting}
                />
              </label>

              <label className="field field-full">
                <span>타깃 포지션</span>
                <input
                  className="form-input"
                  value={company.jobTitle}
                  onChange={(event) =>
                    onCompanyChange({
                      ...company,
                      jobTitle: event.target.value
                    })
                  }
                  disabled={exporting}
                />
              </label>
            </div>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Contacts</p>
                <h3>연락처</h3>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updateResume((current) => ({
                    ...current,
                    contacts: [...current.contacts, makeEmptyContact()]
                  }))
                }
                disabled={exporting}
              >
                연락처 추가
              </button>
            </div>

            {resume.contacts.length === 0 && (
              <p className="muted-help">
                이메일, GitHub, 블로그처럼 PDF에 바로 보일 값만 넣으면 됩니다. 값이 없으면 이 줄은 숨겨집니다.
              </p>
            )}

            <div className="pdf-stack">
              {resume.contacts.map((contact, index) => (
                <div key={`contact-${index}`} className="pdf-inline-card">
                  <div className="pdf-inline-card-head">
                    <strong>연락처 {index + 1}</strong>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        updateResume((current) => ({
                          ...current,
                          contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index)
                        }))
                      }
                      disabled={exporting}
                    >
                      삭제
                    </button>
                  </div>

                  <div className="form-grid two">
                    <label className="field">
                      <span>구분</span>
                      <input
                        className="form-input"
                        placeholder="예: Email, GitHub"
                        value={contact.label}
                        onChange={(event) => updateContact(index, "label", event.target.value)}
                        disabled={exporting}
                      />
                    </label>

                    <label className="field">
                      <span>표시 값</span>
                      <input
                        className="form-input"
                        placeholder="예: hong@example.com, github.com/qrqr"
                        value={contact.value}
                        onChange={(event) => updateContact(index, "value", event.target.value)}
                        disabled={exporting}
                      />
                    </label>

                    <label className="field field-full">
                      <span>링크 URL</span>
                      <input
                        className="form-input"
                        placeholder="예: mailto:hong@example.com, https://github.com/qrqr"
                        value={contact.url}
                        onChange={(event) => updateContact(index, "url", event.target.value)}
                        disabled={exporting}
                      />
                    </label>
                  </div>

                  <p className="muted-help">
                    미리보기에는{" "}
                    <strong>{formatPdfContactDisplay(contact) || "표시 값"}</strong>
                    {contact.url.trim() ? " 형태로 보이고, PDF에서는 클릭 가능한 링크로 출력됩니다." : " 형태로만 출력됩니다."}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Tailored Intro</p>
                <h3>소개글</h3>
              </div>
              <span className="inline-badge ok">{company.companyName || "회사"} 기준</span>
            </div>

            <label className="field">
              <span>최종 소개글</span>
              <AutoGrowTextarea
                className="pdf-intro-textarea"
                value={intro.longIntro}
                onChange={(event) => onIntroChange({ ...intro, longIntro: event.target.value })}
                disabled={exporting}
              />
            </label>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Experience</p>
                <h3>경력</h3>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updateResume((current) => ({
                    ...current,
                    experience: [...current.experience, makeEmptyExperience()]
                  }))
                }
                disabled={exporting}
              >
                경력 추가
              </button>
            </div>

            {resume.experience.length === 0 && <p className="muted-help">경력이 없으면 이 영역은 PDF에서 숨겨집니다.</p>}

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
                        onChange={(event) => updateExperienceField(index, "company", event.target.value)}
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
                        onChange={(event) => updateExperienceField(index, "period", event.target.value)}
                        disabled={exporting}
                      />
                    </label>

                    <label className="field field-full">
                      <span>설명</span>
                      <AutoGrowTextarea
                        value={item.description}
                        onChange={(event) => updateExperienceField(index, "description", event.target.value)}
                        disabled={exporting}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Highlights</p>
                <h3>Highlights</h3>
              </div>
              <span className="inline-badge">한 줄씩 Enter</span>
            </div>

            <label className="field">
              <span>Highlights</span>
              <ListTextarea
                value={resume.pdfHighlights}
                placeholder="한 줄이 항목 1개입니다."
                onChange={(nextValues) =>
                  updateResume((current) => ({
                    ...current,
                    pdfHighlights: nextValues
                  }))
                }
                disabled={exporting}
              />
            </label>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Projects</p>
                <h3>프로젝트</h3>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updateResume((current) => ({
                    ...current,
                    projects: [...current.projects, makeEmptyProject()]
                  }))
                }
                disabled={exporting}
              >
                프로젝트 추가
              </button>
            </div>

            {resume.projects.length === 0 && <p className="muted-help">프로젝트가 없으면 이 영역은 PDF에서 숨겨집니다.</p>}

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
                        onChange={(event) => updateProjectField(index, "description", event.target.value)}
                        disabled={exporting}
                      />
                    </label>

                    <div className="field">
                      <span>기술 스택</span>
                      <TagInput
                        ariaLabel={`프로젝트 ${index + 1} 기술 스택`}
                        values={project.techStack}
                        onChange={(values) => updateProjectTechStack(index, values)}
                        placeholder="입력 후 Enter로 추가"
                        disabled={exporting}
                      />
                    </div>

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
                          onChange={(event) => updateProjectField(index, "linkLabel", event.target.value)}
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

                  <p className="muted-help">
                    step 1에 없던 링크나 부제목도 여기서 바로 넣으면 이번 PDF에 바로 반영됩니다.
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Skills</p>
                <h3>기술 스택</h3>
              </div>
              <span className="inline-badge">미리보기에서 자동 그룹화</span>
            </div>

            <div className="field">
              <span>전체 기술 스택</span>
              <TagInput
                ariaLabel="PDF 기술 스택"
                values={resume.techStack}
                onChange={(values) =>
                  updateResume((current) => ({
                    ...current,
                    techStack: values
                  }))
                }
                placeholder="입력 후 Enter로 추가"
                disabled={exporting}
              />
            </div>
          </section>

          <section className="pdf-editor-card">
            <div className="pdf-editor-card-head">
              <div>
                <p className="card-kicker">Strengths</p>
                <h3>Strengths</h3>
              </div>
              <span className="inline-badge">한 줄씩 Enter</span>
            </div>

            <label className="field">
              <span>Strengths</span>
              <ListTextarea
                value={resume.pdfStrengths}
                placeholder="한 줄이 항목 1개입니다."
                onChange={(nextValues) =>
                  updateResume((current) => ({
                    ...current,
                    pdfStrengths: nextValues
                  }))
                }
                disabled={exporting}
              />
            </label>
          </section>
        </div>

        <div className="pdf-preview-pane">
          <div className="pdf-preview-card">
            <div className="pdf-preview-card-head">
              <div>
                <p className="card-kicker">Typst Preview</p>
                <h3>실제 출력 미리보기</h3>
              </div>
              <span className={`inline-badge ${typstPreview.status === "error" ? "warn" : "ok"}`}>
                {typstPreview.status === "ready"
                  ? `${typstPreview.pages.length}p`
                  : typstPreview.status === "rendering"
                    ? "렌더링 중"
                    : typstPreview.status === "error"
                      ? "fallback"
                      : "준비 중"}
              </span>
            </div>

            {typstPreview.error && (
              <p className="muted-help">
                실제 Typst 미리보기를 불러오지 못해 HTML fallback을 보여주고 있어요. {typstPreview.error}
              </p>
            )}

            {typstPreview.pages.length > 0 ? (
              <div className="typst-preview-stack" aria-label="Typst SVG preview pages">
                {typstPreview.pages.map((pageSvg, index) => (
                  <div
                    key={`typst-preview-${index}`}
                    className="typst-preview-page"
                    dangerouslySetInnerHTML={{ __html: pageSvg }}
                  />
                ))}
              </div>
            ) : (
              <article className="pdf-paper">
                <header className="pdf-paper-header">
                  <p className="pdf-paper-name">{preview.name || "이름을 입력해 주세요"}</p>
                  <p className="pdf-paper-role-line">
                    {[preview.desiredPosition, preview.careerDuration].filter(Boolean).join(" • ") ||
                      "직무와 경력을 입력해 주세요"}
                  </p>
                  {preview.headline && <p className="pdf-paper-headline">{preview.headline}</p>}
                  {preview.targetCompany && (
                    <p className="pdf-paper-target">
                      Tailored for {preview.targetCompany}
                      {preview.targetJobTitle ? ` · ${preview.targetJobTitle}` : ""}
                    </p>
                  )}
                  {preview.contacts.length > 0 && (
                    <p className="pdf-paper-contacts">
                      {preview.contacts.map((contact) => contact.display).join(" • ")}
                    </p>
                  )}
                </header>

                <div className="pdf-paper-body">
                  {preview.sections.map((section) => (
                    <section key={section.id} className="pdf-paper-section">
                      <div className="pdf-paper-section-head">
                        <h4>{section.title}</h4>
                        <span />
                      </div>
                      <div className="pdf-paper-copy">
                        {section.paragraphs.map((paragraph, index) => (
                          <p key={`${section.id}-${index}`}>{paragraph}</p>
                        ))}
                      </div>
                    </section>
                  ))}

                  {preview.experience.length > 0 && (
                    <section className="pdf-paper-section">
                      <div className="pdf-paper-section-head">
                        <h4>Experience</h4>
                        <span />
                      </div>
                      <div className="pdf-paper-list">
                        {preview.experience.map((item, index) => (
                          <article key={`experience-${index}`} className="pdf-paper-entry">
                            <div className="pdf-paper-entry-head">
                              <strong>{item.role || "경력"}</strong>
                              <span>{item.period}</span>
                            </div>
                            {item.company && <p className="pdf-paper-entry-sub">{item.company}</p>}
                            {item.description && <p>{item.description}</p>}
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  {preview.achievements.length > 0 && (
                    <section className="pdf-paper-section">
                      <div className="pdf-paper-section-head">
                        <h4>Highlights</h4>
                        <span />
                      </div>
                      <ul className="pdf-paper-bullets">
                        {preview.achievements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {preview.projects.length > 0 && (
                    <section className="pdf-paper-section">
                      <div className="pdf-paper-section-head">
                        <h4>Projects</h4>
                        <span />
                      </div>
                      <div className="pdf-paper-list">
                        {preview.projects.map((project, index) => (
                          <article key={`preview-project-${index}`} className="pdf-paper-entry">
                            <div className="pdf-paper-entry-head">
                              <strong>{project.name || `프로젝트 ${index + 1}`}</strong>
                              {project.link && <span>{project.linkLabel}</span>}
                            </div>
                            {project.subtitle && <p className="pdf-paper-entry-sub">{project.subtitle}</p>}
                            {project.meta && <p className="pdf-paper-entry-meta">{project.meta}</p>}
                            {project.description && <p>{project.description}</p>}
                            {project.highlights.length > 0 && (
                              <ul className="pdf-paper-bullets">
                                {project.highlights.map((highlight) => (
                                  <li key={highlight}>{highlight}</li>
                                ))}
                              </ul>
                            )}
                          </article>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="pdf-paper-section">
                    <div className="pdf-paper-section-head">
                      <h4>Skills</h4>
                      <span />
                    </div>
                    <div className="pdf-paper-skill-grid">
                      {preview.techGroups.map((group) => (
                        <div key={group.label} className="pdf-paper-skill-row">
                          <strong>{group.label}</strong>
                          <span>{group.items.join(", ") || "자동 분류 시 표시됩니다."}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {preview.strengths.length > 0 && (
                    <section className="pdf-paper-section">
                      <div className="pdf-paper-section-head">
                        <h4>Strengths</h4>
                        <span />
                      </div>
                      <ul className="pdf-paper-bullets">
                        {preview.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              </article>
            )}
          </div>
        </div>
      </div>

      <div className="pdf-workspace-footer">
        <div className="action-row">
          <button type="button" className="primary" onClick={onExport} disabled={exporting}>
            {exporting ? "PDF 만드는 중..." : "PDF 내보내기"}
          </button>
        </div>
      </div>
    </section>
  );
}
