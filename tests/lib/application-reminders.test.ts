import { describe, expect, it } from "vitest";

import { getApplicationReminderItems } from "@/entities/application/model/application-reminders";
import { createApplicationRecord, updateApplicationRecord } from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

function createRecord(id: string, date: string | null, nextAction: string) {
  const record = createApplicationRecord(
    {
      resume: createPdfResumeFixture(),
      company: companyFixture,
      intro: introFixture,
      resumeSnapshot: "resume snapshot",
      companySnapshot: "company snapshot",
      templateId: "modern",
      themeId: "forest",
      customAccentHex: ""
    },
    { id, now: "2026-11-01T00:00:00.000Z" }
  );

  return updateApplicationRecord(
    [record],
    id,
    { nextActionDate: date, nextAction },
    "2026-11-01T00:00:00.000Z"
  )[0]!;
}

describe("application reminders", () => {
  it("returns overdue, today, and near-term actions while omitting later or unscheduled records", () => {
    const records = [
      createRecord("upcoming", "2026-11-12", "과제 제출 확인"),
      createRecord("overdue", "2026-11-08", "결과 문의"),
      createRecord("later", "2026-11-17", "다음 주 할 일"),
      createRecord("today", "2026-11-09", "면접 준비"),
      createRecord("unscheduled", null, "날짜 미정")
    ];

    expect(getApplicationReminderItems(records, "2026-11-09", 3).map((item) => ({
      recordId: item.recordId,
      dueDate: item.dueDate,
      kind: item.kind,
      nextAction: item.nextAction
    }))).toEqual([
      { recordId: "overdue", dueDate: "2026-11-08", kind: "overdue", nextAction: "결과 문의" },
      { recordId: "today", dueDate: "2026-11-09", kind: "today", nextAction: "면접 준비" },
      { recordId: "upcoming", dueDate: "2026-11-12", kind: "upcoming", nextAction: "과제 제출 확인" }
    ]);
  });
});
