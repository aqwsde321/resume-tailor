import { describe, expect, it } from "vitest";
import { buildApplicationMailto, createApplicationEmailDraft, findApplicationRecipient } from "@/entities/application/model/application-email";
import { CompanySchema } from "@/shared/lib/schemas";

describe("최초 지원 메일", () => {
  it("공고에 지원 주소가 한 곳으로 명시된 경우만 받는 사람을 채운다", () => {
    expect(findApplicationRecipient("일반 문의 help@example.com\n지원 이메일: jobs@example.com")).toBe("jobs@example.com");
    expect(findApplicationRecipient("문의 support@example.com\n팀 people@example.com")).toBe("");
    expect(findApplicationRecipient("지원 이메일: jobs@example.com 또는 team@example.com")).toBe("");
    expect(findApplicationRecipient("Send your resume to apply@example.com.")).toBe("apply@example.com");
  });

  it("지원자·회사·직무를 사용하고 공고에서 확인 못한 수신자는 비워 둔다", () => {
    const company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "서버 개발자" });
    const draft = createApplicationEmailDraft(company, "김개발", "온라인 지원", "example-id");
    expect(draft.recipient).toBe("");
    expect(draft.subject).toContain("서버 개발자");
    expect(draft.body).toContain("예시 회사");
    expect(draft.body).toContain("김개발");
    expect(draft.artifactId).toBe("example-id");
  });

  it("제목과 본문을 안전하게 인코딩하고 주소나 제목에 추가 헤더가 있으면 링크를 만들지 않는다", () => {
    const draft = { recipient: "jobs+dev@example.com", subject: "서버 개발자 & 지원", body: "안녕하세요.\n이력서를 첨부합니다." };
    const mailto = buildApplicationMailto(draft);
    expect(mailto).toContain("mailto:jobs%2Bdev@example.com?");
    const params = new URLSearchParams(mailto?.split("?")[1]);
    expect(params.get("subject")).toBe(draft.subject);
    expect(params.get("body")).toBe("안녕하세요.\r\n이력서를 첨부합니다.");
    expect(buildApplicationMailto({ ...draft, recipient: "a@b.com?bcc=other@example.com" })).toBeNull();
    expect(buildApplicationMailto({ ...draft, subject: "제목\nBcc: other@example.com" })).toBeNull();
  });
});
