"use client";

import { useRef, useState } from "react";
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
  APPLICATION_STATUS_OPTIONS,
  deleteApplicationRecord,
  updateApplicationRecord,
  type ApplicationRecord,
  type ApplicationStatus
} from "@/entities/application/model/application-record";
import {
  deleteApplicationPdf,
  getApplicationPdf,
  getApplicationPdfs,
  saveApplicationPdfs
} from "@/entities/application/model/application-pdf-store";
import { usePipeline } from "@/entities/pipeline/model/pipeline-context";

function formatCreatedAt(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ApplicationsWorkspace({ records }: { records: ApplicationRecord[] }) {
  const { patch, setError, setMessage } = usePipeline();
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const updateRecord = (
    id: string,
    changes: Partial<Pick<ApplicationRecord, "status" | "notes">>
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

  return (
    <>
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
      {records.length === 0 ? (
        <section className="card applications-empty">
          <p className="card-kicker">아직 기록이 없어요</p>
          <h2>PDF를 만들 때 지원 기록으로 저장해 보세요.</h2>
          <p className="card-copy">
            저장한 시점의 공고, 이력서, 소개글과 PDF가 한 건으로 보관됩니다.
          </p>
        </section>
      ) : (
        <section className="applications-list" aria-label="지원 기록 목록">
          {records.map((record) => (
        <article className="card application-card" key={record.id}>
          <header className="application-card-head">
            <div>
              <p className="card-kicker">{formatCreatedAt(record.createdAt)} 저장</p>
              <h2>{record.companyName}</h2>
              <p className="application-job-title">{record.jobTitle}</p>
            </div>
            <span className={`application-status-badge status-${record.status}`}>
              {APPLICATION_STATUS_OPTIONS.find((option) => option.id === record.status)?.label}
            </span>
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
          ))}
        </section>
      )}
    </>
  );
}
