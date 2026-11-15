import { Fragment, type ReactNode } from "react";

const headings = new Set(["소개", "핵심 기술", "경력", "프로젝트", "학력", "자격·교육", "주요 성과", "강점"]);

// 검토·확인에서 같은 문서를 렌더링한다. 구분자도 DOM에 보존해 댓글의 문자 위치가 달라지지 않게 한다.
export function ResumeDocumentPreview({ text, renderRange = (start, end) => text.slice(start, end) }: { text: string; renderRange?: (start: number, end: number) => ReactNode }) {
  let offset = 0;
  const blocks = text.split("\n\n").map((value) => {
    const start = offset;
    offset += value.length + 2;
    return { value, start, end: start + value.length };
  });
  type Block = typeof blocks[number];
  const groups: { heading?: Block; blocks: Block[] }[] = [{ blocks: [] }];
  for (const block of blocks) {
    if (headings.has(block.value)) groups.push({ heading: block, blocks: [] });
    else groups[groups.length - 1].blocks.push(block);
  }
  const separator = (end: number) => end < text.length ? <span className="resume-text-separator">{"\n\n"}</span> : null;
  function entry(block: Block, section: string) {
    let lineOffset = block.start;
    return <article className="resume-review-entry">{block.value.split("\n").map((line, index) => {
      const start = lineOffset;
      lineOffset += line.length + 1;
      const metadata = /^\d{4}[./-]\d{1,2}/.test(line) || section === "프로젝트" && index === 1 && line.includes(" · ");
      return <Fragment key={start}>{index === 0 ? <h5>{renderRange(start, start + line.length)}</h5> : <div className={metadata ? "resume-entry-meta" : "resume-entry-line"} data-bullet={line.startsWith("• ")}>{renderRange(start, start + line.length)}</div>}{lineOffset <= block.end ? <span className="resume-text-separator">{"\n"}</span> : null}</Fragment>;
    })}</article>;
  }
  return <article className="studio-resume-preview resume-document-preview" aria-label="정리된 이력서">{groups.map((group, groupIndex) => {
    const children = <>{group.heading && <><h4>{renderRange(group.heading.start, group.heading.end)}</h4>{separator(group.heading.end)}</>}{group.blocks.map((block, index) => <Fragment key={block.start}>{groupIndex === 0 && index === 0 ? <h3>{renderRange(block.start, block.end)}</h3> : group.heading && ["경력", "프로젝트"].includes(group.heading.value) ? entry(block, group.heading.value) : <div className={groupIndex === 0 ? "resume-document-meta" : "studio-preview-copy"}>{renderRange(block.start, block.end)}</div>}{separator(block.end)}</Fragment>)}</>;
    return groupIndex === 0 ? <header key="header">{children}</header> : <section key={group.heading!.start} data-resume-section={group.heading!.value}>{children}</section>;
  })}</article>;
}
