import type { ApplicationRecord } from "@/entities/application/model/application-record";

export type ApplicationReminderKind = "overdue" | "today" | "upcoming";

export interface ApplicationReminderItem {
  id: string;
  recordId: string;
  companyName: string;
  jobTitle: string;
  nextAction: string;
  dueDate: string;
  kind: ApplicationReminderKind;
}

export function getApplicationReminderItems(
  records: ApplicationRecord[],
  today = getLocalDateKey(new Date()),
  daysAhead = 7
): ApplicationReminderItem[] {
  if (!Number.isInteger(daysAhead) || daysAhead < 0) {
    throw new RangeError("알림 기간은 0일 이상의 정수여야 해요.");
  }

  const lastUpcomingDate = shiftLocalDateKey(today, daysAhead);

  return records
    .flatMap((record) => {
      if (!record.nextActionDate || record.nextActionDate > lastUpcomingDate) {
        return [];
      }

      return [{
        id: record.id,
        recordId: record.id,
        companyName: record.companyName,
        jobTitle: record.jobTitle,
        nextAction: record.nextAction,
        dueDate: record.nextActionDate,
        kind:
          record.nextActionDate < today
            ? "overdue" as const
            : record.nextActionDate === today
              ? "today" as const
              : "upcoming" as const
      }];
    })
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        left.companyName.localeCompare(right.companyName, "ko-KR") ||
        left.id.localeCompare(right.id)
    );
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftLocalDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}
