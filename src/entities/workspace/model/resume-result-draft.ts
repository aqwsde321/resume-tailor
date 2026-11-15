import { ResumeSchema } from "@/shared/lib/schemas";
import type { Resume } from "@/shared/lib/types";
import type { ResumeResultDraft } from "./workspace";
import { newTextDocument } from "./operations";

export function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  return skills.map((item) => item.trim()).filter((item) => {
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function resumeToReviewText(resume: Resume): string {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  return [`# ${resume.name || "내 이력서"}`, resume.headline || resume.desiredPosition,
    resume.careerDurationText ? `경력 ${resume.careerDurationText}` : resume.careerYears ? `경력 ${resume.careerYears}년` : "",
    list(resume.contacts.map((item) => `${item.label}: ${item.value || item.url}`)),
    "## 소개", resume.summary, "## 핵심 기술", list(resume.techStack),
    "## 경력", ...resume.experience.map((item) => [`### ${item.company || item.role}`, item.role, item.period, item.description].filter(Boolean).join("\n\n")),
    "## 프로젝트", ...resume.projects.map((item) => [`### ${item.name}`, [item.company, item.role, item.period || item.subtitle].filter(Boolean).join(" · "), item.description, list(item.highlights), item.techStack.length ? `사용 기술: ${item.techStack.join(", ")}` : "", item.link].filter(Boolean).join("\n\n")),
    "## 학력", list(resume.education ?? []), "## 자격·교육", list(resume.qualifications ?? []),
    "## 주요 성과", list(resume.achievements), "## 강점", list(resume.strengths),
  ].filter(Boolean).join("\n\n");
}
export function createResultDraft(resume: Resume, sourceText: string, catalog: string[] = [], preserveSelection = false, markdown?: string): ResumeResultDraft {
  const parsed = ResumeSchema.parse({ ...resume, techStack: preserveSelection ? resume.techStack : resume.techStack.slice(0, 6) });
  const structuredText = markdown ?? resumeToReviewText(parsed);
  const document = newTextDocument("resume", "정리된 이력서", structuredText);
  document.source.type = "markdown";
  return { resume: parsed, sourceText, structuredText, document, skillCatalog: uniqueSkills([...catalog, ...resume.techStack, ...resume.projects.flatMap((item) => item.techStack)]) };
}
export function changeDraftSkills(draft: ResumeResultDraft, selected: string[], catalog: string[]): ResumeResultDraft {
  if (draft.document.text !== draft.structuredText || draft.document.proposal || draft.document.annotations.some((item) => item.status === "pending")) throw new Error("댓글과 문서 수정을 먼저 정리해 주세요.");
  const resume = { ...draft.resume, techStack: uniqueSkills(selected) };
  const text = resumeToReviewText(resume);
  return { ...draft, resume, skillCatalog: uniqueSkills([...catalog, ...resume.techStack]), structuredText: text, document: { ...draft.document, text, updatedAt: new Date().toISOString() } };
}
