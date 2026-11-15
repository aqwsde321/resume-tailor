"use client";
import { Fragment, useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import type { Annotation, ReviewDocument, Workspace } from "@/entities/workspace/model/workspace";
import { acceptDocumentChanges } from "@/entities/workspace/model/document-review";
import { jsonRequest, workspaceRequest } from "@/features/workspace/api";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";
import { StudioIcon } from "./studio-icon";
import { OriginalSourceToolbar } from "./original-source-toolbar";

export function DocumentEditor({ document, settings, onChange, variant = "default", active = true, heading = "원문 검토", description = "추출한 내용이 맞는지 확인해 주세요. 수정할 문장을 드래그하면 댓글을 남길 수 있어요.", presentation = "text" }: {
  document: ReviewDocument; settings: Workspace["settings"]; onChange: (document: ReviewDocument) => void; variant?: "default" | "studio"; active?: boolean; heading?: string; description?: string; presentation?: "text" | "resume";
}) {
  const studio = variant === "studio";
  const formId = useId();
  const [listOpen, setListOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [mobilePane, setMobilePane] = useState("review");
  const [zoom, setZoom] = useState("100");
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<string | null>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);
  const [composerPlacement, setComposerPlacement] = useState({ left: 12, top: 12 });
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const rangeRef = useRef<Range | null>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const draftDocumentRef = useRef(document.id);
  const commentRefs = useRef<Record<string, HTMLElement | null>>({});
  const hasPlacement = placement !== null;
  const place = useCallback((rect: { left: number; bottom: number }) => {
    setPlacement({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 144)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 52)) });
    setComposerPlacement({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 344)), top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 456)) });
  }, []);
  function openComposer(trigger?: HTMLElement) {
    if (busy) return;
    triggerRef.current = trigger ?? null;
    draftDocumentRef.current = document.id;
    if (trigger && !placement) place(trigger.getBoundingClientRect());
    setError(""); setComposerOpen(true); setPlacement(null);
  }
  function closeComposer() {
    window.getSelection()?.removeAllRanges();
    setComposerOpen(false); setInstruction(""); setPlacement(null); setAnchor({ type: "document" });
    if (triggerRef.current?.isConnected) triggerRef.current.focus(); else readRef.current?.focus();
  }
  function showComment(id: string) { setActiveComment(id); setListOpen(true); setPlacement(null); }
  useEffect(() => { if (active && composerOpen) composerRef.current?.focus(); }, [composerOpen, active]);
  useEffect(() => { if (active && listOpen && activeComment) commentRefs.current[activeComment]?.scrollIntoView({ block: "nearest" }); }, [listOpen, activeComment, active]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const beforeEdit = useRef(document.text);
  const [anchor, setAnchor] = useState<Annotation["anchor"]>({ type: "document" });
  const [instruction, setInstruction] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const update = (patch: Partial<ReviewDocument>) => {
    const annotations = patch.annotations ?? document.annotations;
    if (patch.text !== undefined) patch.annotations = annotations.map((comment) => {
      const anchor = comment.anchor;
      if (anchor.type !== "text" || patch.text!.slice(anchor.start, anchor.end) === anchor.quote) return comment;
      const start = patch.text!.indexOf(anchor.quote);
      if (start < 0 || patch.text!.indexOf(anchor.quote, start + 1) >= 0) return comment;
      return { ...comment, anchor: { ...anchor, start, end: start + anchor.quote.length } };
    });
    onChange({ ...document, ...patch, updatedAt: new Date().toISOString() });
  };
  const pending = document.annotations.filter((comment) => comment.status === "pending");
  const page = document.source.pages.find((item) => item.page === pageNumber);
  function point(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)) };
  }
  const region = anchor.type === "region" && anchor.page === pageNumber ? anchor : null;
  useEffect(() => {
    if (!active || (!hasPlacement && !composerOpen)) return;
    const reposition = () => {
      let rect = sourceRef.current?.getBoundingClientRect() ?? rangeRef.current?.getBoundingClientRect();
      if (anchor.type === "text" && readRef.current) {
        const root = readRef.current;
        const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const range = root.ownerDocument.createRange();
        let offset = 0; let started = false; let node = walker.nextNode();
        while (node) {
          const length = node.textContent?.length ?? 0;
          if (!started && anchor.start < offset + length) { range.setStart(node, anchor.start - offset); started = true; }
          if (started && anchor.end <= offset + length) { range.setEnd(node, anchor.end - offset); const rects = range.getClientRects(); rect = rects[rects.length - 1] ?? range.getBoundingClientRect(); break; }
          offset += length; node = walker.nextNode();
        }
      }
      if (rect) { place({ left: anchor.type === "text" && readRef.current ? rect.right : rect.left, bottom: rect.bottom }); if (composerOpen) setPlacement(null); }
    };
    const dismiss = (event: Event) => {
      const target = event.target;
      if (!composerOpen && target instanceof Element && !target.closest(".annotation-selection-button") && !readRef.current?.contains(target)) setPlacement(null);
    };
    const dismissSelection = () => { if (!composerOpen && window.getSelection()?.isCollapsed) setPlacement(null); };
    const escape = (event: KeyboardEvent) => { if (!composerOpen && event.key === "Escape") { window.getSelection()?.removeAllRanges(); setPlacement(null); } };
    reposition();
    window.addEventListener("scroll", reposition, true); window.addEventListener("resize", reposition);
    globalThis.document.addEventListener("pointerdown", dismiss);
    globalThis.document.addEventListener("selectionchange", dismissSelection);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); globalThis.document.removeEventListener("pointerdown", dismiss); globalThis.document.removeEventListener("selectionchange", dismissSelection); window.removeEventListener("keydown", escape); };
  }, [hasPlacement, composerOpen, place, anchor, active]);
  const highlights = pending.flatMap((comment) => comment.anchor.type === "text" && document.text.slice(comment.anchor.start, comment.anchor.end) === comment.anchor.quote ? [{ ...comment.anchor, id: comment.id, instruction: comment.instruction }] : []);
  const draft = composerOpen && anchor.type === "text" && document.text.slice(anchor.start, anchor.end) === anchor.quote ? [anchor] : [];
  let paragraphOffset = 0;
  const paragraphs = document.text.split("\n\n").map((text) => { const start = paragraphOffset; paragraphOffset += text.length + 2; return { text, start, end: start + text.length }; });
  const boundaries = [...new Set([0, document.text.length, ...(presentation === "resume" ? paragraphs.flatMap((item) => [item.start, item.end]) : []), ...[...highlights, ...draft].flatMap((item) => [item.start, item.end])])].sort((a, b) => a - b);
  const renderBetween = (from: number, to: number) => boundaries.filter((offset) => offset >= from && offset <= to).slice(0, -1).map((start, index) => {
          const offsets = boundaries.filter((offset) => offset >= from && offset <= to); const end = offsets[index + 1]; const comments = highlights.filter((item) => item.start <= start && item.end >= end);
          const drafting = draft.some((item) => item.start <= start && item.end >= end);
          return comments.length ? <mark className="comment-mark" key={start} data-comment-count={comments.length} data-active={comments.some((item) => item.id === activeComment)} title={comments.map((item) => item.instruction).join("\n")}><button className="comment-anchor" aria-label={`${comments.length > 1 ? `댓글 ${comments.length}개 보기` : "댓글 보기"}: ${document.text.slice(start, end)}`} onClick={(event) => { if (event.detail === 0 || window.getSelection()?.isCollapsed) showComment(comments[0].id); }}>{document.text.slice(start, end)}</button></mark> : drafting ? <mark className="comment-draft-mark" key={start}>{document.text.slice(start, end)}</mark> : <span key={start}>{document.text.slice(start, end)}</span>;
        });
  function selectText() {
    if (!active || composerOpen) return;
    const selection = window.getSelection(); if (!selection?.rangeCount || selection.isCollapsed || !readRef.current) { setPlacement(null); return; }
    const range = selection.getRangeAt(0); if (!readRef.current.contains(range.commonAncestorContainer)) return;
    const prefix = range.cloneRange(); prefix.selectNodeContents(readRef.current); prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length; const quote = range.toString();
    if (document.text.slice(start, start + quote.length) === quote) {
      setAnchor({ type: "text", start, end: start + quote.length, quote });
      rangeRef.current = range.cloneRange(); sourceRef.current = null;
      const rects = range.getClientRects(); const endRect = rects[rects.length - 1] ?? range.getBoundingClientRect();
      place({ left: endRect.right, bottom: endRect.bottom });
    }
  }
  return <section className={studio ? "studio-document-review" : "card document-review"}>
    <header className={studio ? "studio-document-heading" : undefined}><div><h2>{heading}</h2><p>{description}</p></div></header>
    <div className="review-desk-toolbar">
      <div className="review-mode-switch" role="group" aria-label="원본 비교 방식"><button type="button" aria-pressed={!comparing} onClick={() => { setComparing(false); setMobilePane("review"); }}>검토 내용</button><button type="button" aria-pressed={comparing} onClick={() => setComparing(true)}>원본과 비교</button></div>
      <div className="review-desk-actions"><button aria-expanded={listOpen} aria-controls={`${formId}-list`} onClick={() => { if (listOpen) setActiveComment(null); setListOpen(!listOpen); }}><StudioIcon name="comment" size={16} />댓글 {pending.length}개</button><details className="review-more"><summary>더보기</summary><div><button disabled={busy} onClick={(event) => { setAnchor({ type: "document" }); rangeRef.current = null; sourceRef.current = event.currentTarget; place(event.currentTarget.getBoundingClientRect()); openComposer(event.currentTarget); event.currentTarget.closest("details")?.removeAttribute("open"); }}>문서 전체에 댓글</button><button disabled={busy || anchor.type === "document"} onClick={(event) => openComposer(event.currentTarget)}>선택 영역에 댓글 추가</button></div></details></div>
    </div>
    {comparing && <div className="review-mobile-tabs" role="group" aria-label="비교할 문서 선택"><button aria-pressed={mobilePane === "original"} onClick={() => setMobilePane("original")}>원본 보기</button><button aria-pressed={mobilePane === "review"} onClick={() => setMobilePane("review")}>검토 내용 보기</button></div>}
    {document.warnings?.map((warning, index) => <p role="status" key={index}>{warning}</p>)}
    <div data-mobile-pane={mobilePane} className={`annotation-layout ${comparing ? "is-comparing" : ""} ${listOpen ? "is-list-open" : ""} ${studio ? "studio-review-columns" : "review-columns"}`}>
    {comparing && <section className="review-original-panel" role="region" aria-label="보관된 원본">
      <header className="review-original-heading"><strong>{document.source.type === "pdf" ? "원본 PDF" : document.source.type === "image" ? "원본 이미지" : "보관된 원본"}</strong><span className="review-original-links"><details className="review-source-info"><summary aria-label="원본 보관 안내">ⓘ</summary><p>{document.source.type === "url" ? "URL에서 가져온 당시 원문입니다." : "처음 등록한 자료입니다. 검토 내용을 수정해도 유지됩니다."}</p></details>{document.source.url && <a href={document.source.url} target="_blank" rel="noreferrer">원본 URL 열기</a>}{document.source.attachmentId && <a href={`/api/workspace/attachment/${document.source.attachmentId}`} target="_blank" rel="noreferrer">새 창으로 열기</a>}</span></header>
      <OriginalSourceToolbar pages={document.source.pages} pageNumber={pageNumber} zoom={zoom} hasImage={Boolean(page?.imageId)} onPageChange={setPageNumber} onZoomChange={setZoom} onPageComment={(trigger) => { setAnchor({ type: "region", page: pageNumber, x: 0, y: 0, width: 1, height: 1 }); rangeRef.current = null; sourceRef.current = trigger; place(trigger.getBoundingClientRect()); openComposer(trigger); }} />
      {page?.imageId ? <div className="review-source-scroll"><div className="source-region" style={{ width: `${zoom}%`, maxWidth: "none" }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = point(event); }} onPointerMove={(event) => {
        const start = dragStart.current; if (!start) return; const end = point(event);
        if (Math.abs(end.x - start.x) > 0.005 && Math.abs(end.y - start.y) > 0.005) setAnchor({ type: "region", page: pageNumber, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
      }} onPointerUp={(event) => {
        const start = dragStart.current; dragStart.current = null; if (!start) return;
        const end = point(event); const width = Math.abs(end.x - start.x); const height = Math.abs(end.y - start.y);
        if (width > 0.005 && height > 0.005) { setAnchor({ type: "region", page: pageNumber, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height }); rangeRef.current = null; sourceRef.current = event.currentTarget; place({ left: event.clientX, bottom: event.clientY }); }
      }}>
        {/* 원본 페이지의 실제 비율을 유지하며 로컬 보관 이미지를 표시한다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/workspace/attachment/${page.imageId}`} alt={`원본 ${pageNumber}페이지. 드래그로 영역을 선택할 수 있습니다.`} draggable={false} />
        {region && <span className="region-selection" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
        {pending.filter((comment) => comment.anchor.type === "region" && comment.anchor.page === pageNumber).map((comment) => {
          if (comment.anchor.type !== "region") return null;
          return <button className="annotation-region-marker" key={comment.id} type="button" aria-label={`원본 영역 댓글 보기: ${comment.instruction}`} style={{ left: `${comment.anchor.x * 100}%`, top: `${comment.anchor.y * 100}%`, width: `${comment.anchor.width * 100}%`, height: `${comment.anchor.height * 100}%` }} onClick={(event) => { event.stopPropagation(); showComment(comment.id); }} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} />;
        })}
      </div></div> : <pre className="source-original">{page?.text || document.source.originalText}</pre>}
    </section>}
      <div className={studio ? "studio-document-column" : undefined}>
        <div className={studio ? "studio-paper-toolbar" : undefined}>{studio && <span className="studio-paper-filename" title={document.title}>{document.title}</span>}<div className={studio ? "studio-view-switch" : undefined} role="group" aria-label="문서 보기 방식"><button aria-pressed={!editing} onClick={() => setEditing(false)}>읽기·댓글</button><button aria-pressed={editing} onClick={() => setEditing(true)}>직접 편집</button></div></div>
        {comparing && <div className="review-edit-hint">검토 내용 · 문장을 선택해 수정 댓글을 남기세요.</div>}
        {!editing && <div ref={readRef} className="review-document" role="region" tabIndex={0} aria-label="추출 문서" onMouseUp={selectText} onKeyUp={selectText}>{presentation === "resume" ? paragraphs.map((paragraph, index) => <Fragment key={paragraph.start}><div className="result-document-block" data-heading={["소개", "핵심 기술", "경력", "프로젝트", "학력", "자격·교육", "주요 성과", "강점"].includes(paragraph.text)} data-name={index === 0}>{renderBetween(paragraph.start, paragraph.end)}</div>{paragraph.end < document.text.length ? "\n\n" : null}</Fragment>) : renderBetween(0, document.text.length)}</div>}
        {editing && <label>추출 문서<textarea ref={textRef} name="review-document" className="review-text" value={document.text} disabled={busy} onMouseUp={(event) => { if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) { rangeRef.current = null; sourceRef.current = event.currentTarget; place({ left: event.clientX, bottom: event.clientY }); } }} onFocus={() => { beforeEdit.current = document.text; }} onBlur={() => {
        if (beforeEdit.current !== document.text) update({ history: [...document.history, { text: beforeEdit.current, annotationIds: [], createdAt: new Date().toISOString() }] });
      }} onSelect={(event) => {
        const { selectionStart: start, selectionEnd: end } = event.currentTarget;
        if (start !== end) setAnchor({ type: "text", start, end, quote: document.text.slice(start, end) });
      }} onChange={(event) => { update({ text: event.target.value, proposal: null }); setAnchor({ type: "document" }); }} /></label>}
      </div>
      {listOpen && <aside id={`${formId}-list`} className={studio ? "studio-comments" : undefined} aria-label="수정 댓글">
        {studio && <div className="studio-comments-heading"><h3><StudioIcon name="comment" size={18} />수정 댓글</h3><span>{pending.length}</span></div>}
        <button type="button" onClick={() => { setListOpen(false); setActiveComment(null); }}>댓글 목록 닫기</button>
        {studio && pending.length === 0 && <div className="studio-comment-empty"><StudioIcon name="comment" size={25} /><strong>수정할 부분을 선택해 보세요</strong><p>문장이나 단락을 드래그하고<br />바꾸고 싶은 내용을 남겨 주세요.</p></div>}
        {pending.map((comment) => <article className="review-comment" onFocusCapture={() => setActiveComment(comment.id)} ref={(element) => { commentRefs.current[comment.id] = element; }} data-active={comment.id === activeComment} key={comment.id}>
          <button onClick={() => { setActiveComment(comment.id); setAnchor(comment.anchor); if (comment.anchor.type === "region") setPageNumber(comment.anchor.page); if (comment.anchor.type === "text") { readRef.current?.scrollIntoView({ block: "center" }); textRef.current?.focus(); textRef.current?.setSelectionRange(comment.anchor.start, comment.anchor.end); } }}>{comment.anchor.type === "text" ? comment.anchor.quote : comment.anchor.type === "region" ? `${comment.anchor.page}페이지 영역` : "문서 전체"}</button>
          <label>댓글 내용<textarea name={`comment-${comment.id}`} value={comment.instruction} disabled={busy} maxLength={4000} onChange={(event) => update({ annotations: document.annotations.map((item) => item.id === comment.id ? { ...item, instruction: event.target.value } : item), proposal: null })} /></label>
          <button disabled={busy} onClick={() => update({ annotations: document.annotations.filter((item) => item.id !== comment.id), proposal: null })}>댓글 삭제</button>
          <button disabled={busy} onClick={() => update({ annotations: document.annotations.map((item) => item.id === comment.id ? { ...item, anchor } : item), proposal: null })}>현재 선택 영역으로 다시 연결</button>
        </article>)}
        <button className="primary" disabled={!pending.length || busy} onClick={async () => {
          setBusy(true); setError("");
          try {
            const proposal = await workspaceRequest<NonNullable<ReviewDocument["proposal"]>>("/api/workspace/review", jsonRequest({ document, agent: toAgentRunOptions(settings) }));
            update({ proposal }); setSelected(proposal.changes.map((change) => change.id));
          } catch (error) { setError(error instanceof Error ? error.message : "수정 요청을 반영하지 못했습니다."); }
          finally { setBusy(false); }
        }}>{busy ? "수정 제안 작성 중…" : `수정 요청 ${pending.length}개 반영`}</button>
      </aside>}
    </div>
    {error && <p role="alert">{error}</p>}
    {document.proposal && <section className="document-proposal" aria-label="변경 검토"><header className="document-proposal-heading"><h3>변경 내용 확인</h3><p>수정 제안 {document.proposal.changes.length}개를 검토하고 반영할 내용을 선택해 주세요.</p></header>
      {document.proposal.changes.map((change) => <article className="document-proposal-change" data-selected={selected.includes(change.id)} key={change.id}>
        <header><CheckboxInput label="이 변경 수락" value={selected.includes(change.id)} onChange={(checked) => setSelected(checked ? [...selected, change.id] : selected.filter((id) => id !== change.id))} /><span>연결된 댓글 {change.commentIds.length}개</span></header>
        <p className="document-proposal-reason">{change.reason}</p><div className="document-proposal-columns"><section aria-label="반영 전"><h4>반영 전</h4><p>{change.before}</p></section><section aria-label="반영 후"><h4>반영 후</h4><p>{change.after}</p></section></div>
      </article>)}
      {document.proposal.unresolved.map((item) => <p key={item.commentId}>추가 확인: {item.message}</p>)}
      <footer className="document-proposal-footer"><p aria-live="polite">{selected.length} / {document.proposal.changes.length}개 변경 선택</p><div><Button label="제안 닫기" variant="secondary" onClick={() => update({ proposal: null })} /><Button label="선택한 변경 적용" variant="primary" isDisabled={!selected.length} onClick={() => {
        try {
          const proposal = document.proposal!;
          if (proposal.sourceText !== document.text) throw new Error("문서가 바뀌었습니다. 다시 제안받아 주세요.");
          const text = acceptDocumentChanges(document.text, proposal.changes, selected);
          const acceptedComments = pending.filter((comment) => proposal.changes.some((change) => change.commentIds.includes(comment.id)) && proposal.changes.filter((change) => change.commentIds.includes(comment.id)).every((change) => selected.includes(change.id))).map((comment) => comment.id);
          update({ text, proposal: null, annotations: document.annotations.map((comment) => acceptedComments.includes(comment.id) ? { ...comment, status: "accepted" } : comment), history: [...document.history, { text: document.text, annotationIds: acceptedComments, createdAt: new Date().toISOString() }] });
          setAnchor({ type: "document" }); setActiveComment(null);
          if (pending.length === acceptedComments.length) setListOpen(false);
        } catch (error) { setError((error as Error).message); }
      }} /></div></footer>
    </section>}
    <button disabled={!document.history.length || busy} onClick={() => {
      const last = document.history[document.history.length - 1];
      if (last) update({ text: last.text, proposal: null, history: document.history.slice(0, -1), annotations: document.annotations.map((comment) => last.annotationIds.includes(comment.id) ? { ...comment, status: "pending" } : comment) });
    }}>이전 수정 되돌리기</button>
    {active && placement && !composerOpen && createPortal(<button className="annotation-selection-button" style={placement} onMouseDown={(event) => event.preventDefault()} onClick={(event) => openComposer(event.currentTarget)}><StudioIcon name="comment" size={16} />댓글 쓰기</button>, globalThis.document.body)}
    {active && composerOpen && createPortal(<section className="annotation-composer" style={composerPlacement} role="dialog" aria-modal="false" aria-labelledby={`${formId}-composer-title`} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeComposer(); } }}>
      <h3 id={`${formId}-composer-title`}>수정 댓글 작성</h3>
      <p className="annotation-composer-quote">{anchor.type === "text" ? anchor.quote : anchor.type === "region" ? `원본 ${anchor.page}페이지 선택 영역` : "문서 전체"}</p>
      <form onSubmit={(event) => {
        event.preventDefault(); if (!instruction.trim() || busy) return;
        if (draftDocumentRef.current !== document.id || (anchor.type === "text" && document.text.slice(anchor.start, anchor.end) !== anchor.quote)) { setError("원문이 바뀌었습니다. 작성을 취소하고 수정할 부분을 다시 선택해 주세요."); return; }
        update({ annotations: [...document.annotations, { id: crypto.randomUUID(), instruction: instruction.trim(), anchor, status: "pending", createdAt: new Date().toISOString() }], proposal: null });
        window.getSelection()?.removeAllRanges(); closeComposer(); setActiveComment(null);
      }}>
        <label htmlFor={`${formId}-instruction`}>수정 요청</label><textarea ref={composerRef} id={`${formId}-instruction`} name="review-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={4000} rows={4} disabled={busy} placeholder="이 부분은 이렇게 바꿔 주세요…" />
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" onClick={closeComposer}>취소</button><button type="submit" disabled={!instruction.trim() || busy}>댓글 추가</button></footer>
      </form>
    </section>, globalThis.document.body)}
  </section>;
}
