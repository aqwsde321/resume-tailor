import { getCompanyRequirementCoverage } from "@/entities/workspace/model/company-requirement-coverage";
import type { CompanyWork } from "@/entities/workspace/model/workspace";
import "../tailoring-review.css";

const labels = {
  direct: "직접 근거",
  related: "관련 경험",
  unchecked: "미확인",
  "known-gap": "해당 경험 없음",
};

export function CompanyRequirementCoverage({ work, actionsEnabled, onCheck, onMark }: {
  work: CompanyWork;
  actionsEnabled: boolean;
  onCheck: (text: string) => void;
  onMark: (text: string, marked: boolean) => void;
}) {
  const coverage = getCompanyRequirementCoverage(work);
  if (!coverage) return null;

  return <section className="company-requirement-coverage" aria-label="공고 요건 충족 현황">
    <h2>공고 요건 충족 현황</h2>
    {coverage.groups.map(({ type, rows, counts }) => <p key={type}>
      <strong>{type === "required" ? "필수" : "우대"} {rows.length}개</strong>
      {rows.length > 0 && <> · {labels.direct} {counts.direct}개 · {labels.related} {counts.related}개 · {labels.unchecked} {counts.unchecked}개{counts["known-gap"] > 0 && <> · {labels["known-gap"]} {counts["known-gap"]}개</>}</>}
    </p>)}
    {coverage.groups.some(({ rows }) => rows.length) && <details className="tailoring-requirements">
      <summary>공고 요건과 경험 연결</summary>
      <p>{coverage.hasAssessment ? "최근 맞춤 제안에서 사용한 이력서 근거입니다." : "맞춤 제안을 받으면 요건별 이력서 근거를 확인할 수 있습니다."}</p>
      {coverage.groups.map(({ type, rows }) => rows.length > 0 && <section key={type} aria-label={type === "required" ? "필수 요건" : "우대 요건"}>
        <h3>{type === "required" ? "필수 요건" : "우대 요건"}</h3>
        {rows.map(({ id, text, status, match, evidence }) => {
          const labelId = `coverage-${id}`;
          return <div className="tailoring-requirement" key={id}>
            <span className="tailoring-match-label" data-match={status === "unchecked" ? "gap" : status === "related" ? "adjacent" : status}>
              {status === "related" && match?.matchType === "transferable" ? "전이 가능한 경험" : labels[status]}
            </span>
            <strong id={labelId}>{text}</strong>
            {match && <p>{match.reason}</p>}
            {evidence.length > 0 && <details><summary>연결한 원본 근거 {evidence.length}개</summary>
              {evidence.map((item) => <blockquote key={item.id}><strong>{item.title}</strong><p>{item.text}</p></blockquote>)}
            </details>}
            {status !== "direct" && <div className="tailoring-requirement-actions">
              {status !== "known-gap" && <button type="button" aria-describedby={labelId} disabled={!actionsEnabled} onClick={() => onCheck(text)}>이 경험 확인하기</button>}
              {status !== "related" && <button type="button" aria-describedby={labelId} disabled={!actionsEnabled} onClick={() => onMark(text, status !== "known-gap")}>
                {status === "known-gap" ? "기록 취소" : labels["known-gap"]}
              </button>}
            </div>}
          </div>;
        })}
      </section>)}
    </details>}
  </section>;
}
