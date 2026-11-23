import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceStore } from "@/server/workspace-store";

import { newTextDocument } from "@/entities/workspace/model/operations";

const directories: string[] = [];
async function setup() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-store-test-"));
  directories.push(directory);
  return { directory, store: createWorkspaceStore(directory) };
}
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe("local workspace persistence", () => {
  it("빈 저장소를 읽고 모델 설정을 프로세스 재시작 후에도 복원한다", async () => {
    const { store, directory } = await setup();
    const initial = await store.read();
    expect(initial.revision).toBe(0);
    const saved = await store.save({ ...initial, settings: { model: "local-test-model", modelReasoningEffort: "high" } }, 0);
    expect(saved.revision).toBe(1);
    expect((await createWorkspaceStore(directory).read()).settings.model).toBe("local-test-model");
    expect(JSON.parse(await readFile(path.join(directory, "workspace.json"), "utf8"))).toEqual(saved);
  });

  it("회사별 PDF 템플릿과 색상을 보존하고 기존 작업도 읽는다", async () => {
    const { store, directory } = await setup();
    const initial = await store.read();
    const now = new Date().toISOString();
    const work = { id: crypto.randomUUID(), title: "테스트 공고", document: newTextDocument("job", "테스트 공고", "공고 본문"), company: null, sourceResumeVersion: null, sourceResume: null, resume: null, intro: null, enrichment: [], versions: [], createdAt: now, updatedAt: now };
    const legacy = { ...work, id: crypto.randomUUID(), pdfTemplateId: "modern" as const };
    const selected = { ...legacy, id: crypto.randomUUID(), pdfThemeId: "forest" as const };
    await store.save({ ...initial, works: [work, legacy, selected] }, initial.revision);
    expect((await createWorkspaceStore(directory).read()).works).toEqual([work, legacy, selected]);
  });

  it("두 탭의 동시 저장에서 오래된 수정이 최신 내용을 덮어쓰지 않는다", async () => {
    const { store, directory } = await setup();
    const initial = await store.read();
    const otherTab = createWorkspaceStore(directory);
    const results = await Promise.allSettled([store.save(initial, 0), otherTab.save(initial, 0)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await store.read()).revision).toBe(1);
  });

  it("손상된 데이터는 빈 저장소로 덮어쓰지 않고 오류로 알린다", async () => {
    const { store, directory } = await setup();
    await writeFile(path.join(directory, "workspace.json"), "broken");
    await expect(store.read()).rejects.toThrow();
    expect(await readFile(path.join(directory, "workspace.json"), "utf8")).toBe("broken");
  });
});
