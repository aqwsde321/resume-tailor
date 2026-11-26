import { describe, expect, it } from "vitest";
import { getConfirmedExperiences, saveConfirmedExperience } from "@/entities/workspace/model/confirmed-experience";
import { buildTailoringClaimWarnings } from "@/entities/resume/model/tailoring-claim-warnings";
import type { ResumeTailoringPlan } from "@/entities/resume/model/resume-tailoring";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { ResumeSchema } from "@/shared/lib/schemas";

const resume = ResumeSchema.parse({ summary: "개발 경험" });
const workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "원본"), resume);
const first = createCompanyWork(workspace.master!, newTextDocument("job", "A", "A 공고"));
const second = createCompanyWork(workspace.master!, newTextDocument("job", "B", "B 공고"));
const fact = {
  id: "64c8f4fc-0c30-4517-8322-34bfd35ba358",
  draft: { category: "project" as const, title: "서비스 운영", organization: "", role: "담당 개발자", period: "2025",
    description: "QuickLoom 배포 시간을 30% 단축했습니다.", techStack: ["QuickLoom"] },
};
const common = { ...fact, id: "da2fcfe0-efe0-47ed-829f-b768aad3b191" };

describe("확인 경험 재사용", () => {
  it("공통 경험은 모든 회사에서, 전용 경험은 저장한 회사에서만 재사용한다", () => {
    const initial = { ...workspace, works: [first, second] };
    const scoped = saveConfirmedExperience(initial, fact, "company", first.id);
    const stored = WorkspaceSchema.parse(saveConfirmedExperience(scoped, common, "common"));
    expect(getConfirmedExperiences(stored, stored.works[0])).toEqual([fact, common]);
    expect(getConfirmedExperiences(stored, stored.works[1])).toEqual([common]);
  });

  it("같은 초안의 범위를 변경하면 이전 범위의 기록도 갱신한다", () => {
    const initial = { ...workspace, works: [first, second] };
    const saved = saveConfirmedExperience(initial, fact, "company", first.id);
    const shared = saveConfirmedExperience(saved, fact, "common", first.id);
    expect(shared.works[0].confirmedExperiences).toEqual([]);
    expect(getConfirmedExperiences(shared, shared.works[1])).toEqual([fact]);
  });

  it("문구가 인용한 확인 경험의 기술과 수치를 경고 근거에 포함한다", () => {
    const plan: ResumeTailoringPlan = {
      headline: { text: "개발 경험", evidenceIds: ["summary"] },
      summary: { text: fact.draft.description, evidenceIds: [`confirmed-${fact.id}`] },
      experience: [], projects: [], requirementMatches: [], skillIds: [], highlightIds: [], strengthIds: [],
    };
    expect(buildTailoringClaimWarnings(resume, plan, [], [fact]).has("summary")).toBe(false);
    const revised = { ...plan, summary: { ...plan.summary, text: "QuickLoom 배포 시간을 40% 단축했습니다." } };
    expect(buildTailoringClaimWarnings(resume, revised, [], [fact]).get("summary")).toEqual({ numbers: ["40%"], technologies: [] });
  });
});
