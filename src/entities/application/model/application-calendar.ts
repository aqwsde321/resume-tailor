import type { ApplicationRecord } from "@/entities/application/model/application-record";

export interface ApplicationCalendarEvent {
  id: string;
  recordId: string;
  date: string;
  companyName: string;
  jobTitle: string;
  kind: "applied" | "next-action";
  label: string;
}

export interface ApplicationCalendarDay {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
}

export function buildApplicationCalendarEvents(
  records: ApplicationRecord[]
): ApplicationCalendarEvent[] {
  const events: ApplicationCalendarEvent[] = [];

  for (const record of records) {
    if (record.appliedAt) {
      events.push({
        id: `${record.id}-applied`,
        recordId: record.id,
        date: record.appliedAt,
        companyName: record.companyName,
        jobTitle: record.jobTitle,
        kind: "applied",
        label: "지원일"
      });
    }

    if (record.nextActionDate) {
      events.push({
        id: `${record.id}-next-action`,
        recordId: record.id,
        date: record.nextActionDate,
        companyName: record.companyName,
        jobTitle: record.jobTitle,
        kind: "next-action",
        label: record.nextAction.trim() || "다음 할 일"
      });
    }
  }

  return events.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.kind === right.kind ? 0 : left.kind === "applied" ? -1 : 1) ||
      left.companyName.localeCompare(right.companyName, "ko-KR")
  );
}

export function buildApplicationCalendarGrid(
  year: number,
  monthIndex: number
): ApplicationCalendarDay[][] {
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new RangeError("달력을 만들 월이 올바르지 않아요.");
  }

  const firstDay = new Date(year, monthIndex, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex);

      return {
        date: toLocalDateKey(date),
        dayOfMonth: date.getDate(),
        inMonth: date.getMonth() === monthIndex
      };
    })
  );
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
