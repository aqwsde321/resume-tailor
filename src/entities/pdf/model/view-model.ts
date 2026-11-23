import type { Company, Intro, Resume } from "@/shared/lib/types";
import {
  DEFAULT_PDF_THEME_ID,
  resolvePdfTheme,
  type PdfThemeId
} from "@/entities/pdf/model/themes";

interface PdfTextBlock {
  id: string;
  title: string;
  paragraphs: string[];
}

export interface PdfDescriptionBlock {
  kind: "paragraph" | "list";
  lines: string[];
}

interface PdfProjectView {
  name: string;
  subtitle: string;
  meta: string;
  description: PdfDescriptionBlock[];
  link: string;
  linkLabel: string;
  highlights: string[];
}

interface PdfExperienceView {
  company: string;
  role: string;
  period: string;
  description: PdfDescriptionBlock[];
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

interface PdfThemeView {
  accentHex: string;
  dividerHex: string;
  id: PdfThemeId;
  inkHex: string;
  label: string;
  mutedHex: string;
  onAccentHex: string;
  softHex: string;
}

export interface TypstResumeDocument {
  education: string[];
  qualifications: string[];
  name: string;
  desiredPosition: string;
  careerDuration: string;
  headline: string;
  profileImageDataUrl: string;
  profileImagePath: string;
  showProfileImage: boolean;
  targetCompany: string;
  targetJobTitle: string;
  contacts: PdfContactView[];
  primaryContacts: PdfContactView[];
  contactLinks: PdfContactView[];
  sections: PdfTextBlock[];
  experience: PdfExperienceView[];
  achievements: string[];
  projects: PdfProjectView[];
  theme: PdfThemeView;
  techGroups: PdfTechGroupView[];
  strengths: string[];
}

const FRONTEND_SKILLS = new Set([
  "react",
  "next.js",
  "nextjs",
  "vue",
  "vue.js",
  "nuxt",
  "nuxt.js",
  "angular",
  "svelte",
  "sveltekit",
  "html",
  "css",
  "scss",
  "sass",
  "tailwind",
  "tailwind css",
  "styled-components",
  "styled components",
  "emotion",
  "redux",
  "recoil",
  "zustand",
  "vite",
  "webpack",
  "storybook",
  "jquery"
]);

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

const SHARED_WEB_SKILLS = new Set(["typescript", "javascript"]);

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
  const trimmed = value.replace(/\r\n?/g, "\n").trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\n[^\S\n]*\n/)
    .map((paragraph) => paragraph.trim())
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
    { label: "Frontend", items: [] },
    { label: "Backend", items: [] },
    { label: "Database", items: [] },
    { label: "DevOps / Tool", items: [] }
  ];
  const normalizedTechStack = compactStrings(techStack).map((item) => ({
    raw: item,
    normalized: normalizeSkillKey(item)
  }));
  const hasExplicitFrontend = normalizedTechStack.some(({ normalized }) => FRONTEND_SKILLS.has(normalized));
  const hasExplicitBackend = normalizedTechStack.some(({ normalized }) => BACKEND_SKILLS.has(normalized));

  for (const { raw: item, normalized } of normalizedTechStack) {
    if (FRONTEND_SKILLS.has(normalized)) {
      groups[0].items.push(item);
      continue;
    }

    if (DATABASE_SKILLS.has(normalized)) {
      groups[2].items.push(item);
      continue;
    }

    if (BACKEND_SKILLS.has(normalized)) {
      groups[1].items.push(item);
      continue;
    }

    if (SHARED_WEB_SKILLS.has(normalized)) {
      if (hasExplicitFrontend && !hasExplicitBackend) {
        groups[0].items.push(item);
        continue;
      }

      if (hasExplicitBackend && !hasExplicitFrontend) {
        groups[1].items.push(item);
        continue;
      }

      if (hasExplicitFrontend) {
        groups[0].items.push(item);
        continue;
      }
    }

    if (DEVOPS_SKILLS.has(normalized)) {
      groups[3].items.push(item);
      continue;
    }

    groups[3].items.push(item);
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

const sentenceSegmenter = new Intl.Segmenter("ko", { granularity: "sentence" });

function splitLongParagraph(paragraph: string) {
  if (paragraph.includes("\n")) return [paragraph];
  const sentences = Array.from(sentenceSegmenter.segment(paragraph), ({ segment }) => segment);
  if (sentences.length <= 3) return [paragraph];

  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join("").trim());
  }
  return paragraphs;
}

function buildDescriptionBlocks(value: string): PdfDescriptionBlock[] {
  const blocks: PdfDescriptionBlock[] = [];

  for (const paragraph of splitParagraphs(value)) {
    let current: PdfDescriptionBlock | undefined;
    for (const rawLine of paragraph.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const bullet = line.match(/^[-*+•]\s+(.+)$/);
      const kind = bullet ? "list" : "paragraph";
      if (current?.kind !== kind) {
        current = { kind, lines: [] };
        blocks.push(current);
      }
      current.lines.push(bullet?.[1] ?? line);
    }
  }

  return blocks.flatMap((block) => block.kind === "paragraph" && block.lines.length === 1
    ? splitLongParagraph(block.lines[0]).map((paragraph) => ({ kind: "paragraph", lines: [paragraph] }))
    : [block]);
}

function buildTextSections(resume: Resume, intro: Intro): PdfTextBlock[] {
  const sections: PdfTextBlock[] = [];
  const introSource = intro.longIntro.trim() || intro.shortIntro.trim() || intro.oneLineIntro.trim() || resume.summary.trim();
  const tailoredIntroParagraphs = splitParagraphs(introSource).flatMap(splitLongParagraph);
  if (tailoredIntroParagraphs.length > 0) {
    sections.push({
      id: "tailored-intro",
      title: "About Me",
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
  company: Company,
  themeId: PdfThemeId = DEFAULT_PDF_THEME_ID,
  customAccentHex?: string
): TypstResumeDocument {
  const theme = resolvePdfTheme(themeId, customAccentHex);
  const profileImageDataUrl = resume.pdfProfileImageDataUrl?.trim() ?? "";
  const showProfileImage = (resume.pdfProfileImageVisible ?? true) && Boolean(profileImageDataUrl);

  const contacts = resume.contacts
    .map((contact) => ({
      label: contact.label.trim(),
      value: contact.value.trim(),
      url: contact.url.trim(),
      display: formatPdfContactDisplay(contact)
    }))
    .filter((contact) => contact.value);
  const isWebLink = ({ url }: PdfContactView) => /^https?:\/\//i.test(url);

  return {
    name: resume.name.trim(),
    desiredPosition: resume.desiredPosition.trim(),
    careerDuration: buildCareerDuration(resume),
    headline: buildHeadline(resume, intro),
    profileImageDataUrl,
    profileImagePath: "",
    showProfileImage,
    targetCompany: company.companyName.trim(),
    targetJobTitle: company.jobTitle.trim(),
    contacts,
    primaryContacts: contacts.filter((contact) => !isWebLink(contact)),
    contactLinks: contacts.filter(isWebLink),
    sections: buildTextSections(resume, intro),
    experience: resume.experience
      .map((item) => ({
        company: item.company.trim(),
        role: item.role.trim(),
        period: item.period.trim(),
        description: buildDescriptionBlocks(item.description)
      }))
      .filter((item) => item.company || item.role || item.period || item.description.length > 0),
    achievements: buildPdfHighlights(resume),
    projects: resume.projects
      .map((project) => ({
        name: project.name.trim(),
        subtitle: project.subtitle.trim(),
        meta: buildProjectMeta(project.techStack),
        description: buildDescriptionBlocks(project.description),
        link: project.link.trim(),
        linkLabel: project.linkLabel.trim() || project.link.trim(),
        highlights: compactStrings(project.highlights)
      }))
      .filter((project) => project.name || project.description.length > 0 || project.meta || project.link),
    theme: {
      id: theme.id,
      label: theme.label,
      accentHex: theme.accentHex,
      softHex: theme.softHex,
      dividerHex: theme.dividerHex,
      inkHex: theme.inkHex,
      mutedHex: theme.mutedHex,
      onAccentHex: theme.onAccentHex
    },
    techGroups: buildTechGroups(resume.techStack),
    strengths: buildPdfStrengths(resume),
    education: compactStrings(resume.education ?? []),
    qualifications: compactStrings(resume.qualifications ?? [])
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
