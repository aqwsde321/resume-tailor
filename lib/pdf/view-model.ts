import type { Company, Intro, Resume } from "@/lib/types";

interface PdfTextBlock {
  id: string;
  title: string;
  paragraphs: string[];
}

interface PdfProjectView {
  name: string;
  subtitle: string;
  meta: string;
  description: string;
  link: string;
  linkLabel: string;
  highlights: string[];
}

interface PdfExperienceView {
  company: string;
  role: string;
  period: string;
  description: string;
}

interface PdfContactView {
  label: string;
  value: string;
  url: string;
  display: string;
}

interface PdfTechGroupView {
  label: string;
  items: string[];
}

export interface TypstResumeDocument {
  name: string;
  desiredPosition: string;
  careerDuration: string;
  headline: string;
  targetCompany: string;
  targetJobTitle: string;
  contacts: PdfContactView[];
  sections: PdfTextBlock[];
  experience: PdfExperienceView[];
  achievements: string[];
  projects: PdfProjectView[];
  techGroups: PdfTechGroupView[];
  strengths: string[];
}

const BACKEND_SKILLS = new Set([
  "java",
  "spring",
  "spring boot",
  "spring framework",
  "jpa",
  "hibernate",
  "node.js",
  "nodejs",
  "nestjs",
  "express",
  "fastify",
  "typescript",
  "javascript",
  "python",
  "django",
  "flask",
  "go",
  "golang",
  "gin",
  "echo",
  "ruby",
  "rails",
  "php",
  "laravel",
  "c#",
  "dotnet",
  ".net",
  "asp.net",
  "graphql",
  "rest api",
  "kotlin"
]);

const DATABASE_SKILLS = new Set([
  "mysql",
  "postgresql",
  "postgres",
  "mariadb",
  "mongodb",
  "redis",
  "elasticsearch",
  "oracle",
  "dynamodb",
  "sqlite",
  "supabase"
]);

const DEVOPS_SKILLS = new Set([
  "docker",
  "kubernetes",
  "k8s",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "github",
  "git",
  "github actions",
  "linux",
  "postman",
  "jira",
  "notion",
  "figma",
  "nginx",
  "grafana",
  "prometheus",
  "datadog"
]);

function compactStrings(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function splitParagraphs(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean);
}

function getFirstSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/.+?[.!?。！？](?:\s|$)/);
  if (match) {
    return match[0].trim();
  }

  return trimmed.split("\n")[0]?.trim() ?? "";
}

function normalizeSkillKey(value: string) {
  return value.trim().toLowerCase();
}

function buildTechGroups(techStack: string[]): PdfTechGroupView[] {
  const groups: PdfTechGroupView[] = [
    { label: "Backend", items: [] },
    { label: "Database", items: [] },
    { label: "DevOps / Tool", items: [] }
  ];

  for (const item of compactStrings(techStack)) {
    const normalized = normalizeSkillKey(item);

    if (DATABASE_SKILLS.has(normalized)) {
      groups[1].items.push(item);
      continue;
    }

    if (BACKEND_SKILLS.has(normalized)) {
      groups[0].items.push(item);
      continue;
    }

    if (DEVOPS_SKILLS.has(normalized)) {
      groups[2].items.push(item);
      continue;
    }

    groups[2].items.push(item);
  }

  return groups.map((group) => ({
    ...group,
    items: Array.from(new Set(group.items))
  }));
}

function buildHeadline(resume: Resume, intro: Intro) {
  return (
    resume.headline.trim() ||
    intro.oneLineIntro.trim() ||
    getFirstSentence(resume.summary) ||
    resume.desiredPosition.trim()
  );
}

function buildCareerDuration(resume: Resume) {
  if (resume.careerDurationText.trim()) {
    return resume.careerDurationText.trim();
  }

  return resume.careerYears > 0 ? `${resume.careerYears}년` : "";
}

function buildTextSections(resume: Resume, intro: Intro): PdfTextBlock[] {
  const sections: PdfTextBlock[] = [];
  const introSource = intro.longIntro.trim() || intro.shortIntro.trim() || intro.oneLineIntro.trim();
  const tailoredIntroParagraphs = splitParagraphs(introSource);
  if (tailoredIntroParagraphs.length > 0) {
    sections.push({
      id: "tailored-intro",
      title: "Tailored Intro",
      paragraphs: tailoredIntroParagraphs
    });
  }

  return sections;
}

function buildProjectMeta(techStack: string[]) {
  return compactStrings(techStack).join(" · ");
}

function buildPdfHighlights(resume: Resume) {
  return compactStrings(resume.pdfHighlights.length > 0 ? resume.pdfHighlights : resume.achievements);
}

function buildPdfStrengths(resume: Resume) {
  return compactStrings(resume.pdfStrengths.length > 0 ? resume.pdfStrengths : resume.strengths);
}

export function formatPdfContactDisplay(contact: Pick<PdfContactView, "label" | "value">) {
  const label = contact.label.trim();
  const value = contact.value.trim();
  if (!value) {
    return "";
  }

  return label ? `${label}: ${value}` : value;
}

export function buildTypstResumeDocument(
  resume: Resume,
  intro: Intro,
  company: Company
): TypstResumeDocument {
  return {
    name: resume.name.trim(),
    desiredPosition: resume.desiredPosition.trim(),
    careerDuration: buildCareerDuration(resume),
    headline: buildHeadline(resume, intro),
    targetCompany: company.companyName.trim(),
    targetJobTitle: company.jobTitle.trim(),
    contacts: resume.contacts
      .map((contact) => ({
        label: contact.label.trim(),
        value: contact.value.trim(),
        url: contact.url.trim(),
        display: formatPdfContactDisplay(contact)
      }))
      .filter((contact) => contact.value),
    sections: buildTextSections(resume, intro),
    experience: resume.experience
      .map((item) => ({
        company: item.company.trim(),
        role: item.role.trim(),
        period: item.period.trim(),
        description: item.description.trim()
      }))
      .filter((item) => item.company || item.role || item.period || item.description),
    achievements: buildPdfHighlights(resume),
    projects: resume.projects
      .map((project) => ({
        name: project.name.trim(),
        subtitle: project.subtitle.trim(),
        meta: buildProjectMeta(project.techStack),
        description: project.description.trim(),
        link: project.link.trim(),
        linkLabel: project.linkLabel.trim() || project.link.trim(),
        highlights: compactStrings(project.highlights)
      }))
      .filter((project) => project.name || project.description || project.meta || project.link),
    techGroups: buildTechGroups(resume.techStack),
    strengths: buildPdfStrengths(resume)
  };
}

function sanitizeFileSegment(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildPdfDownloadName(company: Company, resume: Resume) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const companySegment = sanitizeFileSegment(company.companyName || "resume-tailor");
  const roleSegment = sanitizeFileSegment(company.jobTitle || resume.desiredPosition || "intro");

  return `${companySegment}-${roleSegment}-${dateStamp}.pdf`;
}
