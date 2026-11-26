"use client";

import { useMemo, useState } from "react";

import {
  buildApplicationCalendarEvents,
  buildApplicationCalendarGrid,
  type ApplicationCalendarEvent
} from "@/entities/application/model/application-calendar";
import type { ApplicationRecord } from "@/entities/application/model/application-record";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function ApplicationCalendarView({
  records,
  onSelectRecord
}: {
  records: ApplicationRecord[];
  onSelectRecord: (recordId: string, interviewRoundId?: string) => void;
}) {
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const weeks = useMemo(
    () => buildApplicationCalendarGrid(monthAnchor.getFullYear(), monthAnchor.getMonth()),
    [monthAnchor]
  );
  const events = useMemo(() => buildApplicationCalendarEvents(records), [records]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, ApplicationCalendarEvent[]>();
    for (const event of events) {
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    }
    return grouped;
  }, [events]);

  const shiftMonth = (amount: number) => {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const monthLabel = monthAnchor.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long"
  });

  return (
    <section className="card application-calendar" aria-labelledby="application-calendar-title">
      <header className="application-calendar-header">
        <div>
          <p className="card-kicker">지원과 후속 일정</p>
          <h2 id="application-calendar-title">지원 일정</h2>
        </div>
        <div className="application-calendar-navigation">
          <button type="button" className="nav-btn" aria-label="이전 달" onClick={() => shiftMonth(-1)}>
            이전 달
          </button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button type="button" className="nav-btn" aria-label="다음 달" onClick={() => shiftMonth(1)}>
            다음 달
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              const now = new Date();
              setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            이번 달
          </button>
        </div>
      </header>
      <p className="application-calendar-legend">
        지원일, 면접, 다음 할 일을 표시합니다. 일정 항목을 누르면 해당 지원 기록으로 이동합니다.
      </p>
      <div className="application-calendar-grid-wrap">
        <table className="application-calendar-table" aria-label={`${monthLabel} 지원 일정 달력`}>
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, weekIndex) => (
              <tr key={week[0]?.date ?? weekIndex}>
                {week.map((day) => {
                  const events = eventsByDate.get(day.date) ?? [];

                  return (
                    <td
                      key={day.date}
                      className={day.inMonth ? "" : "application-calendar-outside-month"}
                      aria-label={`${day.date}${events.length > 0 ? ` 일정 ${events.length}건` : ""}`}
                    >
                      <span className="application-calendar-day-number">{day.dayOfMonth}</span>
                      <div className="application-calendar-day-events">
                        {events.map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            className={`application-calendar-event event-${event.kind}`}
                            aria-label={`${event.companyName} · ${event.label}`}
                            title={`${event.companyName} · ${event.jobTitle} · ${event.label}`}
                            onClick={() => onSelectRecord(event.recordId, event.interviewRoundId)}
                          >
                            <strong>{event.companyName}</strong>
                            <span>{event.label}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length === 0 && (
        <p className="application-calendar-empty">아직 달력에 표시할 일정이 없습니다.</p>
      )}
    </section>
  );
}
