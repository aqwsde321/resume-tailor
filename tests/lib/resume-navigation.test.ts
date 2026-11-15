import { expect, it } from "vitest";
import { ResumeSchema } from "@/shared/lib/schemas";
import { createEmptyWorkspace } from "@/entities/workspace/model/workspace";
import { newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createResultDraft } from "@/entities/workspace/model/resume-result-draft";
import { getResumeView, resumeSaveBlockReason, navigateResume } from "@/entities/workspace/model/resume-navigation";

function setup() {
  const workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "자료", "원문"), ResumeSchema.parse({ name: "예시" }));
  workspace.master!.resultDraft = createResultDraft(workspace.master!.resume!, "원문");
  return workspace;
}
it("단계 이동은 원문·편집 문서·댓글을 보존한다", () => {
  const workspace = setup(); const draft = workspace.master!.resultDraft!;
  draft.document.text += "\n\n직접 편집";
  draft.document.annotations.push({ id: crypto.randomUUID(), anchor: { type: "document" }, instruction: "수정", status: "pending", createdAt: new Date().toISOString() });
  const source = navigateResume(workspace, "source");
  expect(getResumeView(source.master)).toBe("source");
  const edit = navigateResume(source, "edit");
  expect(getResumeView(edit.master)).toBe("edit");
  expect(edit.master!.resultDraft!.document).toEqual(draft.document);
  expect(edit.master!.document).toEqual(workspace.master!.document);
});
it("미처리 댓글·문서 수정·원문 변경은 저장 진입을 차단하고 이유를 반환한다", () => {
  const workspace = setup(); const draft = workspace.master!.resultDraft!;
  draft.document.text += "수정";
  expect(resumeSaveBlockReason(workspace.master)).toContain("다시 정리");
  expect(() => navigateResume(workspace, "save")).toThrow();
  draft.document.text = draft.structuredText;
  draft.document.annotations.push({ id: crypto.randomUUID(), anchor: { type: "document" }, instruction: "수정", status: "pending", createdAt: new Date().toISOString() });
  expect(resumeSaveBlockReason(workspace.master)).toContain("댓글");
  draft.document.annotations = [];
  workspace.master!.document.text += "원문 변경";
  expect(resumeSaveBlockReason(workspace.master)).toContain("자료");
});
it("저장본에서 편집을 열 때는 처음에만 초안을 만들고 이후에는 같은 초안을 유지한다", () => {
  const workspace = setup(); workspace.master!.resultDraft = null;
  const edit = navigateResume(workspace, "edit");
  expect(edit.master!.resultDraft).toBeTruthy();
  const again = navigateResume(navigateResume(edit, "source"), "edit");
  expect(again.master!.resultDraft!.document.id).toBe(edit.master!.resultDraft!.document.id);
});
