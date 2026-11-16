import type { CompanyWork, ReviewDocument } from "./workspace";

/** Refresh only the job document. Resume drafts, their comments and saved versions stay intact. */
export function refreshCompanyJobDocument(work: CompanyWork, refreshed: ReviewDocument): CompanyWork {
  const old = work.document;
  if (old.source.type !== "url" || refreshed.source.type !== "url" || old.source.url !== refreshed.source.url || refreshed.kind !== "job") {
    throw new Error("기존 공고와 동일한 URL의 추출 문서만 반영할 수 있습니다.");
  }
  const text = refreshed.text;
  if (!text.trim()) throw new Error("공고 내용이 비어 있어 기존 문서를 유지합니다.");
  let unlinked = 0;
  const annotations = old.annotations.map((comment) => {
    const anchor = comment.anchor;
    if (anchor.type !== "text" || text.slice(anchor.start, anchor.end) === anchor.quote) return comment;
    const start = text.indexOf(anchor.quote);
    if (!anchor.quote || start < 0 || text.indexOf(anchor.quote, start + 1) >= 0) {
      if (comment.status === "pending") unlinked++;
      return comment;
    }
    return { ...comment, anchor: { ...anchor, start, end: start + anchor.quote.length } };
  });
  const changed = text !== old.text;
  const now = new Date().toISOString();
  return { ...work, updatedAt: now, tailoring: changed ? null : work.tailoring,
    document: { ...old, title: refreshed.title, source: refreshed.source, text, annotations,
      warnings: [...(refreshed.warnings ?? []), ...(unlinked ? [`기존 댓글 ${unlinked}개의 문장 연결을 확인해 주세요. 댓글 내용은 유지했습니다.`] : [])],
      proposal: changed ? null : old.proposal,
      history: changed ? [...old.history, { text: old.text, annotationIds: [], createdAt: now }] : old.history,
      updatedAt: now,
    },
  };
}
