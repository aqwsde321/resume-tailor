"use client";

import type { ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

import { PipelineProvider } from "@/entities/pipeline/model/pipeline-context";

export function Providers({ children }: { children: ReactNode }) {
  return <Theme theme={neutralTheme} mode="light"><PipelineProvider>{children}</PipelineProvider></Theme>;
}
