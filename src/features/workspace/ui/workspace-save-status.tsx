"use client";
import { useWorkspace } from "../context";
export function WorkspaceSaveStatus() {
  const { status, error } = useWorkspace();
  return <span className="studio-save" role="status"><i data-error={Boolean(error)} />{status === "저장됨" ? "자동 저장됨" : status}</span>;
}
