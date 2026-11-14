import { describe, expect, it } from "vitest";
import { ResumeSchema, CompanySchema, IntroSchema } from "@/shared/lib/schemas";
import { buildResumeTailoringEvidence } from "@/entities/resume/model/resume-tailoring";
import { buildTypstResumeDocument } from "@/entities/pdf/model/view-model";
import { resumeToMarkdown } from "@/entities/workspace/model/operations";
describe("resume education and qualifications", () => {
  const resume = ResumeSchema.parse({ education: ["예시대학교 수학 학사"], qualifications: ["SQLD 2022"], summary: "원본 소개" });
  it("학력·자격을 맞춤 분석 근거로 전달한다", () => {
    expect(buildResumeTailoringEvidence(resume).map((item) => item.text)).toContain("예시대학교 수학 학사");
  });
  it("PDF와 Markdown에서도 학력·자격과 요약을 보존한다", () => {
    const view = buildTypstResumeDocument(resume, IntroSchema.parse({}), CompanySchema.parse({}));
    expect(view.education).toEqual(resume.education);
    expect(view.qualifications).toEqual(resume.qualifications);
    expect(view.sections[0].paragraphs).toContain("원본 소개");
    expect(resumeToMarkdown(resume)).toContain("SQLD 2022");
  });
});
