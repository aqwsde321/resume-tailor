"use client";

import { useMemo } from "react";

import { groupApplicationRecordsByStatus } from "@/entities/application/model/application-board";
import {
  APPLICATION_STATUS_OPTIONS,
  type ApplicationRecord,
  type ApplicationStatus
} from "@/entities/application/model/application-record";

export function ApplicationBoardView({
  records,
  onStatusChange,
  onSelectRecord
}: {
  records: ApplicationRecord[];
  onStatusChange: (recordId: string, status: ApplicationStatus) => void;
  onSelectRecord: (recordId: string) => void;
}) {
  const columns = useMemo(() => groupApplicationRecordsByStatus(records), [records]);

  return (
    <section className="card application-board" aria-labelledby="application-board-title">
      <header className="application-board-heading">
        <div>
          <p className="card-kicker">지원 진행 흐름</p>
          <h2 id="application-board-title">지원 현황 보드</h2>
        </div>
        <p>각 카드에서 상태를 바꾸거나 상세 기록을 열 수 있습니다.</p>
      </header>
      <div className="application-board-columns">
        {columns.map((column) => (
          <section
            key={column.status}
            className={`application-kanban-column column-${column.status}`}
            data-status={column.status}
            aria-labelledby={`application-column-${column.status}`}
          >
            <header>
              <h3 id={`application-column-${column.status}`}>{column.label}</h3>
              <span>{column.records.length}</span>
            </header>
            {column.records.length > 0 ? (
              <div className="application-kanban-cards">
                {column.records.map((record) => (
                  <article className="application-kanban-card" key={record.id}>
                    <div>
                      <h4>{record.companyName}</h4>
                      <p className="application-kanban-job-title">{record.jobTitle}</p>
                    </div>
                    {record.appliedAt && <p>지원일 · {record.appliedAt}</p>}
                    {record.nextAction && (
                      <p className="application-kanban-next-action">
                        다음 할 일 · {record.nextAction}
                        {record.nextActionDate ? ` · ${record.nextActionDate}` : ""}
                      </p>
                    )}
                    <label className="application-field">
                      <span>상태 변경</span>
                      <select
                        aria-label={`${record.companyName} 보드 상태`}
                        className="form-select"
                        value={record.status}
                        onChange={(event) =>
                          onStatusChange(record.id, event.target.value as ApplicationStatus)
                        }
                      >
                        {APPLICATION_STATUS_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="text-btn application-kanban-open"
                      onClick={() => onSelectRecord(record.id)}
                    >
                      상세 기록 보기
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="application-kanban-empty">기록 없음</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
