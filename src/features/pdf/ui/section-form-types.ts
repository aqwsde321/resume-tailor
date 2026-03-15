"use client";

import type { Company, Intro, Resume } from "@/shared/lib/types";

import type { CompanyUpdater, IntroUpdater, ResumeUpdater } from "./types";

export interface SharedSectionProps {
  exporting: boolean;
  resume: Resume;
  updateResume: ResumeUpdater;
}

export interface HeaderSectionFormProps extends SharedSectionProps {
  company: Company;
  onCompanyChange: CompanyUpdater;
}

export interface IntroSectionFormProps {
  companyName: string;
  exporting: boolean;
  intro: Intro;
  onIntroChange: IntroUpdater;
}

export interface SkillsSectionFormProps extends SharedSectionProps {
  onSkillsTextChange: (value: string) => void;
  skillsText: string;
}

export interface ProjectsSectionFormProps extends SharedSectionProps {
  onProjectTechStackTextChange: (index: number, value: string) => void;
  projectTechStackTexts: string[];
}
