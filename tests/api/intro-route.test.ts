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
      longIntro:
        "실무 3년 동안 Node.js와 TypeScript 기반 서버를 개발하며 API 구조를 정리하고 운영 이슈를 안정적으로 대응해 왔습니다. 서비스 요구사항을 빠르게 해석해 백엔드 구조로 옮기는 데 강점이 있고, 문제를 재현하고 원인을 좁혀 가는 방식으로 장애를 해결해 왔습니다. 특히 Node.js 기반 서버 개발 경험은 이번 공고의 핵심 요구사항과 직접 맞닿아 있습니다. TypeScript를 활용해 유지보수하기 쉬운 코드를 만드는 데 익숙하며, 팀과 함께 안정적인 백엔드 운영 기준을 정리해 온 경험도 있습니다. 입사 후에도 서비스 구조를 빠르게 이해하고 안정적인 API 운영에 기여할 수 있습니다.",
      fitReasons: ["Node.js 기반 서버 개발 경험이 공고 요구사항과 맞닿아 있습니다."],
      matchedSkills: ["Node.js", "TypeScript", "Spring Boot"],
      gapNotes: [
        "AWS 경험은 이력서에서 직접 확인되지 않습니다.",
        "Kubernetes 경험이 필요합니다."
      ],
      missingButRelevant: []
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
    expect(body.data.longIntro).toContain("Node.js");
    expect(body.data.fitReasons).toHaveLength(1);
    expect(body.data.matchedSkills).toEqual(["TypeScript"]);
    expect(body.data.gapNotes).toEqual(["AWS 경험은 이력서에서 직접 확인되지 않습니다."]);
    expect(body.data.missingButRelevant).toEqual([]);
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.skillName).toBe("generate-intro");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("[분석 힌트]");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("[핵심 요건]");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("최우선 필수 요건");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("\"matchedSkills\": [");
  });

  it("agent 설정이 있으면 intro 생성에도 전달한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      oneLineIntro: "백엔드 개발자",
      shortIntro: "실무 경험이 있습니다.",
      longIntro:
        "실무 경험을 바탕으로 백엔드 구조를 안정적으로 운영해 왔고, TypeScript 기반 개발 경험을 갖추고 있습니다. 요구사항을 빠르게 파악하고 서비스에 맞는 서버 구조를 정리하는 데 익숙합니다. 입사 후에도 안정적인 API 운영에 기여할 수 있습니다.",
      fitReasons: [],
      matchedSkills: ["TypeScript"],
      gapNotes: [],
      missingButRelevant: []
    });

    const request = new Request("http://localhost/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumePayload,
        company: companyPayload,
        agent: {
          model: "gpt-5.3-codex",
          modelReasoningEffort: "medium"
        }
      })
    });

    await POST(request);

    expect(mockedRunSkillJson.mock.calls[0]?.[0]).toMatchObject({
      skillName: "generate-intro",
      model: "gpt-5.3-codex",
      modelReasoningEffort: "medium"
    });
  });

  it("tone 설정이 있으면 intro 생성 입력에도 반영한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      oneLineIntro: "백엔드 개발자",
      shortIntro: "실무 경험이 있습니다.",
      longIntro:
        "실무 경험을 바탕으로 백엔드 구조를 안정적으로 운영해 왔고, TypeScript 기반 개발 경험을 갖추고 있습니다. 요구사항을 빠르게 파악하고 서비스에 맞는 서버 구조를 정리하는 데 익숙합니다. 입사 후에도 안정적인 API 운영에 기여할 수 있습니다.",
      fitReasons: [],
      matchedSkills: ["TypeScript"],
      gapNotes: [],
      missingButRelevant: []
    });

    const request = new Request("http://localhost/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumePayload,
        company: companyPayload,
        tone: "confident"
      })
    });

    await POST(request);

    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("[톤 가이드]");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.inputText).toContain("자신감 있게");
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
    expect(body.data.longIntro).toBe("실무 3년 경력의 백엔드 개발자입니다.");
    expect(body.data.fitReasons).toEqual([]);
    expect(body.data.matchedSkills).toEqual(["TypeScript"]);
    expect(body.data.gapNotes).toEqual([]);
    expect(body.data.missingButRelevant).toEqual([]);
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
