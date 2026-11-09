"use client";

import { useMemo, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";

import {
  createApplicationBackup,
  decodeApplicationBackupPdfs,
  MAX_APPLICATION_BACKUP_BYTES,
  mergeApplicationBackupEntries,
  parseApplicationBackup,
  serializeApplicationBackup,
  type ApplicationBackupEntry
} from "@/entities/application/model/application-backup";
import {
  APPLICATION_OUTCOME_OPTIONS,
  APPLICATION_OUTCOME_STAGE_OPTIONS,
  APPLICATION_STATUS_OPTIONS,
  type ApplicationFollowUpDraft,
  type ApplicationInterviewPrep,
  type ApplicationOutcome,
  type ApplicationOutcomeReview,
  buildApplicationDashboard,
  deleteApplicationRecord,
  filterApplicationRecords,
  getApplicationDeadlineStatus,
  sortApplicationRecords,
  updateApplicationRecord,
  type ApplicationDeadlineStatus,
  type ApplicationRecord,
  type ApplicationRecordSort,
  type ApplicationStatus,
  type ApplicationStatusFilter
} from "@/entities/application/model/application-record";
import {
  ApplicationFollowUpDraftSchema,
  FOLLOW_UP_OCCASION_OPTIONS,
  upsertApplicationFollowUpDraft,
  type FollowUpOccasion
} from "@/entities/application/model/follow-up-draft";
import { ApplicationInterviewPrepSchema } from "@/entities/application/model/interview-prep";
import {
  deleteApplicationPdf,
  getApplicationPdf,
  getApplicationPdfs,
  saveApplicationPdfs
} from "@/entities/application/model/application-pdf-store";
import { usePipeline } from "@/entities/pipeline/model/pipeline-context";
import { ApplicationBoardView } from "@/features/applications/ui/application-board-view";
import { ApplicationCalendarView } from "@/features/applications/ui/application-calendar-view";
import { ApplicationRemindersPanel } from "@/features/applications/ui/application-reminders-panel";
import { toAgentRunOptions } from "@/shared/lib/agent-settings";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const DEADLINE_STATUS_LABELS: Record<Exclude<ApplicationDeadlineStatus, "none">, string> = {
  overdue: "기한 지남",
  today: "오늘",
  upcoming: "예정"
};

export function ApplicationsWorkspace({ records }: { records: ApplicationRecord[] }) {
  const { state, patch, setError, setMessage } = usePipeline();
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<ApplicationRecordSort>("recent");
  const [followUpOccasion, setFollowUpOccasion] = useState<FollowUpOccasion>("application-thanks");
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "board">("list");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const dashboard = useMemo(() => buildApplicationDashboard(records), [records]);
  const filteredRecords = useMemo(
    () =>
      sortApplicationRecords(
        filterApplicationRecords(records, searchQuery, statusFilter),
        sortOrder
      ),
    [records, searchQuery, sortOrder, statusFilter]
  );

  const updateRecord = (
    id: string,
    changes: Partial<
      Pick<
        ApplicationRecord,
        | "status"
        | "notes"
        | "nextAction"
        | "nextActionDate"
        | "appliedAt"
        | "interviewPrep"
        | "followUpDrafts"
        | "outcomeReview"
      >
    >
  ) => {
    patch((previous) => ({
      ...previous,
      applications: updateApplicationRecord(previous.applications, id, changes)
    }));
  };

  const downloadPdf = async (record: ApplicationRecord) => {
    setBusyRecordId(record.id);
    try {
      const blob = await getApplicationPdf(record.id);
      if (!blob) {
        throw new Error("보관한 PDF 파일을 찾지 못했어요.");
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = record.pdfFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setMessage("보관한 PDF를 내려받았어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "PDF를 내려받지 못했어요.");
    } finally {
      setBusyRecordId(null);
    }
  };

  const removeRecord = async (record: ApplicationRecord) => {
    setBusyRecordId(record.id);
    try {
      await deleteApplicationPdf(record.id);
      patch((previous) => ({
        ...previous,
        applications: deleteApplicationRecord(previous.applications, record.id)
      }));
      setMessage("지원 기록을 삭제했어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "지원 기록을 삭제하지 못했어요.");
    } finally {
      setBusyRecordId(null);
    }
  };

  const exportBackup = async () => {
    if (records.length === 0) {
      setError("백업할 지원 기록이 없어요.");
      return;
    }

    setIsBackingUp(true);
    try {
      const storedPdfs = await getApplicationPdfs(records.map((record) => record.id));
      const pdfs = new Map(storedPdfs.map((record) => [record.id, record.blob]));
      const backup = await createApplicationBackup(records, pdfs);
      const blob = new Blob([serializeApplicationBackup(backup)], {
        type: "application/json;charset=utf-8"
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `resume-tailor-applications-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      setMessage(`지원 기록 ${records.length}건을 백업했어요.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "지원 기록 백업을 만들지 못했어요.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const importBackup = async (file: File) => {
    setIsRestoring(true);
    try {
      if (file.size > MAX_APPLICATION_BACKUP_BYTES) {
        throw new Error("백업 파일이 너무 커서 불러올 수 없어요.");
      }

      const backup = parseApplicationBackup(await file.text());
      const merged = mergeApplicationBackupEntries(records, backup.entries);
      const entriesWithPdf: ApplicationBackupEntry[] = merged.filter(
        (entry): entry is ApplicationBackupEntry => typeof entry.pdfBase64 === "string"
      );
      const restoredPdfs = decodeApplicationBackupPdfs({ ...backup, entries: entriesWithPdf });
      await saveApplicationPdfs(restoredPdfs);

      patch((previous) => ({
        ...previous,
        applications: mergeApplicationBackupEntries(previous.applications, backup.entries).map(
          (entry) => entry.record
        )
      }));
      setMessage(`지원 기록 ${backup.entries.length}건을 백업에서 가져왔어요.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "지원 기록을 복원하지 못했어요.");
    } finally {
      setIsRestoring(false);
      if (backupInputRef.current) {
        backupInputRef.current.value = "";
      }
    }
  };

  const generateInterviewPrep = async (record: ApplicationRecord) => {
    setBusyRecordId(record.id);
    try {
      const response = await fetch("/api/application/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: record.snapshot.resume,
          company: record.snapshot.company,
          agent: toAgentRunOptions(state.agentSettings)
        })
      });
      const body = (await response.json()) as {
        ok?: boolean;
        data?: unknown;
        error?: { message?: string };
      };
      if (!response.ok || body.ok !== true) {
        throw new Error(body.error?.message ?? "면접 준비 자료를 만들지 못했어요.");
      }

      const interviewPrep: ApplicationInterviewPrep = ApplicationInterviewPrepSchema.parse(body.data);
      updateRecord(record.id, { interviewPrep });
      setMessage("면접 준비 자료를 저장했어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "면접 준비 자료를 만들지 못했어요.");
    } finally {
      setBusyRecordId(null);
    }
  };

  const generateFollowUpDraft = async (record: ApplicationRecord) => {
    setBusyRecordId(record.id);
    try {
      const response = await fetch("/api/application/follow-up-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: followUpOccasion,
          company: record.snapshot.company,
          status: record.status,
          notes: record.notes,
          nextAction: record.nextAction,
          agent: toAgentRunOptions(state.agentSettings)
        })
      });
      const body = (await response.json()) as {
        ok?: boolean;
        data?: unknown;
        error?: { message?: string };
      };
      if (!response.ok || body.ok !== true) {
        throw new Error(body.error?.message ?? "후속 메일 초안을 만들지 못했어요.");
      }

      const draft: ApplicationFollowUpDraft = ApplicationFollowUpDraftSchema.parse(body.data);
      updateRecord(record.id, {
        followUpDrafts: upsertApplicationFollowUpDraft(record.followUpDrafts, draft)
      });
      setMessage("후속 메일 초안을 저장했어요.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "후속 메일 초안을 만들지 못했어요.");
    } finally {
      setBusyRecordId(null);
    }
  };

  const updateFollowUpDraft = (
    record: ApplicationRecord,
    draft: ApplicationFollowUpDraft,
    changes: Partial<Pick<ApplicationFollowUpDraft, "subject" | "body">>
  ) => {
    updateRecord(record.id, {
      followUpDrafts: upsertApplicationFollowUpDraft(record.followUpDrafts, { ...draft, ...changes })
    });
  };

  const copyFollowUpDraft = async (draft: ApplicationFollowUpDraft) => {
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      setMessage("메일 초안을 복사했어요.");
    } catch {
      setError("메일 초안을 복사하지 못했어요. 제목과 본문을 직접 선택해 주세요.");
    }
  };

  const updateOutcomeReview = (
    record: ApplicationRecord,
    changes: Partial<ApplicationOutcomeReview>
  ) => {
    const current: ApplicationOutcomeReview = record.outcomeReview ?? {
      outcome: "pending",
      lastStage: "document",
      feedback: "",
      reflection: ""
    };
    updateRecord(record.id, { outcomeReview: { ...current, ...changes } });
  };

  const selectApplicationRecord = (recordId: string) => {
    setViewMode("list");
    window.setTimeout(() => {
      document
        .getElementById(`application-record-${recordId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  return (
    <>
      {records.length > 0 && (
        <section className="card application-dashboard" aria-labelledby="application-dashboard-title">
          <div className="application-dashboard-heading">
            <div>
              <p className="card-kicker">지원 현황 요약</p>
              <h2 id="application-dashboard-title">지원 성과</h2>
            </div>
            <p>면접 전환율은 지원 완료 이력이 있는 기록을 기준으로 계산합니다.</p>
          </div>
          <div className="application-dashboard-metrics">
            <article className="application-dashboard-metric">
              <span>전체 기록</span>
              <strong>{dashboard.totalApplications}</strong>
              <small>저장한 지원 기록</small>
            </article>
            <article className="application-dashboard-metric">
              <span>지원 완료</span>
              <strong>{dashboard.submittedApplications}</strong>
              <small>지원일 또는 상태 변경 이력</small>
            </article>
            <article className="application-dashboard-metric">
              <span>면접 경험</span>
              <strong>{dashboard.interviewedApplications}</strong>
              <small>현재 상태와 변경 이력 포함</small>
            </article>
            <article className="application-dashboard-metric application-dashboard-rate">
              <span>면접 전환율</span>
              <strong>{dashboard.interviewConversionRate}%</strong>
              <small>면접 경험 ÷ 지원 완료</small>
            </article>
          </div>
          <div className="application-outcome-summary" aria-label="지원 결과 기록 요약">
            <strong>결과 기록</strong>
            {APPLICATION_OUTCOME_OPTIONS.map((option) => (
              <span key={option.id}>
                {option.label} {dashboard.outcomeCounts[option.id]}
              </span>
            ))}
          </div>
          {dashboard.companies.length > 0 && (
            <div className="application-company-summary">
              <h3>회사별 현황</h3>
              <div className="application-company-table-wrap">
                <table className="application-company-table">
                  <caption className="sr-only">회사별 지원 및 면접 현황</caption>
                  <thead>
                    <tr>
                      <th scope="col">회사</th>
                      <th scope="col">기록</th>
                      <th scope="col">지원 완료</th>
                      <th scope="col">면접 경험</th>
                      <th scope="col">종료</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.companies.map((company) => (
                      <tr key={company.companyName}>
                        <th scope="row">{company.companyName}</th>
                        <td>{company.totalApplications}</td>
                        <td>{company.submittedApplications}</td>
                        <td>{company.interviewedApplications}</td>
                        <td>{company.closedApplications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
      {records.length > 0 && (
        <ApplicationRemindersPanel records={records} onSelectRecord={selectApplicationRecord} />
      )}
      <div className="applications-toolbar">
        <span>{records.length}건 저장됨</span>
        <div className="action-row">
          <button
            type="button"
            className="nav-btn"
            disabled={records.length === 0 || isBackingUp || isRestoring}
            onClick={() => void exportBackup()}
          >
            {isBackingUp ? "백업 만드는 중..." : "백업 내보내기"}
          </button>
          <button
            type="button"
            className="nav-btn"
            disabled={isBackingUp || isRestoring}
            onClick={() => backupInputRef.current?.click()}
          >
            {isRestoring ? "복원 중..." : "백업 불러오기"}
          </button>
          <input
            ref={backupInputRef}
            aria-label="지원 기록 백업 파일"
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void importBackup(file);
              }
            }}
          />
          <Link href={"/resume" as Route} className="nav-btn">
            작업 화면으로 돌아가기
          </Link>
        </div>
      </div>
      {records.length > 0 && (
        <div className="applications-filters">
          <label className="application-field">
            <span>기록 검색</span>
            <input
              aria-label="지원 기록 검색"
              className="form-input"
              type="search"
              placeholder="회사명, 직무, 메모, 다음 할 일 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label className="application-field">
            <span>진행 상태</span>
            <select
              aria-label="지원 상태 필터"
              className="form-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ApplicationStatusFilter)}
            >
              <option value="all">모든 상태</option>
              {APPLICATION_STATUS_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="application-field">
            <span>일정 정렬</span>
            <select
              aria-label="지원 기록 정렬"
              className="form-select"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as ApplicationRecordSort)}
            >
              <option value="recent">최근 저장순</option>
              <option value="due-date">일정 임박순</option>
            </select>
          </label>
          <span className="applications-filter-count">
            {filteredRecords.length} / {records.length}건
          </span>
        </div>
      )}
      {records.length > 0 && (
        <div className="application-view-toggle" role="group" aria-label="지원 기록 보기 방식">
          <button
            type="button"
            className="nav-btn"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            목록 보기
          </button>
          <button
            type="button"
            className="nav-btn"
            aria-pressed={viewMode === "calendar"}
            onClick={() => setViewMode("calendar")}
          >
            달력 보기
          </button>
          <button
            type="button"
            className="nav-btn"
            aria-pressed={viewMode === "board"}
            onClick={() => setViewMode("board")}
          >
            보드 보기
          </button>
        </div>
      )}
      {records.length === 0 ? (
        <section className="card applications-empty">
          <p className="card-kicker">아직 기록이 없어요</p>
          <h2>PDF를 만들 때 지원 기록으로 저장해 보세요.</h2>
          <p className="card-copy">
            저장한 시점의 공고, 이력서, 소개글과 PDF가 한 건으로 보관됩니다.
          </p>
        </section>
      ) : (
        filteredRecords.length === 0 ? (
          <section className="card applications-empty">
            <p className="card-kicker">조건에 맞는 기록이 없어요</p>
            <h2>검색 결과가 없어요.</h2>
            <p className="card-copy">검색어를 바꾸거나 상태 필터를 초기화해 보세요.</p>
            <div className="action-row">
              <button
                type="button"
                className="nav-btn"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSortOrder("recent");
                }}
              >
                필터 초기화
              </button>
            </div>
          </section>
        ) : viewMode === "calendar" ? (
          <ApplicationCalendarView
            records={filteredRecords}
            onSelectRecord={selectApplicationRecord}
          />
        ) : viewMode === "board" ? (
          <ApplicationBoardView
            records={filteredRecords}
            onStatusChange={(recordId, status) => updateRecord(recordId, { status })}
            onSelectRecord={selectApplicationRecord}
          />
        ) : (
          <section className="applications-list" aria-label="지원 기록 목록">
            {filteredRecords.map((record) => {
              const deadlineStatus = getApplicationDeadlineStatus(record.nextActionDate);
              const followUpDraft = record.followUpDrafts.find(
                (draft) => draft.occasion === followUpOccasion
              );

              return (
        <article className="card application-card" id={`application-record-${record.id}`} key={record.id}>
          <header className="application-card-head">
            <div>
              <p className="card-kicker">{formatCreatedAt(record.createdAt)} 저장</p>
              <h2>{record.companyName}</h2>
              <p className="application-job-title">{record.jobTitle}</p>
            </div>
            <div className="application-card-badges">
              <span className={`application-status-badge status-${record.status}`}>
                {APPLICATION_STATUS_OPTIONS.find((option) => option.id === record.status)?.label}
              </span>
              {deadlineStatus !== "none" && record.nextActionDate && (
                <span
                  className={`application-deadline-badge deadline-${deadlineStatus}`}
                >
                  {DEADLINE_STATUS_LABELS[deadlineStatus]} · {record.nextActionDate}
                </span>
              )}
            </div>
          </header>

          <details className="application-snapshot">
            <summary>저장한 자료 보기</summary>
            <div className="application-snapshot-body">
              <section>
                <h3>공고</h3>
                <p>{record.snapshot.company.jobDescription || "공고 설명이 없어요."}</p>
              </section>
              <section>
                <h3>이력서</h3>
                <p>{record.snapshot.resume.summary || "요약이 없어요."}</p>
              </section>
              <section>
                <h3>소개글</h3>
                <p>{record.snapshot.intro.longIntro || "소개글이 없어요."}</p>
              </section>
              <p className="application-template-note">
                PDF 설정: {record.snapshot.templateId} · {record.snapshot.themeId}
                {record.snapshot.customAccentHex ? ` · ${record.snapshot.customAccentHex}` : ""}
              </p>
            </div>
          </details>

          <div className="application-controls">
            <label className="application-field">
              <span>진행 상태</span>
              <select
                aria-label={`${record.companyName} 진행 상태`}
                className="form-select"
                value={record.status}
                onChange={(event) =>
                  updateRecord(record.id, { status: event.target.value as ApplicationStatus })
                }
              >
                {APPLICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="application-field application-notes-field">
              <span>메모</span>
              <textarea
                aria-label={`${record.companyName} 메모`}
                className="form-input application-notes"
                maxLength={5000}
                placeholder="면접 일정, 담당자, 다음 할 일 등을 적어 두세요."
                value={record.notes}
                onChange={(event) => updateRecord(record.id, { notes: event.target.value })}
              />
            </label>
          </div>

          <div className="application-follow-up">
            <label className="application-field">
              <span>지원일</span>
              <input
                aria-label={`${record.companyName} 지원일`}
                className="form-input"
                type="date"
                value={record.appliedAt ?? ""}
                onChange={(event) => updateRecord(record.id, { appliedAt: event.target.value || null })}
              />
            </label>
            <label className="application-field">
              <span>다음 할 일</span>
              <input
                aria-label={`${record.companyName} 다음 할 일`}
                className="form-input"
                type="text"
                maxLength={5000}
                placeholder="예: 면접 결과 문의"
                value={record.nextAction}
                onChange={(event) => updateRecord(record.id, { nextAction: event.target.value })}
              />
            </label>
            <label className="application-field">
              <span>예정일</span>
              <input
                aria-label={`${record.companyName} 예정일`}
                className="form-input"
                type="date"
                value={record.nextActionDate ?? ""}
                onChange={(event) =>
                  updateRecord(record.id, { nextActionDate: event.target.value || null })
                }
              />
            </label>
          </div>

          <details className="application-interview-prep">
            <summary>면접 준비 자료{record.interviewPrep ? " · 저장됨" : ""}</summary>
            <div className="application-interview-prep-content">
              {record.interviewPrep ? (
                <>
                  <p className="application-artifact-date">
                    {formatCreatedAt(record.interviewPrep.generatedAt)} 생성
                  </p>
                  <section>
                    <h3>면접 시작 30초 소개</h3>
                    <p>{record.interviewPrep.openingPitch}</p>
                  </section>
                  <section>
                    <h3>예상 질문과 답변 개요</h3>
                    <ol className="application-interview-questions">
                      {record.interviewPrep.questions.map((question, index) => (
                        <li key={`${question.question}-${index}`}>
                          <h4>{question.question}</h4>
                          <p><strong>확인 포인트:</strong> {question.focus}</p>
                          <p><strong>이력서 근거:</strong> {question.resumeEvidence}</p>
                          <ol>
                            {question.answerOutline.map((step, stepIndex) => (
                              <li key={`${step}-${stepIndex}`}>{step}</li>
                            ))}
                          </ol>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section>
                    <h3>회사에 물어볼 질문</h3>
                    <ul>
                      {record.interviewPrep.questionsToAsk.map((question, index) => (
                        <li key={`${question}-${index}`}>{question}</li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : (
                <p>저장한 이력서와 공고를 바탕으로 예상 질문과 답변 개요를 만듭니다.</p>
              )}
              <button
                type="button"
                className="nav-btn"
                disabled={busyRecordId === record.id}
                onClick={() => void generateInterviewPrep(record)}
              >
                {busyRecordId === record.id
                  ? "면접 자료 만드는 중..."
                  : record.interviewPrep
                    ? "면접 준비 자료 다시 만들기"
                    : "면접 준비 자료 만들기"}
              </button>
            </div>
          </details>

          <details className="application-follow-up-drafts">
            <summary>후속 메일 초안{record.followUpDrafts.length > 0 ? ` · ${record.followUpDrafts.length}개 저장` : ""}</summary>
            <div className="application-follow-up-draft-content">
              <label className="application-field">
                <span>메일 목적</span>
                <select
                  aria-label={`${record.companyName} 메일 목적`}
                  className="form-select"
                  value={followUpOccasion}
                  onChange={(event) => setFollowUpOccasion(event.target.value as FollowUpOccasion)}
                >
                  {FOLLOW_UP_OCCASION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              {followUpDraft ? (
                  <div className="application-follow-up-draft-editor">
                    <p className="application-artifact-date">{formatCreatedAt(followUpDraft.generatedAt)} 생성</p>
                    <label className="application-field">
                      <span>제목</span>
                      <input
                        aria-label={`${record.companyName} 후속 메일 제목`}
                        className="form-input"
                        maxLength={180}
                        value={followUpDraft.subject}
                        onChange={(event) => updateFollowUpDraft(record, followUpDraft, { subject: event.target.value })}
                      />
                    </label>
                    <label className="application-field">
                      <span>본문</span>
                      <textarea
                        aria-label={`${record.companyName} 후속 메일 본문`}
                        className="form-input application-follow-up-draft-body"
                        maxLength={4000}
                        value={followUpDraft.body}
                        onChange={(event) => updateFollowUpDraft(record, followUpDraft, { body: event.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="nav-btn"
                      disabled={!followUpDraft.subject.trim() || !followUpDraft.body.trim()}
                      onClick={() => void copyFollowUpDraft(followUpDraft)}
                    >
                      제목과 본문 복사
                    </button>
                  </div>
              ) : (
                  <p>저장한 회사 정보, 진행 상태, 메모를 바탕으로 보낼 메일 초안을 만듭니다.</p>
              )}
              <button
                type="button"
                className="nav-btn"
                disabled={busyRecordId === record.id}
                onClick={() => void generateFollowUpDraft(record)}
              >
                {busyRecordId === record.id
                  ? "메일 초안 만드는 중..."
                  : Boolean(followUpDraft)
                    ? "이 목적의 초안 다시 만들기"
                    : "후속 메일 초안 만들기"}
              </button>
            </div>
          </details>

          <details className="application-outcome-review">
            <summary>면접 결과와 회고{record.outcomeReview ? " · 기록됨" : ""}</summary>
            <div className="application-outcome-review-content">
              <div className="application-outcome-review-fields">
                <label className="application-field">
                  <span>지원 결과</span>
                  <select
                    aria-label={`${record.companyName} 결과`}
                    className="form-select"
                    value={record.outcomeReview?.outcome ?? "pending"}
                    onChange={(event) =>
                      updateOutcomeReview(record, { outcome: event.target.value as ApplicationOutcome })
                    }
                  >
                    {APPLICATION_OUTCOME_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="application-field">
                  <span>마지막 단계</span>
                  <select
                    aria-label={`${record.companyName} 마지막 단계`}
                    className="form-select"
                    value={record.outcomeReview?.lastStage ?? "document"}
                    onChange={(event) =>
                      updateOutcomeReview(record, {
                        lastStage: event.target.value as ApplicationOutcomeReview["lastStage"]
                      })
                    }
                  >
                    {APPLICATION_OUTCOME_STAGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="application-field">
                <span>받은 피드백 또는 기억할 질문</span>
                <textarea
                  aria-label={`${record.companyName} 받은 피드백`}
                  className="form-input application-outcome-textarea"
                  maxLength={3000}
                  value={record.outcomeReview?.feedback ?? ""}
                  onChange={(event) => updateOutcomeReview(record, { feedback: event.target.value })}
                />
              </label>
              <label className="application-field">
                <span>다음 지원에서 배울 점</span>
                <textarea
                  aria-label={`${record.companyName} 다음 지원에서 배울 점`}
                  className="form-input application-outcome-textarea"
                  maxLength={3000}
                  value={record.outcomeReview?.reflection ?? ""}
                  onChange={(event) => updateOutcomeReview(record, { reflection: event.target.value })}
                />
              </label>
              <p className="application-artifact-date">입력한 내용은 자동 저장됩니다.</p>
            </div>
          </details>

          <details className="application-status-history">
            <summary>상태 변경 이력</summary>
            <ol>
              {record.statusHistory.map((entry, index) => (
                <li key={`${entry.changedAt}-${entry.status}-${index}`}>
                  <span>{APPLICATION_STATUS_OPTIONS.find((option) => option.id === entry.status)?.label}</span>
                  <time dateTime={entry.changedAt}>{formatCreatedAt(entry.changedAt)}</time>
                </li>
              ))}
            </ol>
          </details>

          <footer className="application-card-footer">
            <span className="application-pdf-name">{record.pdfFileName}</span>
            <div className="action-row">
              <button
                type="button"
                className="nav-btn"
                disabled={busyRecordId === record.id}
                onClick={() => void downloadPdf(record)}
              >
                PDF 다운로드
              </button>
              <button
                type="button"
                className="text-btn application-delete-button"
                disabled={busyRecordId === record.id}
                onClick={() => void removeRecord(record)}
              >
                기록 삭제
              </button>
            </div>
          </footer>
        </article>
              );
            })}
          </section>
        )
      )}
    </>
  );
}
