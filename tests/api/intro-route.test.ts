import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/intro/route";
import { runSkillJson } from "@/lib/codex-client";

vi.mock("@/lib/codex-client", () => ({
  runSkillJson: vi.fn()
}));

const resumePayload = {
  name: "홍길동",
  summary: "백엔드 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 3,
  techStack: ["TypeScript", "Node.js"],
  experience: [],
  projects: [],
  achievements: [],
  strengths: []
};

const companyPayload = {
  companyName: "Acme",
  companyDescription: "테크 스타트업",
  jobTitle: "Backend Engineer",
  jobDescription: "서버 개발",
  requirements: ["Node.js"],
  preferredSkills: ["AWS"],
  techStack: ["TypeScript"]
};

describe("POST /api/intro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 요청이면 intro JSON을 반환한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      oneLineIntro: "백엔드 실무 3년, 문제 해결형 개발자",
      shortIntro: "실무 3년 경력의 백엔드 개발자입니다.",
      fitReasons: ["Node.js 기반 서버 개발 경험이 공고 요구사항과 맞닿아 있습니다."],
      matchedSkills: ["Node.js", "TypeScript", "Spring Boot"],
      gapNotes: [
        "AWS 경험은 이력서에서 직접 확인되지 않습니다.",
        "Kubernetes 경험이 필요합니다."
      ]
    });

    const request = new Request("http://localhost/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumePayload,
        company: companyPayload
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.oneLineIntro).toContain("개발자");
    expect(body.data.fitReasons).toHaveLength(1);
    expect(body.data.matchedSkills).toEqual(["TypeScript"]);
    expect(body.data.gapNotes).toEqual(["AWS 경험은 이력서에서 직접 확인되지 않습니다."]);
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.skillName).toBe("generate-intro");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("[분석 힌트]");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("\"matchedSkills\": [");
  });

  it("이전 형식 응답이면 분석 힌트를 기준으로 기본 기술을 보정한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      oneLineIntro: "백엔드 실무 3년, 문제 해결형 개발자",
      shortIntro: "실무 3년 경력의 백엔드 개발자입니다."
    });

    const request = new Request("http://localhost/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumePayload,
        company: companyPayload
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.fitReasons).toEqual([]);
    expect(body.data.matchedSkills).toEqual(["TypeScript"]);
    expect(body.data.gapNotes).toEqual([]);
  });

  it("resume 타입이 잘못되면 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: { ...resumePayload, careerYears: "3년" },
        company: companyPayload
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
