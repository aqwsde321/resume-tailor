"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { StudioIcon } from "./studio-icon";
import { WorkspaceRecovery } from "./workspace-recovery";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace, error, status, loading } = useWorkspace();
  const studio = pathname.startsWith("/workspace/");
  const section = pathname.startsWith("/workspace/companies") ? "회사별 이력서" : pathname === "/workspace/settings" ? "설정" : "내 이력서";
  return <div className={`workspace-app${studio ? " resume-studio" : ""}`}>
    {studio ? <>
      <a className="studio-skip" href="#workspace-main">본문으로 건너뛰기</a>
      <aside className="studio-sidebar" aria-label="작업 공간 탐색">
        <Link className="studio-brand" href="/workspace/resume"><span className="studio-brand-mark"><StudioIcon name="document" size={22} /></span><span>ResumeTailor<small>이력서 작업 공간</small></span></Link>
        <nav aria-label="주 메뉴">
          <Link href="/workspace/resume" aria-current={section === "내 이력서" ? "page" : undefined}><StudioIcon name="document" />내 이력서</Link>
          <Link href="/workspace/companies" aria-current={section === "회사별 이력서" ? "page" : undefined}><StudioIcon name="company" />회사별 이력서</Link>
          <Link href="/workspace/settings" aria-current={section === "설정" ? "page" : undefined}><StudioIcon name="settings" />설정</Link>
        </nav>
        <div className="studio-sidebar-note"><StudioIcon name="document" size={18} /><p>한 번 정리한 경험을<br />회사마다 다르게 전하세요.</p><small>내 이력서는 모든 맞춤 작업의 기준이 됩니다.</small></div>
      </aside>
      <header className="studio-topbar"><span>작업 공간<span className="studio-crumb-divider">/</span><strong>{section}</strong></span><span className="studio-save" role="status"><i data-error={Boolean(error)} />{status}</span></header>
    </> : <header className="workspace-header"><Link href="/workspace/resume">ResumeTailor</Link><nav aria-label="주 메뉴">
      <Link href="/workspace/resume" aria-current={pathname === "/workspace/resume" ? "page" : undefined}>내 이력서</Link>
      <Link href="/workspace/companies" aria-current={pathname.startsWith("/workspace/companies") ? "page" : undefined}>회사별 이력서</Link>
      <Link href="/workspace/settings" aria-current={pathname === "/workspace/settings" ? "page" : undefined}>설정</Link>
    </nav><span role="status">{status}</span></header>}
    <main id="workspace-main" className={studio ? "studio-main" : undefined} tabIndex={studio ? -1 : undefined}>
    <WorkspaceRecovery />
    {workspace ? children : loading ? <p role="status">저장된 작업을 불러오는 중입니다.</p> : null}
    </main>
  </div>;
}
