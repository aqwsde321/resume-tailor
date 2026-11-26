"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MAX_TAILORING_COPY_LENGTH } from "@/entities/resume/model/resume-tailoring";
import type { TailoringClaimWarnings } from "@/entities/resume/model/tailoring-claim-warnings";
import type { useTailoringCopyEdits } from "@/features/resume/hooks/use-tailoring-copy-edits";
import { TailoringClaimWarning } from "./tailoring-claim-warning";
import styles from "./tailoring-claim-warning.module.css";

export function TailoringCopyReview({ id, text, warning, edits, disabled, children }: {
  id: string;
  text: string;
  warning?: TailoringClaimWarnings;
  edits: ReturnType<typeof useTailoringCopyEdits>;
  disabled?: boolean;
  children: ReactNode;
}) {
  const inputId = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [draft, setDraft] = useState("");
  const editing = edits.editingId === id;
  const checked = edits.revisions.has(id);
  const trimmed = draft.trim();

  useEffect(() => {
    if (editing) input.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  return (
    <>
      {editing ? (
        <div className={styles.editor}>
          <label htmlFor={inputId}>수정할 문구</label>
          <textarea id={inputId} ref={input} rows={3} maxLength={MAX_TAILORING_COPY_LENGTH} value={draft}
            onChange={(event) => setDraft(event.target.value)} />
          <div className={styles.actions}>
            <button type="button" onClick={() => edits.setEditingId(null)}>수정 취소</button>
            <button type="button" disabled={disabled || !trimmed || trimmed.length > MAX_TAILORING_COPY_LENGTH}
              onClick={() => edits.recheck(id, trimmed)}>수정 후 근거 다시 확인</button>
          </div>
        </div>
      ) : children}
      {(warning || checked) && (
        <div aria-live="polite">
          {warning ? <TailoringClaimWarning warning={warning} /> : (
            <div className={styles.checked}>수치·기술 추가 경고 없음</div>
          )}
        </div>
      )}
      {!editing && (warning || checked) && (
        <div className={styles.actions}>
          <button type="button" ref={editButton} disabled={disabled || edits.editingId !== null} onClick={() => {
            restoreFocus.current = true;
            setDraft(text);
            edits.setEditingId(id);
          }}>문구 수정</button>
        </div>
      )}
    </>
  );
}
