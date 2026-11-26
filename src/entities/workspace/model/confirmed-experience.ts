import { ConfirmedExperienceSchema, type ConfirmedExperience, type ConfirmedExperienceScope } from "@/entities/resume/model/confirmed-experience";
import type { CompanyWork, Workspace } from "./workspace";

export function getConfirmedExperiences(workspace: Workspace, work: CompanyWork): ConfirmedExperience[] {
  return [...(work.confirmedExperiences ?? []), ...(workspace.confirmedExperiences ?? [])];
}

export function saveConfirmedExperience(
  workspace: Workspace,
  experience: ConfirmedExperience,
  scope: ConfirmedExperienceScope,
  workId?: string,
): Workspace {
  if (scope === "company" && !workspace.works.some((work) => work.id === workId)) return workspace;
  const fact = ConfirmedExperienceSchema.parse(experience);
  const replace = (existing: ConfirmedExperience[] | undefined, add: boolean) => {
    const other = (existing ?? []).filter((item) => item.id !== fact.id);
    return add ? [fact, ...other] : other;
  };
  return {
    ...workspace,
    confirmedExperiences: replace(workspace.confirmedExperiences, scope === "common"),
    works: workspace.works.map((work) => work.id === workId
      ? { ...work, confirmedExperiences: replace(work.confirmedExperiences, scope === "company"), updatedAt: new Date().toISOString() }
      : work),
  };
}
