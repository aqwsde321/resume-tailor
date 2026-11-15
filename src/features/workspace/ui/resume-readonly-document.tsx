import type { ReactNode } from "react";
import { WorkspaceSaveStatus } from "./workspace-save-status";
import { ResumeDocumentPreview } from "./resume-document-preview";

export function ResumeReadonlyDocument({ text, saved = false, toolbar }: { text: string; saved?: boolean; toolbar?: ReactNode }) {
  return <div className={`resume-readonly-document ${saved ? "studio-saved-document-card" : "resume-confirm-document-card"}`}>
    <header className={saved ? "studio-saved-document-header" : "studio-paper-toolbar"}>{toolbar ?? <span className="studio-paper-filename">정리된 이력서 · 저장 전 확인</span>}<WorkspaceSaveStatus /></header>
    <div className={`resume-readonly-scroll ${saved ? "studio-saved-document-scroll" : "resume-confirm-document-scroll"}`} role="region" aria-label={saved ? "저장된 이력서 본문" : "확인할 이력서 본문"} tabIndex={0}>
      <ResumeDocumentPreview text={text} />
    </div>
  </div>;
}
