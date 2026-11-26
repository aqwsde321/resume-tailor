import {
  splitTailoringLines,
  type ResumeTailoringEvidence,
  type ResumeTailoringRequirementMatch,
  type ResumeTailoringTarget,
  type TailoringLineCitation,
} from "@/entities/resume/model/resume-tailoring";
import styles from "./tailoring-line-evidence.module.css";

const targetLabels = {
  required: "필수 자격",
  preferred: "우대 요건",
  responsibilities: "주요 업무",
  domain: "제품·산업 맥락",
};

const matchLabels = {
  direct: "직접 경험",
  transferable: "전이 가능한 경험",
  adjacent: "관련 경험",
  gap: "추가 확인 필요",
};

export function TailoringLineEvidence({ text, citations, evidence, targets, matches }: {
  text: string;
  citations: TailoringLineCitation[];
  evidence: ReadonlyMap<string, ResumeTailoringEvidence>;
  targets: ReadonlyMap<string, ResumeTailoringTarget>;
  matches: ReadonlyMap<string, ResumeTailoringRequirementMatch>;
}) {
  return <div className={styles.lines}>
    {splitTailoringLines(text).map((line, index) => {
      const citation = citations[index];
      if (!citation) return <p key={index}>{line}</p>;
      return <details className={styles.line} key={index}>
        <summary>{line.replace(/^[-*+•]\s+/, "")}</summary>
        <div className={styles.sources}>
          <h4>공고 요건</h4>
          {citation.requirementIds.length === 0 && <p>직접 연결한 공고 요건이 없습니다.</p>}
          {citation.requirementIds.map((id) => {
            const target = targets.get(id);
            const match = matches.get(id);
            return <div key={id}>
              <strong>{target ? `${targetLabels[target.type]} · ${target.text}` : "공고 요건을 찾지 못했습니다."}</strong>
              {match && <p>{matchLabels[match.matchType]} · {match.reason}</p>}
            </div>;
          })}
          <h4>원본 경험</h4>
          {citation.evidenceIds.map((id) => <blockquote key={id}>
            <strong>{evidence.get(id)?.title ?? "원본 근거"}</strong>
            <p>{evidence.get(id)?.text ?? "원본 근거를 찾지 못했습니다."}</p>
          </blockquote>)}
        </div>
      </details>;
    })}
  </div>;
}
