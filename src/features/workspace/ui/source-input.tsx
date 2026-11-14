"use client";
import { useState } from "react";
import type { ReviewDocument } from "@/entities/workspace/model/workspace";
import { workspaceRequest } from "@/features/workspace/api";
export function SourceInput({ kind, onImport }: { kind: "resume" | "job"; onImport: (document: ReviewDocument) => void }) {
  const [mode, setMode] = useState("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="card">
    <h2>{kind === "resume" ? "이력서 자료 등록" : "공고 자료 등록"}</h2>
    <p>먼저 내용을 추출합니다. 원문을 확인하고 수정한 다음 이력서 또는 공고로 정리할 수 있습니다.</p>
    <label>입력 방법<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="file">PDF·이미지·텍스트 파일</option><option value="url">URL</option><option value="text">텍스트·Markdown 붙여넣기</option></select></label>
    {mode === "file" && <label>자료 파일<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.markdown" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>}
    {mode === "url" && <label>원본 URL<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>}
    {mode === "text" && <label>원문<textarea rows={10} value={text} onChange={(event) => setText(event.target.value)} /></label>}
    <button className="primary" disabled={busy || (mode === "file" ? !file : mode === "url" ? !url.trim() : !text.trim())} onClick={async () => {
      setBusy(true); setError("");
      try {
        const form = new FormData(); form.set("kind", kind);
        if (mode === "file" && file) form.set("file", file);
        else if (mode === "url") form.set("url", url);
        else form.set("text", text);
        const result = await workspaceRequest<{ document: ReviewDocument; warnings: string[] }>("/api/workspace/source", { method: "POST", body: form });
        onImport(result.document);
        setError(result.warnings.join(" "));
      } catch (error) { setError(error instanceof Error ? error.message : "자료를 읽지 못했습니다."); }
      finally { setBusy(false); }
    }}>{busy ? "자료 읽는 중…" : "내용 추출"}</button>
    {error && <p role="status">{error}</p>}
  </section>;
}
