import { describe, expect, it } from "vitest";
import { archiveCompanyVersion, compareCompanyVersions, restoreCompanyVersion } from "@/entities/workspace/model/company-version-history";
import { createCompanyWork, newTextDocument, publishMasterResume } from "@/entities/workspace/model/operations";
import { createEmptyWorkspace, WorkspaceSchema } from "@/entities/workspace/model/workspace";
import { IntroSchema, ResumeSchema } from "@/shared/lib/schemas";

const earlier = ResumeSchema.parse({ summary: "기존 소개", techStack: ["Java"], projects: [{ name: "API", description: "기존 문구" }] });
const later = ResumeSchema.parse({ ...earlier, techStack: ["Java", "Kafka"], projects: [{ ...earlier.projects[0], description: "Kafka 운영" }] });
const firstIntro = IntroSchema.parse({ longIntro: "기존 PDF 소개" });
const laterIntro = IntroSchema.parse({ longIntro: "바뀐 PDF 소개" });

describe("회사별 이력서 버전 이력", () => {
  it("두 버전에서 바뀐 부분만 이전·이후 텍스트와 함께 보여준다", () => {
    expect(compareCompanyVersions({ resume: earlier, intro: firstIntro }, { resume: later, intro: laterIntro }))
      .toEqual([
        { label: "기술", before: "Java", after: "Java\nKafka" },
        { label: "프로젝트", before: "API\n기존 문구", after: "API\nKafka 운영" },
        { label: "PDF 상단 요약", before: "기존 PDF 소개", after: "바뀐 PDF 소개" },
      ]);
    expect(compareCompanyVersions({ resume: later, intro: laterIntro }, { resume: later, intro: laterIntro })).toEqual([]);
  });

  it("이전 저장본에도 복원 기능을 제공하고 복원 직전 내용과 사유를 보관한다", () => {
    const workspace = publishMasterResume(createEmptyWorkspace(), newTextDocument("resume", "이력서", "원본"), later);
    const original = createCompanyWork(workspace.master!, newTextDocument("job", "공고", "이력서 접수"));
    const legacyVersion = { id: crypto.randomUUID(), resume: earlier, intro: firstIntro, createdAt: original.createdAt };
    const stored = WorkspaceSchema.parse({
      ...workspace, works: [{ ...original, intro: laterIntro, versions: [legacyVersion] }],
    }).works[0];
    const restored = restoreCompanyVersion(stored, legacyVersion.id);
    expect(restored.resume).toEqual(earlier);
    expect(restored.intro).toEqual(firstIntro);
    expect(restored.versions.at(-1)).toMatchObject({ resume: later, intro: laterIntro, cause: "before-restore" });
    expect(restored.resumeDocument?.text).toContain("기존 문구");
    expect(restoreCompanyVersion(stored, "missing")).toBe(stored);

    const saved = archiveCompanyVersion(restored, "manual", "  기술을 다시 확인함  ");
    expect(saved.versions.at(-1)).toMatchObject({ cause: "manual", note: "기술을 다시 확인함" });
  });
});
