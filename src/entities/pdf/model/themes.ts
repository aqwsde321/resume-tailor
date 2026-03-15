export const PDF_THEME_IDS = [
  "cobalt",
  "forest",
  "ember",
  "graphite",
  "onyx",
  "teal",
  "rose",
  "plum",
  "custom"
] as const;

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
  },
  {
    id: "onyx",
    label: "Onyx",
    description: "검정 계열의 모노톤",
    accentHex: "#171717",
    softHex: "#efefef",
    dividerHex: "#d1d1d1",
    inkHex: "#171717",
    mutedHex: "#5f6368",
    onAccentHex: "#ffffff"
  },
  {
    id: "teal",
    label: "Teal",
    description: "차분한 청록 포인트",
    accentHex: "#1f6f78",
    softHex: "#e2f1f2",
    dividerHex: "#b5d6d9",
    inkHex: "#16262a",
    mutedHex: "#607175",
    onAccentHex: "#ffffff"
  },
  {
    id: "rose",
    label: "Rose",
    description: "부드러운 로즈 포인트",
    accentHex: "#b54d72",
    softHex: "#fae6ec",
    dividerHex: "#e4bfd0",
    inkHex: "#2b1a21",
    mutedHex: "#7b6470",
    onAccentHex: "#ffffff"
  },
  {
    id: "plum",
    label: "Plum",
    description: "자주빛 강조형",
    accentHex: "#7b3d69",
    softHex: "#f4e7f0",
    dividerHex: "#dcc2d4",
    inkHex: "#2a1f28",
    mutedHex: "#776672",
    onAccentHex: "#ffffff"
  }
];

export function isPdfThemeId(value: unknown): value is PdfThemeId {
  return typeof value === "string" && PDF_THEME_IDS.includes(value as PdfThemeId);
}

export function getPdfThemeOption(themeId: PdfThemeId) {
  return PDF_THEME_OPTIONS.find((theme) => theme.id === themeId) ?? PDF_THEME_OPTIONS[0];
}

export function normalizePdfAccentHex(value: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(left: string, right: string, ratio: number) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return rgbToHex(
    a.r * (1 - ratio) + b.r * ratio,
    a.g * (1 - ratio) + b.g * ratio,
    a.b * (1 - ratio) + b.b * ratio
  );
}

function getContrastText(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

export function resolvePdfTheme(themeId: PdfThemeId, customAccentHex?: string): PdfThemeOption {
  if (themeId !== "custom") {
    return getPdfThemeOption(themeId);
  }

  const accentHex = normalizePdfAccentHex(customAccentHex ?? "") ?? "#2950c8";

  return {
    id: "custom",
    label: "Custom",
    description: "직접 고른 강조 색상",
    accentHex,
    softHex: mixHex(accentHex, "#ffffff", 0.88),
    dividerHex: mixHex(accentHex, "#d7dce7", 0.65),
    inkHex: "#1b1f24",
    mutedHex: "#5f6b78",
    onAccentHex: getContrastText(accentHex)
  };
}
