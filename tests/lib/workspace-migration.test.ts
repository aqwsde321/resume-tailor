import { describe, expect, it } from "vitest";
import { migrateLegacyWorkspace } from "@/entities/workspace/model/migration";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
describe("legacy workspace migration", () => {
  it("이전 브라우저 원문과 확정 이력서를 보존하며 가져온다", () => {
    const legacy = { resumeText: "이전 원문", resumeConfirmedJson: JSON.stringify({ summary: "이전 소개" }), applications: [], notes: "원형 보관" };
    const result = migrateLegacyWorkspace(createEmptyWorkspace(), legacy);
    expect(result.workspace.master?.resume?.summary).toBe("이전 소개");
    expect(result.workspace.master?.document.source.originalText).toBe("이전 원문");
    expect(result.workspace.legacyBackup).toEqual(legacy);
  });
  it("기존 자료가 이미 있으면 중복 이전으로 덮어쓰지 않는다", () => {
    const workspace = { ...createEmptyWorkspace(), legacyBackup: { existing: true } };
    expect(() => migrateLegacyWorkspace(workspace, { resumeText: "다른 내용" })).toThrow();
  });
});
