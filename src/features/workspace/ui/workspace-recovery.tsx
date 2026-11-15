"use client";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../context";
import "./workspace-recovery.css";

export function WorkspaceRecovery() {
  const { workspace, error, errorKind, loading, saving, dirty, reload, retrySave } = useWorkspace();
  const [confirmReload, setConfirmReload] = useState(false);
  const [exported, setExported] = useState<typeof workspace>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const canDiscard = Boolean(workspace && exported === workspace);
  useEffect(() => {
    if (confirmReload) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmReload]);
  if (!error) return null;
  const title = errorKind === "conflict" ? "다른 창에서 자료가 변경되었습니다" : errorKind === "load" ? "자료를 불러오지 못했습니다" : "편집 내용을 저장하지 못했습니다";
  function downloadRecovery() {
    if (!workspace) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `resume-workspace-recovery-${new Date().toISOString().replaceAll(":", "-")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(workspace);
  }
  return <section className="workspace-recovery" aria-label="자료 저장 및 복구">
    <div role="alert"><h2>{title}</h2><p>{error}</p></div>
    {workspace && <p>{errorKind === "conflict" ? "현재 편집본은 이 화면에 유지됩니다. 다른 창의 변경을 덮어쓰지 않도록 자동 저장을 멈췄습니다." : "현재 편집본은 이 화면에 유지됩니다. 연결을 확인한 뒤 다시 저장할 수 있습니다."}</p>}
    <div className="workspace-recovery-actions">
      {workspace && <button type="button" onClick={downloadRecovery}>편집 내용 복구 파일 저장</button>}
      {workspace && dirty && errorKind !== "conflict" && <button type="button" disabled={saving || loading} onClick={retrySave}>다시 저장</button>}
      <button type="button" disabled={loading || saving} onClick={() => { if (dirty) setConfirmReload(true); else void reload(); }}>{loading ? "불러오는 중…" : workspace ? "서버 자료 다시 불러오기" : "다시 불러오기"}</button>
    </div>
    {workspace && <p className="workspace-recovery-note">복구 파일에는 현재 편집 내용이 들어갑니다. 원본 첨부파일은 설정의 자료 백업으로 보관하세요.</p>}
    <dialog ref={dialog} className="workspace-recovery-dialog" aria-labelledby="workspace-reload-title" onCancel={() => setConfirmReload(false)}>
      <h2 id="workspace-reload-title">서버 자료로 바꾸기</h2>
      <p>저장되지 않은 편집 내용을 서버 자료로 바꿉니다. 먼저 최신 편집본의 복구 파일을 저장해 주세요. 불러온 뒤 필요한 내용은 복구 파일에서 다시 옮길 수 있습니다.</p>
      <div className="workspace-recovery-actions">
        <button type="button" onClick={() => setConfirmReload(false)} autoFocus>계속 편집</button>
        <button type="button" onClick={downloadRecovery}>최신 편집본 복구 파일 저장</button>
        <button type="button" disabled={!canDiscard || loading || saving} onClick={async () => { await reload({ discardChanges: true }); setConfirmReload(false); }}>편집본을 보관했고 서버 자료 불러오기</button>
      </div>
    </dialog>
  </section>;
}
