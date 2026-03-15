"use client";

import type { CompareSection, IntroSectionKey } from "@/lib/result-view";

export interface IntroSectionView {
  emptyText: string;
  key: IntroSectionKey;
  title: string;
  value: string;
}

export interface WritingAnchorItem {
  evidence: string[];
  label: string;
  target: string;
  type: "requirement" | "preferred";
}

export interface WritingAnchorView {
  anchors: WritingAnchorItem[];
  kicker: string;
  title: string;
}

export interface InsightView {
  gaps: string[];
  highlights: string[];
  kicker: string;
  keywords: string[];
  opportunities: string[];
  title: string;
}

export type ResultCompareSection = CompareSection;
