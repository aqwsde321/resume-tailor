import { buildResumeTailoringEvidence, buildResumeTailoringRequirements } from "@/entities/resume/model/resume-tailoring";
import type { CompanyWork } from "./workspace";

export function getCompanyRequirementCoverage(work: CompanyWork) {
  if (!work.company || work.companySourceText !== work.document.text) return null;

  const assessment = work.tailoring
    ? { sourceResume: work.tailoring.sourceResume, matches: work.tailoring.plan.requirementMatches, confirmedExperiences: work.tailoring.confirmedExperiences }
    : work.requirementAssessment;
  const matches = new Map(assessment?.matches.map((match) => [match.requirementId, match]));
  const evidence = new Map(assessment ? buildResumeTailoringEvidence(assessment.sourceResume, assessment.confirmedExperiences).map((item) => [item.id, item]) : []);
  const requirements = buildResumeTailoringRequirements(work.company);
  const groups = (["required", "preferred"] as const).map((type) => {
    const counts = { direct: 0, related: 0, unchecked: 0, "known-gap": 0 };
    const rows = requirements.filter((item) => item.type === type).map((requirement) => {
      const match = matches.get(requirement.id);
      const linked = (match?.evidenceIds ?? []).flatMap((id) => evidence.get(id) ?? []);
      const status: keyof typeof counts = work.knownGaps?.includes(requirement.text) ? "known-gap"
        : !linked.length || match?.matchType === "gap" ? "unchecked"
        : match?.matchType === "direct" ? "direct" : "related";
      counts[status]++;
      return { ...requirement, status, match, evidence: linked };
    });
    return { type, counts, rows };
  });
  return { hasAssessment: Boolean(assessment), groups };
}
