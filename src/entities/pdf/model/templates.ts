export const PDF_TEMPLATE_IDS = ["classic", "compact", "modern", "typographic", "minimal", "ledger"] as const;
export const PDF_PREVIEW_RENDER_VERSION = "2026-11-17-pretendard-pagination-v7";

export type PdfTemplateId = (typeof PDF_TEMPLATE_IDS)[number];

export interface PdfTemplateOption {
  description: string;
  id: PdfTemplateId;
  label: string;
  summary: string;
}

export const DEFAULT_PDF_TEMPLATE_ID: PdfTemplateId = "classic";

export const PDF_TEMPLATE_OPTIONS: PdfTemplateOption[] = [
  {
    id: "classic",
    label: "Classic",
    summary: "가장 안정적인 기본형",
    description: "단일 컬럼 중심의 정돈된 기본 이력서 레이아웃입니다."
  },
  {
    id: "compact",
    label: "Sidebar",
    summary: "왼쪽 레일과 오른쪽 본문으로 나눈 타입",
    description: "메타 정보와 스킬은 왼쪽 레일에, 소개와 경력은 오른쪽 본문에 분리합니다."
  },
  {
    id: "modern",
    label: "Modern",
    summary: "상단 배너와 강조 블록이 있는 타입",
    description: "헤더 배너와 섹션 강조 블록으로 브랜드감이 더 강한 레이아웃입니다."
  },
  {
    id: "typographic",
    label: "Typographic",
    summary: "타이포 중심의 에디토리얼 타입",
    description: "세리프 중심 헤더와 본문/보조 컬럼 대비가 강조된 레이아웃입니다."
  },
  {
    id: "minimal",
    label: "Minimal",
    summary: "왼쪽 정렬의 간결한 단일 컬럼",
    description: "얇은 구분선과 여백으로 경력 내용을 차분하게 보여줍니다."
  },
  {
    id: "ledger",
    label: "Ledger",
    summary: "섹션 구분이 선명한 단일 컬럼",
    description: "세로 강조선을 둔 헤더와 띠 형태의 제목으로 항목을 빠르게 찾을 수 있습니다."
  }
];

export function isPdfTemplateId(value: unknown): value is PdfTemplateId {
  return typeof value === "string" && PDF_TEMPLATE_IDS.includes(value as PdfTemplateId);
}

export function getPdfTemplateOption(templateId: PdfTemplateId) {
  return (
    PDF_TEMPLATE_OPTIONS.find((template) => template.id === templateId) ??
    PDF_TEMPLATE_OPTIONS[0]
  );
}
