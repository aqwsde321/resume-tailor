import { describe, expect, it } from "vitest";
import { acceptDocumentChanges, validateDocumentChanges } from "@/entities/workspace/model/document-review";

describe("annotation rewrite review", () => {
  const text = "첫 단락\n\n두 번째 단락\n\n마지막 단락";
  it("선택한 변경만 반영하고 나머지 원문을 보존한다", () => {
    const changes = [
      { id: "one", start: 0, end: 4, before: "첫 단락", after: "수정한 첫 단락", reason: "사용자 정정", commentIds: ["comment"] },
      { id: "two", start: 6, end: 14, before: "두 번째 단락\n", after: "다른 문장", reason: "수정", commentIds: ["other"] },
    ];
    expect(acceptDocumentChanges(text, changes, ["one"])).toBe("수정한 첫 단락\n\n두 번째 단락\n\n마지막 단락");
  });
  it("원문이 바뀌었거나 수정 영역이 겹치면 적용을 거절한다", () => {
    const change = { id: "one", start: 0, end: 4, before: "첫 단락", after: "수정", reason: "정정", commentIds: ["comment"] };
    expect(validateDocumentChanges("바뀐 문서", [change])).toBe(false);
    expect(validateDocumentChanges(text, [change, { ...change, id: "two" }])).toBe(false);
  });
  it("존재하지 않는 변경 ID나 중복 ID를 수락하지 않는다", () => {
    expect(() => acceptDocumentChanges(text, [], ["missing"])).toThrow();
    const change = { id: "one", start: 0, end: 4, before: "첫 단락", after: "수정", reason: "정정", commentIds: ["comment"] };
    expect(() => acceptDocumentChanges(text, [change], ["one", "one"])).toThrow();
  });
});
