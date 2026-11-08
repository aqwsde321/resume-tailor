import type { DiscoveredExperienceDraft, ExperienceDiscoverySession, Resume } from "@/shared/lib/types";
import { ExperienceDiscoverySessionSchema } from "@/shared/lib/schemas";

export function normalizeExperienceDiscoverySession(raw: unknown): ExperienceDiscoverySession | null {
  const parsed = ExperienceDiscoverySessionSchema.safeParse(raw);
  if (!parsed.success || (parsed.data.status === "draft") !== Boolean(parsed.data.draft)) {
    return null;
  }

  return parsed.data;
}

export function isExperienceDiscoverySessionCurrent(
  session: ExperienceDiscoverySession | null,
  resumeSnapshot: string | null,
  companyJson: string | null
): session is ExperienceDiscoverySession {
  return Boolean(
    session &&
      resumeSnapshot &&
      companyJson &&
      session.sourceResumeSnapshot === resumeSnapshot &&
      session.sourceCompanyJson === companyJson
  );
}

function normalizeSkills(existing: string[], discovered: string[]) {
  const seen = new Set<string>();

  return [...existing, ...discovered]
    .map((skill) => skill.trim())
    .filter((skill) => {
      const key = skill.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function addDiscoveredExperienceToResume(
  resume: Resume,
  draft: DiscoveredExperienceDraft
): Resume {
  const title = draft.title.trim();
  const organization = draft.organization.trim();
  const role = draft.role.trim();
  const period = draft.period.trim();
  const description = draft.description.trim();

  if ((!title && !organization) || !description) {
    return resume;
  }

  const techStack = normalizeSkills(resume.techStack, draft.techStack);

  if (draft.category === "experience") {
    return {
      ...resume,
      techStack,
      experience: [
        ...resume.experience,
        {
          company: organization || title,
          role,
          period,
          description
        }
      ]
    };
  }

  return {
    ...resume,
    techStack,
    projects: [
      ...resume.projects,
      {
        name: title || organization,
        description,
        subtitle: [role, period].filter(Boolean).join(" · "),
        link: "",
        linkLabel: "",
        techStack: normalizeSkills([], draft.techStack),
        highlights: []
      }
    ]
  };
}
