import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/company/route";
import { runSkillJson } from "@/lib/codex-client";

vi.mock("@/lib/codex-client", () => ({
  runSkillJson: vi.fn()
}));

describe("POST /api/company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 요청이면 company JSON을 반환한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      companyName: "Acme",
      companyDescription: "테크 스타트업",
      jobTitle: "Frontend Engineer",
      jobDescription: "웹 프론트엔드 개발",
      requirements: ["React"],
      preferredSkills: ["Next.js"],
      techStack: ["TypeScript"]
    });

    const request = new Request("http://localhost/api/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "채용공고 원문" })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyName).toBe("Acme");
    expect(mockedRunSkillJson.mock.calls[0]?.[0]?.skillName).toBe("company-to-json");
  });
});
