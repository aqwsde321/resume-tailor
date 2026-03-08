import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OCR_TIMEOUT_MS = 30000;
const OCR_SCRIPT_PATH = path.join(process.cwd(), "scripts", "vision_ocr.swift");
const TESSERACT_LANGUAGES = "kor+eng";
const TESSERACT_PSM = "6";

export interface CompanyImageOcrInput {
  buffer: Buffer;
  contentType?: string | null;
  sourceUrl?: string;
}

// Docker/Linux에서는 macOS Vision을 쓸 수 없으므로 tesseract 바이너리를 직접 찾는다.
function getTesseractBinaryPath() {
  if (process.platform !== "linux") {
    return null;
  }

  const configuredPath = process.env.TESSERACT_PATH?.trim();
  if (configuredPath) {
    return existsSync(configuredPath) ? configuredPath : null;
  }

  const candidates = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((entry) => path.join(entry, "tesseract"));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function isImageOcrAvailable() {
  return process.platform === "darwin" || getTesseractBinaryPath() !== null;
}

// OCR 도구는 파일 경로를 기대하므로 메모리 버퍼를 임시 이미지 파일로 내려서 전달한다.
async function writeTempImages(tempDir: string, images: CompanyImageOcrInput[]) {
  return Promise.all(
    images.map(async (image, index) => {
      const extension = guessImageExtension(image.contentType, image.sourceUrl);
      const imagePath = path.join(tempDir, `image-${index}${extension}`);
      await writeFile(imagePath, image.buffer);
      return imagePath;
    })
  );
}

async function extractTextWithVision(imagePaths: string[]) {
  const { stdout } = await execFileAsync("swift", [OCR_SCRIPT_PATH, ...imagePaths], {
    timeout: OCR_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024
  });

  const parsed = JSON.parse(stdout) as Array<{ text?: string } | string>;
  return parsed
    .map((entry) =>
      typeof entry === "string" ? entry : typeof entry?.text === "string" ? entry.text : ""
    )
    .map((text) => normalizeOcrText(text))
    .filter(Boolean);
}

// 이미지별 OCR 실패를 허용해 일부 이미지가 깨져도 다른 이미지 텍스트는 최대한 살린다.
async function extractTextWithTesseract(imagePaths: string[], tesseractBinaryPath: string) {
  const outputs = await Promise.all(
    imagePaths.map(async (imagePath) => {
      try {
        const { stdout } = await execFileAsync(
          tesseractBinaryPath,
          [imagePath, "stdout", "-l", TESSERACT_LANGUAGES, "--psm", TESSERACT_PSM],
          {
            timeout: OCR_TIMEOUT_MS,
            maxBuffer: 4 * 1024 * 1024,
            env: {
              ...process.env,
              OMP_THREAD_LIMIT: "1"
            }
          }
        );

        return normalizeOcrText(stdout);
      } catch {
        return "";
      }
    })
  );

  return outputs.filter(Boolean);
}

function guessImageExtension(contentType?: string | null, sourceUrl?: string) {
  const normalizedType = contentType?.toLowerCase().split(";")[0]?.trim();
  switch (normalizedType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
    case "image/heif":
      return ".heic";
    case "image/gif":
      return ".gif";
    default:
      break;
  }

  const pathname = sourceUrl ? new URL(sourceUrl).pathname.toLowerCase() : "";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return ".jpg";
  }

  if (pathname.endsWith(".png")) {
    return ".png";
  }

  if (pathname.endsWith(".webp")) {
    return ".webp";
  }

  if (pathname.endsWith(".heic") || pathname.endsWith(".heif")) {
    return ".heic";
  }

  if (pathname.endsWith(".gif")) {
    return ".gif";
  }

  return ".img";
}

function normalizeOcrText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim())
    .filter((line, index, lines) => line.length > 1 && line !== lines[index - 1])
    .join("\n");
}

export async function extractTextFromImages(
  images: CompanyImageOcrInput[]
): Promise<string[]> {
  if (!isImageOcrAvailable() || images.length === 0) {
    return [];
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "resume-tailor-ocr-"));

  try {
    const imagePaths = await writeTempImages(tempDir, images);

    // 로컬 macOS는 Vision OCR, Docker/Linux는 Tesseract로 같은 인터페이스를 유지한다.
    if (process.platform === "darwin") {
      return await extractTextWithVision(imagePaths);
    }

    const tesseractBinaryPath = getTesseractBinaryPath();
    if (!tesseractBinaryPath) {
      return [];
    }

    return await extractTextWithTesseract(imagePaths, tesseractBinaryPath);
  } catch {
    return [];
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
