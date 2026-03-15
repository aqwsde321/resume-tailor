import type { IntroTone } from "@/shared/lib/types";

export const INTRO_TONE_VALUES = [
  "balanced",
  "confident",
  "collaborative",
  "problemSolving"
] as const satisfies readonly IntroTone[];

export const INTRO_TONE_LABELS: Record<IntroTone, string> = {
  balanced: "담백하게",
  confident: "자신감 있게",
  collaborative: "협업 중심",
  problemSolving: "문제 해결 중심"
};

export function isIntroTone(value: unknown): value is IntroTone {
  return typeof value === "string" && INTRO_TONE_VALUES.includes(value as IntroTone);
}

export function formatIntroToneLabel(value: IntroTone): string {
  return INTRO_TONE_LABELS[value];
}

