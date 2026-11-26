import { useState } from "react";

export function useTailoringCopyEdits() {
  const [revisions, setRevisions] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [editingId, setEditingId] = useState<string | null>(null);

  function recheck(id: string, text: string) {
    setRevisions((previous) => new Map(previous).set(id, text));
    setEditingId(null);
  }

  return { revisions, editingId, setEditingId, recheck };
}
