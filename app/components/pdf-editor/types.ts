import type { Company, Intro, Resume } from "@/lib/types";

export type PdfSectionKey =
  | "header"
  | "contacts"
  | "intro"
  | "experience"
  | "highlights"
  | "projects"
  | "skills"
  | "strengths";

export type ResumeUpdater = (updater: (current: Resume) => Resume) => void;
export type CompanyUpdater = (nextCompany: Company) => void;
export type IntroUpdater = (nextIntro: Intro) => void;

export type TypstPreviewStatus = "idle" | "rendering" | "ready" | "error";

export interface TypstPreviewState {
  error: string;
  pages: string[];
  status: TypstPreviewStatus;
}
