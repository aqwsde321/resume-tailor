import { buildResumeTailoringEvidence, splitTailoringLines, type ResumeTailoringPlan } from "./resume-tailoring";
import type { ConfirmedExperience } from "./confirmed-experience";
import type { Resume } from "@/shared/lib/types";

export interface TailoringClaimWarnings {
  numbers: string[];
  technologies: string[];
}

const commonTechnologies = [
  "Java", "JavaScript", "TypeScript", "Python", "Kotlin", "Swift", "Rust", "Go", "C++", "C#",
  "Spring", "Spring Boot", "Spring Framework", "JPA", "Hibernate", "Django", "FastAPI",
  "React", "React Native", "Angular", "Svelte", "Tailwind CSS", "Webpack", "Vite", "Redux",
  "SQL", "MySQL", "MariaDB", "Redis", "MongoDB", "DynamoDB", "Elasticsearch", "SQLite",
  "AWS", "AWS Lambda", "Amazon S3", "Azure", "GCP", "Docker", "Terraform", "Ansible",
  "Kafka", "RabbitMQ", "Git", "GitHub", "GitHub Actions", "Jenkins", "Linux",
  "Nginx", "Grafana", "Prometheus", "Figma", "GraphQL", "REST API", "gRPC", "Spark",
];
const technologyAliases = [
  ["Kubernetes", "K8s", "쿠버네티스"],
  ["Next.js", "NextJS"],
  ["Node.js", "NodeJS"],
  ["NestJS", "Nest.js"],
  ["Vue.js", "Vue", "VueJS"],
  ["PostgreSQL", "Postgres"],
  ["Go", "Golang"],
];

const quantities = /(?<![\da-z_])([+-]?\d+(?:,\d{3})*(?:\.\d+)?)(?:[^\S\r\n]*(%p|%|(?:ms|gb|mb|tb|s|x|percent|years?|months?|weeks?|days?|hours?|minutes?|seconds?|milliseconds?|times?|users?|requests?|items?)\b|건|명|개월|개|년|월|일|주|시간|분|초|배|원|회|대|점|곳|줄|만|억))?(?![\da-z_])/gi;
const unitAliases: Record<string, string> = {
  percent: "%",
  year: "년",
  month: "개월",
  week: "주",
  day: "일",
  hour: "시간",
  minute: "분",
  second: "초",
  millisecond: "ms",
  time: "회",
  x: "배",
  s: "초",
};

function uniqueClaims(claims: Iterable<readonly [string, string]>) {
  const unique = new Map<string, string>();
  for (const [key, display] of claims) {
    if (!unique.has(key)) unique.set(key, display);
  }
  return unique;
}

function numberClaims(text: string) {
  return uniqueClaims(Array.from(text.normalize("NFKC").matchAll(quantities), ([display, number, unit = ""]) => {
    const normalizedUnit = unit.toLowerCase().replace(/(?<=[a-z]{3})s$/, "");
    return [`${Number(number.replaceAll(",", ""))}:${unitAliases[normalizedUnit] ?? normalizedUnit}`, display];
  }));
}

function technologyMatcher(names: readonly string[]) {
  const key = (value: string) => value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
  const aliases = new Map(technologyAliases.flatMap(([primary, ...aliases]) =>
    [primary, ...aliases].map((name) => [key(name), key(primary)] as const)
  ));
  const terms = [...new Set([...aliases.keys(), ...names.map(key)].filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "[^\\S\\r\\n]+"));
  const pattern = new RegExp(`(?<![a-z0-9_.+#])(?:${terms.join("|")})(?![a-z0-9_+#]|\\.[a-z0-9])`, "gi");

  return (text: string) => uniqueClaims(Array.from(text.normalize("NFKC").matchAll(pattern))
    .filter(([name]) => name !== "go")
    .map(([name]) => [aliases.get(key(name)) ?? key(name), name]));
}

function unsupportedClaims(proposed: Map<string, string>, evidence: string[], readClaims: (text: string) => Map<string, string>) {
  const supported = new Set(evidence.flatMap((text) => [...readClaims(text).keys()]));
  return [...proposed].filter(([key]) => !supported.has(key)).map(([, display]) => display);
}

export function buildTailoringClaimWarnings(
  source: Resume,
  plan: ResumeTailoringPlan,
  jobTechnologies: readonly string[] = [],
  confirmedExperiences: readonly ConfirmedExperience[] = [],
) {
  const evidenceById = new Map(buildResumeTailoringEvidence(source, confirmedExperiences).map(({ id, text }) => [id, text]));
  const proposals = [
    { id: "headline", ...plan.headline },
    { id: "summary", ...plan.summary },
    ...[...plan.experience, ...plan.projects].map((item) => ({ id: item.sourceId, text: item.description, ...item })),
  ];
  const knownTechnologies = [
    ...commonTechnologies, ...jobTechnologies, ...source.techStack,
    ...source.projects.flatMap((item) => item.techStack),
    ...confirmedExperiences.flatMap(({ draft }) => draft.techStack),
  ];
  const warnings = new Map<string, TailoringClaimWarnings>();
  for (const { id, text, evidenceIds, lineCitations, technologies = [] } of proposals) {
    const technologyClaims = technologyMatcher([...knownTechnologies, ...technologies]);
    const lines = lineCitations
      ? splitTailoringLines(text).map((line, index) => ({ text: line, evidenceIds: lineCitations[index]?.evidenceIds ?? [] }))
      : [{ text, evidenceIds }];
    const numbers = new Set<string>();
    const unsupportedTechnologies = new Set<string>();
    for (const line of lines) {
      const evidence = line.evidenceIds.map((evidenceId) => evidenceById.get(evidenceId) ?? "");
      unsupportedClaims(numberClaims(line.text), evidence, numberClaims).forEach((value) => numbers.add(value));
      unsupportedClaims(technologyClaims(line.text), evidence, technologyClaims).forEach((value) => unsupportedTechnologies.add(value));
    }
    if (numbers.size || unsupportedTechnologies.size) {
      warnings.set(id, { numbers: [...numbers], technologies: [...unsupportedTechnologies] });
    }
  }
  return warnings;
}
