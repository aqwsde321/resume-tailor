export const PDF_TEMPLATE_IDS = ["classic", "compact", "modern"] as const;

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
