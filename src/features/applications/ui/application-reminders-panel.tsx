"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getApplicationReminderItems,
  getLocalDateKey
} from "@/entities/application/model/application-reminders";
import type { ApplicationRecord } from "@/entities/application/model/application-record";

const REMINDER_KIND_LABELS = {
  overdue: "기한 지남",
  today: "오늘",
  upcoming: "예정"
} as const;

export function ApplicationRemindersPanel({
  records,
  onSelectRecord
}: {
  records: ApplicationRecord[];
  onSelectRecord: (recordId: string) => void;
}) {
  const [today, setToday] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const reminders = useMemo(
    () => (today ? getApplicationReminderItems(records, today) : []),
    [records, today]
  );
  const dueReminders = useMemo(
    () => reminders.filter((item) => item.kind === "overdue" || item.kind === "today"),
    [reminders]
  );

  useEffect(() => {
    const refreshCurrentDate = () => {
      setToday(getLocalDateKey(new Date()));
      setPermission("Notification" in window ? window.Notification.permission : "unsupported");
    };

    refreshCurrentDate();
    const intervalId = window.setInterval(refreshCurrentDate, 60_000);
    window.addEventListener("focus", refreshCurrentDate);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshCurrentDate);
    };
  }, []);

  useEffect(() => {
    if (permission !== "granted" || dueReminders.length === 0 || !today) {
      return;
    }

    const storageKey = `resume-tailor.application-reminder.${today}`;
    try {
      const previousIds = new Set(
        (window.localStorage.getItem(storageKey) ?? "").split(",").filter(Boolean)
      );
      const newReminders = dueReminders.filter((item) => !previousIds.has(item.id));
      if (newReminders.length === 0) {
        return;
      }

      const preview = newReminders
        .slice(0, 3)
        .map((item) => `${item.companyName}: ${item.nextAction.trim() || "예정된 할 일"}`)
        .join("\n");
      const extraCount = newReminders.length - 3;
      new window.Notification(`${newReminders.length}건의 지원 일정`, {
        body: `${preview}${extraCount > 0 ? `\n외 ${extraCount}건` : ""}`
      });
      window.localStorage.setItem(
        storageKey,
        [...previousIds, ...newReminders.map((item) => item.id)].join(",")
      );
    } catch {
      // 알림이나 브라우저 저장소를 사용할 수 없어도 일정 목록은 계속 표시한다.
    }
  }, [dueReminders, permission, today]);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setIsRequestingPermission(true);
    try {
      setPermission(await window.Notification.requestPermission());
    } catch {
      setPermission("denied");
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const notificationButtonLabel =
    permission === "granted"
      ? "브라우저 알림 켜짐"
      : permission === "denied"
        ? "브라우저 알림이 차단됨"
        : permission === "unsupported"
          ? "브라우저 알림 미지원"
          : isRequestingPermission
            ? "알림 권한 확인 중..."
            : "브라우저 알림 켜기";

  return (
    <section className="card application-reminder-panel" aria-labelledby="application-reminders-title">
      <header className="application-reminder-heading">
        <div>
          <p className="card-kicker">오늘부터 7일 안의 후속 일정</p>
          <h2 id="application-reminders-title">지원 일정 알림</h2>
        </div>
        <button
          type="button"
          className="nav-btn"
          disabled={permission === "granted" || permission === "denied" || permission === "unsupported" || isRequestingPermission}
          onClick={() => void requestNotificationPermission()}
        >
          {notificationButtonLabel}
        </button>
      </header>
      <p className="application-reminder-help" role="status">
        브라우저 알림은 이 페이지를 열어 둔 동안 오늘이나 기한 지난 일정에 하루 한 번 보냅니다.
        {permission === "denied" ? " 브라우저 사이트 설정에서 알림을 허용해 주세요." : ""}
      </p>
      {reminders.length > 0 ? (
        <ul className="application-reminder-list">
          {reminders.map((item) => (
            <li key={item.id} className={`reminder-${item.kind}`}>
              <span className="application-reminder-kind">{REMINDER_KIND_LABELS[item.kind]}</span>
              <time dateTime={item.dueDate}>{item.dueDate}</time>
              <button type="button" onClick={() => onSelectRecord(item.recordId)}>
                <strong>{item.companyName}</strong>
                <span>{item.nextAction.trim() || "다음 할 일"}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="application-reminder-empty">7일 안에 예정된 후속 일정이 없습니다.</p>
      )}
    </section>
  );
}
