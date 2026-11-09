import { describe, expect, it } from "vitest";

import { groupApplicationRecordsByStatus } from "@/entities/application/model/application-board";
import { createApplicationRecord } from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

function createRecord(id: string, status: "preparing" | "applied" | "interviewing" | "closed") {
  return {
    ...createApplicationRecord(
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
      { id, now: "2026-11-09T00:00:00.000Z" }
    ),
    status
  };
}

describe("application status board", () => {
  it("returns every status column in workflow order, including empty columns", () => {
    const records = [
      createRecord("application-1", "interviewing"),
      createRecord("application-2", "preparing"),
      createRecord("application-3", "interviewing")
    ];

    expect(groupApplicationRecordsByStatus(records).map((column) => ({
      status: column.status,
      label: column.label,
      recordIds: column.records.map((record) => record.id)
    }))).toEqual([
      { status: "preparing", label: "준비 중", recordIds: ["application-2"] },
      { status: "applied", label: "지원 완료", recordIds: [] },
      { status: "interviewing", label: "면접 중", recordIds: ["application-1", "application-3"] },
      { status: "closed", label: "종료", recordIds: [] }
    ]);
  });
});
