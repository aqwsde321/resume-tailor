import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/resume/tailor/stream/route";
import { runSkillJsonStream } from "@/server/codex-client";
import { companyFixture, createPdfResumeFixture } from "../fixtures/pdf-fixture";

vi.mock("@/server/codex-client", () => ({
  runSkillJsonStream: vi.fn()
}));

const resume = createPdfResumeFixture();
const plan = {
  headline: {
    text: "관리자 도구 경험을 가진 프론트엔드 개발자",
    evidenceIds: ["experience-1", "project-1"],
    lineCitations: [{ requirementIds: ["preferred-2"], evidenceIds: ["experience-1", "project-1"] }],
  },
  summary: {
    text: "React 기반 관리자 도구와 운영 대시보드 개발 경험을 보유했습니다.",
    evidenceIds: ["experience-1", "project-1"],
    lineCitations: [{ requirementIds: ["preferred-2"], evidenceIds: ["experience-1", "project-1"] }],
  },
  experience: [
    {
      sourceId: "experience-1",
      description: "운영 도구와 대시보드를 개발했습니다.",
      evidenceIds: ["experience-1"],
      lineCitations: [{ requirementIds: ["job-context"], evidenceIds: ["experience-1"] }],
    }
  ],
  projects: [
    {
      sourceId: "project-1",
      description: "관리자 화면과 API를 설계했습니다.",
      evidenceIds: ["project-1"],
      lineCitations: [{ requirementIds: ["preferred-2"], evidenceIds: ["project-1"] }],
    },
  ],
  requirementMatches: [
    {
      requirementId: "requirement-1",
      matchType: "direct",
      evidenceIds: ["skill-1"],
      reason: "이력서에 Java 사용 근거가 있습니다."
    },
    {
      requirementId: "requirement-2",
      matchType: "direct",
      evidenceIds: ["skill-2"],
      reason: "이력서에 Spring Boot 사용 근거가 있습니다."
    },
    {
      requirementId: "requirement-3",
      matchType: "adjacent",
      evidenceIds: ["project-1"],
      reason: "PostgreSQL 프로젝트 경험이 RDB 업무와 연결됩니다."
    },
    {
      requirementId: "preferred-1",
      matchType: "direct",
      evidenceIds: ["skill-4"],
      reason: "이력서에 Docker 사용 근거가 있습니다."
    },
    {
      requirementId: "preferred-2",
      matchType: "direct",
      evidenceIds: ["project-1"],
      reason: "프로젝트에 관리자 대시보드 설계 경험이 있습니다."
    },
    { requirementId: "job-context", matchType: "transferable", evidenceIds: ["experience-1"], reason: "운영 도구 개발 경험이 유사합니다." },
    { requirementId: "company-context", matchType: "gap", evidenceIds: [], reason: "직접적인 도메인 경험이 확인되지 않습니다." },
  ],
  skillIds: ["skill-2", "skill-1"],
  highlightIds: ["highlight-2"],
  strengthIds: ["strength-1"]
};

function parseSse(text: string) {
  return text
    .trim()
    .split("\n\n")
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      return {
        event: eventLine?.slice("event:".length).trim() ?? "message",
        data: dataLine ? JSON.parse(dataLine.slice("data:".length).trim()) : null
      };
    });
}

async function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/resume/tailor/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/resume/tailor/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("지원 공고에 맞춘 이력서 초안과 근거 연결을 반환한다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce(plan);

    const response = await post({ resume, company: companyFixture });
    const events = parseSse(await response.text());
    const result = events.find((event) => event.event === "result")?.data.data;

    expect(response.status).toBe(200);
    expect(result.resume).toMatchObject({
      summary: plan.summary.text,
      experience: [
        {
          company: "Acme",
          role: "Backend Engineer",
          description: plan.experience[0]?.description
        }
      ],
      projects: [{ name: "Admin Console", description: plan.projects[0]?.description }],
      techStack: ["Spring Boot", "Java"]
    });
    expect(result.plan).toEqual(plan);
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]).toMatchObject({
      skillName: "tailor-resume",
      inputText: expect.stringContaining("experience-1")
    });
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain("requirement-1");
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain(
      "주문 API와 운영 시스템을 개발합니다."
    );
  });

  it("사용자가 확인한 경험을 인용할 수 있고 요청에 없는 확인 경험은 인용할 수 없다", async () => {
    const fact = {
      id: "64c8f4fc-0c30-4517-8322-34bfd35ba358",
      draft: { category: "project", title: "서비스 운영", organization: "", role: "담당 개발자", period: "2025",
        description: "QuickLoom 배포 시간을 30% 단축했습니다.", techStack: ["QuickLoom"] },
    };
    const factId = `confirmed-${fact.id}`;
    const withFact = { ...plan, summary: {
      text: fact.draft.description, evidenceIds: [factId], lineCitations: [{ evidenceIds: [factId], requirementIds: [] }],
    } };
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce(withFact).mockResolvedValueOnce(withFact);

    const response = await post({ resume, company: companyFixture, confirmedExperiences: [fact] });
    expect(parseSse(await response.text()).find((event) => event.event === "result")?.data.data.plan).toEqual(withFact);
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain(fact.draft.description);
    const withoutFact = parseSse(await (await post({ resume, company: companyFixture })).text());
    expect(withoutFact.find((event) => event.event === "result")).toBeUndefined();
  });

  it("Codex 출력 스키마에 근거 ID 개수 제한을 포함한다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce(plan);

    await post({ resume, company: companyFixture });

    const outputSchema = vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.outputSchema;
    const serializedSchema = JSON.stringify(outputSchema);
    expect(serializedSchema).toContain("\"minItems\":1");
    expect(serializedSchema).toContain("\"maxItems\":4");
    expect(serializedSchema).toContain("\"maxItems\":6");
    expect(serializedSchema.match(/"lineCitations":/g)).toHaveLength(4);
  });

  it("문구별로 인용한 공고 요건과 근거를 보존하고 다른 문구의 근거를 빌려온 연결은 거절한다", async () => {
    const linkedPlan = {
      ...plan,
      summary: {
        text: "관리자 도구를 개발했습니다.\n운영 대시보드를 설계했습니다.",
        evidenceIds: ["experience-1", "project-1"],
        lineCitations: [
          { requirementIds: ["job-context"], evidenceIds: ["experience-1"] },
          { requirementIds: ["preferred-2"], evidenceIds: ["project-1"] },
        ],
      },
    };
    const valid = linkedPlan.summary.lineCitations;
    const invalid = [
      [valid[0]],
      [{ ...valid[0], requirementIds: ["preferred-2"] }, valid[1]],
      [{ ...valid[0], requirementIds: ["company-context"] }, valid[1]],
      [{ ...valid[0], evidenceIds: ["invented-source"] }, valid[1]],
    ];
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce(linkedPlan);
    const accepted = parseSse(await (await post({ resume, company: companyFixture })).text());
    expect(accepted.find((event) => event.event === "result")?.data.data.plan).toEqual(linkedPlan);
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain("company-context");

    for (const lineCitations of invalid) {
      vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
        ...linkedPlan, summary: { ...linkedPlan.summary, lineCitations },
      });
      const events = parseSse(await (await post({ resume, company: companyFixture })).text());
      expect(events.find((event) => event.event === "result")).toBeUndefined();
      expect(events.find((event) => event.event === "error")).toBeDefined();
    }
  });

  it("문구에 등장하는 기술 후보를 받아 검토 화면에 전달한다", async () => {
    const withTechnologies = { ...plan, summary: {
      ...plan.summary,
      text: "QuickLoom으로 대시보드를 개발했습니다.",
      technologies: ["QuickLoom"]
    } };
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce(withTechnologies);

    const events = parseSse(await (await post({ resume, company: companyFixture })).text());
    expect(events.find((event) => event.event === "result")?.data.data.plan).toEqual(withTechnologies);
    const output = JSON.stringify(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.outputSchema);
    expect(output.match(/"technologies":/g)).toHaveLength(4);
  });

  it("새 요약은 근거가 검증된 줄이라도 세 줄을 넘기지 않는다", async () => {
    const lines = [
      "운영 도구를 개발했습니다.",
      "관리자 화면을 설계했습니다.",
      "API를 설계했습니다.",
      "대시보드를 구현했습니다."
    ];
    const summary = {
      ...plan.summary,
      lineCitations: lines.map(() => plan.summary.lineCitations[0])
    };
    vi.mocked(runSkillJsonStream)
      .mockResolvedValueOnce({ ...plan, summary: { ...summary, text: lines.slice(0, 3).join("\n"), lineCitations: summary.lineCitations.slice(0, 3) } })
      .mockResolvedValueOnce({ ...plan, summary: { ...summary, text: lines.join("\n") } });

    const accepted = parseSse(await (await post({ resume, company: companyFixture })).text());
    expect(accepted.find((event) => event.event === "result")).toBeDefined();

    const rejected = parseSse(await (await post({ resume, company: companyFixture })).text());
    expect(rejected.find((event) => event.event === "result")).toBeUndefined();
    expect(rejected.find((event) => event.event === "error")?.data.message).toBe("맞춤 이력서 요약이 세 줄을 넘었어요.");
  });

  it("이력서에 없는 근거 참조를 반환하면 결과를 내보내지 않는다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
      ...plan,
      summary: { ...plan.summary, evidenceIds: ["invented-source"] }
    });

    const response = await post({ resume, company: companyFixture });
    const events = parseSse(await response.text());

    expect(events.find((event) => event.event === "result")).toBeUndefined();
    expect(events.find((event) => event.event === "error")?.data.message).toBe(
      "맞춤 이력서 결과에 공고 요건 또는 원본 이력서에 없는 근거가 있어요."
    );
  });

  it("공고에 없는 요건 ID를 매칭하면 결과를 내보내지 않는다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
      ...plan,
      requirementMatches: plan.requirementMatches.map((match, index) =>
        index === 0 ? { ...match, requirementId: "requirement-99" } : match
      )
    });

    const response = await post({ resume, company: companyFixture });
    const events = parseSse(await response.text());

    expect(events.find((event) => event.event === "result")).toBeUndefined();
    expect(events.find((event) => event.event === "error")?.data.message).toBe(
      "맞춤 이력서 결과에 공고 요건 또는 원본 이력서에 없는 근거가 있어요."
    );
  });

  it("이력서나 공고가 없으면 400을 반환한다", async () => {
    const response = await post({ resume, company: null });

    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
    expect(runSkillJsonStream).not.toHaveBeenCalled();
  });
});
