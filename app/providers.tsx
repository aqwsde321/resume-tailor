"use client";

import type { ReactNode } from "react";

import { PipelineProvider } from "@/entities/pipeline/model/pipeline-context";

export function Providers({ children }: { children: ReactNode }) {
  return <PipelineProvider>{children}</PipelineProvider>;
}
