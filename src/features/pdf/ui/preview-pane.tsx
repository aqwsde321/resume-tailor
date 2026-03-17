"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  getPdfTemplateOption,
  PDF_TEMPLATE_OPTIONS,
  type PdfTemplateId
} from "@/entities/pdf/model/templates";
import {
  normalizePdfAccentHex,
  PDF_THEME_OPTIONS,
  resolvePdfTheme,
  type PdfThemeId
} from "@/entities/pdf/model/themes";
import { buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import type { Company, Intro, Resume } from "@/shared/lib/types";

import type { TypstPreviewState } from "./types";

interface PdfPreviewPaneProps {
  company: Company;
  customAccentHex: string;
  exporting: boolean;
  intro: Intro;
  onCustomAccentChange: (nextAccentHex: string) => void;
  onTemplateChange: (nextTemplateId: PdfTemplateId) => void;
  onThemeChange: (nextThemeId: PdfThemeId) => void;
  resume: Resume;
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
  typstPreview: TypstPreviewState;
}

export function PdfPreviewPane({
  company,
  customAccentHex,
  exporting,
  intro,
  onCustomAccentChange,
  onTemplateChange,
  onThemeChange,
  resume,
  templateId,
  themeId,
  typstPreview
}: PdfPreviewPaneProps) {
  const preview = buildTypstResumeDocument(resume, intro, company, themeId, customAccentHex);
  const template = getPdfTemplateOption(templateId);
  const theme = resolvePdfTheme(themeId, customAccentHex);
  const effectiveCustomHex = normalizePdfAccentHex(customAccentHex) ?? "#2950c8";
  const [themeOpen, setThemeOpen] = useState(false);
  const [customHexDraft, setCustomHexDraft] = useState(effectiveCustomHex);
  const normalizedCustomDraftHex = normalizePdfAccentHex(customHexDraft);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomHexDraft(effectiveCustomHex);
  }, [effectiveCustomHex]);

  const applyCustomTheme = () => {
    const nextAccentHex = normalizePdfAccentHex(customHexDraft);
    if (!nextAccentHex) {
      return;
    }

    onThemeChange("custom");
    onCustomAccentChange(nextAccentHex);
    setThemeOpen(false);
  };

  useEffect(() => {
    if (!themeOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemeOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [themeOpen]);

  return (
    <div className="pdf-preview-pane">
      <div className="pdf-preview-card">
        <div className="pdf-preview-card-head">
          <div>
            <p className="card-kicker">Typst Preview</p>
            <div className="pdf-preview-title-row">
              <h3>실제 출력 미리보기</h3>
              <p className={`pdf-preview-meta ${typstPreview.status === "error" ? "warn" : ""}`}>
                {typstPreview.status === "ready"
                  ? `${typstPreview.pages.length}p`
                  : typstPreview.status === "rendering"
                    ? "렌더링 중"
                    : typstPreview.status === "error"
                      ? "fallback"
                      : "준비 중"}
              </p>
            </div>
            <p className="pdf-preview-card-copy">
              {company.companyName || "회사"} 기준 {template.label} 템플릿을 바로 확인합니다.
            </p>
          </div>
          <div className="pdf-preview-head-actions">
            <div className="pdf-template-segment" role="tablist" aria-label="PDF 템플릿 선택">
              {PDF_TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`pdf-template-segment-button ${
                    templateId === option.id ? "active" : ""
                  }`}
                  onClick={() => onTemplateChange(option.id)}
                  disabled={exporting}
                  aria-pressed={templateId === option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="pdf-theme-menu" ref={themeMenuRef}>
              <button
                type="button"
                className={`pdf-theme-trigger ${themeOpen ? "active" : ""}`}
                onClick={() => setThemeOpen((current) => !current)}
                disabled={exporting}
                aria-expanded={themeOpen}
                aria-haspopup="dialog"
              >
                <span
                  className="pdf-theme-trigger-swatch"
                  aria-hidden="true"
                  style={
                    {
                      "--pdf-theme-accent": theme.accentHex,
                      "--pdf-theme-soft": theme.softHex
                    } as CSSProperties
                  }
                />
                <span>{theme.label}</span>
              </button>

              {themeOpen && (
                <div className="pdf-theme-popover" role="dialog" aria-label="PDF 색상 선택">
                  {PDF_THEME_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`pdf-theme-option ${themeId === option.id ? "active" : ""}`}
                      onClick={() => {
                        onThemeChange(option.id);
                        setThemeOpen(false);
                      }}
                      disabled={exporting}
                    >
                      <span
                        className="pdf-theme-option-swatch"
                        aria-hidden="true"
                        style={
                          {
                            "--pdf-theme-accent": option.accentHex,
                            "--pdf-theme-soft": option.softHex
                          } as CSSProperties
                        }
                      />
                      <span className="pdf-theme-option-copy">
                        <strong>{option.label}</strong>
                        <span>{option.description}</span>
                      </span>
                    </button>
                  ))}

                  <div className="pdf-theme-custom">
                    <div className="pdf-theme-custom-copy">
                      <strong>Custom</strong>
                      <span>원하는 강조색을 직접 고릅니다.</span>
                    </div>
                    <div className="pdf-theme-custom-controls">
                      <label className="pdf-theme-color-field">
                        <input
                          type="color"
                          aria-label="사용자 지정 PDF 색상"
                          value={normalizedCustomDraftHex ?? effectiveCustomHex}
                          onChange={(event) => {
                            const nextAccentHex = normalizePdfAccentHex(event.target.value);
                            if (!nextAccentHex) {
                              return;
                            }

                            setCustomHexDraft(nextAccentHex);
                          }}
                          disabled={exporting}
                        />
                      </label>
                      <div className="pdf-theme-hex-actions">
                        <input
                          type="text"
                          className="pdf-theme-hex-input"
                          aria-label="사용자 지정 PDF HEX"
                          inputMode="text"
                          value={customHexDraft}
                          onChange={(event) => {
                            setCustomHexDraft(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              applyCustomTheme();
                            }
                          }}
                          disabled={exporting}
                        />
                        <button
                          type="button"
                          className="secondary pdf-theme-apply-button"
                          onClick={applyCustomTheme}
                          disabled={exporting || !normalizedCustomDraftHex}
                        >
                          선택 완료
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {typstPreview.error && (
          <p className="muted-help">
            실제 Typst 미리보기를 불러오지 못해 HTML fallback을 보여주고 있어요.{" "}
            {typstPreview.error}
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
            <header className={`pdf-paper-header ${preview.showProfileImage ? "has-profile-image" : ""}`}>
              <div className="pdf-paper-header-copy">
                <p className="pdf-paper-name">{preview.name || "이름을 입력해 주세요"}</p>
                <p className="pdf-paper-role-line">
                  {[preview.desiredPosition, preview.careerDuration].filter(Boolean).join(" • ") ||
                    "직무와 경력을 입력해 주세요"}
                </p>
                {preview.headline && <p className="pdf-paper-headline">{preview.headline}</p>}
                {(preview.targetCompany || preview.targetJobTitle) && (
                  <div className="pdf-paper-target-block">
                    <p className="pdf-paper-target">
                      {preview.targetCompany || ""}
                      {preview.targetCompany && preview.targetJobTitle ? " · " : ""}
                      {preview.targetJobTitle || ""}
                    </p>
                  </div>
                )}
                {preview.contacts.length > 0 && (
                  <p className="pdf-paper-contacts">
                    {preview.contacts.map((contact) => contact.display).join(" • ")}
                  </p>
                )}
              </div>
              {preview.showProfileImage && preview.profileImageDataUrl && (
                <div className="pdf-paper-profile-image-shell">
                  <Image
                    src={preview.profileImageDataUrl || ""}
                    alt="프로필 이미지 미리보기"
                    className="pdf-paper-profile-image"
                    width={64}
                    height={64}
                    unoptimized
                  />
                </div>
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
                        {project.subtitle && (
                          <p className="pdf-paper-entry-sub">{project.subtitle}</p>
                        )}
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
  );
}
