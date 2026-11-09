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
    evidenceIds: ["experience-1", "project-1"]
  },
  summary: {
    text: "React 기반 관리자 도구와 운영 대시보드 개발 경험을 보유했습니다.",
    evidenceIds: ["experience-1", "project-1"]
  },
  experience: [
    {
      sourceId: "experience-1",
      description: "운영 도구와 대시보드를 개발했습니다.",
      evidenceIds: ["experience-1"]
    }
  ],
  projects: [
    {
      sourceId: "project-1",
      description: "관리자 화면과 API를 설계했습니다.",
      evidenceIds: ["project-1"]
    }
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
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain(
      "주문 API와 운영 시스템을 개발합니다."
    );
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
      "맞춤 이력서 결과에 원본에서 찾을 수 없는 항목이 있어요."
    );
  });

  it("이력서나 공고가 없으면 400을 반환한다", async () => {
    const response = await post({ resume, company: null });

    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
    expect(runSkillJsonStream).not.toHaveBeenCalled();
  });
});
