"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceSchema, type Workspace } from "@/entities/workspace/model/workspace";
import { jsonRequest, workspaceRequest } from "./api";

type Update = (updater: (previous: Workspace) => Workspace) => void;
const Context = createContext<{ workspace: Workspace | null; update: Update; error: string; status: string; reload: () => Promise<void> } | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const latest = useRef<Workspace | null>(null);
  const inFlight = useRef(false);
  const reload = useCallback(async () => {
    try {
      const loaded = WorkspaceSchema.parse(await workspaceRequest("/api/workspace"));
      latest.current = loaded; setWorkspace(loaded); setDirty(false); setError("");
    } catch (error) { setError((error as Error).message); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const update = useCallback<Update>((updater) => {
    if (!latest.current) return;
    const next = updater(latest.current);
    latest.current = next; setWorkspace(next); setDirty(true);
  }, []);
  useEffect(() => {
    if (!workspace || !dirty || error || inFlight.current) return;
    const timer = setTimeout(async () => {
      inFlight.current = true; setSaving(true);
      const captured = workspace;
      try {
        const saved = WorkspaceSchema.parse(await workspaceRequest("/api/workspace", jsonRequest({ workspace: captured, expectedRevision: captured.revision }, "PUT")));
        const next = latest.current === captured ? saved : { ...latest.current!, revision: saved.revision };
        const hasNewChanges = latest.current !== captured;
        latest.current = next; setWorkspace(next); setDirty(hasNewChanges);
      } catch (error) { setError((error as Error).message); }
      finally { inFlight.current = false; setSaving(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [workspace, dirty, error]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <Context.Provider value={{ workspace, update, error, reload, status: saving ? "저장 중…" : dirty ? "저장 대기" : "저장됨" }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("WorkspaceProvider가 필요합니다."); return value; }
