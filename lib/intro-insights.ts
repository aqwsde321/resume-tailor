import type { Company, Intro, Resume } from "@/lib/types";
import type { IntroTone } from "@/lib/types";
import { formatIntroToneLabel } from "@/lib/intro-tone";

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
  priorityScore: number;
  priorityReason: string;
};

type WritingAnchor = {
  type: "requirement" | "preferred";
  target: string;
  evidence: string[];
  priorityScore: number;
  priorityReason: string;
};

export type IntroGuidance = {
  roleOverlap: string[];
  matchedSkills: string[];
  requirementMatches: EvidenceMatch[];
  preferredMatches: EvidenceMatch[];
  writingAnchors: WritingAnchor[];
  gapCandidates: string[];
  highlightCandidates: string[];
  keywordCandidates: string[];
};

const EVIDENCE_PRIORITY: Record<string, number> = {
  achievement: 6,
  project: 5,
  experience: 4,
  strength: 3,
  summary: 2,
  desiredPosition: 1
};

export type MatchInsights = {
  highlights: string[];
  gaps: string[];
  opportunities: string[];
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

function normalizeList(items: string[], maxLength: number): string[] {
  return unique(
    items
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
  ).slice(0, maxLength);
}

function buildEvidenceEntries(resume: Resume): EvidenceEntry[] {
  const entries: EvidenceEntry[] = [];

  // 이력서 전체를 "공고 요구사항과 연결할 수 있는 근거 조각" 단위로 평탄화한다.
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

function stripEvidenceLabel(evidence: string): string {
  return evidence.replace(/^(요약|희망직무|강점|성과|경력|프로젝트):\s*/u, "").trim();
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
        score: unique(overlap).length,
        priority: EVIDENCE_PRIORITY[entry.label] ?? 0
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.priority - left.priority);

  return unique(scored.slice(0, limit).map((item) => formatEvidence(item.entry)));
}

function countSharedTokens(tokens: string[], text: string): number {
  const textTokens = new Set(getMeaningfulTokens(text));
  return unique(tokens).filter((token) => textTokens.has(token)).length;
}

function countEvidenceBonus(evidence: string[]): number {
  let score = evidence.length * 2;

  if (evidence.some((item) => item.startsWith("프로젝트:"))) {
    score += 6;
  }

  if (evidence.some((item) => item.startsWith("경력:"))) {
    score += 5;
  }

  if (evidence.some((item) => item.startsWith("성과:"))) {
    score += 4;
  }

  if (evidence.some((item) => item.startsWith("강점:"))) {
    score += 2;
  }

  return score;
}

function buildPriorityReason(
  type: "requirement" | "preferred",
  index: number,
  anchorMatched: string[],
  evidence: string[]
): string {
  const reasons: string[] = [];

  reasons.push(type === "requirement" ? "필수 요건" : "우대 조건");

  if (anchorMatched.length > 0) {
    reasons.push(`기술 스택 ${anchorMatched.join(", ")}와 직접 연결`);
  }

  if (evidence.some((item) => item.startsWith("프로젝트:"))) {
    reasons.push("프로젝트 근거 확인");
  } else if (evidence.some((item) => item.startsWith("경력:"))) {
    reasons.push("경력 근거 확인");
  } else if (evidence.length > 0) {
    reasons.push("이력서 근거 확인");
  }

  if (index === 0) {
    reasons.push("상단 요구사항");
  }

  return reasons.slice(0, 3).join(", ");
}

function scoreEvidenceMatch(
  target: string,
  type: "requirement" | "preferred",
  index: number,
  anchorMatched: string[],
  matchedSignalCount: number,
  evidence: string[],
  company: Company
): number {
  const targetTokens = getMeaningfulTokens(target);
  const baseScore = type === "requirement" ? 60 : 30;
  const orderScore = Math.max(0, 16 - index * 3);
  const anchorScore = anchorMatched.length * 8;
  const signalScore = matchedSignalCount * 4;
  const titleScore = countSharedTokens(targetTokens, company.jobTitle) * 3;
  const descriptionScore = countSharedTokens(targetTokens, company.jobDescription) * 2;
  const evidenceScore = countEvidenceBonus(evidence);

  return baseScore + orderScore + anchorScore + signalScore + titleScore + descriptionScore + evidenceScore;
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

function canonicalizeSkill(skill: string, allowedSkills: string[]): string | null {
  const normalizedSkill = normalizePhrase(skill);
  const skillTokens = tokenize(skill);

  for (const allowedSkill of allowedSkills) {
    const normalizedAllowed = normalizePhrase(allowedSkill);
    const allowedTokens = tokenize(allowedSkill);

    if (
      normalizedSkill === normalizedAllowed ||
      normalizedSkill.includes(normalizedAllowed) ||
      normalizedAllowed.includes(normalizedSkill)
    ) {
      return allowedSkill;
    }

    if (
      skillTokens.length > 0 &&
      allowedTokens.length > 0 &&
      (skillTokens.every((token) => allowedTokens.includes(token)) ||
        allowedTokens.every((token) => skillTokens.includes(token)))
    ) {
      return allowedSkill;
    }
  }

  return null;
}

function referencesTarget(text: string, target: string): boolean {
  const normalizedText = normalizePhrase(text);
  const normalizedTarget = normalizePhrase(target);

  if (!normalizedText || !normalizedTarget) {
    return false;
  }

  if (normalizedText.includes(normalizedTarget) || normalizedTarget.includes(normalizedText)) {
    return true;
  }

  const textTokens = tokenize(text);
  const targetTokens = getMeaningfulTokens(target);

  if (targetTokens.length === 0) {
    return false;
  }

  return targetTokens.some((token) => textTokens.includes(token) || normalizedText.includes(token));
}

function buildEvidenceMatches(
  items: string[],
  type: "requirement" | "preferred",
  resumeKeywords: Set<string>,
  resumeTech: Set<string>,
  entries: EvidenceEntry[],
  company: Company
): EvidenceMatch[] {
  return items
    .map((target, index) => {
      // 기술 스택 앵커가 있으면 그쪽을 우선 보고, 없으면 일반 키워드 겹침으로 근거를 찾는다.
      const anchors = findTechAnchors(target, company);
      const anchorMatched = anchors.filter((skill) => hasSkillEvidence(skill, resumeKeywords, resumeTech));
      const meaningfulTokens = getMeaningfulTokens(target);
      const fallbackTokens = meaningfulTokens.filter((token) => resumeKeywords.has(token));
      const evidenceTokens = anchorMatched.length > 0 ? anchorMatched.flatMap(tokenize) : fallbackTokens;
      const evidence = findEvidence(entries, unique(evidenceTokens));
      const priorityScore = scoreEvidenceMatch(
        target,
        type,
        index,
        anchorMatched,
        unique(evidenceTokens).length,
        evidence,
        company
      );
      const priorityReason = buildPriorityReason(type, index, anchorMatched, evidence);

      return {
        target,
        evidence,
        priorityScore,
        priorityReason
      };
    })
    .filter((item) => item.evidence.length > 0)
    .sort((left, right) => right.priorityScore - left.priorityScore || right.evidence.length - left.evidence.length);
}

function buildWritingAnchors(
  requirementMatches: EvidenceMatch[],
  preferredMatches: EvidenceMatch[]
): WritingAnchor[] {
  return [
    ...requirementMatches.map((item) => ({
      type: "requirement" as const,
      target: item.target,
      evidence: item.evidence,
      priorityScore: item.priorityScore,
      priorityReason: item.priorityReason
    })),
    ...preferredMatches.map((item) => ({
      type: "preferred" as const,
      target: item.target,
      evidence: item.evidence,
      priorityScore: item.priorityScore,
      priorityReason: item.priorityReason
    }))
  ]
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 5);
}

function formatPriorityWritingAnchors(writingAnchors: WritingAnchor[]): string[] {
  if (writingAnchors.length === 0) {
    return [
      "- 직접 연결 가능한 우선 요건이 약하면, 이력서의 프로젝트와 경력 근거를 중심으로만 과장 없이 작성합니다."
    ];
  }

  return writingAnchors.slice(0, 3).flatMap((item, index) => [
    `${index + 1}. ${index === 0 ? "최우선" : "우선"} ${item.type === "requirement" ? "필수 요건" : "우대 조건"}: ${item.target}`,
    `   - 연결 근거: ${item.evidence.join(" / ")}`,
    `   - 우선 이유: ${item.priorityReason}`
  ]);
}

function formatWritingAnchors(writingAnchors: WritingAnchor[]): string[] {
  if (writingAnchors.length === 0) {
    return [
      "- 직접 연결 가능한 필수/우대 근거가 약하면, 이력서 summary와 주요 프로젝트를 기반으로만 과장 없이 작성합니다."
    ];
  }

  return writingAnchors.flatMap((item, index) => [
    `${index + 1}. ${item.type === "requirement" ? "필수 요건" : "우대 조건"}: ${item.target}`,
    `   - 내 근거: ${item.evidence.join(" / ")}`,
    `   - 우선 이유: ${item.priorityReason}`,
    `   - 작성 방식: 위 요건을 내 경험·성과·강점 중 하나와 직접 연결해 한 문장 이상에 녹입니다.`
  ]);
}

function introMentionsAnchor(text: string, anchor: WritingAnchor): boolean {
  return referencesTarget(text, anchor.target);
}

function buildMissingButRelevantSuggestions(
  writingAnchors: WritingAnchor[],
  intro: Pick<Intro, "oneLineIntro" | "shortIntro" | "longIntro">
): string[] {
  const introBody = [intro.oneLineIntro, intro.shortIntro, intro.longIntro]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" ");

  if (!introBody) {
    return [];
  }

  return normalizeList(
    writingAnchors
      .filter((anchor) => !introMentionsAnchor(introBody, anchor))
      .map((anchor) => {
        const label = anchor.type === "requirement" ? "필수 요건" : "우대 조건";
        const evidence = anchor.evidence[0] ? stripEvidenceLabel(anchor.evidence[0]) : "";

        return evidence
          ? `${label} '${anchor.target}'은 ${evidence} 근거를 써서 한 문장 더 보강할 수 있습니다.`
          : `${label} '${anchor.target}'은 소개글에서 한 번 더 드러내면 좋습니다.`;
      }),
    3
  );
}

export function buildIntroGuidance(resume: Resume, company: Company): IntroGuidance {
  // 소개글 생성 전에 겹치는 강점, 직접 근거, 부족한 항목을 구조화해 프롬프트 힌트로 만든다.
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
    "requirement",
    resumeKeywords,
    resumeTech,
    entries,
    company
  ).slice(0, 4);
  const preferredMatches = buildEvidenceMatches(
    company.preferredSkills,
    "preferred",
    resumeKeywords,
    resumeTech,
    entries,
    company
  ).slice(0, 3);
  const writingAnchors = buildWritingAnchors(requirementMatches, preferredMatches);

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
    writingAnchors,
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
    opportunities: [],
    keywords: guidance.keywordCandidates
  };
}

function buildToneGuidance(tone: IntroTone): string[] {
  switch (tone) {
    case "confident":
      return [
        `- 이번 소개글 톤: ${formatIntroToneLabel(tone)}`,
        "- 성과와 강점을 분명하게 말하되, 과장하거나 단정적으로 쓰지 않습니다."
      ];
    case "collaborative":
      return [
        `- 이번 소개글 톤: ${formatIntroToneLabel(tone)}`,
        "- 협업, 조율, 커뮤니케이션 맥락을 자연스럽게 드러냅니다."
      ];
    case "problemSolving":
      return [
        `- 이번 소개글 톤: ${formatIntroToneLabel(tone)}`,
        "- 문제를 구조화하고 개선한 경험을 중심으로 문장을 전개합니다."
      ];
    default:
      return [
        `- 이번 소개글 톤: ${formatIntroToneLabel(tone)}`,
        "- 담백하고 사실 중심으로 쓰되, 불필요하게 꾸미지 않습니다."
      ];
  }
}

export function buildIntroSkillInput(
  resume: Resume,
  company: Company,
  tone: IntroTone = "balanced"
): string {
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
    "[핵심 요건]",
    ...formatPriorityWritingAnchors(guidance.writingAnchors),
    "",
    "[작성 앵커]",
    ...formatWritingAnchors(guidance.writingAnchors),
    "",
    "[톤 가이드]",
    ...buildToneGuidance(tone),
    "",
    "[출력 제약]",
    "- oneLineIntro는 25~45자 안팎으로 작성합니다.",
    "- shortIntro는 120~220자, 2~4문장으로 작성합니다.",
    "- longIntro는 450~700자, 5~8문장으로 작성합니다.",
    "- longIntro는 shortIntro보다 정보량이 분명히 많아야 하며, 문장을 그대로 반복하지 않습니다.",
    "- [핵심 요건]의 최우선 필수 요건이 있으면 shortIntro 본문에 직접 반영합니다.",
    "- [핵심 요건]의 상위 필수 요건 2개까지는 longIntro 본문에서 근거와 함께 직접 연결합니다.",
    "- shortIntro와 longIntro에는 필수 요건 requirementMatches 상위 항목을 최소 1개 이상 자연스럽게 반영합니다.",
    "- preferredMatches에 직접 근거가 있으면 shortIntro 또는 longIntro 후반에 우대 조건을 1개 이상 반영합니다.",
    "- 각 연결은 '공고 요건 -> 내 경험/성과/강점 -> 입사 후 기여' 흐름이 드러나게 작성합니다.",
    "- 자기소개 문장은 resume.json의 프로젝트, 성과, 강점, 경력 설명을 재료로 삼고 요약 문장만 반복하지 않습니다.",
    "- fitReasons의 첫 항목은 가능하면 [핵심 요건]의 최우선 필수 요건을 기준으로 작성합니다.",
    "- fitReasons에는 requirementMatches 또는 preferredMatches에 있는 근거를 우선 사용합니다.",
    "- matchedSkills에는 분석 힌트의 matchedSkills 범위를 넘지 않습니다.",
    "- gapNotes에는 gapCandidates 중 실제로 공고에서 중요한 항목만 선택합니다.",
    "- missingButRelevant에는 근거는 있지만 소개글 본문에 아직 직접 드러나지 않은 필수/우대 요건만 담습니다.",
    "- missingButRelevant는 0~3개로 제한하고, 보완 제안 문장으로 작성합니다.",
    `- oneLineIntro, shortIntro, longIntro는 모두 '${formatIntroToneLabel(tone)}' 톤을 일관되게 유지합니다.`
  ].join("\n");
}

export function normalizeIntroWithGuidance(intro: Intro, resume: Resume, company: Company): Intro {
  const guidance = buildIntroGuidance(resume, company);
  const rawFitReasons = normalizeList(intro.fitReasons, 4);
  const rawGapNotes = normalizeList(intro.gapNotes, 3);
  const rawMissingButRelevant = normalizeList(intro.missingButRelevant, 3);
  const canonicalMatchedSkills = normalizeList(
    intro.matchedSkills
      .map((item) => canonicalizeSkill(item, guidance.matchedSkills))
      .filter((item): item is string => item !== null),
    6
  );

  const fitReferences = [
    ...guidance.matchedSkills,
    ...guidance.roleOverlap,
    ...guidance.requirementMatches.map((item) => item.target),
    ...guidance.preferredMatches.map((item) => item.target),
    ...guidance.requirementMatches.flatMap((item) => item.evidence),
    ...guidance.preferredMatches.flatMap((item) => item.evidence)
  ];
  const filteredFitReasons = rawFitReasons.filter((item) =>
    fitReferences.some((target) => referencesTarget(item, target))
  );
  const filteredGapNotes = rawGapNotes.filter((item) =>
    guidance.gapCandidates.some((target) => referencesTarget(item, target))
  );
  const availableMissingAnchors = guidance.writingAnchors.filter(
    (anchor) => !introMentionsAnchor(`${intro.oneLineIntro} ${intro.shortIntro} ${intro.longIntro}`, anchor)
  );
  const filteredMissingButRelevant = rawMissingButRelevant.filter((item) =>
    availableMissingAnchors.some(
      (anchor) =>
        referencesTarget(item, anchor.target) ||
        anchor.evidence.some((evidence) => referencesTarget(item, stripEvidenceLabel(evidence)))
    )
  );
  const computedMissingButRelevant = buildMissingButRelevantSuggestions(guidance.writingAnchors, intro);

  // 모델이 과하게 넓게 쓴 보조 필드는 실제 매칭 근거 범위 안으로 다시 제한한다.
  return {
    oneLineIntro: intro.oneLineIntro.trim(),
    shortIntro: intro.shortIntro.trim(),
    longIntro: intro.longIntro.trim() || intro.shortIntro.trim(),
    fitReasons: filteredFitReasons.length > 0 ? filteredFitReasons : rawFitReasons,
    matchedSkills:
      canonicalMatchedSkills.length > 0
        ? canonicalMatchedSkills
        : guidance.matchedSkills.slice(0, Math.min(4, guidance.matchedSkills.length)),
    gapNotes: filteredGapNotes,
    missingButRelevant:
      filteredMissingButRelevant.length > 0 ? filteredMissingButRelevant : computedMissingButRelevant
  };
}
