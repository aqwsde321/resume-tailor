import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { buildResumePdf, buildResumeSvgPreview } from "@/server/pdf/build";
import { companyFixture, createPdfResumeFixture, introFixture, PROFILE_IMAGE_DATA_URL } from "../fixtures/pdf-fixture";

const hasTypst = spawnSync("typst", ["--version"], { encoding: "utf8" }).status === 0;
const describeWithTypst = hasTypst ? describe : describe.skip;
const resumeFixture = createPdfResumeFixture({
  pdfProfileImageDataUrl: PROFILE_IMAGE_DATA_URL,
  pdfProfileImageVisible: true
});

describeWithTypst("pdf build smoke", () => {
  it("모든 템플릿이 프로필 이미지와 함께 SVG 미리보기를 실제로 만든다", async () => {
    for (const templateId of ["classic", "compact", "modern", "typographic"] as const) {
      const preview = await buildResumeSvgPreview(
        resumeFixture,
        introFixture,
        companyFixture,
        templateId,
        "cobalt"
      );

      expect(preview.pages.length).toBeGreaterThan(0);
      expect(preview.pages[0]).toContain("<svg");
    }
  });

  it("프로필 이미지가 있어도 실제 PDF를 만들 수 있다", async () => {
    const pdf = await buildResumePdf(
      resumeFixture,
      introFixture,
      companyFixture,
      "classic",
      "cobalt"
    );

    expect(pdf.byteLength).toBeGreaterThan(0);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
