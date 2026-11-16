"use client";
import { useState } from "react";
import { useWorkspace } from "@/features/workspace/context";
import { AgentSettingsPanel } from "@/features/workspace/ui/agent-settings-panel";
import { StudioIcon } from "@/features/workspace/ui/studio-icon";
import { WorkspaceSaveStatus } from "@/features/workspace/ui/workspace-save-status";
import { workspaceRequest } from "@/features/workspace/api";
export default function SettingsPage() {
  const { workspace, update, reload, status } = useWorkspace();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<File | null>(null); const [confirmed, setConfirmed] = useState(false);
  if (!workspace) return null;
  return <div className="studio-settings"><header className="studio-page-heading"><div><h1>설정</h1><p>AI 실행 방식과 소중한 작업 자료를 관리하세요.</p></div><WorkspaceSaveStatus /></header>
    <AgentSettingsPanel settings={workspace.settings} onChange={(settings) => update((previous) => ({ ...previous, settings }))} />
    <section className="card settings-storage-panel" aria-labelledby="storage-settings-title">
      <header className="settings-section-heading"><span className="settings-section-icon"><StudioIcon name="document" size={20} /></span><div><h2 id="storage-settings-title">전체 작업 백업</h2><p>평소 작업은 이 컴퓨터에 자동 저장됩니다. 백업 파일은 자료 복구나 컴퓨터 이동에 사용합니다.</p></div></header>
      <div className="settings-storage-grid">
        <section className="settings-backup-section" aria-labelledby="backup-save-title"><h3 id="backup-save-title">백업 파일에 포함되는 내용</h3>
          <ul className="settings-backup-scope" aria-label="백업에 포함되는 자료">
            <li><StudioIcon name="check" size={16} /><div><strong>내 이력서</strong><span>공통 이력서와 편집 중인 초안</span></div></li>
            <li><StudioIcon name="check" size={16} /><div><strong>회사별 작업</strong><span>공고·맞춤 이력서·보관 버전·선택한 소개글</span></div></li>
            <li><StudioIcon name="check" size={16} /><div><strong>댓글과 수정 이력</strong><span>문서에 남긴 수정 요청과 작업 내용</span></div></li>
            <li><StudioIcon name="check" size={16} /><div><strong>원본 파일과 PDF</strong><span>작업에 연결된 첨부파일과 생성한 이력서 PDF</span></div></li>
            <li><StudioIcon name="check" size={16} /><div><strong>AI 설정</strong><span>실행 도구·모델·effort 선택</span></div></li>
          </ul><a className="settings-backup-download" href="/api/workspace/backup" download><StudioIcon name="document" size={16} />전체 작업 백업 다운로드</a><p className="settings-backup-caption">원본 파일을 포함한 JSON 파일 1개로 내려받습니다.</p><p className="settings-backup-caption">앱 코드와 AI 도구 로그인 정보는 백업 대상이 아닙니다. 작업 자료는 Git 추적에서 제외됩니다.</p></section>
        <section className="settings-restore-section" aria-labelledby="backup-restore-title"><h3 id="backup-restore-title">전체 작업 복원</h3><p>백업 당시의 이력서·회사별 작업·AI 설정으로 현재 작업 전체를 바꿉니다. 복원 전 작업도 이 컴퓨터에 별도로 보관합니다.</p>
      <label className="settings-backup-file">복원할 백업 파일<input type="file" accept=".json" onChange={(event) => setRestore(event.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />현재 작업 전체를 백업 내용으로 바꾸는 데 동의합니다.</label>
      <button disabled={busy || !restore || !confirmed || status !== "저장됨"} onClick={async () => {
        setBusy(true); setError("");
        try { if (restore!.size > 150 * 1024 * 1024) throw new Error("백업은 150MB 이하만 가져올 수 있습니다."); await workspaceRequest("/api/workspace/backup", { method: "POST", headers: { "Content-Type": "application/json", "If-Match": String(workspace.revision) }, body: await restore!.text() }); await reload(); setConfirmed(false); }
        catch (error) { setError((error as Error).message); } finally { setBusy(false); }
      }}>전체 작업 복원</button></section></div>
    </section>
    {error && <p role="status">{error}</p>}
  </div>;
}
