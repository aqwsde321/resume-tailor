"use client";

import { AutoGrowTextarea } from "@/app/components/auto-grow-textarea";
import { formatPdfContactDisplay } from "@/lib/pdf/view-model";

import type {
  HeaderSectionFormProps,
  IntroSectionFormProps,
  SkillsSectionFormProps,
  SharedSectionProps
} from "./section-form-types";

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

export function SkillsSectionForm({
  exporting,
  onSkillsTextChange,
  skillsText
}: SkillsSectionFormProps) {
  return (
    <label className="field">
      <span>전체 기술 스택</span>
      <AutoGrowTextarea
        className="inline-list-textarea"
        aria-label="PDF 기술 스택"
        placeholder="예: Java, Spring Boot, JPA, Docker"
        value={skillsText}
        onChange={(event) => onSkillsTextChange(event.target.value)}
        minHeight={44}
        disabled={exporting}
      />
    </label>
  );
}
