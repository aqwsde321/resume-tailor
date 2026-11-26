import { describe, expect, it } from "vitest";
import { setCompanyRequirementGap } from "@/entities/workspace/model/company-requirement-gaps";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { CompanySchema, ResumeSchema } from "@/shared/lib/schemas";

function setup() {
  const workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "개발 경력"), ResumeSchema.parse({}));
  const document = newTextDocument("job", "공고", "Kubernetes 운영 경험");
  const company = CompanySchema.parse({ companyName: "예시 회사", jobTitle: "백엔드 개발자", requirements: ["Kubernetes 운영 경험", "Java 개발 경험"] });
  const work = { ...createCompanyWork(workspace.master!, document), company, companySourceText: document.text };
  return { workspace, work };
}

describe("공고별 해당 경험 없음 기록", () => {
  it("기존 작업을 읽고, 중복 없이 저장하며, 취소할 수 있다", () => {
    const { workspace, work } = setup();
    const legacy = WorkspaceSchema.parse({ ...workspace, works: [work] }).works[0];
    const marked = setCompanyRequirementGap(legacy, "Kubernetes 운영 경험", true);
    expect(setCompanyRequirementGap(marked, "Kubernetes 운영 경험", true)).toBe(marked);

    const [saved, other] = WorkspaceSchema.parse({ ...workspace, works: [marked, { ...work, id: crypto.randomUUID() }] }).works;
    expect(saved.knownGaps).toEqual(["Kubernetes 운영 경험"]);
    expect(other.knownGaps ?? []).toEqual([]);
    expect(setCompanyRequirementGap(saved, "Kubernetes 운영 경험", false).knownGaps).toEqual([]);
  });

  it("요건 순서가 바뀌어도 원문으로 구분하고, 미확정 공고의 요건은 기록하지 않는다", () => {
    const { work } = setup();
    const marked = setCompanyRequirementGap(work, "Kubernetes 운영 경험", true);
    const reordered = { ...marked, company: { ...work.company, requirements: [...work.company.requirements].reverse() } };
    expect(setCompanyRequirementGap(reordered, "Java 개발 경험", true).knownGaps).toEqual(["Kubernetes 운영 경험", "Java 개발 경험"]);
    expect(setCompanyRequirementGap(reordered, "공고에 없는 요건", true)).toBe(reordered);

    const unconfirmed = { ...work, document: { ...work.document, text: "수정한 공고" } };
    expect(setCompanyRequirementGap(unconfirmed, "Kubernetes 운영 경험", true)).toBe(unconfirmed);
  });
});
