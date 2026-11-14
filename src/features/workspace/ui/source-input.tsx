"use client";
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ReviewDocument } from "@/entities/workspace/model/workspace";
import { workspaceRequest } from "@/features/workspace/api";
import { StudioIcon } from "./studio-icon";

const modes = [{ id: "file", label: "파일 업로드" }, { id: "url", label: "URL" }, { id: "text", label: "텍스트·Markdown" }] as const;
export function SourceInput({ kind, onImport, variant = "default" }: { kind: "resume" | "job"; onImport: (document: ReviewDocument) => void; variant?: "default" | "studio" }) {
  const [mode, setMode] = useState("file");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const studio = variant === "studio";
  function changeMode(value: string) { setMode(value); setError(""); }
  function changeFile(value: File | null) {
    if (value && value.size > 20 * 1024 * 1024) { setFile(null); setError("파일은 20MB 이하로 올려 주세요."); return; }
    setFile(value); setError("");
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % modes.length : event.key === "ArrowLeft" ? (index + modes.length - 1) % modes.length : event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); changeMode(modes[next].id); tabsRef.current[next]?.focus();
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setError("");
    if (mode === "file" && !file) { setError("먼저 자료 파일을 선택해 주세요."); fileRef.current?.focus(); return; }
    if (mode === "text" && !text.trim()) { setError("정리할 원문을 붙여넣어 주세요."); textRef.current?.focus(); return; }
    if (mode === "url") {
      try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); }
      catch { setError("https://로 시작하는 공개 URL을 입력해 주세요."); urlRef.current?.focus(); return; }
    }
    setBusy(true);
    try {
      const form = new FormData(); form.set("kind", kind);
      if (mode === "file" && file) form.set("file", file);
      else if (mode === "url") form.set("url", url);
      else form.set("text", text);
      const result = await workspaceRequest<{ document: ReviewDocument; warnings: string[] }>("/api/workspace/source", { method: "POST", body: form });
      onImport(result.document); setError(result.warnings.join(" "));
    } catch (error) { setError(error instanceof Error ? error.message : "자료를 읽지 못했습니다. 다른 입력 방법으로 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  return <section className={studio ? "studio-source" : "card"}>
    <div className={studio ? "studio-source-heading" : undefined}><h2>{kind === "resume" ? "이력서 자료 등록" : "공고 자료 등록"}</h2><p>{studio ? "가지고 있는 자료를 올려 주세요. 추출한 내용은 직접 확인하고 고칠 수 있어요." : "먼저 내용을 추출합니다. 원문을 확인하고 수정한 다음 이력서 또는 공고로 정리할 수 있습니다."}</p></div>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      {studio ? <div className="studio-source-tabs" role="tablist" aria-label="입력 방법">{modes.map((item, index) => <button type="button" role="tab" id={`${id}-tab-${item.id}`} key={item.id} aria-controls={`${id}-panel`} aria-selected={mode === item.id} tabIndex={mode === item.id ? 0 : -1} ref={(element) => { tabsRef.current[index] = element; }} onKeyDown={(event) => moveTab(event, index)} onClick={() => changeMode(item.id)} disabled={busy}>{item.label}</button>)}</div> : <label>입력 방법<select value={mode} onChange={(event) => changeMode(event.target.value)} disabled={busy}>{modes.map((item) => <option key={item.id} value={item.id}>{item.id === "file" ? "PDF·이미지·텍스트 파일" : item.id === "text" ? "텍스트·Markdown 붙여넣기" : item.label}</option>)}</select></label>}
      <div id={`${id}-panel`} role={studio ? "tabpanel" : undefined} aria-labelledby={studio ? `${id}-tab-${mode}` : undefined} className={studio ? "studio-source-panel" : undefined}>
        {mode === "file" && (studio ? <div className={`studio-dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) changeFile(event.dataTransfer.files[0] ?? null); }}>
          <span className="studio-upload-icon"><StudioIcon name={file ? "check" : "upload"} size={26} /></span>
          <strong>{file ? file.name : "이력서 파일을 여기에 놓아 주세요"}</strong><span>{file ? "클릭해서 다른 파일로 바꿀 수 있어요" : "또는 클릭해서 파일 선택"}</span><small>PDF, PNG, JPG, WebP, TXT, Markdown · 최대 20MB</small>
          <input ref={fileRef} type="file" name="resume-file" aria-label="자료 파일" aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.markdown" onChange={(event) => changeFile(event.target.files?.[0] ?? null)} disabled={busy} />
        </div> : <label>자료 파일<input ref={fileRef} type="file" name="source-file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.markdown" onChange={(event) => changeFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>)}
        {mode === "url" && <div className="studio-source-url"><label htmlFor={`${id}-url`}>원본 URL</label><input ref={urlRef} id={`${id}-url`} name="source-url" type="url" autoComplete="off" spellCheck={false} value={url} aria-invalid={Boolean(error)} aria-describedby={`${id}-url-help${error ? ` ${id}-error` : ""}`} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/resume…" disabled={busy} /><small id={`${id}-url-help`}>로그인 없이 볼 수 있는 공개 주소를 입력해 주세요.</small></div>}
        {mode === "text" && <label>원문<textarea ref={textRef} name="source-text" rows={10} value={text} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => setText(event.target.value)} placeholder="원문을 그대로 붙여넣어 주세요…" disabled={busy} /></label>}
      </div>
      {error && <p className="studio-input-error" id={`${id}-error`} role="alert">{error}</p>}
      <div className={studio ? "studio-source-footer" : undefined}>{studio && <span>원본 자료는 그대로 보관됩니다.</span>}<button type="submit" className="primary" disabled={busy}>{busy ? "자료 읽는 중…" : "내용 추출"}{studio && !busy && <StudioIcon name="arrow" size={16} />}</button></div>
    </form>
  </section>;
}
