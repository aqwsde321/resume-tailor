import type { PdfAtsAudit } from "@/entities/pdf/model/ats-audit";

interface PdfAtsAuditPanelProps {
  audit: PdfAtsAudit;
}

function KeywordCoverage({
  label,
  coverage
}: {
  label: string;
  coverage: PdfAtsAudit["requiredTerms"];
}) {
  if (coverage.total === 0) {
    return null;
  }

  return (
    <div className="pdf-ats-coverage">
      <div className="pdf-ats-coverage-head">
        <strong>{label}</strong>
        <span>
          {coverage.matchedCount}/{coverage.total} 포함
        </span>
      </div>
      {coverage.matched.length > 0 && <p>포함: {coverage.matched.join(", ")}</p>}
      {coverage.missing.length > 0 && <p>찾지 못함: {coverage.missing.join(", ")}</p>}
      {coverage.total > coverage.matched.length + coverage.missing.length && (
        <p>나머지 키워드는 목록을 생략했어요.</p>
      )}
    </div>
  );
}

export function PdfAtsAuditPanel({ audit }: PdfAtsAuditPanelProps) {
  if (audit.status !== "checked") {
    return (
      <section className="pdf-ats-audit is-unavailable" aria-labelledby="pdf-ats-audit-title">
        <div>
          <p className="pdf-ats-audit-kicker">PDF 텍스트 검사</p>
          <h2 id="pdf-ats-audit-title">
            {audit.status === "unavailable" ? "검사를 건너뛰었어요" : "텍스트 검사에 실패했어요"}
          </h2>
          <p role="status" aria-live="polite">{audit.message}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pdf-ats-audit" aria-labelledby="pdf-ats-audit-title">
      <div className="pdf-ats-audit-head">
        <div>
          <p className="pdf-ats-audit-kicker">PDF 텍스트 검사</p>
          <h2 id="pdf-ats-audit-title">
            {audit.textCharacterCount > 0 ? "PDF 텍스트를 확인했어요" : "PDF에서 텍스트를 읽지 못했어요"}
          </h2>
          <p role="status" aria-live="polite">{audit.message}</p>
        </div>
        <span className="pdf-ats-audit-count">{audit.textCharacterCount.toLocaleString("ko-KR")}자 추출</span>
      </div>

      {audit.textCharacterCount > 0 && (
        <>
          <div className="pdf-ats-check-row">
            {audit.nameFound !== null && (
              <span className={audit.nameFound ? "is-found" : "is-missing"}>
                이름 {audit.nameFound ? "포함" : "누락"}
              </span>
            )}
            {audit.contacts.map((contact, index) => (
              <span className={contact.found ? "is-found" : "is-missing"} key={`${contact.label}-${index}`}>
                {contact.label} {contact.found ? "포함" : "누락"}
              </span>
            ))}
          </div>

          <div className="pdf-ats-coverage-grid">
            <KeywordCoverage label="필수 키워드" coverage={audit.requiredTerms} />
            <KeywordCoverage label="우대 키워드" coverage={audit.preferredTerms} />
          </div>

          {audit.textPreview && (
            <details className="pdf-ats-preview">
              <summary>PDF에서 추출한 텍스트 앞부분 보기</summary>
              <p>{audit.textPreview}</p>
            </details>
          )}
          <p className="pdf-ats-footnote">PDF 텍스트와 공고 키워드의 단순 대조 결과이며, ATS 심사 통과를 보장하지는 않아요.</p>
        </>
      )}
    </section>
  );
}
