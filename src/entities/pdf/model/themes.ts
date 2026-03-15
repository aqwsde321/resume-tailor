export const PDF_THEME_IDS = ["cobalt", "forest", "ember", "graphite"] as const;

export type PdfThemeId = (typeof PDF_THEME_IDS)[number];

export interface PdfThemeOption {
  accentHex: string;
  description: string;
  dividerHex: string;
  id: PdfThemeId;
  inkHex: string;
  label: string;
  mutedHex: string;
  onAccentHex: string;
  softHex: string;
}

export const DEFAULT_PDF_THEME_ID: PdfThemeId = "cobalt";

export const PDF_THEME_OPTIONS: PdfThemeOption[] = [
  {
    id: "cobalt",
    label: "Cobalt",
    description: "차분한 블루 기본형",
    accentHex: "#2950c8",
    softHex: "#e9efff",
    dividerHex: "#b7c5ef",
    inkHex: "#142033",
    mutedHex: "#64748b",
    onAccentHex: "#ffffff"
  },
  {
    id: "forest",
    label: "Forest",
    description: "그린 계열 집중형",
    accentHex: "#2f6b3b",
    softHex: "#e3efe2",
    dividerHex: "#b8d1b6",
    inkHex: "#18261d",
    mutedHex: "#5f6f65",
    onAccentHex: "#ffffff"
  },
  {
    id: "ember",
    label: "Ember",
    description: "코럴 계열 강조형",
    accentHex: "#b44d3e",
    softHex: "#fae7e1",
    dividerHex: "#e3beb5",
    inkHex: "#2b1c19",
    mutedHex: "#7b645d",
    onAccentHex: "#ffffff"
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "짙은 중성톤과 골드 포인트",
    accentHex: "#7d6632",
    softHex: "#f2ead6",
    dividerHex: "#d7c8a2",
    inkHex: "#1f2126",
    mutedHex: "#686a70",
    onAccentHex: "#ffffff"
  }
];

export function isPdfThemeId(value: unknown): value is PdfThemeId {
  return typeof value === "string" && PDF_THEME_IDS.includes(value as PdfThemeId);
}

export function getPdfThemeOption(themeId: PdfThemeId) {
  return PDF_THEME_OPTIONS.find((theme) => theme.id === themeId) ?? PDF_THEME_OPTIONS[0];
}
