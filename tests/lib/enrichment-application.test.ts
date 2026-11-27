import { describe, expect, it } from "vitest";
import { applyEnrichmentDrafts, applyProjectEnrichmentReview } from "@/entities/workspace/model/enrichment-application";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, type CompanyWork } from "@/entities/workspace/model/workspace";
import { CompanySchema, IntroSchema, ResumeSchema } from "@/shared/lib/schemas";
describe("collected experience drafts", () => {
  it("선택한 기존 프로젝트를 보완하고 원래 내용을 지우지 않는다", () => {
    const resume = ResumeSchema.parse({ projects: [{ name: "결제 시스템", description: "API를 개발했습니다." }] });
    const updated = applyEnrichmentDrafts(resume, [{ target: "project:0", draft: { category: "project", title: "결제 시스템", organization: "", role: "", period: "", description: "재시도 정책을 구현했습니다.", techStack: ["Java"] } }]);
    expect(updated.projects).toHaveLength(1);
    expect(updated.projects[0].description).toContain("API를 개발했습니다.");
    expect(updated.projects[0].description).toContain("재시도 정책을 구현했습니다.");
    expect(resume.projects[0].description).toBe("API를 개발했습니다.");
  });

  it("기존 프로젝트나 PDF 요약이 달라졌으면 확인한 수정안으로 덮어쓰지 않는다", () => {
    const resume = ResumeSchema.parse({ summary: "원본 요약", projects: [
      { name: "신고 시스템", description: "상태 관리 API를 개발했습니다." },
      { name: "다른 프로젝트", description: "별도 서비스 개발" },
    ] });
    const master = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", ""), resume).master!;
    const work = createCompanyWork(master, newTextDocument("job", "공고", ""));
    const revision = { description: "관리자가 승인하면 상태를 변경했습니다.", summary: "관리자 승인으로 신고 상태를 변경하는 API를 구현했습니다." };
    const company = CompanySchema.parse({ requirements: ["상태 전이 구현"] });
    const reviewed: CompanyWork = { ...work, company, enrichment: [{
      id: crypto.randomUUID(), topic: "상태 전이", status: "draft", messages: [], drafts: [],
      projectReview: { index: 0, project: resume.projects[0], company, summary: resume.summary, revision },
    }] };
    const id = reviewed.enrichment[0].id;
    const updated = applyProjectEnrichmentReview(reviewed, id, revision);
    expect(updated?.projects.map(({ description }) => description)).toEqual([revision.description, "별도 서비스 개발"]);
    expect(updated?.summary).toBe(revision.summary);
    expect(applyProjectEnrichmentReview({
      ...reviewed, resume: { ...resume, projects: [...resume.projects].reverse() },
    }, id, revision)).toBeUndefined();
    expect(applyProjectEnrichmentReview({
      ...reviewed, intro: IntroSchema.parse({ longIntro: "다른 PDF 요약" }),
    }, id, revision)).toBeUndefined();
    expect(applyProjectEnrichmentReview({
      ...reviewed, company: { ...company, requirements: ["다른 자격 요건"] },
    }, id, revision)).toBeUndefined();
  });
});
