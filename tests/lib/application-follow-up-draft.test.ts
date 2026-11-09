import { describe, expect, it } from "vitest";

import { upsertApplicationFollowUpDraft } from "@/entities/application/model/follow-up-draft";
import type { ApplicationFollowUpDraft } from "@/entities/application/model/follow-up-draft";

function createDraft(
  occasion: ApplicationFollowUpDraft["occasion"],
  subject: string
): ApplicationFollowUpDraft {
  return {
    occasion,
    subject,
    body: "정중한 후속 메일 본문입니다.",
    generatedAt: "2026-11-09T00:00:00.000Z"
  };
}

describe("application follow-up drafts", () => {
  it("keeps one editable draft per occasion and replaces only the matching occasion", () => {
    const applicationThanks = createDraft("application-thanks", "지원 확인 메일");
    const interviewThanks = createDraft("interview-thanks", "면접 감사 메일");

    expect(
      upsertApplicationFollowUpDraft([applicationThanks], interviewThanks)
    ).toEqual([applicationThanks, interviewThanks]);
    expect(
      upsertApplicationFollowUpDraft([applicationThanks, interviewThanks], {
        ...interviewThanks,
        subject: "수정된 면접 감사 메일"
      })
    ).toEqual([applicationThanks, { ...interviewThanks, subject: "수정된 면접 감사 메일" }]);
  });
});
