function uniquePreserveOrder(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    if (seen.has(value)) {
      return;
    }

    seen.add(value);
    normalized.push(value);
  });

  return normalized;
}

function normalizeItem(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/^[\s\-•·*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseInlineItems(value: string): string[] {
  return uniquePreserveOrder(
    value
      .replace(/\r/g, "\n")
      .split(/[\n,]/g)
      .map((item) => normalizeItem(item))
      .filter(Boolean)
  );
}

export function parseListText(value: string): string[] {
  const normalized = value.replace(/\r/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const parts = normalized.includes("\n") ? normalized.split("\n") : normalized.split(",");
  return uniquePreserveOrder(parts.map((item) => normalizeItem(item)).filter(Boolean));
}

export function stringifyLineList(values: string[]): string {
  return values.join("\n");
}
