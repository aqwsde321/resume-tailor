import { ResumeSchema } from "@/shared/lib/schemas";
import type { Resume, ResumeContactItem, ResumeExperienceItem, ResumeProjectItem } from "@/shared/lib/types";

export const EMPTY_RESUME: Resume = {
  name: "",
  headline: "",
  summary: "",
  desiredPosition: "",
  careerYears: 0,
  careerDurationText: "",
  contacts: [],
  techStack: [],
  experience: [],
  projects: [],
  achievements: [],
  pdfHighlights: [],
  strengths: [],
  pdfStrengths: []
};

export function makeEmptyExperience(): ResumeExperienceItem {
  return {
    company: "",
    role: "",
    period: "",
    description: ""
  };
}

export function makeEmptyContact(): ResumeContactItem {
  return {
    label: "",
    value: "",
    url: ""
  };
}

export function makeEmptyProject(): ResumeProjectItem {
  return {
    name: "",
    description: "",
    subtitle: "",
    link: "",
    linkLabel: "",
    techStack: [],
    highlights: []
  };
}

export function toResumeDraft(jsonText: string): Resume {
  if (!jsonText.trim()) {
    return EMPTY_RESUME;
  }

  try {
    const parsed = ResumeSchema.safeParse(JSON.parse(jsonText));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    return EMPTY_RESUME;
  }

  return EMPTY_RESUME;
}

export function parseResumeJson(jsonText: string | null | undefined): Resume | null {
  if (!jsonText?.trim()) {
    return null;
  }

  try {
    const parsed = ResumeSchema.safeParse(JSON.parse(jsonText));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeResume(resume: Resume): string {
  return JSON.stringify(ResumeSchema.parse(resume), null, 2);
}

export function normalizeResumeJsonText(jsonText: string | null | undefined): string | null {
  const parsed = parseResumeJson(jsonText);
  return parsed ? serializeResume(parsed) : null;
}

function buildIntroComparableResume(resume: Resume) {
  return {
    name: resume.name,
    summary: resume.summary,
    desiredPosition: resume.desiredPosition,
    careerYears: resume.careerYears,
    techStack: resume.techStack,
    experience: resume.experience,
    projects: resume.projects.map((project) => ({
      name: project.name,
      description: project.description,
      techStack: project.techStack
    })),
    achievements: resume.achievements,
    strengths: resume.strengths
  };
}

export function serializeResumeIntroSnapshot(resume: Resume): string {
  return JSON.stringify(buildIntroComparableResume(ResumeSchema.parse(resume)));
}

export function serializeResumeIntroSnapshotFromJson(jsonText: string | null | undefined): string | null {
  const parsed = parseResumeJson(jsonText);
  return parsed ? serializeResumeIntroSnapshot(parsed) : null;
}

export function matchesResumeIntroSnapshot(
  currentJsonText: string | null | undefined,
  introSnapshot: string | null | undefined
): boolean {
  return serializeResumeIntroSnapshotFromJson(currentJsonText) === introSnapshot;
}

export function hasSameResumeIntroData(
  leftJsonText: string | null | undefined,
  rightJsonText: string | null | undefined
): boolean {
  return (
    serializeResumeIntroSnapshotFromJson(leftJsonText) ===
    serializeResumeIntroSnapshotFromJson(rightJsonText)
  );
}
