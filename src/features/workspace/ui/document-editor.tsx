"use client";
import { useRef, useState, type PointerEvent } from "react";
import type { Annotation, ReviewDocument, Workspace } from "@/entities/workspace/model/workspace";
import { acceptDocumentChanges } from "@/entities/workspace/model/document-review";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";

export function DocumentEditor({ document, settings, onChange }: {
  document: ReviewDocument; settings: Workspace["settings"]; onChange: (document: ReviewDocument) => void;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const beforeEdit = useRef(document.text);
  const [anchor, setAnchor] = useState<Annotation["anchor"]>({ type: "document" });
  const [instruction, setInstruction] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const update = (patch: Partial<ReviewDocument>) => onChange({ ...document, ...patch, updatedAt: new Date().toISOString() });
  const pending = document.annotations.filter((comment) => comment.status === "pending");
  const page = document.source.pages.find((item) => item.page === pageNumber);
  function point(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) };
  }
  const region = anchor.type === "region" && anchor.page === pageNumber ? anchor : null;
  return <section className="card document-review">
    <header><h2>추출 문서 검토</h2><p>문장을 드래그해 댓글을 달거나 직접 고치세요. 수정 요청을 모아서 한 번에 반영할 수 있습니다.</p></header>
    <details><summary>원본 확인</summary>
      {document.source.url && <a href={document.source.url} target="_blank" rel="noreferrer">원본 URL 열기</a>}
      {document.source.attachmentId && <a href={`/api/workspace/attachment/${document.source.attachmentId}`} target="_blank" rel="noreferrer">원본 파일 열기</a>}
      {document.source.pages.length > 0 && <label>페이지<select value={pageNumber} onChange={(event) => setPageNumber(Number(event.target.value))}>{document.source.pages.map((item) => <option value={item.page} key={item.page}>{item.page}페이지 · {item.method === "ocr" ? "OCR" : "텍스트"}</option>)}</select></label>}
      {page?.imageId ? <div className="source-region" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = point(event); }} onPointerUp={(event) => {
        const start = dragStart.current; dragStart.current = null; if (!start) return;
        const end = point(event); const width = Math.abs(end.x - start.x); const height = Math.abs(end.y - start.y);
        if (width > 0.005 && height > 0.005) setAnchor({ type: "region", page: pageNumber, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height });
      }}>
        {/* 원본 페이지의 실제 비율을 유지하며 로컬 보관 이미지를 표시한다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/workspace/attachment/${page.imageId}`} alt={`원본 ${pageNumber}페이지. 드래그로 영역을 선택할 수 있습니다.`} draggable={false} />
        {region && <span className="region-selection" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
      </div> : <pre className="source-original">{document.source.originalText}</pre>}
    </details>
    <div className="review-columns">
      <div><label>추출 문서<textarea ref={textRef} className="review-text" value={document.text} disabled={busy} onFocus={() => { beforeEdit.current = document.text; }} onBlur={() => {
        if (beforeEdit.current !== document.text) update({ history: [...document.history, { text: beforeEdit.current, annotationIds: [], createdAt: new Date().toISOString() }] });
      }} onSelect={(event) => {
        const { selectionStart: start, selectionEnd: end } = event.currentTarget;
        if (start !== end) setAnchor({ type: "text", start, end, quote: document.text.slice(start, end) });
      }} onChange={(event) => { update({ text: event.target.value, proposal: null }); setAnchor({ type: "document" }); }} /></label></div>
      <aside aria-label="수정 댓글">
        <button type="button" onClick={() => setAnchor({ type: "document" })}>문서 전체에 댓글</button>
        <p>{anchor.type === "text" ? `선택: ${anchor.quote}` : anchor.type === "region" ? `원본 ${anchor.page}페이지 선택 영역` : "문서 전체"}</p>
        <label>수정 요청<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={4000} rows={4} placeholder="이 부분은 … 내용이어야 해요." /></label>
        <button disabled={!instruction.trim() || busy} onClick={() => {
          update({ annotations: [...document.annotations, { id: crypto.randomUUID(), instruction: instruction.trim(), anchor, status: "pending", createdAt: new Date().toISOString() }], proposal: null }); setInstruction("");
        }}>댓글 추가</button>
        {pending.map((comment) => <article className="review-comment" key={comment.id}>
          <button onClick={() => { setAnchor(comment.anchor); if (comment.anchor.type === "text") { textRef.current?.focus(); textRef.current?.setSelectionRange(comment.anchor.start, comment.anchor.end); } }}>{comment.anchor.type === "text" ? comment.anchor.quote : comment.anchor.type === "region" ? `${comment.anchor.page}페이지 영역` : "문서 전체"}</button>
          <label>댓글 내용<textarea value={comment.instruction} disabled={busy} maxLength={4000} onChange={(event) => update({ annotations: document.annotations.map((item) => item.id === comment.id ? { ...item, instruction: event.target.value } : item), proposal: null })} /></label>
          <button disabled={busy} onClick={() => update({ annotations: document.annotations.filter((item) => item.id !== comment.id), proposal: null })}>댓글 삭제</button>
        </article>)}
        <button className="primary" disabled={!pending.length || busy} onClick={async () => {
          setBusy(true); setError("");
          try {
            const proposal = await workspaceRequest<NonNullable<ReviewDocument["proposal"]>>("/api/workspace/review", jsonRequest({ document, agent: toAgentRunOptions(settings) }));
            update({ proposal }); setSelected(proposal.changes.map((change) => change.id));
          } catch (error) { setError(error instanceof Error ? error.message : "수정 요청을 반영하지 못했습니다."); }
          finally { setBusy(false); }
        }}>{busy ? "수정 제안 작성 중…" : `수정 요청 ${pending.length}개 반영`}</button>
      </aside>
    </div>
    {error && <p role="alert">{error}</p>}
    {document.proposal && <section aria-label="변경 검토"><h3>변경 내용 확인</h3>
      {document.proposal.changes.map((change) => <article className="review-change" key={change.id}>
        <label><input type="checkbox" checked={selected.includes(change.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, change.id] : selected.filter((id) => id !== change.id))} />이 변경 수락</label>
        <p>{change.reason}</p><div className="review-columns"><pre>{change.before}</pre><pre>{change.after}</pre></div>
      </article>)}
      {document.proposal.unresolved.map((item) => <p key={item.commentId}>추가 확인: {item.message}</p>)}
      <button className="primary" disabled={!selected.length} onClick={() => {
        try {
          const proposal = document.proposal!;
          if (proposal.sourceText !== document.text) throw new Error("문서가 바뀌었습니다. 다시 제안받아 주세요.");
          const text = acceptDocumentChanges(document.text, proposal.changes, selected);
          const acceptedComments = pending.filter((comment) => proposal.changes.some((change) => change.commentIds.includes(comment.id)) && proposal.changes.filter((change) => change.commentIds.includes(comment.id)).every((change) => selected.includes(change.id))).map((comment) => comment.id);
          update({ text, proposal: null, annotations: document.annotations.map((comment) => acceptedComments.includes(comment.id) ? { ...comment, status: "accepted" } : comment), history: [...document.history, { text: document.text, annotationIds: acceptedComments, createdAt: new Date().toISOString() }] });
          setAnchor({ type: "document" });
        } catch (error) { setError((error as Error).message); }
      }}>선택한 변경 적용</button>
      <button onClick={() => update({ proposal: null })}>제안 닫기</button>
    </section>}
    <button disabled={!document.history.length || busy} onClick={() => {
      const last = document.history[document.history.length - 1];
      if (last) update({ text: last.text, proposal: null, history: document.history.slice(0, -1), annotations: document.annotations.map((comment) => last.annotationIds.includes(comment.id) ? { ...comment, status: "pending" } : comment) });
    }}>이전 수정 되돌리기</button>
  </section>;
}
