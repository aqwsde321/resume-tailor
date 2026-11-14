"use client";
import { useState } from "react";
import type { CompanyWork } from "@/entities/workspace/model/workspace";
import { resumeToMarkdown } from "@/entities/workspace/model/operations";
import { PDF_TEMPLATE_OPTIONS } from "@/entities/pdf/model/templates";
import { PDF_THEME_OPTIONS } from "@/entities/pdf/model/themes";
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function WorkExport({ work, onSaved }: { work: CompanyWork; onSaved: (id: string, name: string) => void }) {
  const [templateId, setTemplate] = useState("classic"); const [themeId, setTheme] = useState("cobalt");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [pdfId, setPdfId] = useState("");
  if (!work.resume || !work.company) return null;
  const safeName = work.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 100);
  return <section className="card"><h2>다운로드</h2><p>소개글을 생성하지 않아도 이력서를 출력할 수 있습니다.</p>
    <label>PDF 템플릿<select value={templateId} onChange={(event) => setTemplate(event.target.value)}>{PDF_TEMPLATE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    <label>PDF 색상<select value={themeId} onChange={(event) => setTheme(event.target.value)}>{PDF_THEME_OPTIONS.filter((option) => option.id !== "custom").map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
    <button className="primary" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/workspace/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume: work.resume, company: work.company, intro: work.intro, templateId, themeId }) });
        if (!response.ok) { const result = await response.json(); throw new Error(result.error?.details || result.error?.message || "PDF 출력 실패"); }
        const id = response.headers.get("X-Workspace-Attachment-ID");
        if (id) { setPdfId(id); onSaved(id, `${safeName}.pdf`); }
        download(await response.blob(), `${safeName}.pdf`);
      } catch (error) { setError((error as Error).message); }
      finally { setBusy(false); }
    }}>{busy ? "PDF 만드는 중…" : "PDF 생성·다운로드"}</button>
    <button onClick={() => download(new Blob([resumeToMarkdown(work.resume!) + (work.intro ? `\n\n## 별도 소개글\n\n${work.intro.longIntro}` : "")], { type: "text/markdown;charset=utf-8" }), `${safeName}.md`)}>Markdown 다운로드</button>
    {pdfId && <a href={`/api/workspace/attachment/${pdfId}`} target="_blank" rel="noreferrer">생성한 PDF 미리보기</a>}
    {work.artifacts?.map((artifact) => <p key={artifact.id}><a href={`/api/workspace/attachment/${artifact.id}`} target="_blank" rel="noreferrer">{artifact.name} · {new Date(artifact.createdAt).toLocaleString("ko-KR")}</a></p>)}
    {error && <p role="alert">{error}</p>}
  </section>;
}
