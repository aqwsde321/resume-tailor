"use client";
import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/features/workspace/context";
import { AgentSettingsPanel } from "@/features/workspace/ui/agent-settings-panel";
import { WorkspaceSaveStatus } from "@/features/workspace/ui/workspace-save-status";
import { migrateLegacyWorkspace } from "@/entities/workspace/model/migration";
import { getApplicationPdf } from "@/entities/application/model/application-pdf-store";
import { workspaceRequest } from "@/features/workspace/api";
export default function SettingsPage() {
  const { workspace, update, reload, status } = useWorkspace();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<File | null>(null); const [confirmed, setConfirmed] = useState(false);
  if (!workspace) return null;
  return <div className="studio-settings"><header className="studio-page-heading"><div><h1>설정</h1><p>AI 실행 방식과 소중한 작업 자료를 관리하세요.</p></div><WorkspaceSaveStatus /></header>
    <AgentSettingsPanel settings={workspace.settings} onChange={(settings) => update((previous) => ({ ...previous, settings: { ...settings, modelReasoningEffort: settings.modelReasoningEffort || "medium" } }))} />
    <section className="card studio-settings-section"><h2>로컬 저장·백업</h2><p>작업 자료와 원본 파일은 이 컴퓨터에 보관되며 Git 추적에서 제외됩니다. 다른 컴퓨터로 옮기기 전에 백업해 주세요.</p>
      <a className="nav-btn" href="/api/workspace/backup" download>자료와 원본 파일 백업</a>
      <label>복원할 백업 파일<input type="file" accept=".json" onChange={(event) => setRestore(event.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />백업 내용으로 현재 작업 전체를 복원합니다. 복원 전 데이터도 로컬에 보관됩니다.</label>
      <button disabled={busy || !restore || !confirmed || status !== "저장됨"} onClick={async () => {
        setBusy(true); setError("");
        try { if (restore!.size > 150 * 1024 * 1024) throw new Error("백업은 150MB 이하만 가져올 수 있습니다."); await workspaceRequest("/api/workspace/backup", { method: "POST", headers: { "Content-Type": "application/json", "If-Match": String(workspace.revision) }, body: await restore!.text() }); await reload(); setConfirmed(false); }
        catch (error) { setError((error as Error).message); } finally { setBusy(false); }
      }}>백업 복원</button>
    </section>
    <section className="card studio-settings-section"><h2>이전 브라우저 자료 가져오기</h2><p>이전에 저장한 이력서·지원 기록과 PDF를 새 회사별 작업으로 가져옵니다. 이전 브라우저 데이터는 삭제하지 않습니다.</p>
      <button disabled={busy || Boolean(workspace.legacyBackup) || status !== "저장됨"} onClick={async () => {
        setBusy(true); setError("");
        try {
          const stored = localStorage.getItem("resume-tailor.pipeline.v2") ?? localStorage.getItem("resume-make.pipeline.v2");
          if (!stored) throw new Error("이 브라우저에서 이전 자료를 찾지 못했습니다.");
          const result = migrateLegacyWorkspace(workspace, JSON.parse(stored));
          const warnings = [];
          for (const mapping of result.applications) {
            try {
              const pdf = await getApplicationPdf(mapping.legacyId);
              if (!pdf) continue;
              const form = new FormData(); form.set("file", pdf, "previous-resume.pdf");
              const artifact = await workspaceRequest<{ id: string }>("/api/workspace/attachment", { method: "POST", body: form });
              result.workspace.works = result.workspace.works.map((work) => work.id === mapping.workId ? { ...work, artifacts: [{ id: artifact.id, name: "이전 제출 이력서.pdf", createdAt: work.createdAt }] } : work);
            } catch { warnings.push("일부 이전 PDF를 가져오지 못했습니다. 이전 지원 기록에서 확인해 주세요."); }
          }
          update((previous) => { if (previous !== workspace) throw new Error("가져오는 동안 작업이 변경됐습니다. 이전 자료 가져오기를 다시 시도해 주세요."); return result.workspace; }); setError(warnings.join(" ") || "이전 자료를 가져왔습니다.");
        } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
      }}>{workspace.legacyBackup ? "이전 자료 가져오기 완료" : "이전 자료 가져오기"}</button>
      <p><Link href="/applications">이전 지원 기록·PDF 확인</Link></p>
    </section>
    {error && <p role="status">{error}</p>}
  </div>;
}
