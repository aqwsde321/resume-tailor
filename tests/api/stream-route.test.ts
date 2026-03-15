import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postCompanyStream } from "@/app/api/company/stream/route";
import { POST as postIntroStream } from "@/app/api/intro/stream/route";
import { POST as postResumeStream } from "@/app/api/resume/stream/route";
import { runSkillJsonStream } from "@/server/codex-client";

vi.mock("@/server/codex-client", () => ({
  runSkillJsonStream: vi.fn()
}));

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

async function readEvents(response: Response) {
  return parseSse(await response.text());
}

describe("stream API error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("빈 이력서 결과면 SSE error 이벤트에 사용자용 문구를 담는다", async () => {
    const mockedRunSkillJsonStream = vi.mocked(runSkillJsonStream);
    mockedRunSkillJsonStream.mockResolvedValueOnce(null);

    const response = await postResumeStream(
      new Request("http://localhost/api/resume/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "이력서 원문" })
      })
    );
    const events = await readEvents(response);
    const errorEvent = events.find((event) => event.event === "error");
    const doneEvent = events.find((event) => event.event === "done");

    expect(errorEvent?.data?.message).toBe("이력서 결과를 받지 못했어요.");
    expect(errorEvent?.data?.details).toContain("비어 있습니다");
    expect(doneEvent?.data?.ok).toBe(false);
  });

  it("공고 결과 형식이 어긋나면 SSE error 이벤트에 형식 오류를 담는다", async () => {
    const mockedRunSkillJsonStream = vi.mocked(runSkillJsonStream);
    mockedRunSkillJsonStream.mockResolvedValueOnce({
      companyName: 123
    });

    const response = await postCompanyStream(
      new Request("http://localhost/api/company/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "공고 원문" })
      })
    );
    const events = await readEvents(response);
    const errorEvent = events.find((event) => event.event === "error");

    expect(errorEvent?.data?.message).toBe("공고 결과 형식을 확인하지 못했어요.");
    expect(errorEvent?.data?.details).toContain("companyName");
  });

  it("소개글 결과 형식이 어긋나면 SSE error 이벤트에 형식 오류를 담는다", async () => {
    const mockedRunSkillJsonStream = vi.mocked(runSkillJsonStream);
    mockedRunSkillJsonStream.mockResolvedValueOnce({
      oneLineIntro: 123
    });

    const response = await postIntroStream(
      new Request("http://localhost/api/intro/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: {
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
          },
          company: {
            companyName: "Acme",
            companyDescription: "테크 스타트업",
            jobTitle: "Backend Engineer",
            jobDescription: "서버 개발",
            requirements: ["Node.js"],
            preferredSkills: ["AWS"],
            techStack: ["TypeScript"]
          }
        })
      })
    );
    const events = await readEvents(response);
    const errorEvent = events.find((event) => event.event === "error");

    expect(errorEvent?.data?.message).toBe("소개글 결과 형식을 확인하지 못했어요.");
    expect(errorEvent?.data?.details).toContain("oneLineIntro");
  });
});
