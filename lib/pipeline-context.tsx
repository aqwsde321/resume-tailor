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

import { normalizeAgentSettings } from "@/lib/agent-settings";
import { isIntroTone } from "@/lib/intro-tone";
import type {
  AgentSettings,
  Company,
  InputMode,
  Intro,
  IntroTone,
  PipelineLog,
  StreamLogPayload,
  TaskKind
} from "@/lib/types";

const STORAGE_KEY = "resume-tailor.pipeline.v2";
const LEGACY_STORAGE_KEY = "resume-make.pipeline.v2";
const MAX_LOG_COUNT = 300;

interface IntroSource {
  resumeConfirmedJson: string;
  companyConfirmedJson: string;
}

export interface IntroRefreshReason {
  key: "resume" | "company";
  message: string;
}

export interface PipelineState {
  agentSettings: AgentSettings;
  introTone: IntroTone;
  resumeInputMode: InputMode;
  companyInputMode: InputMode;
  resumeText: string;
  resumeUrl: string;
  companyUrl: string;
  companyText: string;
  resumeJsonText: string;
  companyJsonText: string;
  resumeConfirmedJson: string | null;
  companyConfirmedJson: string | null;
  resumeSavedAt: string | null;
  companySavedAt: string | null;
  introSavedAt: string | null;
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
  agentSettings: {
    model: "",
    modelReasoningEffort: "medium"
  },
  introTone: "balanced",
  resumeInputMode: "text",
  companyInputMode: "text",
  resumeText: "",
  resumeUrl: "",
  companyUrl: "",
  companyText: "",
  resumeJsonText: "",
  companyJsonText: "",
  resumeConfirmedJson: null,
  companyConfirmedJson: null,
  resumeSavedAt: null,
  companySavedAt: null,
  introSavedAt: null,
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
    longIntro:
      typeof value.longIntro === "string"
        ? value.longIntro
        : typeof value.shortIntro === "string"
          ? value.shortIntro
          : "",
    fitReasons: normalizeStringArray(value.fitReasons),
    matchedSkills: normalizeStringArray(value.matchedSkills),
    gapNotes: normalizeStringArray(value.gapNotes),
    missingButRelevant: normalizeStringArray(value.missingButRelevant)
  };
}

function normalizeState(raw: unknown): PipelineState {
  if (!raw || typeof raw !== "object") {
    return initialState;
  }

  const value = raw as Partial<PipelineState>;

  // 저장 포맷이 일부 달라졌거나 손상돼도 화면이 깨지지 않도록 안전한 기본값으로 복원한다.
  return {
    ...initialState,
    ...value,
    agentSettings: normalizeAgentSettings(value.agentSettings),
    introTone: isIntroTone(value.introTone) ? value.introTone : "balanced",
    resumeUrl: typeof value.resumeUrl === "string" ? value.resumeUrl : "",
    companyUrl: typeof value.companyUrl === "string" ? value.companyUrl : "",
    resumeSavedAt: typeof value.resumeSavedAt === "string" ? value.resumeSavedAt : null,
    companySavedAt: typeof value.companySavedAt === "string" ? value.companySavedAt : null,
    introSavedAt: typeof value.introSavedAt === "string" ? value.introSavedAt : null,
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
      // 현재 키를 우선 읽고, 예전 앱 이름으로 저장된 데이터는 한 번만 마이그레이션한다.
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setState(normalizeState(JSON.parse(stored)));
      } else {
        const legacyStored = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyStored) {
          const nextState = normalizeState(JSON.parse(legacyStored));
          setState(nextState);
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    // 초기 hydration 전에 덮어쓰지 않도록, 브라우저 상태를 읽은 뒤부터만 저장한다.
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

  // 소개글 생성 시점의 저장본 스냅샷과 현재 저장본이 같을 때만 최신으로 본다.
  return (
    state.introSource.resumeConfirmedJson === state.resumeConfirmedJson &&
    state.introSource.companyConfirmedJson === state.companyConfirmedJson
  );
}

export function getIntroRefreshReasons(state: PipelineState): IntroRefreshReason[] {
  if (!state.intro || !state.introSource) {
    return [];
  }

  const reasons: IntroRefreshReason[] = [];

  if (!state.resumeConfirmedJson) {
    reasons.push({
      key: "resume",
      message: "이력서를 다시 저장해 주세요."
    });
  } else if (state.introSource.resumeConfirmedJson !== state.resumeConfirmedJson) {
    reasons.push({
      key: "resume",
      message: "이력서가 바뀌었어요."
    });
  }

  if (!state.companyConfirmedJson) {
    reasons.push({
      key: "company",
      message: "공고를 다시 저장해 주세요."
    });
  } else if (state.introSource.companyConfirmedJson !== state.companyConfirmedJson) {
    reasons.push({
      key: "company",
      message: "공고가 바뀌었어요."
    });
  }

  return reasons;
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
