import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";
import { ApplicationRecordSchema } from "@/entities/application/model/application-record";
import { createCompanyWork, newTextDocument, publishMasterResume, resumeToMarkdown } from "./operations";
import type { Workspace } from "./workspace";
export function migrateLegacyWorkspace(current: Workspace, raw: Record<string, unknown>) {
  if (current.legacyBackup) throw new Error("이전 브라우저 자료를 이미 가져왔습니다.");
  const parse = (value: unknown) => { try { return typeof value === "string" ? JSON.parse(value) : value; } catch { return undefined; } };
  let workspace: Workspace = { ...current, legacyBackup: raw };
  const resume = ResumeSchema.safeParse(parse(raw.resumeConfirmedJson));
  if (!workspace.master && resume.success) workspace = publishMasterResume(workspace, newTextDocument("resume", "이전 이력서", typeof raw.resumeText === "string" && raw.resumeText ? raw.resumeText : resumeToMarkdown(resume.data)), resume.data);
  const applications: { legacyId: string; workId: string }[] = [];
  for (const value of Array.isArray(raw.applications) ? raw.applications : []) {
    const result = ApplicationRecordSchema.safeParse(value);
    if (!result.success) continue;
    const old = result.data;
    const text = [old.companyName, old.jobTitle, old.snapshot.company.jobDescription, ...old.snapshot.company.requirements, ...old.snapshot.company.preferredSkills].join("\n\n");
    const document = newTextDocument("job", `${old.companyName} · ${old.jobTitle}`, text);
    const base = { id: crypto.randomUUID(), version: 1, resume: old.snapshot.resume, document: newTextDocument("resume", "이전 제출 이력서", resumeToMarkdown(old.snapshot.resume)), enrichment: [], updatedAt: old.updatedAt };
    const work = { ...createCompanyWork(base, document), company: old.snapshot.company, companySourceText: text, sourceResumeVersion: null, intro: old.snapshot.intro, createdAt: old.createdAt, updatedAt: old.updatedAt };
    workspace.works = [...workspace.works, work]; applications.push({ legacyId: old.id, workId: work.id });
  }
  const company = CompanySchema.safeParse(parse(raw.companyConfirmedJson));
  if (company.success && workspace.master?.resume) {
    const text = typeof raw.companyText === "string" && raw.companyText ? raw.companyText : [company.data.companyName, company.data.jobTitle, company.data.jobDescription, ...company.data.requirements].join("\n\n");
    const work = createCompanyWork(workspace.master, newTextDocument("job", `${company.data.companyName} · ${company.data.jobTitle}`, text));
    const intro = IntroSchema.safeParse(raw.intro);
    workspace.works = [...workspace.works, { ...work, company: company.data, companySourceText: text, intro: intro.success ? intro.data : null }];
  }
  return { workspace, applications };
}
