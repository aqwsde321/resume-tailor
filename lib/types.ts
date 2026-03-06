export type SkillName = "resume-to-json" | "company-to-json" | "generate-intro";
export type InputMode = "text" | "file";
export type TaskKind = "resume" | "company" | "intro";
export type LogLevel = "info" | "success" | "error";

export interface ResumeExperienceItem {
  company: string;
  role: string;
  period: string;
  description: string;
}

export interface ResumeProjectItem {
  name: string;
  description: string;
  techStack: string[];
}

export interface Resume {
  name: string;
  summary: string;
  desiredPosition: string;
  careerYears: number;
  techStack: string[];
  experience: ResumeExperienceItem[];
  projects: ResumeProjectItem[];
  achievements: string[];
  strengths: string[];
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
