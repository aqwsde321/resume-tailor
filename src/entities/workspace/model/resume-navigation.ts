import type { Workspace } from "./workspace";
import { createResultDraft } from "./resume-result-draft";
export type ResumeView = "source" | "edit" | "save" | "saved";
export function getResumeView(master: Workspace["master"]): ResumeView {
  if (!master) return "source";
  if (master.viewStep === "source") return "source";
  if (master.resultDraft) return master.viewStep === "save" || master.viewStep !== "edit" && master.resultDraft.stage === "confirm" ? "save" : "edit";
  return master.resume && !master.sourceNeedsReview ? "saved" : "source";
}
export function resumeSaveBlockReason(master: Workspace["master"]): string {
  if (!master) return "자료를 등록하고 이력서를 정리해 주세요.";
  const draft = master.resultDraft;
  if (!draft) return master.resume && !master.sourceNeedsReview ? "" : "자료를 먼저 정리한 뒤 이력서를 확인해 주세요.";
  if (draft.sourceText !== master.document.text) return "자료가 변경됐습니다. 자료 확인 내용과 편집본을 먼저 맞춰 주세요.";
  if (draft.document.annotations.some((item) => item.status === "pending")) return "남은 수정 댓글을 반영하거나 삭제한 뒤 저장 단계로 이동할 수 있습니다.";
  if (draft.document.proposal) return "AI 수정 제안을 확인한 뒤 저장 단계로 이동할 수 있습니다.";
  if (draft.document.text !== draft.structuredText) return "수정한 결과를 다시 정리한 뒤 저장 단계로 이동할 수 있습니다.";
  return "";
}
export function navigateResume(workspace: Workspace, view: "source" | "edit" | "save"): Workspace {
  const master = workspace.master;
  if (!master) throw new Error("자료를 먼저 등록해 주세요.");
  if (view === "source") return { ...workspace, master: { ...master, viewStep: "source" } };
  if (view === "save") {
    const reason = resumeSaveBlockReason(master);
    if (reason) throw new Error(reason);
    return { ...workspace, master: { ...master, viewStep: master.resultDraft ? "save" : "saved", resultDraft: master.resultDraft ? { ...master.resultDraft, stage: "confirm" } : null } };
  }
  if (!master.resultDraft && (!master.resume || master.sourceNeedsReview)) throw new Error("자료를 먼저 정리해 주세요.");
  const draft = master.resultDraft ?? createResultDraft(master.resume!, master.document.text, master.skillCatalog, true, master.reviewMarkdown);
  return { ...workspace, master: { ...master, viewStep: "edit", resultDraft: { ...draft, stage: "review" } } };
}
