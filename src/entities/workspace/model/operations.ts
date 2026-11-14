import type { Resume } from "@/shared/lib/types";
import { ResumeSchema } from "@/shared/lib/schemas";
import type { CompanyWork, ReviewDocument, Workspace } from "./workspace";

export function publishMasterResume(workspace: Workspace, document: ReviewDocument, resume: Resume): Workspace {
  const now = new Date().toISOString();
  return { ...workspace, master: {
    id: workspace.master?.id ?? crypto.randomUUID(),
    version: (workspace.master?.resume ? workspace.master.version : 0) + 1,
    document, resume: ResumeSchema.parse(resume), enrichment: workspace.master?.enrichment ?? [], updatedAt: now,
  } };
}
export function createCompanyWork(master: NonNullable<Workspace["master"]>, document: ReviewDocument): CompanyWork {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), title: document.title, document, company: null,
    sourceResumeVersion: master.version, sourceResume: structuredClone(master.resume), resume: structuredClone(master.resume),
    intro: null, enrichment: [], versions: [], createdAt: now, updatedAt: now,
  };
}
export function refreshCompanySource(work: CompanyWork, master: NonNullable<Workspace["master"]>): CompanyWork {
  return { ...work, sourceResumeVersion: master.version, sourceResume: structuredClone(master.resume), updatedAt: new Date().toISOString() };
}
export function sortResumeChronologically(resume: Resume): Resume {
  const startDate = (period: string) => { const match = period.match(/(\d{4})(?:\s*[.\-/년]\s*(\d{1,2}))?/); return match ? Number(match[1]) * 100 + Number(match[2] ?? 1) : 0; };
  return { ...resume,
    experience: [...resume.experience].sort((a, b) => startDate(b.period) - startDate(a.period)),
    projects: [...resume.projects].sort((a, b) => startDate(b.period || b.subtitle) - startDate(a.period || a.subtitle)),
  };
}

export function resumeToMarkdown(resume: Resume): string {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  return [
    `# ${resume.name || "이력서"}`, resume.headline, resume.summary,
    "## 기본 정보", `희망 직무: ${resume.desiredPosition}`, `경력: ${resume.careerDurationText || `${resume.careerYears}년`}`,
    list(resume.contacts.map((contact) => `${contact.label}: ${contact.value}${contact.url ? ` (${contact.url})` : ""}`)),
    "## 기술", list(resume.techStack), "## 경력",
    ...resume.experience.map((item) => `### ${item.company} | ${item.role} | ${item.period}\n\n${item.description}`),
    "## 프로젝트", ...resume.projects.map((item) => `### ${item.name} | ${[item.company, item.role, item.period].filter(Boolean).join(" · ") || item.subtitle}\n\n${item.description}\n\n${list(item.highlights)}\n\n기술: ${item.techStack.join(", ")}${item.link ? `\n링크: ${item.link}` : ""}`),
    "## 학력", list(resume.education ?? []), "## 자격·교육·수상", list(resume.qualifications ?? []),
    "## 주요 성과", list(resume.achievements), "## 강점", list(resume.strengths),
  ].filter(Boolean).join("\n\n");
}
export function newTextDocument(kind: "resume" | "job", title: string, text: string): ReviewDocument {
  return { id: crypto.randomUUID(), kind, title, text, source: { type: "text", originalText: text, pages: [] }, annotations: [], proposal: null, history: [], updatedAt: new Date().toISOString() };
}
