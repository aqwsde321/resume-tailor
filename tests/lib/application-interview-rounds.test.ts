import { describe, expect, it } from "vitest";
import { buildApplicationCalendarEvents } from "@/entities/application/model/application-calendar";
import { createInterviewRound, updateInterviewRound } from "@/entities/application/model/interview-rounds";
import { createApplicationRecord, normalizeApplicationRecord, updateApplicationRecord } from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

const record = createApplicationRecord({
  resume: createPdfResumeFixture(), company: companyFixture, intro: introFixture, resumeSnapshot: "이력서",
  companySnapshot: "공고", templateId: "modern", themeId: "forest", customAccentHex: "",
});

describe("지원 기록의 면접 차수", () => {
  it("이전 기록에 차수가 없어도 열고 차수별 체크리스트와 복기를 독립적으로 저장한다", () => {
    const legacy = normalizeApplicationRecord({ ...record, interviewRounds: undefined })!;
    expect(legacy.interviewRounds).toEqual([]);
    const first = createInterviewRound(legacy.interviewRounds);
    const second = createInterviewRound([first]);
    const rounds = updateInterviewRound([first, second], second.id, (round) => ({
      ...round, title: "실무진 면접", reflection: "DB 인덱스 질문", completed: true,
      checklist: round.checklist.map((item, index) => index === 0 ? { ...item, done: true } : item),
    }));
    expect(rounds[0]).toBe(first);
    expect(rounds[1]).toMatchObject({ number: 2, title: "실무진 면접", reflection: "DB 인덱스 질문", completed: true });
    expect(rounds[1].checklist.map(({ done }) => done)).toEqual([true, false, false]);
    const [saved] = updateApplicationRecord([legacy], legacy.id, { interviewRounds: rounds });
    expect(normalizeApplicationRecord(JSON.parse(JSON.stringify(saved)))?.interviewRounds).toEqual(rounds);
  });

  it("달력에 날짜가 있는 차수만 시간 순으로 표시하고 같은 지원의 기존 일정도 유지한다", () => {
    const first = createInterviewRound([]);
    const second = createInterviewRound([first]);
    const third = createInterviewRound([first, second]);
    const records = updateApplicationRecord([record], record.id, {
      appliedAt: "2026-11-10",
      nextAction: "결과 문의",
      nextActionDate: "2026-11-20",
      interviewRounds: [
        { ...first, date: "2026-11-19", time: "15:00" },
        { ...second, title: "기술 면접", date: "2026-11-19", time: "10:30" },
        third,
      ],
    });
    expect(buildApplicationCalendarEvents(records).map(({ kind, label, interviewRoundId }) => ({ kind, label, interviewRoundId }))).toEqual([
      { kind: "applied", label: "지원일", interviewRoundId: undefined },
      { kind: "interview", label: "10:30 기술 면접", interviewRoundId: second.id },
      { kind: "interview", label: "15:00 1차 면접", interviewRoundId: first.id },
      { kind: "next-action", label: "결과 문의", interviewRoundId: undefined },
    ]);
  });
});
