import { buildResumeTailoringRequirements } from "@/entities/resume/model/resume-tailoring";
import type { CompanyWork } from "./workspace";

export function setCompanyRequirementGap(work: CompanyWork, requirement: string, marked: boolean): CompanyWork {
  if (!work.company || work.companySourceText !== work.document.text ||
    !buildResumeTailoringRequirements(work.company).some(({ text }) => text === requirement)) {
    return work;
  }

  const knownGaps = work.knownGaps ?? [];
  if (knownGaps.includes(requirement) === marked) return work;

  return {
    ...work,
    knownGaps: marked ? [...knownGaps, requirement] : knownGaps.filter((text) => text !== requirement),
  };
}
