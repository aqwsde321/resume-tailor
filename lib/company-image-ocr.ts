import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OCR_TIMEOUT_MS = 30000;
const OCR_SCRIPT_PATH = path.join(process.cwd(), "scripts", "vision_ocr.swift");

export interface CompanyImageOcrInput {
  buffer: Buffer;
  contentType?: string | null;
  sourceUrl?: string;
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
  if (process.platform !== "darwin" || images.length === 0) {
    return [];
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "resume-make-ocr-"));

  try {
    const imagePaths = await Promise.all(
      images.map(async (image, index) => {
        const extension = guessImageExtension(image.contentType, image.sourceUrl);
        const imagePath = path.join(tempDir, `image-${index}${extension}`);
        await writeFile(imagePath, image.buffer);
        return imagePath;
      })
    );

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
  } catch {
    return [];
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
