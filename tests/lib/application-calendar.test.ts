import { describe, expect, it } from "vitest";

import { buildApplicationCalendarEvents, buildApplicationCalendarGrid } from "@/entities/application/model/application-calendar";
import { createApplicationRecord, updateApplicationRecord } from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

function createRecord() {
  return createApplicationRecord(
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
    { id: "application-1", now: "2026-11-09T00:00:00.000Z" }
  );
}

describe("application calendar", () => {
  it("builds support and follow-up events in date order", () => {
    const record = createRecord();
    const datedRecord = updateApplicationRecord(
      [record],
      record.id,
      {
        status: "applied",
        appliedAt: "2026-11-10",
        nextAction: "면접 준비",
        nextActionDate: "2026-11-15"
      },
      "2026-11-10T00:00:00.000Z"
    )[0]!;

    expect(buildApplicationCalendarEvents([datedRecord])).toEqual([
      {
        id: "application-1-applied",
        recordId: "application-1",
        date: "2026-11-10",
        companyName: "Beta Corp",
        jobTitle: "Backend Engineer",
        kind: "applied",
        label: "지원일"
      },
      {
        id: "application-1-next-action",
        recordId: "application-1",
        date: "2026-11-15",
        companyName: "Beta Corp",
        jobTitle: "Backend Engineer",
        kind: "next-action",
        label: "면접 준비"
      }
    ]);
  });

  it("creates a Monday-first six-week grid with adjacent month dates", () => {
    const weeks = buildApplicationCalendarGrid(2026, 10);

    expect(weeks).toHaveLength(6);
    expect(weeks.flat()).toHaveLength(42);
    expect(weeks[0]?.[0]).toMatchObject({ date: "2026-10-26", dayOfMonth: 26, inMonth: false });
    expect(weeks[0]?.[6]).toMatchObject({ date: "2026-11-01", dayOfMonth: 1, inMonth: true });
    expect(weeks[5]?.[6]).toMatchObject({ date: "2026-12-06", dayOfMonth: 6, inMonth: false });
  });
});
