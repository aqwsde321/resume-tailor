import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/application/follow-up-draft/route";
import { runSkillJson } from "@/server/codex-client";

vi.mock("@/server/codex-client", () => ({
  runSkillJson: vi.fn()
}));

const company = {
  companyName: "Beta Corp",
  companyDescription: "B2B 결제 SaaS 팀",
  jobTitle: "Backend Engineer",
  jobDescription: "결제 API 성능과 안정성을 개선합니다.",
  requirements: ["Node.js 서버 개발"],
  preferredSkills: ["AWS"],
  techStack: ["TypeScript"]
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/application/follow-up-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/application/follow-up-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a follow-up email grounded in the selected occasion and record context", async () => {
    vi.mocked(runSkillJson).mockResolvedValueOnce({
      subject: "면접 후 감사 인사드립니다",
      body: "안녕하세요, Beta Corp 채용 담당자님. 오늘 면접에서 결제 API의 안정성 개선 방향을 들을 수 있어 감사했습니다. Node.js 기반 서버 운영 경험을 바탕으로 팀에 기여하고 싶습니다. 추가로 필요한 내용이 있으면 알려주세요. 감사합니다."
    });

    const response = await post({
      occasion: "interview-thanks",
      company,
      status: "interviewing",
      notes: "면접에서 결제 API 운영 사례를 질문받음",
      nextAction: "감사 메일 보내기",
      agent: { modelReasoningEffort: "high" }
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      occasion: "interview-thanks",
      subject: "면접 후 감사 인사드립니다",
      body: expect.stringContaining("Beta Corp"),
      generatedAt: expect.any(String)
    });
    expect(vi.mocked(runSkillJson).mock.calls[0]?.[0]).toMatchObject({
      skillName: "write-follow-up",
      modelReasoningEffort: "high",
      inputText: expect.stringContaining("면접에서 결제 API 운영 사례를 질문받음")
    });
  });

  it("rejects unsupported occasions and malformed generated drafts", async () => {
    const invalidRequest = await post({
      occasion: "unknown",
      company,
      status: "applied",
      notes: "",
      nextAction: ""
    });
    expect(invalidRequest.status).toBe(400);
    expect(runSkillJson).not.toHaveBeenCalled();

    vi.mocked(runSkillJson).mockResolvedValueOnce({ subject: "", body: "" });
    const invalidOutput = await post({
      occasion: "result-inquiry",
      company,
      status: "closed",
      notes: "",
      nextAction: "결과 문의"
    });
    expect(invalidOutput.status).toBe(502);
  });
});
