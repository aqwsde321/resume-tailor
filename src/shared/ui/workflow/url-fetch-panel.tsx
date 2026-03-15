"use client";

interface UrlPreviewField {
  label: string;
  value: string;
}

export interface UrlFetchPreview {
  fields: UrlPreviewField[];
  sourceHost: string;
  textLength: number;
  title: string;
  warning?: string;
}

interface UrlFetchPanelProps {
  disabled: boolean;
  loading: boolean;
  onFetch: () => void;
  onValueChange: (value: string) => void;
  placeholder: string;
  preview: UrlFetchPreview | null;
  value: string;
}

export function UrlFetchPanel({
  disabled,
  loading,
  onFetch,
  onValueChange,
  placeholder,
  preview,
  value
}: UrlFetchPanelProps) {
  return (
    <div className="url-fetch-panel">
      <div className="url-fetch-row">
        <input
          type="url"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button type="button" className="secondary" onClick={onFetch} disabled={disabled}>
          {loading ? "불러오는 중..." : "URL 불러오기"}
        </button>
      </div>
      {preview && (
        <div className="url-preview" aria-live="polite">
          <div className="url-preview-head">
            <strong>읽어온 정보</strong>
            <div className="url-preview-badges">
              <span className="inline-badge ok">본문 {preview.textLength.toLocaleString()}자</span>
              {preview.warning && <span className="inline-badge warn">이미지 본문 감지</span>}
            </div>
          </div>
          <p className="url-preview-title">{preview.title}</p>
          {preview.warning && <p className="url-preview-note">{preview.warning}</p>}
          <div className="url-preview-meta">
            {preview.fields.map((field) => (
              <span key={`${field.label}-${field.value}`} className="url-preview-chip">
                <span>{field.label}</span>
                <strong>{field.value || "확인 필요"}</strong>
              </span>
            ))}
            <span className="url-preview-chip">
              <span>출처</span>
              <strong>{preview.sourceHost}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
