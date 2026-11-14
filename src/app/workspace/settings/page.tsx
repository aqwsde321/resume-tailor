"use client";
import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/features/workspace/context";
import { MODEL_REASONING_EFFORT_LABELS, MODEL_REASONING_EFFORT_VALUES, isModelReasoningEffort } from "@/shared/lib/agent-settings";
import { migrateLegacyWorkspace } from "@/entities/workspace/model/migration";
import { getApplicationPdf } from "@/entities/application/model/application-pdf-store";
import { workspaceRequest } from "@/features/workspace/api";
export default function SettingsPage() {
  const { workspace, update, reload, status } = useWorkspace();
  const [direct, setDirect] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<File | null>(null); const [confirmed, setConfirmed] = useState(false);
  if (!workspace) return null;
  return <><h1>설정</h1>
    <section className="card"><h2>AI 실행 설정</h2>
      <label>모델 선택<select value={direct || workspace.settings.model ? "direct" : "default"} onChange={(event) => { setDirect(event.target.value === "direct"); if (event.target.value === "default") update((previous) => ({ ...previous, settings: { ...previous.settings, model: "" } })); }}><option value="default">Codex 기본 모델 사용</option><option value="direct">모델 직접 지정</option></select></label>
      {(direct || workspace.settings.model) && <label>모델 ID<input value={workspace.settings.model} onChange={(event) => update((previous) => ({ ...previous, settings: { ...previous.settings, model: event.target.value } }))} maxLength={120} placeholder="사용 가능한 모델 ID 입력" /></label>}
      <p>지정한 모델은 이력서·공고 정리, 댓글 반영, 경험 보완과 맞춤 생성에 공통 적용합니다. 사용할 수 없는 모델은 실행 시 오류로 알려 줍니다.</p>
      <label>생각 깊이<select value={workspace.settings.modelReasoningEffort} onChange={(event) => { const value = event.target.value; if (isModelReasoningEffort(value)) update((previous) => ({ ...previous, settings: { ...previous.settings, modelReasoningEffort: value } })); }}>{MODEL_REASONING_EFFORT_VALUES.map((value) => <option key={value} value={value}>{MODEL_REASONING_EFFORT_LABELS[value]}</option>)}</select></label>
    </section>
    <section className="card"><h2>로컬 저장·백업</h2><p>자료는 실행 중인 프로젝트의 private-data/workspace 폴더에 저장됩니다. Git 추적에서 제외됩니다.</p>
      <a className="nav-btn" href="/api/workspace/backup" download>자료와 원본 파일 백업</a>
      <label>복원할 백업 파일<input type="file" accept=".json" onChange={(event) => setRestore(event.target.files?.[0] ?? null)} /></label>
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />백업 내용으로 현재 작업 전체를 복원합니다. 복원 전 데이터도 로컬에 보관됩니다.</label>
      <button disabled={busy || !restore || !confirmed || status !== "저장됨"} onClick={async () => {
        setBusy(true); setError("");
        try { if (restore!.size > 150 * 1024 * 1024) throw new Error("백업은 150MB 이하만 가져올 수 있습니다."); await workspaceRequest("/api/workspace/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: await restore!.text() }); await reload(); setConfirmed(false); }
        catch (error) { setError((error as Error).message); } finally { setBusy(false); }
      }}>백업 복원</button>
    </section>
    <section className="card"><h2>이전 브라우저 자료 가져오기</h2><p>이전에 저장한 이력서·지원 기록과 PDF를 새 회사별 작업으로 가져옵니다. 이전 브라우저 데이터는 삭제하지 않습니다.</p>
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
          update(() => result.workspace); setError(warnings.join(" ") || "이전 자료를 가져왔습니다.");
        } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
      }}>{workspace.legacyBackup ? "이전 자료 가져오기 완료" : "이전 자료 가져오기"}</button>
      <p><Link href="/applications">이전 지원 기록·PDF 확인</Link></p>
    </section>
    {error && <p role="status">{error}</p>}
  </>;
}
