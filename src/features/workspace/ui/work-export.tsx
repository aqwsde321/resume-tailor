"use client";
import { StudioIcon } from "./studio-icon";
import { useEffect, useRef, useState } from "react";
import { useTypstPreview } from "@/features/pdf/ui/use-typst-preview";
import { IntroSchema } from "@/shared/lib/schemas";
import { createApplicationSnapshot } from "@/entities/application/model/application-record";
import type { CompanyPdfArtifact, CompanyWork } from "@/entities/workspace/model/workspace";
import type { ApplicationEmailDraft } from "@/entities/application/model/application-email";
import { ApplicationSubmission } from "./application-submission";
import { resumeToMarkdown } from "@/entities/workspace/model/operations";
import { PDF_PREVIEW_RENDER_VERSION, PDF_TEMPLATE_OPTIONS, type PdfTemplateId } from "@/entities/pdf/model/templates";
import { DEFAULT_PDF_THEME_ID, PDF_THEME_OPTIONS, type PdfThemeId } from "@/entities/pdf/model/themes";
function ExportPreview({ resume, company, intro, templateId, themeId }: {
  resume: NonNullable<CompanyWork["resume"]>;
  company: NonNullable<CompanyWork["company"]>;
  intro: CompanyWork["intro"];
  templateId: PdfTemplateId;
  themeId: PdfThemeId;
}) {
  const preview = useTypstPreview({
    resume, company, intro: intro ?? IntroSchema.parse({ longIntro: resume.summary }),
    templateId, themeId, customAccentHex: ""
  });

  if (preview.status === "error") return <p role="alert">{preview.error}</p>;
  if (preview.status !== "ready") return <p role="status">PDF 미리보기 만드는 중…</p>;

  return <div className="company-pdf-preview" role="region" aria-label="PDF 페이지 미리보기" tabIndex={0}>
    {preview.pages.map((svg, index) => (
      // The SVG is rendered as an image so its contents cannot run in the page.
      // eslint-disable-next-line @next/next/no-img-element
      <img key={index} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`PDF ${index + 1} / ${preview.pages.length}페이지`} />
    ))}
  </div>;
}

type PresetThemeId = NonNullable<CompanyWork["pdfThemeId"]>;
const themes = PDF_THEME_OPTIONS.filter((theme): theme is typeof theme & { id: PresetThemeId } => theme.id !== "custom");

type GalleryProps = {
  work: CompanyWork;
  selectedTemplate: PdfTemplateId | null;
  selectedTheme: PresetThemeId;
  onPreview: (templateId: PdfTemplateId, themeId: PresetThemeId) => void;
  onSelect: (templateId: PdfTemplateId, themeId: PresetThemeId) => void;
};

function DesignGallery({ work, selectedTemplate, selectedTheme, onSelect, onPreview }: GalleryProps) {
  const { resume, company, intro } = work;
  const [loaded, setLoaded] = useState<{
    resume: CompanyWork["resume"];
    company: CompanyWork["company"];
    intro: CompanyWork["intro"];
    thumbnails: Record<string, string | null>;
  }>();
  const thumbnails = loaded?.resume === resume && loaded?.company === company && loaded?.intro === intro
    ? loaded.thumbnails
    : {};

  useEffect(() => {
    if (!resume || !company) return;
    const controller = new AbortController();
    const summary = intro ?? IntroSchema.parse({ longIntro: resume.summary });

    async function loadThumbnails() {
      const thumbnails: Record<string, string | null> = {};
      for (const template of PDF_TEMPLATE_OPTIONS) {
        for (const theme of themes) {
          if (controller.signal.aborted) return;
          const key = `${template.id}:${theme.id}`;
          let svg: string | null = null;
          try {
            const response = await fetch("/api/pdf/preview?firstPageOnly=1", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resume, company, intro: summary, templateId: template.id, themeId: theme.id, renderVersion: PDF_PREVIEW_RENDER_VERSION }),
              signal: controller.signal
            });
            if (response.ok) svg = (await response.json()).data.pages[0] ?? null;
          } catch {
            // A single unavailable thumbnail does not stop the rest of the gallery.
          }
          if (!controller.signal.aborted) {
            thumbnails[key] = svg;
            setLoaded({ resume, company, intro, thumbnails: { ...thumbnails } });
          }
        }
      }
    }

    void loadThumbnails();
    return () => controller.abort();
  }, [resume, company, intro]);

  return <div className="company-pdf-gallery">
    {PDF_TEMPLATE_OPTIONS.map((template) => <section key={template.id}>
      <h3>{template.label}</h3>
      <div className="company-pdf-gallery-grid">
        {themes.map((theme) => {
          const svg = thumbnails[`${template.id}:${theme.id}`];
          const selected = template.id === selectedTemplate && theme.id === selectedTheme;
          return <div key={theme.id} className="company-pdf-design-card" data-selected={selected}>
            <button className="company-pdf-select" type="button" aria-label={`${template.label} · ${theme.label} 선택`} aria-pressed={selected} onClick={() => onSelect(template.id, theme.id)}>
            <span className="company-pdf-thumbnail">
              {svg
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" />
                : svg === null ? "미리보기 없음" : "준비 중"}
            </span>
            <strong>{theme.label}{selected && <StudioIcon name="check" size={14} />}</strong>
            </button>
            <button className="company-pdf-expand" type="button" title="상세보기" aria-label={`${template.label} · ${theme.label} 상세보기`} onClick={() => onPreview(template.id, theme.id)}>
              <StudioIcon name="expand" size={18} />
            </button>
          </div>;
        })}
      </div>
    </section>)}
  </div>;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WorkExport({ active, work, onSaved, onDesignChange, onEmailDraftChange }: { active: boolean; work: CompanyWork; onDesignChange: (templateId: PdfTemplateId, themeId: PresetThemeId) => void; onSaved: (artifact: CompanyPdfArtifact) => void; onEmailDraftChange: (draft: ApplicationEmailDraft) => void }) {
  const templateId = work.pdfTemplateId;
  const themeId = work.pdfThemeId ?? DEFAULT_PDF_THEME_ID;
  const [detail, setDetail] = useState<{ template: PdfTemplateId; theme: PresetThemeId } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail && active && !dialog.current?.open) dialog.current?.showModal();
    if (!active && dialog.current?.open) dialog.current.close();
  }, [detail, active]);
  function selectDesign(template: PdfTemplateId, theme: PresetThemeId) {
    if (template !== templateId || theme !== themeId) onDesignChange(template, theme);
  }
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const { resume, company, intro } = work;
  if (!resume || !company) return null;
  const safeName = work.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 100);
  const templateLabel = PDF_TEMPLATE_OPTIONS.find(({ id }) => id === templateId)?.label;
  const themeLabel = themes.find(({ id }) => id === themeId)?.label;
  return <section className="company-export-tools" hidden={!active}>
    <div className="company-detail-section-heading">
      <div>
        <h2 id="company-pdf-design-heading" tabIndex={-1}>PDF 디자인 선택</h2>
        <p>첫 페이지를 비교해 디자인을 선택하세요. 상세보기에서 전체 문서를 확인할 수 있습니다.</p>
      </div>
    </div>
    {active && <DesignGallery work={work} selectedTemplate={templateId ?? null} selectedTheme={themeId}
      onSelect={selectDesign} onPreview={(template, theme) => setDetail({ template, theme })} />}
    <dialog ref={dialog} className="company-pdf-dialog" aria-labelledby="company-pdf-detail-title" onClose={() => setDetail(null)}>
      {detail && <>
        <header>
          <h3 id="company-pdf-detail-title">{PDF_TEMPLATE_OPTIONS.find(({ id }) => id === detail.template)?.label} · {themes.find(({ id }) => id === detail.theme)?.label}</h3>
          <button type="button" onClick={() => dialog.current?.close()} autoFocus>닫기</button>
        </header>
        <ExportPreview key={`${detail.template}:${detail.theme}`} resume={resume} company={company} intro={intro} templateId={detail.template} themeId={detail.theme} />
        <footer><button className="primary" type="button" onClick={() => { selectDesign(detail.template, detail.theme); dialog.current?.close(); }}>이 디자인 선택</button></footer>
      </>}
    </dialog>
    <div className="company-export-actions">
      <p role="status">{templateId ? `선택한 디자인 · ${templateLabel} · ${themeLabel}` : "PDF로 저장할 디자인을 선택하세요."}</p>
    <button className="primary" disabled={busy || !templateId} onClick={async () => {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/workspace/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume, company, intro, templateId, themeId }) });
        if (!response.ok) { const result = await response.json(); throw new Error(result.error?.details || result.error?.message || "PDF 출력 실패"); }
        const id = response.headers.get("X-Workspace-Attachment-ID");
        const name = `${safeName}.pdf`;
        const pdf = await response.blob();
        if (id && templateId) onSaved({
          id, name, createdAt: new Date().toISOString(),
          snapshot: createApplicationSnapshot({
            resume, company, intro: intro ?? IntroSchema.parse({ longIntro: resume.summary }),
            resumeSnapshot: resumeToMarkdown(resume),
            companySnapshot: work.companySourceText?.trim() || JSON.stringify(company),
            templateId, themeId, customAccentHex: "",
          }),
        });
        download(pdf, name);
      } catch (error) { setError((error as Error).message); }
      finally { setBusy(false); }
    }}>{busy ? "PDF 만드는 중…" : "PDF 생성·다운로드"}</button>
    <button onClick={() => download(new Blob([resumeToMarkdown(work.resume!) + (work.intro ? `\n\n## PDF 상단 요약\n\n${work.intro.longIntro}` : "")], { type: "text/markdown;charset=utf-8" }), `${safeName}.md`)}>Markdown 다운로드</button></div>
    {work.artifacts && work.artifacts.length > 0 && <details className="company-pdf-history">
      <summary>이전에 만든 PDF <span>{work.artifacts.length}개</span></summary>
      <ul>
        {[...work.artifacts].reverse().map((artifact) => <li key={artifact.id}>
          <a href={`/api/workspace/attachment/${artifact.id}`} target="_blank" rel="noreferrer">{artifact.name}</a>
          <time dateTime={artifact.createdAt}>{new Date(artifact.createdAt).toLocaleString("ko-KR")}</time>
        </li>)}
      </ul>
    </details>}
    <ApplicationSubmission key={work.id} work={work} company={company} onEmailDraftChange={onEmailDraftChange} />
    {error && <p role="alert">{error}</p>}
  </section>;
}
