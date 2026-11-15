import { createElement, Fragment, type ReactNode } from "react";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes } from "mdast";

// 숨긴 문법 문자도 DOM에 보존한다. 댓글 위치는 렌더링된 글자 수가 아닌 Markdown 원문을 기준으로 한다.
export function ResumeDocumentPreview({ text, renderRange = (start, end) => text.slice(start, end) }: { text: string; renderRange?: (start: number, end: number) => ReactNode }) {
  const tree = fromMarkdown(text);
  const syntax = (start: number, end: number) => start < end ? <span className="resume-markdown-syntax" aria-hidden="true">{renderRange(start, end)}</span> : null;
  function children(node: Nodes) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? text.length;
    let cursor = start;
    const output: ReactNode[] = [];
    if ("children" in node) for (const child of node.children) {
      const from = child.position!.start.offset!; const to = child.position!.end.offset!;
      output.push(<Fragment key={from}>{syntax(cursor, from)}{render(child)}</Fragment>);
      cursor = to;
    }
    output.push(<Fragment key="suffix">{syntax(cursor, end)}</Fragment>);
    return output;
  }
  function render(node: Nodes): ReactNode {
    const start = node.position?.start.offset ?? 0; const end = node.position?.end.offset ?? text.length;
    switch (node.type) {
      case "root": return children(node);
      case "heading": return createElement(`h${node.depth}`, {}, children(node));
      case "paragraph": return <p>{children(node)}</p>;
      case "strong": return <strong>{children(node)}</strong>;
      case "emphasis": return <em>{children(node)}</em>;
      case "list": return node.ordered ? <ol start={node.start ?? 1}>{children(node)}</ol> : <ul>{children(node)}</ul>;
      case "listItem": return <li>{children(node)}</li>;
      case "blockquote": return <blockquote>{children(node)}</blockquote>;
      case "link": case "linkReference": return <span className="resume-markdown-link">{children(node)}</span>;
      case "inlineCode": {
        const source = text.slice(start, end); const width = source.match(/^`+/)?.[0].length ?? 0;
        return <code>{syntax(start, start + width)}{renderRange(start + width, end - width)}{syntax(end - width, end)}</code>;
      }
      case "code": {
        const source = text.slice(start, end); const fenced = /^(?:`{3,}|~{3,})/.test(source);
        const from = fenced ? start + source.indexOf("\n") + 1 : start;
        const last = source.lastIndexOf("\n");
        const to = fenced && last >= 0 && /^\s*(?:`{3,}|~{3,})\s*$/.test(source.slice(last + 1)) ? start + last : end;
        return <pre><code>{syntax(start, from)}{renderRange(from, to)}{syntax(to, end)}</code></pre>;
      }
      case "thematicBreak": return <>{syntax(start, end)}<hr /></>;
      case "break": return <>{syntax(start, end)}<br /></>;
      case "definition": return syntax(start, end);
      default: return renderRange(start, end);
    }
  }
  return <article className="studio-resume-preview resume-document-preview resume-markdown" aria-label="정리된 이력서">{render(tree)}</article>;
}
