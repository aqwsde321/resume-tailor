"use client";

import { useRef } from "react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import type { ReviewDocument } from "@/entities/workspace/model/workspace";

const zoomLevels = [75, 100, 125, 150, 200];

export function OriginalSourceToolbar({ pages, pageNumber, zoom, hasImage, onPageChange, onZoomChange, onPageComment }: {
  pages: ReviewDocument["source"]["pages"];
  pageNumber: number;
  zoom: string;
  hasImage: boolean;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: string) => void;
  onPageComment: (trigger: HTMLElement) => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const pageIndex = pages.findIndex((page) => page.page === pageNumber);
  const zoomIndex = zoomLevels.indexOf(Number(zoom));
  return <div ref={toolbarRef} className="astryx-source-toolbar" role="toolbar" aria-label="원본 비교 도구">
    {pages.length > 0 && <div className="astryx-source-group">
      <IconButton label="이전 원본 페이지" tooltip="이전 페이지" icon={<span aria-hidden="true">‹</span>} size="sm" variant="ghost" isDisabled={pageIndex <= 0} onClick={() => onPageChange(pages[pageIndex - 1].page)} />
      <Selector label="원본 페이지" isLabelHidden size="sm" variant="secondary" value={String(pageNumber)} width={120} options={pages.map((page) => ({ value: String(page.page), label: `${page.page} / ${pages.length}페이지` }))} onChange={(value) => onPageChange(Number(value))} />
      <IconButton label="다음 원본 페이지" tooltip="다음 페이지" icon={<span aria-hidden="true">›</span>} size="sm" variant="ghost" isDisabled={pageIndex >= pages.length - 1} onClick={() => onPageChange(pages[pageIndex + 1].page)} />
    </div>}
    {hasImage && <div className="astryx-source-group">
      <IconButton label="원본 축소" tooltip="축소" icon={<span aria-hidden="true">−</span>} size="sm" variant="ghost" isDisabled={zoomIndex <= 0} onClick={() => onZoomChange(String(zoomLevels[zoomIndex - 1]))} />
      <Selector label="원본 확대" isLabelHidden size="sm" variant="secondary" value={zoom} width={88} options={zoomLevels.map((value) => ({ value: String(value), label: value === 100 ? "맞춤" : `${value}%` }))} onChange={onZoomChange} />
      <IconButton label="원본 확대하기" tooltip="확대" icon={<span aria-hidden="true">+</span>} size="sm" variant="ghost" isDisabled={zoomIndex >= zoomLevels.length - 1} onClick={() => onZoomChange(String(zoomLevels[zoomIndex + 1]))} />
    </div>}
    {pages.length > 0 && <div className="astryx-source-menu"><DropdownMenu renderTrigger={(props) => <IconButton {...props} label="원본 추가 도구" tooltip="원본 추가 도구" icon={<span aria-hidden="true">⋯</span>} size="sm" variant="ghost" />} items={[{ label: "현재 페이지에 댓글", onClick: () => { const trigger = toolbarRef.current?.querySelector<HTMLButtonElement>('button[aria-label="원본 추가 도구"]'); if (trigger) onPageComment(trigger); } }]} /></div>}
  </div>;
}
