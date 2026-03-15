"use client";

import { useCallback } from "react";

import { usePipeline } from "@/lib/client/pipeline-context";
import { isAbortError, postSseJson } from "@/lib/client/stream-client";
import type { TaskKind } from "@/lib/types";

interface RunPipelineStreamTaskOptions<TResponse> {
  abortMessage: string;
  endpoint: string;
  fallbackErrorMessage: string;
  onSuccess: (result: TResponse) => void;
  requestBody: unknown;
  startMessage: string;
  successMessage: string;
  task: TaskKind;
}

export function usePipelineStreamTask() {
  const {
    clearLogs,
    startTask,
    finishTask,
    addLog,
    setTaskAborter,
    setMessage,
    setError
  } = usePipeline();

  return useCallback(
    async <TResponse,>(options: RunPipelineStreamTaskOptions<TResponse>) => {
      clearLogs();
      startTask(options.task, options.startMessage);

      const controller = new AbortController();
      setTaskAborter(() => controller.abort());

      try {
        const result = await postSseJson<TResponse>(options.endpoint, options.requestBody, {
          onLog: (payload) => addLog(options.task, payload),
          signal: controller.signal
        });

        options.onSuccess(result);
        setMessage(options.successMessage);
      } catch (error) {
        if (isAbortError(error)) {
          setMessage(options.abortMessage);
        } else {
          setError(
            error instanceof Error ? error.message : options.fallbackErrorMessage
          );
        }
      } finally {
        setTaskAborter(null);
        finishTask();
      }
    },
    [addLog, clearLogs, finishTask, setError, setMessage, setTaskAborter, startTask]
  );
}
