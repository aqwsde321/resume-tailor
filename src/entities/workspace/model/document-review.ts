import { z } from "zod";

export const DocumentChangeSchema = z.object({
  id: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
  commentIds: z.array(z.string()).min(1),
}).strict();
export type DocumentChange = z.infer<typeof DocumentChangeSchema>;

export function validateDocumentChanges(text: string, changes: DocumentChange[]): boolean {
  const sorted = [...changes].sort((a, b) => a.start - b.start);
  return new Set(sorted.map((change) => change.id)).size === sorted.length && sorted.every((change, index) =>
    change.start <= change.end && change.end <= text.length &&
    text.slice(change.start, change.end) === change.before &&
    (!index || sorted[index - 1].end <= change.start) &&
    (!index || sorted[index - 1].start !== change.start)
  );
}

export function acceptDocumentChanges(text: string, changes: DocumentChange[], selectedIds: string[]): string {
  if (!validateDocumentChanges(text, changes) ||
    new Set(selectedIds).size !== selectedIds.length ||
    selectedIds.some((id) => !changes.some((change) => change.id === id))) {
    throw new Error("문서나 수정 제안이 변경됐습니다. 현재 원문으로 다시 검토해 주세요.");
  }
  return changes.filter((change) => selectedIds.includes(change.id))
    .sort((a, b) => b.start - a.start)
    .reduce((result, change) => result.slice(0, change.start) + change.after + result.slice(change.end), text);
}
