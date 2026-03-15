export type SkillName = "resume-to-json" | "company-to-json" | "generate-intro";
export type InputMode = "text" | "file" | "url";
export type TaskKind = "resume" | "company" | "intro";
export type LogLevel = "info" | "success" | "error";
export type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type IntroTone = "balanced" | "confident" | "collaborative" | "problemSolving";

export interface AgentSettings {
  model: string;
  modelReasoningEffort: ModelReasoningEffort | "";
}

export interface AgentRunOptions {
  model?: string;
  modelReasoningEffort?: ModelReasoningEffort;
}

export interface ResumeExperienceItem {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface ResumeContactItem {
  label: string;
  value: string;
  url: string;
}

export interface ResumeProjectItem {
  name: string;
  description: string;
  subtitle: string;
  link: string;
  linkLabel: string;
  techStack: string[];
  highlights: string[];
}

export interface Resume {
  name: string;
  headline: string;
  summary: string;
  desiredPosition: string;
  careerYears: number;
  careerDurationText: string;
  pdfProfileImageDataUrl?: string;
  pdfProfileImageVisible?: boolean;
  contacts: ResumeContactItem[];
  techStack: string[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  achievements: string[];
  pdfHighlights: string[];
  strengths: string[];
  pdfStrengths: string[];
}

export interface Company {
  companyName: string;
  companyDescription: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
  preferredSkills: string[];
  techStack: string[];
}

export interface Intro {
  oneLineIntro: string;
  shortIntro: string;
  longIntro: string;
  fitReasons: string[];
  matchedSkills: string[];
  gapNotes: string[];
  missingButRelevant: string[];
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    message: string;
    details?: string;
  };
}

export interface StreamLogPayload {
  level: LogLevel;
  phase: string;
  message: string;
}

export interface PipelineLog extends StreamLogPayload {
  id: string;
  task: TaskKind;
  at: string;
}
