"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import {
  parseInlineItems,
  parseListText,
  stringifyInlineList,
  stringifyLineList
} from "@/lib/list-input";
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
  rootRef?: RefObject<HTMLElement | null>;
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

type PdfSectionKey =
  | "header"
  | "contacts"
  | "intro"
  | "experience"
  | "highlights"
  | "projects"
  | "skills"
  | "strengths";

interface PdfSectionDefinition {
  action?: ReactNode;
  children: ReactNode;
  chipTitle?: string;
  description?: string;
  isActive: boolean;
  kicker: string;
  onClose: () => void;
  onOpen: () => void;
  summary: string;
  title: string;
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

function PdfEditorSection({
  action,
  children,
  chipTitle,
  description,
  isActive,
  kicker,
  onClose,
  onOpen,
  summary,
  title
}: PdfSectionDefinition) {
  return (
    <>
      <button
        type="button"
        className={`pdf-editor-chip ${isActive ? "active" : ""}`}
        onClick={onOpen}
      >
        <span className="pdf-editor-chip-copy">
          <span className="pdf-editor-chip-key">{kicker}</span>
          <span className="pdf-editor-chip-title">{chipTitle ?? title}</span>
        </span>
        <span className="pdf-editor-chip-meta">{summary}</span>
      </button>

      {isActive && (
        <section className="pdf-modal-shell" aria-modal="true" role="dialog">
          <button
            type="button"
            className="pdf-modal-backdrop"
            onClick={onClose}
            aria-label={`${title} 편집 닫기`}
          />

          <div className="pdf-modal pdf-editor-modal">
            <div className="pdf-modal-head">
              <div>
                <p className="card-kicker">{kicker}</p>
                <h2>{title}</h2>
                {description && <p className="pdf-modal-copy">{description}</p>}
              </div>
              <div className="pdf-modal-actions">
                {action}
                <button type="button" className="secondary" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>

            <div className="pdf-editor-modal-body">{children}</div>
          </div>
        </section>
      )}
    </>
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
  rootRef,
  resume
}: PdfEditorWorkspaceProps) {
  const preview = buildTypstResumeDocument(resume, intro, company);
  const [typstPreview, setTypstPreview] = useState<TypstPreviewState>({
    error: "",
    pages: [],
    status: "idle"
  });
  const [openSection, setOpenSection] = useState<PdfSectionKey | null>(null);
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

  useEffect(() => {
    if (!openSection) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSection(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSection]);

  useEffect(() => {
    document.body.classList.toggle("pdf-modal-open", Boolean(openSection));

    return () => {
      document.body.classList.remove("pdf-modal-open");
    };
  }, [openSection]);

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
    <section className="pdf-workspace" ref={rootRef}>
      {error && <p className="status error">{error}</p>}

      <div className="pdf-workspace-grid">
        <div className="pdf-editor-pane">
          <p className="pdf-editor-toolbar-label">수정 섹션</p>

          <PdfEditorSection
            kicker="Header"
            title="상단 헤더"
            chipTitle="상단"
            description="첫 화면 기준으로 이름, 직무, 회사 정보를 맞춥니다."
            summary="기본"
            isActive={openSection === "header"}
            onOpen={() => setOpenSection("header")}
            onClose={() => setOpenSection(null)}
          >
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
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Contacts"
            title="연락처"
            chipTitle="연락"
            description="값이 있는 항목만 PDF에 노출됩니다."
            summary={`${resume.contacts.length}개`}
            isActive={openSection === "contacts"}
            onOpen={() => setOpenSection("contacts")}
            onClose={() => setOpenSection(null)}
            action={
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
            }
          >
            
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
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Tailored Intro"
            title="소개글"
            chipTitle="소개"
            description={`${company.companyName || "회사"} 기준으로 들어가는 최종 문장입니다.`}
            summary={intro.longIntro.trim() ? "본문" : "빈칸"}
            isActive={openSection === "intro"}
            onOpen={() => setOpenSection("intro")}
            onClose={() => setOpenSection(null)}
          >
            <label className="field">
              <span>최종 소개글</span>
              <AutoGrowTextarea
                className="pdf-intro-textarea"
                value={intro.longIntro}
                onChange={(event) => onIntroChange({ ...intro, longIntro: event.target.value })}
                disabled={exporting}
              />
            </label>
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Experience"
            title="경력"
            chipTitle="경력"
            description="핵심 역할과 기간만 명확하면 충분합니다."
            summary={`${resume.experience.length}개`}
            isActive={openSection === "experience"}
            onOpen={() => setOpenSection("experience")}
            onClose={() => setOpenSection(null)}
            action={
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
            }
          >

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
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Highlights"
            title="Highlights"
            chipTitle="핵심"
            description="한 줄이 항목 1개입니다."
            summary={`${resume.pdfHighlights.length}개`}
            isActive={openSection === "highlights"}
            onOpen={() => setOpenSection("highlights")}
            onClose={() => setOpenSection(null)}
          >
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
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Projects"
            title="프로젝트"
            chipTitle="프로젝트"
            description="step 1에 없던 링크와 부제목도 여기서 바로 반영됩니다."
            summary={`${resume.projects.length}개`}
            isActive={openSection === "projects"}
            onOpen={() => setOpenSection("projects")}
            onClose={() => setOpenSection(null)}
            action={
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
            }
          >

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

                    <label className="field">
                      <span>기술 스택</span>
                      <AutoGrowTextarea
                        className="inline-list-textarea"
                        aria-label={`프로젝트 ${index + 1} 기술 스택`}
                        placeholder="예: Node.js, TypeScript, PostgreSQL"
                        value={stringifyInlineList(project.techStack)}
                        onChange={(event) =>
                          updateProjectTechStack(index, parseInlineItems(event.target.value))
                        }
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

                </div>
              ))}
            </div>
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Skills"
            title="기술 스택"
            chipTitle="스택"
            description="미리보기에서는 자동 그룹화됩니다."
            summary={`${resume.techStack.length}개`}
            isActive={openSection === "skills"}
            onOpen={() => setOpenSection("skills")}
            onClose={() => setOpenSection(null)}
          >
            <label className="field">
              <span>전체 기술 스택</span>
              <AutoGrowTextarea
                className="inline-list-textarea"
                aria-label="PDF 기술 스택"
                placeholder="예: Java, Spring Boot, JPA, Docker"
                value={stringifyInlineList(resume.techStack)}
                onChange={(event) =>
                  updateResume((current) => ({
                    ...current,
                    techStack: parseInlineItems(event.target.value)
                  }))
                }
                minHeight={44}
                disabled={exporting}
              />
            </label>
          </PdfEditorSection>

          <PdfEditorSection
            kicker="Strengths"
            title="Strengths"
            chipTitle="강점"
            description="한 줄이 항목 1개입니다."
            summary={`${resume.pdfStrengths.length}개`}
            isActive={openSection === "strengths"}
            onOpen={() => setOpenSection("strengths")}
            onClose={() => setOpenSection(null)}
          >
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
          </PdfEditorSection>
        </div>

        <div className="pdf-preview-pane">
          <div className="pdf-preview-card">
            <div className="pdf-preview-card-head">
              <div>
                <p className="card-kicker">Typst Preview</p>
                <h3>실제 출력 미리보기</h3>
                <p className="pdf-preview-card-copy">
                  {company.companyName || "회사"} 기준 최종 PDF를 그대로 보여줍니다.
                </p>
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
        <div className="action-copy">
          <strong>{company.companyName || "회사"} PDF</strong>
          <span>미리보기 기준으로 확인한 뒤 최종 PDF를 내보냅니다.</span>
        </div>
        <div className="action-row">
          <button type="button" className="primary" onClick={onExport} disabled={exporting}>
            {exporting ? "PDF 만드는 중..." : "PDF 내보내기"}
          </button>
        </div>
      </div>
    </section>
  );
}
