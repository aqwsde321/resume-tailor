import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/application/interview-prep/route";
import { runSkillJson } from "@/server/codex-client";

vi.mock("@/server/codex-client", () => ({
  runSkillJson: vi.fn()
}));

const resume = {
  name: "홍길동",
  desiredPosition: "Backend Engineer",
  summary: "결제 API 운영 경험이 있는 백엔드 개발자",
  experience: [{ company: "Beta", role: "Backend Engineer", period: "2022-2025", description: "결제 API를 운영하고 응답 시간을 30% 줄였습니다." }],
  techStack: ["TypeScript", "Node.js"]
};

const company = {
  companyName: "Beta Corp",
  jobTitle: "Backend Engineer",
  jobDescription: "결제 서비스의 안정성과 API 성능을 개선합니다.",
  requirements: ["Node.js 서버 개발", "서비스 운영 경험"],
  preferredSkills: ["AWS"],
  techStack: ["TypeScript"]
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/application/interview-prep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/application/interview-prep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the saved resume and job post to create structured interview preparation", async () => {
    vi.mocked(runSkillJson).mockResolvedValueOnce({
      openingPitch: "결제 API 운영과 성능 개선을 맡아 온 백엔드 개발자입니다.",
      questions: [
        {
          question: "결제 API 응답 시간을 어떻게 개선했나요?",
          focus: "문제 분석과 성과를 확인합니다.",
          resumeEvidence: "결제 API 응답 시간을 30% 줄인 경험",
          answerOutline: ["지연 현상을 설명합니다.", "병목을 찾은 방법을 말합니다.", "개선 결과를 수치로 설명합니다."]
        },
        {
          question: "운영 중 장애를 대응한 경험을 들려주세요.",
          focus: "운영 안정성에 대한 접근을 확인합니다.",
          resumeEvidence: "서비스 운영 경험",
          answerOutline: ["상황과 영향을 설명합니다.", "조치와 협업을 말합니다."]
        },
        {
          question: "AWS에서 서비스를 운영할 때 고려할 점은 무엇인가요?",
          focus: "우대 기술에 대한 이해와 학습 태도를 확인합니다.",
          resumeEvidence: "이력서에서 AWS 실무 경험은 확인되지 않음",
          answerOutline: ["관련 지식과 경험을 구분합니다.", "학습 또는 대응 계획을 설명합니다."]
        }
      ],
      questionsToAsk: ["현재 결제 API에서 가장 먼저 개선하려는 지표는 무엇인가요?", "팀의 운영 장애 대응 방식은 어떻게 되나요?"]
    });

    const response = await post({ resume, company, agent: { modelReasoningEffort: "high" } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.openingPitch).toContain("결제 API");
    expect(body.data.questions).toHaveLength(3);
    expect(body.data.generatedAt).toEqual(expect.any(String));
    expect(vi.mocked(runSkillJson).mock.calls[0]?.[0]).toMatchObject({
      skillName: "prepare-interview",
      modelReasoningEffort: "high",
      inputText: expect.stringContaining("서비스 운영 경험")
    });
  });

  it("rejects incomplete model output before returning it to the client", async () => {
    vi.mocked(runSkillJson).mockResolvedValueOnce({
      openingPitch: "짧은 소개",
      questions: [],
      questionsToAsk: []
    });

    const response = await post({ resume, company });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(vi.mocked(runSkillJson)).toHaveBeenCalledTimes(1);
  });
});
