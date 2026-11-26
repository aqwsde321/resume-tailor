"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useWorkspace } from "../context";
import { StudioIcon } from "./studio-icon";
import { WorkspaceRecovery } from "./workspace-recovery";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace, status, loading } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const studio = pathname.startsWith("/workspace/");
  const section = pathname.startsWith("/workspace/companies") ? "회사별 이력서" : pathname === "/workspace/settings" ? "설정" : "내 이력서";
  return <div className={`workspace-app${studio ? " resume-studio" : ""}`}>
    {studio ? <>
      <a className="studio-skip" href="#workspace-main">본문으로 건너뛰기</a>
      <aside className="studio-sidebar" aria-label="작업 공간 탐색" data-menu-open={menuOpen}>
        <div className="studio-sidebar-heading">
        <Link className="studio-brand" href="/workspace/resume"><span className="studio-brand-mark"><StudioIcon name="document" size={22} /></span><span>ResumeTailor<small>이력서 작업 공간</small></span></Link>
        <button type="button" className="studio-menu-toggle" aria-expanded={menuOpen} aria-controls="studio-navigation" onClick={() => setMenuOpen(!menuOpen)}>메뉴</button></div>
        <nav id="studio-navigation" aria-label="주 메뉴" onClick={() => setMenuOpen(false)}>
          <Link href="/workspace/resume" aria-current={section === "내 이력서" ? "page" : undefined}><StudioIcon name="document" />내 이력서</Link>
          <Link href="/workspace/companies" aria-current={section === "회사별 이력서" ? "page" : undefined}><StudioIcon name="company" />회사별 이력서</Link>
          <Link href="/applications"><StudioIcon name="document" />지원 기록</Link>
          <Link href="/workspace/settings" aria-current={section === "설정" ? "page" : undefined}><StudioIcon name="settings" />설정</Link>
        </nav>
      </aside>

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
