"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import type { Company, InputMode, Intro, PipelineLog, StreamLogPayload, TaskKind } from "@/lib/types";

const STORAGE_KEY = "resume-make.pipeline.v2";
const MAX_LOG_COUNT = 300;

interface IntroSource {
  resumeConfirmedJson: string;
  companyConfirmedJson: string;
}

export interface PipelineState {
  resumeInputMode: InputMode;
  companyInputMode: InputMode;
  resumeText: string;
  companyText: string;
  resumeJsonText: string;
  companyJsonText: string;
  resumeConfirmedJson: string | null;
  companyConfirmedJson: string | null;
  intro: Intro | null;
  previousIntro: Intro | null;
  introSource: IntroSource | null;
  currentTask: TaskKind | null;
  taskStartedAt: number | null;
  message: string;
  error: string;
  logs: PipelineLog[];
}

const initialState: PipelineState = {
  resumeInputMode: "text",
  companyInputMode: "text",
  resumeText: "",
  companyText: "",
  resumeJsonText: "",
  companyJsonText: "",
  resumeConfirmedJson: null,
  companyConfirmedJson: null,
  intro: null,
  previousIntro: null,
  introSource: null,
  currentTask: null,
  taskStartedAt: null,
  message: "",
  error: "",
  logs: []
};

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeIntro(raw: unknown): Intro | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Partial<Intro>;

  return {
    oneLineIntro: typeof value.oneLineIntro === "string" ? value.oneLineIntro : "",
    shortIntro: typeof value.shortIntro === "string" ? value.shortIntro : "",
    fitReasons: normalizeStringArray(value.fitReasons),
    matchedSkills: normalizeStringArray(value.matchedSkills),
    gapNotes: normalizeStringArray(value.gapNotes)
  };
}

function normalizeState(raw: unknown): PipelineState {
  if (!raw || typeof raw !== "object") {
    return initialState;
  }

  const value = raw as Partial<PipelineState>;

  return {
    ...initialState,
    ...value,
    intro: normalizeIntro(value.intro),
    previousIntro: normalizeIntro(value.previousIntro),
    logs: Array.isArray(value.logs)
      ? value.logs.filter(
          (item): item is PipelineLog =>
            !!item && typeof item === "object" && typeof item.message === "string"
        )
      : []
  };
}

interface PipelineContextValue {
  state: PipelineState;
  hydrated: boolean;
  patch: (updater: (prev: PipelineState) => PipelineState) => void;
  clearStatus: () => void;
  setMessage: (message: string) => void;
  setError: (message: string) => void;
  clearLogs: () => void;
  startTask: (task: TaskKind, message?: string) => void;
  finishTask: () => void;
  addLog: (task: TaskKind, payload: StreamLogPayload) => void;
}

const PipelineContext = createContext<PipelineContextValue | undefined>(undefined);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PipelineState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setState(normalizeState(JSON.parse(stored)));
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const patch = useCallback((updater: (prev: PipelineState) => PipelineState) => {
    setState((prev) => updater(prev));
  }, []);

  const clearStatus = useCallback(() => {
    setState((prev) => ({
      ...prev,
      message: "",
      error: ""
    }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      message,
      error: ""
    }));
  }, []);

  const setError = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      error: message,
      message: ""
    }));
  }, []);

  const clearLogs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      logs: []
    }));
  }, []);

  const startTask = useCallback((task: TaskKind, message?: string) => {
    setState((prev) => ({
      ...prev,
      currentTask: task,
      taskStartedAt: Date.now(),
      error: "",
      message: message ?? prev.message
    }));
  }, []);

  const finishTask = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentTask: null,
      taskStartedAt: null
    }));
  }, []);

  const addLog = useCallback((task: TaskKind, payload: StreamLogPayload) => {
    setState((prev) => {
      const entry: PipelineLog = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        task,
        at: new Date().toISOString(),
        level: payload.level,
        phase: payload.phase,
        message: payload.message
      };

      const nextLogs = [...prev.logs, entry];
      const logs = nextLogs.length > MAX_LOG_COUNT ? nextLogs.slice(-MAX_LOG_COUNT) : nextLogs;

      return {
        ...prev,
        logs
      };
    });
  }, []);

  const value = useMemo<PipelineContextValue>(
    () => ({
      state,
      hydrated,
      patch,
      clearStatus,
      setMessage,
      setError,
      clearLogs,
      startTask,
      finishTask,
      addLog
    }),
    [state, hydrated, patch, clearStatus, setMessage, setError, clearLogs, startTask, finishTask, addLog]
  );

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline() {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("PipelineProvider 내부에서 usePipeline을 사용해야 합니다.");
  }
  return context;
}

export function isIntroFresh(state: PipelineState): boolean {
  if (!state.intro || !state.introSource || !state.resumeConfirmedJson || !state.companyConfirmedJson) {
    return false;
  }

  return (
    state.introSource.resumeConfirmedJson === state.resumeConfirmedJson &&
    state.introSource.companyConfirmedJson === state.companyConfirmedJson
  );
}

export function hasCompanyConfirmed(state: PipelineState): state is PipelineState & {
  companyConfirmedJson: string;
} {
  return typeof state.companyConfirmedJson === "string";
}

export function hasResumeConfirmed(state: PipelineState): state is PipelineState & {
  resumeConfirmedJson: string;
} {
  return typeof state.resumeConfirmedJson === "string";
}

export function getConfirmedCompany(state: PipelineState): Company | null {
  if (!state.companyConfirmedJson) {
    return null;
  }

  try {
    return JSON.parse(state.companyConfirmedJson) as Company;
  } catch {
    return null;
  }
}
