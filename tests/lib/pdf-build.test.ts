import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { auditResumePdf } from "@/server/pdf/ats-audit";
import { PDF_TEMPLATE_IDS } from "@/entities/pdf/model/templates";
import { buildResumePdf, buildResumeSvgPreview } from "@/server/pdf/build";
import { companyFixture, createPdfResumeFixture, introFixture, PROFILE_IMAGE_DATA_URL } from "../fixtures/pdf-fixture";

const hasTools = ["typst", "pdffonts", "pdftotext", "pdfinfo"].every(
  (tool) => spawnSync(tool, [tool === "typst" ? "--version" : "-v"], { encoding: "utf8" }).status === 0
);
const describeWithTools = hasTools ? describe : describe.skip;

function inspect(pdf: Uint8Array) {
  const directory = mkdtempSync(path.join(tmpdir(), "resume-tailor-pdf-build-"));
  try {
    const file = path.join(directory, "resume.pdf");
    writeFileSync(file, Buffer.from(pdf));
    const run = (tool: string, args: string[]) => spawnSync(tool, [...args, file], { encoding: "utf8" }).stdout;
    const pages = Number(run("pdfinfo", []).match(/Pages:\s+(\d+)/)?.[1]);
    return {
      fonts: run("pdffonts", []),
      pages,
      pageTexts: Array.from({ length: pages }, (_, index) => {
        const page = String(index + 1);
        return spawnSync("pdftotext", ["-f", page, "-l", page, "-layout", file, "-"], { encoding: "utf8" }).stdout;
      })
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

// 텍스트 추출기는 기호 주변 공백을 일정하게 보존하지 않으므로 공백을 지우고 비교한다.
const lastLine = (text: string) => (text.trimEnd().split("\n").at(-1) ?? "").replace(/\s+/g, "");

const longResume = createPdfResumeFixture({
  experience: Array.from({ length: 9 }, (_, index) => ({
    company: `회사 ${index + 1}`,
    role: "Backend Engineer",
    period: `20${10 + index}.01 - 20${11 + index}.01`,
    description: "주문 API와 운영 도구를 개발했습니다. 조회 성능을 개선하고 배포 절차를 정리했습니다. ".repeat(5)
  })),
  projects: Array.from({ length: 6 }, (_, index) => ({
    name: `프로젝트 ${index + 1}`,
    subtitle: "운영 도구",
    description: "관리자 화면과 API를 설계했습니다. ".repeat(4),
    link: "",
    linkLabel: "",
    techStack: ["Java", "Spring Boot"],
    highlights: ["관리자 대시보드 설계", "조회 응답 속도 개선", "운영 알림 정리"]
  }))
});

describeWithTools("PDF 빌드 결과", () => {
  for (const templateId of PDF_TEMPLATE_IDS) {
    it(`${templateId}: 한글은 저장소에 포함한 폰트로 내장한다`, async () => {
      const { fonts } = inspect(await buildResumePdf(createPdfResumeFixture(), introFixture, companyFixture, templateId));
      expect(fonts).toContain("Pretendard");
      expect(fonts).not.toMatch(/AppleSDGothicNeo|ArialUnicode/);
    });

    it(`${templateId}: 여러 쪽이면 모든 쪽에 쪽 번호를 표시한다`, async () => {
      const { pages, pageTexts } = inspect(await buildResumePdf(longResume, introFixture, companyFixture, templateId));
      expect(pages).toBeGreaterThan(1);
      pageTexts.forEach((text, index) => expect(lastLine(text)).toBe(`${index + 1}/${pages}`));
    });

    it(`${templateId}: 한 쪽이면 쪽 번호를 표시하지 않는다`, async () => {
      const { pages, pageTexts } = inspect(await buildResumePdf(createPdfResumeFixture(), introFixture, companyFixture, templateId));
      expect(pages).toBe(1);
      expect(lastLine(pageTexts[0]!)).not.toMatch(/^\d+\/\d+$/);
    });
  }
});

const hasTypst = spawnSync("typst", ["--version"]).status === 0;
(hasTypst ? describe : describe.skip)("프로필 이미지 렌더링", () => {
  for (const templateId of PDF_TEMPLATE_IDS) {
    it(`${templateId}: 프로필 이미지를 포함한 실제 SVG와 PDF를 빌드한다`, async () => {
      const resume = createPdfResumeFixture({ pdfProfileImageVisible: true, pdfProfileImageDataUrl: PROFILE_IMAGE_DATA_URL });
      const preview = await buildResumeSvgPreview(resume, introFixture, companyFixture, templateId);
      expect(preview.pages.length).toBeGreaterThan(0);
      expect(preview.pages[0]).toContain("<svg");
      expect(preview.pages.join("")).toContain("data:image/png;base64,");
      const pdf = await buildResumePdf(resume, introFixture, companyFixture, templateId);
      expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
    });
  }
});

const hasPdfTextExtractor = spawnSync("pdftotext", ["-v"]).status === 0;
(hasTypst && hasPdfTextExtractor ? describe : describe.skip)("PDF ATS 텍스트 추출", () => {
  it("프로필 이미지가 있어도 이름과 핵심 기술의 텍스트 레이어를 유지한다", async () => {
    const resume = createPdfResumeFixture({ pdfProfileImageVisible: true, pdfProfileImageDataUrl: PROFILE_IMAGE_DATA_URL });
    const pdf = await buildResumePdf(resume, introFixture, companyFixture, "classic", "cobalt");
    const audit = await auditResumePdf(pdf, resume, companyFixture);
    expect(audit.status).toBe("checked");
    expect(audit.textCharacterCount).toBeGreaterThan(100);
    expect(audit.nameFound).toBe(true);
    expect(audit.requiredTerms.matched).toEqual(expect.arrayContaining(["Java", "PostgreSQL"]));
  });
});
