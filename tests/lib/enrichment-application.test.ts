import { describe, expect, it } from "vitest";
import { applyEnrichmentDrafts } from "@/entities/workspace/model/enrichment-application";
import { ResumeSchema } from "@/shared/lib/schemas";
describe("collected experience drafts", () => {
  it("선택한 기존 프로젝트를 보완하고 원래 내용을 지우지 않는다", () => {
    const resume = ResumeSchema.parse({ projects: [{ name: "결제 시스템", description: "API를 개발했습니다." }] });
    const updated = applyEnrichmentDrafts(resume, [{ target: "project:0", draft: { category: "project", title: "결제 시스템", organization: "", role: "", period: "", description: "재시도 정책을 구현했습니다.", techStack: ["Java"] } }]);
    expect(updated.projects).toHaveLength(1);
    expect(updated.projects[0].description).toContain("API를 개발했습니다.");
    expect(updated.projects[0].description).toContain("재시도 정책을 구현했습니다.");
    expect(resume.projects[0].description).toBe("API를 개발했습니다.");
  });
});
