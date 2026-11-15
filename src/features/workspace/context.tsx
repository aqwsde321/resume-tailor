"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { WorkspaceSchema, type Workspace } from "@/entities/workspace/model/workspace";
import { jsonRequest } from "./api";

type Update = (updater: (previous: Workspace) => Workspace) => void;
type ErrorKind = "load" | "save" | "conflict" | null;
class StorageError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function requestWorkspace(init?: RequestInit): Promise<Workspace> {
  const response = await fetch("/api/workspace", init);
  const body = await response.json();
  if (!response.ok || !body.ok) throw new StorageError(body.error?.details || body.error?.message || "요청을 처리하지 못했습니다.", response.status);
  return WorkspaceSchema.parse(body.data);
}
const Context = createContext<{
  workspace: Workspace | null; update: Update; error: string; errorKind: ErrorKind;
  status: string; dirty: boolean; loading: boolean; saving: boolean;
  reload: (options?: { discardChanges?: boolean }) => Promise<void>;
  retrySave: () => void;
} | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const latest = useRef<Workspace | null>(null);
  const dirtyRef = useRef(false);
  const inFlight = useRef(false);
  const loadingRef = useRef(false);
  const reload = useCallback(async (options?: { discardChanges?: boolean }) => {
    if (inFlight.current || loadingRef.current || (dirtyRef.current && !options?.discardChanges)) return;
    loadingRef.current = true;
    setLoading(true);
    const captured = latest.current;
    try {
      const loaded = await requestWorkspace();
      // Never replace edits made while the server request was pending.
      if (latest.current !== captured) return;
      latest.current = loaded; dirtyRef.current = false;
      setWorkspace(loaded); setDirty(false); setError(""); setErrorKind(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "자료를 불러오지 못했습니다.");
      setErrorKind("load");
    } finally { loadingRef.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const update = useCallback<Update>((updater) => {
    if (!latest.current) return;
    const next = updater(latest.current);
    if (next === latest.current) return;
    latest.current = next; dirtyRef.current = true;
    setWorkspace(next); setDirty(true);
  }, []);
  const retrySave = useCallback(() => {
    if (inFlight.current || !dirtyRef.current || errorKind === "conflict") return;
    setError(""); setErrorKind(null);
  }, [errorKind]);
  useEffect(() => {
    if (!workspace || !dirty || error || loading || inFlight.current) return;
    const timer = setTimeout(async () => {
      inFlight.current = true; setSaving(true);
      const captured = latest.current!;
      try {
        const saved = await requestWorkspace(jsonRequest({ workspace: captured, expectedRevision: captured.revision }, "PUT"));
        const hasNewChanges = latest.current !== captured;
        const next = hasNewChanges ? { ...latest.current!, revision: saved.revision } : saved;
        latest.current = next; dirtyRef.current = hasNewChanges;
        setWorkspace(next); setDirty(hasNewChanges);
      } catch (error) {
        setError(error instanceof Error ? error.message : "편집 내용을 저장하지 못했습니다.");
        setErrorKind(error instanceof StorageError && error.status === 409 ? "conflict" : "save");
      } finally { inFlight.current = false; setSaving(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [workspace, dirty, error, loading, saving]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const status = errorKind === "load" ? "불러오기 실패" : errorKind === "conflict" ? "저장 충돌" : error ? "저장 실패" : loading ? "불러오는 중…" : saving ? "저장 중…" : dirty ? "저장 대기" : "저장됨";
  return <Context.Provider value={{ workspace, update, error, errorKind, reload, retrySave, dirty, loading, saving, status }}>{children}</Context.Provider>;
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("WorkspaceProvider가 필요합니다."); return value; }
