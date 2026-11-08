import { describe, expect, it } from "vitest";

import {
  createApplicationBackup,
  decodeApplicationBackupPdfs,
  mergeApplicationBackupEntries,
  parseApplicationBackup,
  serializeApplicationBackup
} from "@/entities/application/model/application-backup";
import { createApplicationRecord } from "@/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

function createRecord(id = "application-1", updatedAt = "2026-11-09T00:00:00.000Z") {
  const resume = createPdfResumeFixture();
  return createApplicationRecord(
    {
      resume,
      company: companyFixture,
      intro: introFixture,
      resumeSnapshot: "resume-source-snapshot",
      companySnapshot: "company-source-snapshot",
      templateId: "modern",
      themeId: "forest",
      customAccentHex: ""
    },
    { id, now: updatedAt }
  );
}

describe("application backups", () => {
  it("round trips records and their PDF files in one versioned JSON backup", async () => {
    const record = createRecord();
    const pdf = new Blob(["%PDF-1.4\nexample"], { type: "application/pdf" });
    const backup = await createApplicationBackup([record], new Map([[record.id, pdf]]), {
      exportedAt: "2026-11-10T00:00:00.000Z"
    });
    const restored = decodeApplicationBackupPdfs(
      parseApplicationBackup(serializeApplicationBackup(backup))
    );

    expect(backup).toMatchObject({
      format: "resume-tailor.applications",
      version: 1,
      exportedAt: "2026-11-10T00:00:00.000Z",
      entries: [{ record }]
    });
    expect(restored).toHaveLength(1);
    expect(restored[0]?.id).toBe(record.id);
    expect(await restored[0]?.blob.text()).toBe("%PDF-1.4\nexample");
    expect(restored[0]?.blob.type).toBe("application/pdf");
  });

  it("rejects missing PDFs, unsupported versions, duplicate ids, and invalid PDF data", async () => {
    const record = createRecord();
    const pdf = new Blob(["%PDF-1.4\nexample"], { type: "application/pdf" });

    await expect(createApplicationBackup([record], new Map(), {})).rejects.toThrow(/PDF/);
    await expect(
      createApplicationBackup([record, record], new Map([[record.id, pdf]]), {})
    ).rejects.toThrow(/중복/);

    const backup = await createApplicationBackup([record], new Map([[record.id, pdf]]), {});
    const unsupported = { ...backup, version: 2 };
    expect(() => parseApplicationBackup(JSON.stringify(unsupported))).toThrow(/백업 파일/);

    const invalidPdf = {
      ...backup,
      entries: [{ ...backup.entries[0], pdfBase64: "bm90IGEgcGRm" }]
    };
    expect(() => decodeApplicationBackupPdfs(parseApplicationBackup(JSON.stringify(invalidPdf)))).toThrow(
      /PDF 파일/
    );
  });

  it("loads older backup records without follow-up fields using safe defaults", async () => {
    const record = createRecord();
    const pdf = new Blob(["%PDF-1.4\nexample"], { type: "application/pdf" });
    const backup = await createApplicationBackup([record], new Map([[record.id, pdf]]), {});
    const legacy = JSON.parse(JSON.stringify(backup)) as {
      entries: Array<{ record: Record<string, unknown> }>;
    };
    delete legacy.entries[0]?.record.nextAction;
    delete legacy.entries[0]?.record.nextActionDate;

    expect(parseApplicationBackup(JSON.stringify(legacy)).entries[0]?.record).toMatchObject({
      nextAction: "",
      nextActionDate: null
    });
  });

  it("merges by record id and keeps the most recently updated version", async () => {
    const existing = createRecord("application-1", "2026-11-10T00:00:00.000Z");
    const older = createRecord("application-1", "2026-11-09T00:00:00.000Z");
    const newer = createRecord("application-2", "2026-11-11T00:00:00.000Z");
    const blob = new Blob(["%PDF-1.4\nexample"], { type: "application/pdf" });
    const incoming = await createApplicationBackup([older, newer], new Map([
      [older.id, blob],
      [newer.id, blob]
    ]), {});
    const merged = mergeApplicationBackupEntries([existing], incoming.entries);

    expect(merged.map((entry) => entry.record.id)).toEqual(["application-2", "application-1"]);
    expect(merged[0]?.pdfBase64).toBe(incoming.entries[1]?.pdfBase64);
    expect(merged[1]?.record.updatedAt).toBe(existing.updatedAt);
    expect(merged[1]?.pdfBase64).toBeUndefined();
  });
});
