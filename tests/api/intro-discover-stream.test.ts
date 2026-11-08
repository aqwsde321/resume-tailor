import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/experience-discovery/route";
import { runSkillJsonStream } from "@/server/codex-client";

vi.mock("@/server/codex-client", () => ({
  runSkillJsonStream: vi.fn()
}));

const resumePayload = {
  name: "홍길동",
  summary: "백엔드 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 3,
  techStack: ["TypeScript"],
  experience: [],
  projects: [],
  achievements: [],
  pdfHighlights: [],
  strengths: [],
  pdfStrengths: []
};

const companyPayload = {
  companyName: "Acme",
  companyDescription: "테크 스타트업",
  jobTitle: "Backend Engineer",
  jobDescription: "결제 API 운영과 서비스 안정화를 담당합니다.",
  requirements: ["운영 환경의 장애 대응 경험"],
  preferredSkills: [],
  techStack: ["TypeScript"]
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
    new Request("http://localhost/api/intro/discover/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/intro/discover/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("첫 질문을 요건에 맞춰 만들고 SSE 결과를 반환한다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
      status: "question",
      message: "운영 중 장애를 직접 분석하거나 대응한 경험이 있나요?",
      draft: null
    });

    const response = await post({
      resume: resumePayload,
      company: companyPayload,
      requirement: "운영 환경의 장애 대응 경험",
      messages: []
    });
    const events = parseSse(await response.text());

    expect(response.status).toBe(200);
    expect(events.find((event) => event.event === "result")?.data.data).toEqual({
      status: "question",
      message: "운영 중 장애를 직접 분석하거나 대응한 경험이 있나요?",
      draft: null
    });
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]).toMatchObject({
      skillName: "discover-experience",
      inputText: expect.stringContaining("운영 환경의 장애 대응 경험")
    });
  });

  it("이전 답변을 다음 질문 입력에 포함한다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
      status: "question",
      message: "장애 원인을 찾기 위해 어떤 조치를 했나요?",
      draft: null
    });

    await post({
      resume: resumePayload,
      company: companyPayload,
      requirement: "운영 환경의 장애 대응 경험",
      messages: [
        { role: "assistant", content: "운영 중 장애를 직접 분석하거나 대응한 경험이 있나요?" },
        { role: "user", content: "결제 API 지연 문제를 대응했습니다." }
      ]
    });

    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.inputText).toContain(
      "결제 API 지연 문제를 대응했습니다."
    );
    expect(vi.mocked(runSkillJsonStream).mock.calls[0]?.[0]?.model).toBeUndefined();
  });

  it("요건이 비어 있으면 400을 반환한다", async () => {
    const response = await post({
      resume: resumePayload,
      company: companyPayload,
      requirement: "   ",
      messages: []
    });

    expect(response.status).toBe(400);
    expect((await response.json()).ok).toBe(false);
    expect(runSkillJsonStream).not.toHaveBeenCalled();
  });

  it("draft 단계에 형식이 틀린 경험을 받으면 SSE 오류를 반환한다", async () => {
    vi.mocked(runSkillJsonStream).mockResolvedValueOnce({
      status: "draft",
      message: "경험 초안을 정리했습니다.",
      draft: null
    });

    const response = await post({
      resume: resumePayload,
      company: companyPayload,
      requirement: "운영 환경의 장애 대응 경험",
      messages: []
    });
    const events = parseSse(await response.text());

    expect(events.find((event) => event.event === "error")?.data.message).toBe(
      "경험 발굴 결과 형식을 확인하지 못했어요."
    );
  });
});
