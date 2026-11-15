"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Task<T> = {
  label: string;
  execute: (signal: AbortSignal) => Promise<T>;
  onSuccess: (result: T) => void;
};
export type AiTaskState = {
  busy: boolean; label: string; elapsedSeconds: number; error: string; cancelled: boolean;
  cancel: () => void; retry: () => void; clearError: () => void;
};
/** Apply results only through onSuccess so cancelled or superseded work cannot change the document. */
export function useAiTask() {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const clock = useRef<number | null>(null);
  const mounted = useRef(true);
  const retryAction = useRef<(() => void) | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; controller.current?.abort(); if (clock.current !== null) window.clearInterval(clock.current); };
  }, []);
  const run = useCallback(async <T,>(task: Task<T>): Promise<void> => {
    if (controller.current) return;
    const active = new AbortController();
    const id = ++generation.current;
    controller.current = active;
    retryAction.current = () => { void run(task); };
    setBusy(true); setLabel(task.label); setElapsedSeconds(0); setError(""); setCancelled(false);
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (mounted.current && generation.current === id) setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    clock.current = timer;
    try {
      const result = await task.execute(active.signal);
      if (mounted.current && generation.current === id && !active.signal.aborted) {
        task.onSuccess(result);
        retryAction.current = null;
      }
    } catch (error) {
      if (mounted.current && generation.current === id && !active.signal.aborted) {
        setError(error instanceof Error ? error.message : "작업을 완료하지 못했습니다.");
      }
    } finally {
      window.clearInterval(timer);
      if (mounted.current && generation.current === id) {
        controller.current = null; clock.current = null;
        setElapsedSeconds(Math.floor((Date.now() - started) / 1000));
        setBusy(false);
      }
    }
  }, []);
  const cancel = useCallback(() => {
    if (!controller.current) return;
    generation.current += 1;
    if (clock.current !== null) window.clearInterval(clock.current);
    clock.current = null;
    controller.current.abort(); controller.current = null;
    setBusy(false); setCancelled(true); setError("");
  }, []);
  const retry = useCallback(() => { if (!controller.current) retryAction.current?.(); }, []);
  const clearError = useCallback(() => { setError(""); setCancelled(false); }, []);
  return { busy, label, elapsedSeconds, error, cancelled, run, cancel, retry, clearError };
}
