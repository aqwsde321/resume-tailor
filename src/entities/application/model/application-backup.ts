import { z } from "zod";

import {
  ApplicationRecordSchema,
  type ApplicationRecord
} from "@/entities/application/model/application-record";

export const APPLICATION_BACKUP_FORMAT = "resume-tailor.applications";
export const APPLICATION_BACKUP_VERSION = 1;
export const MAX_APPLICATION_BACKUP_BYTES = 100 * 1024 * 1024;

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const ApplicationBackupEntrySchema = z
  .object({
    record: ApplicationRecordSchema,
    pdfBase64: z.string().min(8).regex(BASE64_PATTERN)
  })
  .strict();

const ApplicationBackupSchema = z
  .object({
    format: z.literal(APPLICATION_BACKUP_FORMAT),
    version: z.literal(APPLICATION_BACKUP_VERSION),
    exportedAt: z.string().datetime(),
    entries: z.array(ApplicationBackupEntrySchema).min(1)
  })
  .strict();

export type ApplicationBackupEntry = z.infer<typeof ApplicationBackupEntrySchema>;
export type ApplicationBackup = z.infer<typeof ApplicationBackupSchema>;
export type MergedApplicationBackupEntry = {
  record: ApplicationRecord;
  pdfBase64?: string;
};

function hasPdfHeader(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

async function encodePdfBlob(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!hasPdfHeader(bytes)) {
    throw new Error("지원 기록에 PDF가 아닌 파일이 들어 있어요.");
  }

  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function decodePdfBase64(pdfBase64: string) {
  let binary: string;
  try {
    binary = atob(pdfBase64);
  } catch {
    throw new Error("백업 파일의 PDF 데이터를 읽지 못했어요.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (!hasPdfHeader(bytes)) {
    throw new Error("백업 파일에 올바른 PDF 파일이 없어요.");
  }

  return new Blob([bytes], { type: "application/pdf" });
}

export async function createApplicationBackup(
  records: ApplicationRecord[],
  pdfs: Map<string, Blob>,
  options: { exportedAt?: string } = {}
): Promise<ApplicationBackup> {
  if (records.length === 0) {
    throw new Error("내보낼 지원 기록이 없어요.");
  }

  const ids = new Set<string>();
  const entries = await Promise.all(
    records.map(async (record): Promise<ApplicationBackupEntry> => {
      if (ids.has(record.id)) {
        throw new Error("지원 기록 ID가 중복되어 백업을 만들 수 없어요.");
      }
      ids.add(record.id);

      const pdf = pdfs.get(record.id);
      if (!pdf) {
        throw new Error(`${record.companyName}의 보관 PDF를 찾지 못했어요.`);
      }

      return {
        record,
        pdfBase64: await encodePdfBlob(pdf)
      };
    })
  );

  const backup = ApplicationBackupSchema.parse({
    format: APPLICATION_BACKUP_FORMAT,
    version: APPLICATION_BACKUP_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    entries
  });
  return backup;
}

export function serializeApplicationBackup(backup: ApplicationBackup) {
  const serialized = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_APPLICATION_BACKUP_BYTES) {
    throw new Error("백업 파일이 너무 커요. 지원 기록을 나누어 백업해 주세요.");
  }

  return serialized;
}

export function parseApplicationBackup(source: string): ApplicationBackup {
  if (new TextEncoder().encode(source).byteLength > MAX_APPLICATION_BACKUP_BYTES) {
    throw new Error("백업 파일이 너무 커서 불러올 수 없어요.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("백업 파일을 읽지 못했어요. JSON 형식인지 확인해 주세요.");
  }

  const parsed = ApplicationBackupSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("백업 파일 형식이 올바르지 않거나 지원하지 않는 버전이에요.");
  }

  const ids = new Set<string>();
  for (const entry of parsed.data.entries) {
    if (ids.has(entry.record.id)) {
      throw new Error("백업 파일에 중복된 지원 기록이 있어요.");
    }
    ids.add(entry.record.id);
  }

  return parsed.data;
}

export function decodeApplicationBackupPdfs(backup: ApplicationBackup) {
  return backup.entries.map(({ record, pdfBase64 }) => ({
    id: record.id,
    blob: decodePdfBase64(pdfBase64)
  }));
}

export function mergeApplicationBackupEntries(
  currentRecords: ApplicationRecord[],
  importedEntries: ApplicationBackupEntry[]
): MergedApplicationBackupEntry[] {
  const merged = new Map<string, MergedApplicationBackupEntry>(
    currentRecords.map((record) => [record.id, { record }])
  );

  for (const entry of importedEntries) {
    const current = merged.get(entry.record.id);
    if (!current || entry.record.updatedAt > current.record.updatedAt) {
      merged.set(entry.record.id, entry);
    }
  }

  return [...merged.values()].sort((left, right) =>
    right.record.createdAt.localeCompare(left.record.createdAt)
  );
}
