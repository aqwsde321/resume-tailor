import type { Resume, ResumeExperienceItem, ResumeProjectItem } from "@/shared/lib/types";
import type { ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";
import { ResumeSchema } from "@/shared/lib/schemas";

export interface TailoringReviewRow {
  id: string;
  label: string;
  before: string;
  after: string;
  evidenceIds: string[];
  changed: boolean;
  addsItem: boolean;
  unavailableReason?: string;
}

export function buildTailoringReviewRows(current: Resume, source: Resume, plan: ResumeTailoringPlan): TailoringReviewRow[] {
  const descriptors: { id: string; label: string; evidenceIds: string[]; read: (resume: Resume) => string; addsItem?: boolean; unavailableReason?: string }[] = [
    { id: "headline", label: "한 줄 소개", evidenceIds: plan.headline.evidenceIds, read: (resume) => resume.headline },
    { id: "summary", label: "소개", evidenceIds: plan.summary.evidenceIds, read: (resume) => resume.summary },
  ];
  const experienceIdentity = (item: ResumeExperienceItem) => [item.company, item.role, item.period].join("\u0000");
  const projectIdentity = (item: ResumeProjectItem) => [item.name, item.company ?? "", item.period ?? ""].join("\u0000");
  for (const item of plan.experience) {
    const original = source.experience[Number(item.sourceId.slice(11)) - 1];
    const matches = original ? current.experience.filter((entry) => experienceIdentity(entry) === experienceIdentity(original)) : [];
    descriptors.push({ id: item.sourceId, label: original ? `${original.company} / ${original.role}` : "경력", evidenceIds: item.evidenceIds,
      read: (resume) => original ? resume.experience.find((entry) => experienceIdentity(entry) === experienceIdentity(original))?.description ?? "" : "",
      addsItem: matches.length === 0,
      unavailableReason: !original ? "제안의 원본 항목을 찾지 못했습니다." : matches.length > 1 ? "같은 제목·소속·기간의 항목이 여러 개입니다. 항목을 구분한 뒤 다시 제안받아 주세요." : undefined });
  }
  for (const item of plan.projects) {
    const original = source.projects[Number(item.sourceId.slice(8)) - 1];
    const matches = original ? current.projects.filter((entry) => projectIdentity(entry) === projectIdentity(original)) : [];
    descriptors.push({ id: item.sourceId, label: original?.name ?? "프로젝트", evidenceIds: item.evidenceIds,
      read: (resume) => original ? resume.projects.find((entry) => projectIdentity(entry) === projectIdentity(original))?.description ?? "" : "",
      addsItem: matches.length === 0,
      unavailableReason: !original ? "제안의 원본 항목을 찾지 못했습니다." : matches.length > 1 ? "같은 제목·소속·기간의 항목이 여러 개입니다. 항목을 구분한 뒤 다시 제안받아 주세요." : undefined });
  }
  descriptors.push(
    { id: "skills", label: "강조할 기술", evidenceIds: plan.skillIds, read: (resume) => resume.techStack.join("\n") },
    { id: "highlights", label: "강조할 성과", evidenceIds: plan.highlightIds, read: (resume) => (resume.pdfHighlights.length ? resume.pdfHighlights : resume.achievements).join("\n") },
    { id: "strengths", label: "강조할 강점", evidenceIds: plan.strengthIds, read: (resume) => (resume.pdfStrengths.length ? resume.pdfStrengths : resume.strengths).join("\n") },
  );
  return descriptors.map(({ read, ...row }) => {
    if (row.unavailableReason) return { ...row, before: "", after: "", changed: false, addsItem: false };
    const before = read(current);
    const after = read(mergeTailoringSelection(current, source, plan, [row.id]));
    return { ...row, before, after, changed: before !== after, addsItem: row.addsItem ?? false };
  });
}

export function mergeTailoringSelection(current: Resume, source: Resume, plan: ResumeTailoringPlan, selected: string[]): Resume {
  function merge<T extends { description: string }>(items: T[], originals: T[], suggestions: { sourceId: string; description: string }[], prefix: string, identity: (item: T) => string): T[] {
    const result = [...items];
    for (const suggestion of suggestions.filter((item) => selected.includes(item.sourceId))) {
      const original = originals[Number(suggestion.sourceId.slice(prefix.length + 1)) - 1];
      if (!original) throw new Error("제안의 원본 항목을 찾지 못했습니다.");
      const matches = result.map((item, index) => identity(item) === identity(original) ? index : -1).filter((index) => index >= 0);
      if (matches.length > 1) throw new Error("같은 제목·소속·기간의 항목이 여러 개입니다. 원본을 구분한 뒤 다시 제안받아 주세요.");
      if (matches.length === 1) result[matches[0]] = { ...result[matches[0]], description: suggestion.description };
      else result.push({ ...original, description: suggestion.description });
    }
    return result;
  }
  return ResumeSchema.parse({ ...current,
    techStack: selected.includes("skills") ? plan.skillIds.flatMap((id) => source.techStack[Number(id.slice(6)) - 1] ?? []) : current.techStack,
    pdfHighlights: selected.includes("highlights") ? plan.highlightIds.flatMap((id) => (source.pdfHighlights.length ? source.pdfHighlights : source.achievements)[Number(id.slice(10)) - 1] ?? []) : current.pdfHighlights,
    pdfStrengths: selected.includes("strengths") ? plan.strengthIds.flatMap((id) => (source.pdfStrengths.length ? source.pdfStrengths : source.strengths)[Number(id.slice(9)) - 1] ?? []) : current.pdfStrengths,
    headline: selected.includes("headline") ? plan.headline.text : current.headline,
    summary: selected.includes("summary") ? plan.summary.text : current.summary,
    experience: merge<ResumeExperienceItem>(current.experience, source.experience, plan.experience, "experience", (item) => [item.company, item.role, item.period].join("\u0000")),
    projects: merge<ResumeProjectItem>(current.projects, source.projects, plan.projects, "project", (item) => [item.name, item.company ?? "", item.period ?? ""].join("\u0000")),
  });
}
