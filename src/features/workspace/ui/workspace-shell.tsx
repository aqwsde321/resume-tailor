"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useWorkspace } from "../context";
import { StudioIcon } from "./studio-icon";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace, error, status, reload } = useWorkspace();
  const studio = pathname === "/workspace/resume";
  return <div className={`workspace-app${studio ? " resume-studio" : ""}`}>
    {studio ? <>
      <a className="studio-skip" href="#workspace-main">본문으로 건너뛰기</a>
      <aside className="studio-sidebar" aria-label="작업 공간 탐색">
        <Link className="studio-brand" href="/workspace/resume"><span className="studio-brand-mark"><StudioIcon name="document" size={22} /></span><span>ResumeTailor<small>이력서 작업 공간</small></span></Link>
        <nav aria-label="주 메뉴">
          <Link href="/workspace/resume" aria-current="page"><StudioIcon name="document" />내 이력서</Link>
          <Link href="/workspace/companies"><StudioIcon name="company" />회사별 이력서</Link>
          <Link href="/workspace/settings"><StudioIcon name="settings" />설정</Link>
        </nav>
        <div className="studio-sidebar-note"><StudioIcon name="document" size={18} /><p>한 번 정리한 경험을<br />회사마다 다르게 전하세요.</p><small>내 이력서는 모든 맞춤 작업의 기준이 됩니다.</small></div>
      </aside>
      <header className="studio-topbar"><span>작업 공간<span className="studio-crumb-divider">/</span><strong>내 이력서</strong></span><span className="studio-save" role="status"><i data-error={Boolean(error)} />{status}</span></header>
    </> : <header className="workspace-header"><Link href="/workspace/resume">ResumeTailor</Link><nav aria-label="주 메뉴">
      <Link href="/workspace/resume" aria-current={pathname === "/workspace/resume" ? "page" : undefined}>내 이력서</Link>
      <Link href="/workspace/companies" aria-current={pathname.startsWith("/workspace/companies") ? "page" : undefined}>회사별 이력서</Link>
      <Link href="/workspace/settings" aria-current={pathname === "/workspace/settings" ? "page" : undefined}>설정</Link>
    </nav><span role="status">{status}</span></header>}
    <main id="workspace-main" className={studio ? "studio-main" : undefined} tabIndex={studio ? -1 : undefined}>
    {error && <section className="card" role="alert"><p>{error}</p><p>저장되지 않은 편집 내용은 아래 파일로 보관한 뒤 현재 서버 자료를 다시 불러올 수 있습니다.</p><button onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "resume-workspace-recovery.json"; link.click(); URL.revokeObjectURL(url);
    }}>편집 내용 복구 파일 저장</button><button onClick={() => void reload()}>서버 자료 다시 불러오기</button></section>}
    {workspace ? children : <p role="status">저장된 작업을 불러오는 중입니다.</p>}
    </main>
  </div>;
}
