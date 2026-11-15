import type { ResumeResultDraft } from "./workspace";

const sections = new Set(["소개", "핵심 기술", "경력", "프로젝트", "학력", "자격·교육", "주요 성과", "강점"]);
function convertLegacy(text: string) {
  const insertions: { at: number; value: string }[] = [];
  let offset = 0;
  let section = "";
  text.split("\n\n").forEach((paragraph, index) => {
    const prefix = sections.has(paragraph) ? "## " : index === 0 ? "# " : ["경력", "프로젝트"].includes(section) ? "### " : "";
    if (prefix && paragraph && !/^#{1,6}\s/.test(paragraph)) insertions.push({ at: offset, value: prefix });
    if (sections.has(paragraph)) section = paragraph;
    offset += paragraph.length + 2;
  });
  const next = insertions.reduceRight((value, item) => value.slice(0, item.at) + item.value + value.slice(item.at), text).replace(/^• /gm, "- ");
  const point = (at: number, end = false) => at + insertions.filter((item) => end ? item.at < at : item.at <= at).reduce((sum, item) => sum + item.value.length, 0);
  return { text: next, point };
}

export function upgradeResultDraftMarkdown(draft: ResumeResultDraft): ResumeResultDraft {
  if (draft.document.source.type === "markdown") return draft;
  const converted = convertLegacy(draft.document.text);
  return {
    ...draft,
    structuredText: convertLegacy(draft.structuredText).text,
    document: {
      ...draft.document, text: converted.text, source: { ...draft.document.source, type: "markdown" },
      annotations: draft.document.annotations.map((comment) => {
        if (comment.anchor.type !== "text") return comment;
        const start = converted.point(comment.anchor.start); const end = converted.point(comment.anchor.end, true);
        return { ...comment, anchor: { ...comment.anchor, start, end, quote: draft.document.text.slice(comment.anchor.start, comment.anchor.end) === comment.anchor.quote ? converted.text.slice(start, end) : comment.anchor.quote } };
      }),
      proposal: draft.document.proposal && (() => {
        const source = convertLegacy(draft.document.proposal.sourceText);
        return { ...draft.document.proposal, sourceText: source.text, changes: draft.document.proposal.changes.map((change) => {
          const start = source.point(change.start); const end = change.end === change.start ? start : source.point(change.end, true);
          return { ...change, start, end, before: source.text.slice(start, end) };
        }) };
      })(),
      history: draft.document.history.map((item) => ({ ...item, text: convertLegacy(item.text).text })),
    },
  };
}
