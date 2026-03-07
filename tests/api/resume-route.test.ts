import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/resume/route";
import { runSkillJson } from "@/lib/codex-client";

vi.mock("@/lib/codex-client", () => ({
  runSkillJson: vi.fn()
}));

describe("POST /api/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 요청이면 resume JSON을 반환한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      name: "홍길동",
      summary: "백엔드 개발자",
      desiredPosition: "Backend Engineer",
      careerYears: 3,
      techStack: ["TypeScript", "Node.js"],
      experience: [],
      projects: [],
      achievements: [],
      strengths: []
    });

    const request = new Request("http://localhost/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "이력서 원문" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.name).toBe("홍길동");
    expect(mockedRunSkillJson).toHaveBeenCalledTimes(1);
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.skillName).toBe("resume-to-json");
  });

  it("모델과 이성 수준을 넘기면 그대로 실행 옵션에 반영한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      name: "홍길동",
      summary: "백엔드 개발자",
      desiredPosition: "Backend Engineer",
      careerYears: 3,
      techStack: ["TypeScript"],
      experience: [],
      projects: [],
      achievements: [],
      strengths: []
    });

    const request = new Request("http://localhost/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "이력서 원문",
        agent: {
          model: "gpt-5.4",
          modelReasoningEffort: "high"
        }
      })
    });

    await POST(request);

    expect(mockedRunSkillJson.mock.calls[0]?.[0]).toMatchObject({
      skillName: "resume-to-json",
      model: "gpt-5.4",
      modelReasoningEffort: "high"
    });
  });

  it("빈 텍스트면 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain("요청 데이터 검증");
  });
});
