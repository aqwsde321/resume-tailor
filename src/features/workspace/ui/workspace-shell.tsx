"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useWorkspace } from "../context";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { workspace, error, status, reload } = useWorkspace();
  return <main className="workspace-app">
    <header className="workspace-header"><Link href="/workspace/resume">ResumeTailor</Link><nav aria-label="주 메뉴">
      <Link href="/workspace/resume" aria-current={pathname === "/workspace/resume" ? "page" : undefined}>내 이력서</Link>
      <Link href="/workspace/companies" aria-current={pathname.startsWith("/workspace/companies") ? "page" : undefined}>회사별 이력서</Link>
      <Link href="/workspace/settings" aria-current={pathname === "/workspace/settings" ? "page" : undefined}>설정</Link>
    </nav><span role="status">{status}</span></header>
    {error && <section className="card" role="alert"><p>{error}</p><p>저장되지 않은 편집 내용은 아래 파일로 보관한 뒤 현재 서버 자료를 다시 불러올 수 있습니다.</p><button onClick={() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "resume-workspace-recovery.json"; link.click(); URL.revokeObjectURL(url);
    }}>편집 내용 복구 파일 저장</button><button onClick={() => void reload()}>서버 자료 다시 불러오기</button></section>}
    {workspace ? children : <p>저장된 작업을 불러오는 중입니다.</p>}
  </main>;
}
