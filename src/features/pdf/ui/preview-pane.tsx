"use client";

import { getPdfTemplateOption, type PdfTemplateId } from "@/entities/pdf/model/templates";
import { getPdfThemeOption, type PdfThemeId } from "@/entities/pdf/model/themes";
import { buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import type { Company, Intro, Resume } from "@/shared/lib/types";

import type { TypstPreviewState } from "./types";

interface PdfPreviewPaneProps {
  company: Company;
  intro: Intro;
  resume: Resume;
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
  typstPreview: TypstPreviewState;
}

export function PdfPreviewPane({
  company,
  intro,
  resume,
  templateId,
  themeId,
  typstPreview
}: PdfPreviewPaneProps) {
  const preview = buildTypstResumeDocument(resume, intro, company, themeId);
  const template = getPdfTemplateOption(templateId);
  const theme = getPdfThemeOption(themeId);

  return (
    <div className="pdf-preview-pane">
      <div className="pdf-preview-card">
        <div className="pdf-preview-card-head">
          <div>
            <p className="card-kicker">Typst Preview</p>
            <h3>실제 출력 미리보기</h3>
            <p className="pdf-preview-card-copy">
              {company.companyName || "회사"} 기준 {template.label} 템플릿과 {theme.label} 색상을 그대로 보여줍니다.
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
