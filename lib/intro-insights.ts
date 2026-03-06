import type { Company, Resume } from "@/lib/types";

const STOPWORDS = new Set([
  "및",
  "또는",
  "관련",
  "기반",
  "사용",
  "능력",
  "경험",
  "개발",
  "프로젝트",
  "업무",
  "이상",
  "이해",
  "보유",
  "우대",
  "필수",
  "가능",
  "preferred",
  "required"
]);

const GENERIC_MATCH_TOKENS = new Set([
  "경험",
  "능력",
  "역량",
  "활용",
  "기반",
  "중심",
  "문화",
  "적응",
  "사용",
  "운영"
]);

type EvidenceEntry = {
  label: string;
  text: string;
  normalized: string;
  tokens: string[];
};

type EvidenceMatch = {
  target: string;
  evidence: string[];
};

export type IntroGuidance = {
  roleOverlap: string[];
  matchedSkills: string[];
  requirementMatches: EvidenceMatch[];
  preferredMatches: EvidenceMatch[];
  gapCandidates: string[];
  highlightCandidates: string[];
  keywordCandidates: string[];
};

export type MatchInsights = {
  highlights: string[];
  gaps: string[];
  keywords: string[];
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return normalizePhrase(value)
    .split(/[^a-z0-9가-힣+#.]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function getMeaningfulTokens(value: string): string[] {
  return tokenize(value).filter((token) => !GENERIC_MATCH_TOKENS.has(token));
}

function truncate(value: string, maxLength = 140): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildEvidenceEntries(resume: Resume): EvidenceEntry[] {
  const entries: EvidenceEntry[] = [];

  const push = (label: string, text: string) => {
    const normalized = truncate(text);
    if (!normalized) {
      return;
    }

    entries.push({
      label,
      text: normalized,
      normalized: normalizePhrase(normalized),
      tokens: tokenize(normalized)
    });
  };

  push("summary", resume.summary);
  push("desiredPosition", resume.desiredPosition);
  resume.strengths.forEach((item) => push("strength", item));
  resume.achievements.forEach((item) => push("achievement", item));
  resume.experience.forEach((item) => {
    push("experience", `${item.company} / ${item.role} / ${item.period} / ${item.description}`);
  });
  resume.projects.forEach((item) => {
    push("project", `${item.name} / ${item.description} / 기술: ${item.techStack.join(", ")}`);
  });

  return entries;
}

function collectResumeKeywords(resume: Resume): Set<string> {
  const raw = [
    resume.desiredPosition,
    resume.summary,
    ...resume.techStack,
    ...resume.achievements,
    ...resume.strengths,
    ...resume.experience.flatMap((item) => [item.company, item.role, item.period, item.description]),
    ...resume.projects.flatMap((item) => [item.name, item.description, ...item.techStack])
  ];

  return new Set(unique(raw.flatMap(tokenize)));
}

function collectResumeTech(resume: Resume): Set<string> {
  return new Set(
    unique([...resume.techStack, ...resume.projects.flatMap((item) => item.techStack)].map(normalizePhrase))
  );
}

function formatEvidence(entry: EvidenceEntry): string {
  const labelMap: Record<string, string> = {
    summary: "요약",
    desiredPosition: "희망직무",
    strength: "강점",
    achievement: "성과",
    experience: "경력",
    project: "프로젝트"
  };

  return `${labelMap[entry.label] ?? entry.label}: ${entry.text}`;
}

function findEvidence(entries: EvidenceEntry[], tokens: string[], limit = 2): string[] {
  if (tokens.length === 0) {
    return [];
  }

  const scored = entries
    .map((entry) => {
      const overlap = tokens.filter(
        (token) => entry.tokens.includes(token) || entry.normalized.includes(token)
      );

      return {
        entry,
        score: unique(overlap).length
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return unique(scored.slice(0, limit).map((item) => formatEvidence(item.entry)));
}

function findTechAnchors(target: string, company: Company): string[] {
  const normalizedTarget = normalizePhrase(target);
  const targetTokens = tokenize(target);

  return company.techStack.filter((skill) => {
    const normalizedSkill = normalizePhrase(skill);
    return (
      normalizedTarget.includes(normalizedSkill) ||
      tokenize(skill).some((token) => targetTokens.includes(token))
    );
  });
}

function hasSkillEvidence(skill: string, resumeKeywords: Set<string>, resumeTech: Set<string>): boolean {
  const normalizedSkill = normalizePhrase(skill);
  return resumeTech.has(normalizedSkill) || tokenize(skill).some((token) => resumeKeywords.has(token));
}

function buildEvidenceMatches(
  items: string[],
  resumeKeywords: Set<string>,
  resumeTech: Set<string>,
  entries: EvidenceEntry[],
  company: Company
): EvidenceMatch[] {
  return items
    .map((target) => {
      const anchors = findTechAnchors(target, company);
      const anchorMatched = anchors.filter((skill) => hasSkillEvidence(skill, resumeKeywords, resumeTech));
      const meaningfulTokens = getMeaningfulTokens(target);
      const fallbackTokens = meaningfulTokens.filter((token) => resumeKeywords.has(token));
      const evidenceTokens = anchorMatched.length > 0 ? anchorMatched.flatMap(tokenize) : fallbackTokens;
      const evidence = findEvidence(entries, unique(evidenceTokens));

      return {
        target,
        evidence
      };
    })
    .filter((item) => item.evidence.length > 0);
}

export function buildIntroGuidance(resume: Resume, company: Company): IntroGuidance {
  const resumeKeywords = collectResumeKeywords(resume);
  const resumeTech = collectResumeTech(resume);
  const entries = buildEvidenceEntries(resume);
  const jobTokens = tokenize(company.jobTitle);
  const desiredTokens = tokenize(`${resume.desiredPosition} ${resume.summary}`);

  const roleOverlap = unique(desiredTokens.filter((token) => jobTokens.includes(token))).slice(0, 4);
  const matchedSkills = unique(
    company.techStack.filter((skill) => {
      const normalized = normalizePhrase(skill);
      return resumeTech.has(normalized) || tokenize(skill).some((token) => resumeKeywords.has(token));
    })
  ).slice(0, 6);
  const requirementMatches = buildEvidenceMatches(
    company.requirements,
    resumeKeywords,
    resumeTech,
    entries,
    company
  ).slice(0, 4);
  const preferredMatches = buildEvidenceMatches(
    company.preferredSkills,
    resumeKeywords,
    resumeTech,
    entries,
    company
  ).slice(0, 3);

  const missingTech = unique(
    company.techStack.filter((skill) => !matchedSkills.includes(skill))
  ).slice(0, 4);
  const missingRequirements = company.requirements
    .filter((item) => {
      const anchors = findTechAnchors(item, company);
      if (anchors.length > 0) {
        return anchors.some((skill) => !hasSkillEvidence(skill, resumeKeywords, resumeTech));
      }

      return getMeaningfulTokens(item).every((token) => !resumeKeywords.has(token));
    })
    .slice(0, 3);
  const missingPreferred = company.preferredSkills
    .filter((item) => {
      const anchors = findTechAnchors(item, company);
      if (anchors.length > 0) {
        return anchors.some((skill) => !hasSkillEvidence(skill, resumeKeywords, resumeTech));
      }

      return getMeaningfulTokens(item).every((token) => !resumeKeywords.has(token));
    })
    .slice(0, 2);

  const highlightCandidates = unique([
    ...roleOverlap,
    ...matchedSkills,
    ...requirementMatches.map((item) => item.target),
    ...preferredMatches.map((item) => item.target)
  ]).slice(0, 8);

  const keywordCandidates = unique([
    ...roleOverlap,
    ...matchedSkills,
    ...requirementMatches.flatMap((item) => tokenize(item.target)),
    ...preferredMatches.flatMap((item) => tokenize(item.target))
  ]).slice(0, 12);

  return {
    roleOverlap,
    matchedSkills,
    requirementMatches,
    preferredMatches,
    gapCandidates: unique([...missingTech, ...missingRequirements, ...missingPreferred]).slice(0, 6),
    highlightCandidates,
    keywordCandidates
  };
}

export function buildMatchInsights(resume: Resume, company: Company): MatchInsights {
  const guidance = buildIntroGuidance(resume, company);
  const highlights: string[] = [];
  const gaps: string[] = [];

  if (guidance.roleOverlap.length > 0) {
    highlights.push(`희망 직무와 공고 직무에서 ${guidance.roleOverlap.join(", ")} 키워드가 겹칩니다.`);
  }

  if (guidance.matchedSkills.length > 0) {
    highlights.push(`공고 기술 스택 중 ${guidance.matchedSkills.join(", ")}가 이력서에서 확인됩니다.`);
  }

  guidance.requirementMatches.forEach((item) => {
    highlights.push(`요구사항 '${item.target}'의 근거: ${item.evidence.join(" / ")}`);
  });

  guidance.preferredMatches.forEach((item) => {
    highlights.push(`우대사항 '${item.target}'의 근거: ${item.evidence.join(" / ")}`);
  });

  guidance.gapCandidates.forEach((item) => {
    gaps.push(`근거 보완 필요: ${item}`);
  });

  return {
    highlights:
      highlights.length > 0 ? highlights.slice(0, 5) : ["현재 데이터 기준으로는 강한 매칭 근거가 적어, 수동 검토가 필요합니다."],
    gaps:
      gaps.length > 0
        ? gaps
        : ["확인된 큰 공백은 없지만, 공고 문구와 표현 톤을 더 맞추면 결과가 좋아집니다."],
    keywords: guidance.keywordCandidates
  };
}

export function buildIntroSkillInput(resume: Resume, company: Company): string {
  const guidance = buildIntroGuidance(resume, company);

  return [
    "output/resume.json 내용:",
    JSON.stringify(resume, null, 2),
    "",
    "output/company.json 내용:",
    JSON.stringify(company, null, 2),
    "",
    "[분석 힌트]",
    JSON.stringify(guidance, null, 2),
    "",
    "[출력 제약]",
    "- fitReasons에는 requirementMatches 또는 preferredMatches에 있는 근거를 우선 사용합니다.",
    "- matchedSkills에는 분석 힌트의 matchedSkills 범위를 넘지 않습니다.",
    "- gapNotes에는 gapCandidates 중 실제로 공고에서 중요한 항목만 선택합니다."
  ].join("\n");
}
