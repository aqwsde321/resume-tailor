"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { parseInlineItems, stringifyInlineList } from "@/lib/list-input";
import { formatPdfContactDisplay } from "@/lib/pdf/view-model";
import {
  makeEmptyContact,
  makeEmptyExperience,
  makeEmptyProject
} from "@/lib/resume-utils";
import type { Company, Intro, Resume } from "@/lib/types";

import { ListTextarea } from "./list-textarea";
import type { CompanyUpdater, IntroUpdater, ResumeUpdater } from "./types";

interface SharedSectionProps {
  exporting: boolean;
  resume: Resume;
  updateResume: ResumeUpdater;
}

interface HeaderSectionFormProps extends SharedSectionProps {
  company: Company;
  onCompanyChange: CompanyUpdater;
}

export function HeaderSectionForm({
  company,
  exporting,
  onCompanyChange,
  resume,
  updateResume
}: HeaderSectionFormProps) {
  return (
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
  );
}

export function ContactsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  const updateContact = (index: number, key: "label" | "value" | "url", value: string) => {
    updateResume((current) => ({
      ...current,
      contacts: current.contacts.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      )
    }));
  };

  return (
    <>
      {resume.contacts.length === 0 && (
        <p className="muted-help">
          이메일, GitHub, 블로그처럼 PDF에 바로 보일 값만 넣으면 됩니다. 값이 없으면 이 줄은
          숨겨집니다.
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
              미리보기에는 <strong>{formatPdfContactDisplay(contact) || "표시 값"}</strong>
              {contact.url.trim()
                ? " 형태로 보이고, PDF에서는 클릭 가능한 링크로 출력됩니다."
                : " 형태로만 출력됩니다."}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

interface IntroSectionFormProps {
  companyName: string;
  exporting: boolean;
  intro: Intro;
  onIntroChange: IntroUpdater;
}

export function IntroSectionForm({
  companyName,
  exporting,
  intro,
  onIntroChange
}: IntroSectionFormProps) {
  return (
    <label className="field">
      <span>최종 소개글</span>
      <AutoGrowTextarea
        className="pdf-intro-textarea"
        value={intro.longIntro}
        onChange={(event) => onIntroChange({ ...intro, longIntro: event.target.value })}
        aria-label={`${companyName || "회사"} 기준 최종 소개글`}
        disabled={exporting}
      />
    </label>
  );
}

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

export function HighlightsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  return (
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
  );
}

export function ProjectsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
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

export function SkillsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  return (
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
  );
}

export function StrengthsSectionForm({
  exporting,
  resume,
  updateResume
}: SharedSectionProps) {
  return (
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
  );
}

export function createContactAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
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
  );
}

export function createExperienceAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
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
  );
}

export function createProjectAction(updateResume: ResumeUpdater, exporting: boolean) {
  return (
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
  );
}
