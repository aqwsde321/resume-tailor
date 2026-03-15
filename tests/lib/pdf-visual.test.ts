import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { buildResumePdf } from "@/server/pdf/build";
import { companyFixture, createPdfResumeFixture, introFixture, PDF_VISUAL_CASES, PROFILE_IMAGE_DATA_URL } from "../fixtures/pdf-fixture";

const hasTypst = spawnSync("typst", ["--version"], { encoding: "utf8" }).status === 0;
const hasPdftoppm = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" }).status === 0;
const describeWithVisualTools = hasTypst && hasPdftoppm ? describe : describe.skip;
const shouldUpdateBaselines = process.env.UPDATE_PDF_VISUAL_BASELINES === "1";
const baselineDir = path.join(process.cwd(), "tests", "fixtures", "pdf-visual", "baselines");
const debugDir = path.join(process.cwd(), "output", "pdf-visual");

type RasterDiff = {
  mean: number;
  max: number;
};

function renderFirstPagePng(pdfBytes: Uint8Array): Buffer {
  const workDir = mkdtempSync(path.join(tmpdir(), "resume-tailor-pdf-visual-"));

  try {
    const inputPath = path.join(workDir, "input.pdf");
    const outputPrefix = path.join(workDir, "page");
    const outputPath = `${outputPrefix}.png`;

    writeFileSync(inputPath, Buffer.from(pdfBytes));

    const result = spawnSync("pdftoppm", ["-png", "-r", "96", "-f", "1", "-singlefile", inputPath, outputPrefix], {
      encoding: "utf8"
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "pdftoppm 렌더에 실패했어요.");
    }

    return readFileSync(outputPath);
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
}

function toLuminance(r: number, g: number, b: number, a: number): number {
  const alpha = a / 255;
  const compositeR = Math.round(255 * (1 - alpha) + r * alpha);
  const compositeG = Math.round(255 * (1 - alpha) + g * alpha);
  const compositeB = Math.round(255 * (1 - alpha) + b * alpha);
  return 0.2126 * compositeR + 0.7152 * compositeG + 0.0722 * compositeB;
}

function buildVisualSignature(png: PNG, columns = 40, rows = 56): number[] {
  const signature: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    const startY = Math.floor((row * png.height) / rows);
    const endY = Math.max(startY + 1, Math.floor(((row + 1) * png.height) / rows));

    for (let column = 0; column < columns; column += 1) {
      const startX = Math.floor((column * png.width) / columns);
      const endX = Math.max(startX + 1, Math.floor(((column + 1) * png.width) / columns));

      let total = 0;
      let count = 0;

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const index = (y * png.width + x) * 4;
          total += toLuminance(png.data[index], png.data[index + 1], png.data[index + 2], png.data[index + 3]);
          count += 1;
        }
      }

      signature.push(total / count);
    }
  }

  return signature;
}

function compareVisualSignature(a: number[], b: number[]): RasterDiff {
  if (a.length !== b.length) {
    throw new Error(`signature 크기가 달라요. ${a.length} vs ${b.length}`);
  }

  let total = 0;
  let max = 0;

  for (let index = 0; index < a.length; index += 1) {
    const diff = Math.abs(a[index] - b[index]);
    total += diff;
    max = Math.max(max, diff);
  }

  return {
    mean: total / a.length,
    max
  };
}

function buildResumeForVisualCase(withProfileImage: boolean) {
  return createPdfResumeFixture({
    pdfProfileImageDataUrl: withProfileImage ? PROFILE_IMAGE_DATA_URL : "",
    pdfProfileImageVisible: withProfileImage
  });
}

describeWithVisualTools("pdf visual regression", () => {
  for (const visualCase of PDF_VISUAL_CASES) {
    it(`${visualCase.id} 첫 페이지 레이아웃이 baseline과 크게 달라지지 않는다`, async () => {
      const baselinePath = path.join(baselineDir, `${visualCase.id}.png`);
      const actualPath = path.join(debugDir, `${visualCase.id}.actual.png`);
      const resume = buildResumeForVisualCase(visualCase.withProfileImage);
      const pdf = await buildResumePdf(
        resume,
        introFixture,
        companyFixture,
        visualCase.templateId,
        visualCase.themeId
      );
      const actualBuffer = renderFirstPagePng(pdf);

      mkdirSync(debugDir, { recursive: true });

      if (shouldUpdateBaselines) {
        mkdirSync(baselineDir, { recursive: true });
        writeFileSync(baselinePath, actualBuffer);
        return;
      }

      expect(existsSync(baselinePath)).toBe(true);

      const baselinePng = PNG.sync.read(readFileSync(baselinePath));
      const actualPng = PNG.sync.read(actualBuffer);

      expect(actualPng.width).toBe(baselinePng.width);
      expect(actualPng.height).toBe(baselinePng.height);

      const diff = compareVisualSignature(
        buildVisualSignature(actualPng),
        buildVisualSignature(baselinePng)
      );

      if (diff.mean > 6 || diff.max > 28) {
        writeFileSync(actualPath, actualBuffer);
        throw new Error(
          `${visualCase.id} visual diff가 기준을 넘었어요. mean=${diff.mean.toFixed(2)}, max=${diff.max.toFixed(
            2
          )}. 비교용 actual: ${path.relative(process.cwd(), actualPath)}`
        );
      }
    });
  }
});

