import type { Resume, ResumeExperienceItem, ResumeProjectItem } from "@/shared/lib/types";
import type { ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";
import { ResumeSchema } from "@/shared/lib/schemas";
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
    headline: selected.includes("headline") ? plan.headline.text : current.headline,
    summary: selected.includes("summary") ? plan.summary.text : current.summary,
    experience: merge<ResumeExperienceItem>(current.experience, source.experience, plan.experience, "experience", (item) => [item.company, item.role, item.period].join("\u0000")),
    projects: merge<ResumeProjectItem>(current.projects, source.projects, plan.projects, "project", (item) => [item.name, item.company ?? "", item.period ?? ""].join("\u0000")),
  });
}
