import { describe, expect, it } from "vitest";
import { findDuplicateCompanyPostings } from "@/entities/workspace/model/company-posting-duplicates";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";

const master = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "개발자"), ResumeSchema.parse({})).master!;
function posting(text: string, url?: string) {
  const document = newTextDocument("job", "공고", text);
  return url ? { ...document, source: { ...document.source, type: "url" as const, url } } : document;
}

describe("중복 공고 확인", () => {
  it("추적 값과 표시 위치는 무시하지만 공고 ID와 해시 라우트는 보존한다", () => {
    const first = createCompanyWork(master, posting("첫 번째 공고", "https://example.com/jobs?jobId=123&utm_source=board"));
    const exact = posting("변경된 공고", "https://example.com/jobs/?fbclid=abc&jobId=123#intro");
    expect(findDuplicateCompanyPostings(exact, [first])).toEqual([{ work: first, reason: "url" }]);
    expect(findDuplicateCompanyPostings(posting("다른 공고", "https://example.com/jobs?jobId=321"), [first])).toEqual([]);
    const routed = createCompanyWork(master, posting("첫 번째 공고", "https://example.com/careers#/jobs/1"));
    expect(findDuplicateCompanyPostings(posting("다른 공고", "https://example.com/careers#/jobs/2"), [routed])).toEqual([]);
  });

  it("PDF와 복사한 본문도 비교하고 동일 회사·직무의 유사 본문을 찾는다", () => {
    const original = "예시 회사 백엔드 개발자\n결제 승인 API 설계와 구현을 맡습니다. 서버 메트릭을 바탕으로 장애 원인을 분석합니다. 주기적인 배포 자동화를 함께 구성합니다.";
    const first = { ...createCompanyWork(master, posting(original)), company: CompanySchema.parse({ companyName: "예시 회사", jobTitle: "백엔드 개발자" }) };
    expect(findDuplicateCompanyPostings(posting(`# ${original.replaceAll("\n", "\r\n")}\n`), [first])).toEqual([{ work: first, reason: "text" }]);
    expect(findDuplicateCompanyPostings(posting(original.replace("주기적인", "안정적인")), [first])).toEqual([{ work: first, reason: "similar" }]);
    const unrelated = posting("예시 회사 백엔드 개발자\n광고 실시간 입찰 서비스를 만들고 검색 인덱스를 개선합니다.");
    expect(findDuplicateCompanyPostings(unrelated, [first])).toEqual([]);
  });

  it("검토하며 편집한 문서의 최초 공고 원문도 비교한다", () => {
    const text = "예시 회사 백엔드 개발자를 모집합니다. 주문 처리 API를 개발하고 운영합니다.";
    const first = createCompanyWork(master, posting(text));
    first.document.text = "직접 정리한 공고";
    expect(findDuplicateCompanyPostings(posting(text), [first])).toEqual([{ work: first, reason: "text" }]);
  });
});
