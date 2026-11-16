import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";
import { refreshCompanyJobDocument } from "@/entities/workspace/model/company-source-refresh";
function fixture() {
  const master = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "원본", "소개"), ResumeSchema.parse({ name: "예시", summary: "기존 이력서" })).master!;
  const old = newTextDocument("job", "원티드 공고", "주요업무API 개발자격요건Java 경험");
  old.source = { ...old.source, type: "url", url: "https://www.wanted.co.kr/wd/123456" };
  old.annotations = [{ id: crypto.randomUUID(), instruction: "이 경험을 강조", status: "pending", createdAt: new Date().toISOString(), anchor: { type: "text", start: 4, end: 10, quote: "API 개발" } }];
  const work = createCompanyWork(master, old);
  work.company = CompanySchema.parse({ companyName: "예시", jobTitle: "개발자" });
  work.companySourceText = old.text;
  work.resumeDocument = newTextDocument("resume", "회사 이력서", "고친 이력서");
  work.resumeDocument.annotations = [{ ...old.annotations[0], id: crypto.randomUUID(), anchor: { type: "document" } }];
  const next = newTextDocument("job", "새 공고", "포지션 상세\n주요업무\nAPI 개발\n자격요건\nJava 경험\n우대사항\nSQL 경험");
  next.source = { ...next.source, type: "url", url: old.source.url };
  return { work, next };
}
describe("회사 공고 다시 불러오기", () => {
  it("공고만 갱신하고 기존 이력서·이력서 댓글·버전은 유지한다", () => {
    const { work, next } = fixture();
    const result = refreshCompanyJobDocument(work, next);
    expect(result.resume).toBe(work.resume);
    expect(result.resumeDocument).toBe(work.resumeDocument);
    expect(result.versions).toBe(work.versions);
    expect(result.sourceResume).toBe(work.sourceResume);
    expect(result.document.id).toBe(work.document.id);
    expect(result.document.text).toBe(next.text);
    expect(result.companySourceText).not.toBe(result.document.text);
    expect(result.document.history.at(-1)?.text).toBe(work.document.text);
    const comment = result.document.annotations[0];
    expect(comment).toMatchObject({ id: work.document.annotations[0].id, instruction: "이 경험을 강조", status: "pending" });
    expect(comment.anchor).toMatchObject({ start: next.text.indexOf("API 개발"), quote: "API 개발" });
  });
  it("연결할 문장이 없어도 댓글을 삭제하지 않고 재연결 안내를 남긴다", () => {
    const { work, next } = fixture();
    next.text = "다른 내용입니다";
    const result = refreshCompanyJobDocument(work, next);
    expect(result.document.annotations[0]).toEqual(work.document.annotations[0]);
    expect(result.document.warnings?.join(" ")).toMatch(/댓글.*연결/);
  });
  it("다른 URL의 문서로 기존 공고를 바꾸지 않는다", () => {
    const { work, next } = fixture(); next.source.url = "https://www.wanted.co.kr/wd/999999";
    expect(() => refreshCompanyJobDocument(work, next)).toThrow(/URL/);
  });
});
