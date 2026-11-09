import { describe, expect, it } from "vitest";

import {
  buildApplicationDashboard,
  createApplicationRecord,
  deleteApplicationRecord,
  filterApplicationRecords,
  getApplicationDeadlineStatus,
  normalizeApplicationRecords,
  sortApplicationRecords,
  updateApplicationRecord
} from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

function createInput() {
  return {
    resume: createPdfResumeFixture({
      pdfProfileImageDataUrl: "data:image/png;base64,c2FtcGxl",
      pdfProfileImageVisible: true
    }),
    company: companyFixture,
    intro: introFixture,
    resumeSnapshot: "resume-source-snapshot",
    companySnapshot: "company-source-snapshot",
    templateId: "modern" as const,
    themeId: "forest" as const,
    customAccentHex: ""
  };
}

function createRecord() {
  return createApplicationRecord(createInput(), { id: "application-1", now: "2026-11-09T00:00:00.000Z" });
}

describe("application records", () => {
  it("creates an immutable text snapshot and omits the duplicated profile image", () => {
    const input = createInput();
    const record = createApplicationRecord(input, { id: "application-1", now: "2026-11-09T00:00:00.000Z" });

    expect(record).toMatchObject({
      id: "application-1",
      companyName: companyFixture.companyName,
      jobTitle: companyFixture.jobTitle,
      status: "preparing",
      notes: "",
      interviewPrep: null,
      createdAt: "2026-11-09T00:00:00.000Z",
      updatedAt: "2026-11-09T00:00:00.000Z",
      pdfFileName: expect.stringContaining("Beta-Corp")
    });
    expect(record.snapshot).toMatchObject({
      resumeSnapshot: "resume-source-snapshot",
      companySnapshot: "company-source-snapshot",
      templateId: "modern",
      themeId: "forest",
      resume: {
        name: input.resume.name,
        pdfProfileImageDataUrl: "",
        pdfProfileImageVisible: false
      }
    });

    input.resume.techStack.push("Changed after save");
    expect(record.snapshot.resume.techStack).not.toContain("Changed after save");
  });

  it("updates status and notes without changing the saved materials", () => {
    const record = createRecord();
    const updated = updateApplicationRecord(
      [record],
      record.id,
      { status: "interviewing", notes: "1차 면접 예정" },
      "2026-11-10T00:00:00.000Z"
    );

    expect(updated[0]).toMatchObject({
      status: "interviewing",
      notes: "1차 면접 예정",
      appliedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      statusHistory: [
        { status: "preparing", changedAt: record.createdAt },
        { status: "interviewing", changedAt: "2026-11-10T00:00:00.000Z" }
      ],
      updatedAt: "2026-11-10T00:00:00.000Z",
      snapshot: record.snapshot
    });
  });

  it("normalizes valid records and drops malformed saved entries", () => {
    const record = createRecord();

    expect(normalizeApplicationRecords([record, { id: "broken", status: "unknown" }])).toEqual([record]);
    expect(normalizeApplicationRecords(null)).toEqual([]);
  });

  it("adds default follow-up fields when loading records created before scheduling existed", () => {
    const record = createRecord();
    const legacyRecord: Record<string, unknown> = { ...record };
    delete legacyRecord.nextAction;
    delete legacyRecord.nextActionDate;
    delete legacyRecord.appliedAt;
    delete legacyRecord.statusHistory;
    delete legacyRecord.interviewPrep;

    expect(normalizeApplicationRecords([legacyRecord])[0]).toMatchObject({
      nextAction: "",
      nextActionDate: null,
      appliedAt: null,
      statusHistory: [{ status: "preparing", changedAt: record.updatedAt }],
      interviewPrep: null
    });
  });

  it("deletes a selected record and leaves other records intact", () => {
    const first = createRecord();
    const second = { ...createRecord(), id: "application-2" };

    expect(deleteApplicationRecord([first, second], first.id)).toEqual([second]);
  });

  it("searches company, job title, notes, and next actions before applying the status filter", () => {
    const beta = createRecord();
    const alpha = {
      ...createRecord(),
      id: "application-2",
      companyName: "Alpha Labs",
      jobTitle: "Backend Engineer",
      status: "applied" as const,
      notes: "Referral from a former teammate",
      nextAction: "Prepare the technical interview"
    };
    const records = [beta, alpha];

    expect(filterApplicationRecords(records, "BETA")).toEqual([beta]);
    expect(filterApplicationRecords(records, "former", "applied")).toEqual([alpha]);
    expect(filterApplicationRecords(records, "technical interview", "applied")).toEqual([alpha]);
    expect(filterApplicationRecords(records, "former", "preparing")).toEqual([]);
    expect(filterApplicationRecords(records, "", "all")).toEqual(records);
  });

  it("updates the next action and due date without changing the saved application snapshot", () => {
    const record = createRecord();
    const updated = updateApplicationRecord(
      [record],
      record.id,
      { nextAction: "결과 문의 메일", nextActionDate: "2026-11-15" },
      "2026-11-10T00:00:00.000Z"
    );

    expect(updated[0]).toMatchObject({
      nextAction: "결과 문의 메일",
      nextActionDate: "2026-11-15",
      updatedAt: "2026-11-10T00:00:00.000Z",
      snapshot: record.snapshot
    });
    expect(() =>
      updateApplicationRecord([record], record.id, { nextActionDate: "2026-02-30" })
    ).toThrow();
  });

  it("classifies deadlines and sorts dated follow-ups before records without a date", () => {
    const record = createRecord();
    const overdue = { ...record, id: "overdue", nextActionDate: "2026-11-08" };
    const today = { ...record, id: "today", nextActionDate: "2026-11-09" };
    const upcoming = { ...record, id: "upcoming", nextActionDate: "2026-11-12" };
    const unscheduled = { ...record, id: "unscheduled", nextActionDate: null };

    expect(getApplicationDeadlineStatus(null, "2026-11-09")).toBe("none");
    expect(getApplicationDeadlineStatus("2026-11-08", "2026-11-09")).toBe("overdue");
    expect(getApplicationDeadlineStatus("2026-11-09", "2026-11-09")).toBe("today");
    expect(getApplicationDeadlineStatus("2026-11-12", "2026-11-09")).toBe("upcoming");
    expect(
      sortApplicationRecords([unscheduled, upcoming, today, overdue], "due-date").map(
        (item) => item.id
      )
    ).toEqual(["overdue", "today", "upcoming", "unscheduled"]);
  });

  it("summarizes application volume, interview conversion, and company results", () => {
    const preparing = createRecord();
    const applied = updateApplicationRecord(
      [createApplicationRecord(createInput(), { id: "applied", now: "2026-11-10T00:00:00.000Z" })],
      "applied",
      { status: "applied" },
      "2026-11-11T00:00:00.000Z"
    )[0]!;
    const interviewing = updateApplicationRecord(
      [createApplicationRecord(createInput(), { id: "interviewing", now: "2026-11-10T00:00:00.000Z" })],
      "interviewing",
      { status: "interviewing" },
      "2026-11-12T00:00:00.000Z"
    )[0]!;
    const closedAfterInterview = updateApplicationRecord(
      [interviewing],
      "interviewing",
      { status: "closed" },
      "2026-11-13T00:00:00.000Z"
    )[0]!;
    const alpha = { ...createRecord(), id: "alpha", companyName: "Alpha Labs" };

    const dashboard = buildApplicationDashboard([
      preparing,
      applied,
      interviewing,
      closedAfterInterview,
      alpha
    ]);

    expect(dashboard).toMatchObject({
      totalApplications: 5,
      submittedApplications: 3,
      interviewedApplications: 2,
      interviewConversionRate: 67,
      statusCounts: {
        preparing: 2,
        applied: 1,
        interviewing: 1,
        closed: 1
      },
      companies: [
        {
          companyName: "Beta Corp",
          totalApplications: 4,
          submittedApplications: 3,
          interviewedApplications: 2,
          closedApplications: 1
        },
        {
          companyName: "Alpha Labs",
          totalApplications: 1,
          submittedApplications: 0,
          interviewedApplications: 0,
          closedApplications: 0
        }
      ]
    });
  });
});
