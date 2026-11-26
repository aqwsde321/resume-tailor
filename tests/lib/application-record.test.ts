import { describe, expect, it } from "vitest";

import {
  buildApplicationDashboard,
  createApplicationSnapshot,
  createApplicationRecord,
  createSubmittedApplicationRecord,
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
  it("선택한 PDF와 생성 시점 자료를 고정하고 지원일과 지원 완료 상태를 기록한다", () => {
    const input = createInput();
    const snapshot = createApplicationSnapshot(input);
    const now = new Date(2026, 10, 9, 12).toISOString();
    const record = createSubmittedApplicationRecord({
      company: { ...input.company, companyName: "나중에 수정된 회사명" },
      companyWorkId: "company-work",
      artifact: { id: "file-1", name: "실제 제출본.pdf", createdAt: "2026-11-08T06:00:00.000Z", snapshot },
    }, { id: "submitted", now });

    expect(record).toMatchObject({
      status: "applied",
      appliedAt: "2026-11-09",
      companyName: input.company.companyName,
      pdfFileName: "실제 제출본.pdf",
      submission: { companyWorkId: "company-work", artifactId: "file-1", exportedAt: "2026-11-08T06:00:00.000Z" },
      snapshot,
    });
    expect(record.statusHistory).toEqual([{ status: "applied", changedAt: now }]);
    expect(updateApplicationRecord([record], record.id, { status: "interviewing" })[0]).toMatchObject({
      pdfFileName: record.pdfFileName, submission: record.submission, snapshot,
    });
  });

  it("기존 PDF를 고를 때 현재 이력서를 제출 당시 자료로 저장하지 않는다", () => {
    const record = createSubmittedApplicationRecord({
      company: companyFixture,
      companyWorkId: "company-work",
      artifact: { id: "old-file", name: "보관본.pdf", createdAt: "2026-11-08T06:00:00.000Z" },
    });
    expect(record.snapshot).toBeNull();
    expect(filterApplicationRecords([record], "Beta")).toEqual([record]);
  });

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
      followUpDrafts: [],
      outcomeReview: null,
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
    expect(record.snapshot!.resume.techStack).not.toContain("Changed after save");
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
    delete legacyRecord.followUpDrafts;
    delete legacyRecord.outcomeReview;

    expect(normalizeApplicationRecords([legacyRecord])[0]).toMatchObject({
      nextAction: "",
      nextActionDate: null,
      appliedAt: null,
      statusHistory: [{ status: "preparing", changedAt: record.updatedAt }],
      interviewPrep: null,
      followUpDrafts: [],
      outcomeReview: null
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
    const rejected = {
      ...closedAfterInterview,
      outcomeReview: {
        outcome: "rejected" as const,
        lastStage: "interview" as const,
        feedback: "운영 경험을 더 구체적으로 설명해 달라는 피드백",
        reflection: "성과를 먼저 요약한 뒤 문제 해결 과정을 설명하기"
      }
    };
    const alpha = {
      ...createRecord(),
      id: "alpha",
      companyName: "Alpha Labs",
      outcomeReview: {
        outcome: "offer" as const,
        lastStage: "final-interview" as const,
        feedback: "",
        reflection: ""
      }
    };

    const dashboard = buildApplicationDashboard([
      preparing,
      applied,
      interviewing,
      rejected,
      alpha
    ]);

    expect(dashboard).toMatchObject({
      totalApplications: 5,
      submittedApplications: 3,
      interviewedApplications: 2,
      interviewConversionRate: 67,
      outcomeCounts: {
        pending: 3,
        offer: 1,
        rejected: 1,
        withdrawn: 0
      },
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
