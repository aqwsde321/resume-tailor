import { newTextDocument, resumeToMarkdown } from "./operations";
import type { CompanyVersion, CompanyWork } from "./workspace";

type Checkpoint = Pick<CompanyVersion, "resume" | "intro">;
type VersionCause = NonNullable<CompanyVersion["cause"]>;

export const versionCauseLabels: Record<VersionCause, string> = {
  manual: "직접 보관",
  "before-tailoring": "맞춤 제안 반영 전",
  "before-edit": "문서 편집 확정 전",
  "before-enrichment": "보완 경험 반영 전",
  "before-intro": "PDF 상단 요약 변경 전",
  "before-restore": "이전 버전 복원 전",
};

export function archiveCompanyVersion(work: CompanyWork, cause: VersionCause, note?: string): CompanyWork {
  if (!work.resume) return work;
  const version: CompanyVersion = {
    id: crypto.randomUUID(), resume: work.resume, intro: work.intro, createdAt: new Date().toISOString(),
    cause, note: note?.trim().slice(0, 300) || undefined,
  };
  return { ...work, versions: [...work.versions, version] };
}

export function restoreCompanyVersion(work: CompanyWork, versionId: string): CompanyWork {
  const version = work.versions.find((item) => item.id === versionId);
  if (!version) return work;
  return {
    ...archiveCompanyVersion(work, "before-restore"),
    resume: version.resume,
    intro: version.intro,
    tailoring: null,
    resumeDocument: newTextDocument("resume", work.title, resumeToMarkdown(version.resume)),
  };
}

const lines = (...values: (string | undefined)[]) => values.filter(Boolean).join("\n");
const items = (values: string[]) => values.filter(Boolean).join("\n\n");

function comparisonSections({ resume, intro }: Checkpoint): [string, string][] {
  return [
    ["기본 정보", lines(resume.name, resume.desiredPosition, resume.careerDurationText || (resume.careerYears ? `${resume.careerYears}년` : ""))],
    ["연락처", lines(...resume.contacts.map(({ label, value, url }) => [label, value, url].filter(Boolean).join(" · ")))],
    ["한 줄 소개", resume.headline],
    ["이력서 소개", resume.summary],
    ["기술", lines(...resume.techStack)],
    ["경력", items(resume.experience.map(({ company, role, period, description }) => lines([company, role, period].filter(Boolean).join(" · "), description)))],
    ["프로젝트", items(resume.projects.map(({ name, company, role, period, subtitle, description, highlights, techStack, link, linkLabel }) =>
      lines(name, [company, role, period].filter(Boolean).join(" · "), subtitle, description, ...highlights,
        techStack.length ? `기술: ${techStack.join(", ")}` : "", [linkLabel, link].filter(Boolean).join(" · "))))],
    ["학력", lines(...(resume.education ?? []))],
    ["자격·교육·수상", lines(...(resume.qualifications ?? []))],
    ["주요 성과", lines(...resume.achievements)],
    ["강점", lines(...resume.strengths)],
    ["PDF 강조 성과", lines(...resume.pdfHighlights)],
    ["PDF 강조 강점", lines(...resume.pdfStrengths)],
    ["PDF 상단 요약", intro?.longIntro ?? ""],
  ];
}

export function compareCompanyVersions(before: Checkpoint, after: Checkpoint) {
  const previous = new Map(comparisonSections(before));
  const changes = comparisonSections(after).flatMap(([label, text]) => {
    const oldText = previous.get(label) ?? "";
    return oldText === text ? [] : [{ label, before: oldText, after: text }];
  });
  const photo = (resume: Checkpoint["resume"]) => !resume.pdfProfileImageDataUrl ? "사진 없음" : resume.pdfProfileImageVisible ? "사진 표시" : "사진 숨김";
  const oldPhoto = photo(before.resume);
  const newPhoto = photo(after.resume);
  if (oldPhoto !== newPhoto || before.resume.pdfProfileImageDataUrl !== after.resume.pdfProfileImageDataUrl) {
    changes.push({ label: "PDF 프로필 사진", before: oldPhoto, after: oldPhoto === newPhoto ? `${newPhoto} · 이미지 교체` : newPhoto });
  }
  return changes;
}
