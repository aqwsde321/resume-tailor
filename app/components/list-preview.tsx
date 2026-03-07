"use client";

interface ListPreviewProps {
  items: string[];
  label?: string;
}

export function ListPreview({ items, label = "미리보기" }: ListPreviewProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="list-preview" aria-label={label}>
      <strong>{label}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
