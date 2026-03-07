import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/company/route";
import { runSkillJson } from "@/lib/codex-client";
import { companyRouteCases } from "../fixtures/company-cases";

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

  it("공고 결과의 중복과 노이즈를 정리해서 반환한다", async () => {
    const mockedRunSkillJson = vi.mocked(runSkillJson);
    mockedRunSkillJson.mockResolvedValue({
      companyName: " Alpha Pay ",
      companyDescription:
        "결제 플랫폼을 운영합니다. 로그인하고 비슷한 조건의 AI추천공고를 확인해 보세요!",
      jobTitle: "Backend Engineer",
      jobDescription:
        "모집요강 결제 API를 개발합니다. 본 채용정보는 잡코리아의 동의없이 무단전재할 수 없습니다.",
      requirements: ["필수 조건: Java 기반 서버 개발 경험", "식대 지원"],
      preferredSkills: ["우대 사항: Spring Boot 경험", "복지 포인트 지급"],
      techStack: ["Java, Spring Boot, Oracle", "Java"]
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
    expect(body.data.companyName).toBe("Alpha Pay");
    expect(body.data.companyDescription).toBe("결제 플랫폼을 운영합니다.");
    expect(body.data.jobDescription).toContain("결제 API를 개발합니다.");
    expect(body.data.jobDescription).not.toContain("무단전재");
    expect(body.data.requirements).toEqual(["Java 기반 서버 개발 경험"]);
    expect(body.data.preferredSkills).toEqual(["Spring Boot 경험"]);
    expect(body.data.techStack).toEqual(["Java", "Spring Boot", "Oracle"]);
  });

  for (const fixture of companyRouteCases) {
    it(`${fixture.name}`, async () => {
      const mockedRunSkillJson = vi.mocked(runSkillJson);
      mockedRunSkillJson.mockResolvedValue(fixture.generated);

      const request = new Request("http://localhost/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fixture.sourceText })
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.companyName).toBe(fixture.expected.companyName);
      expect(body.data.jobTitle).toBe(fixture.expected.jobTitle);
      expect(body.data.requirements).toEqual(fixture.expected.requirements);
      expect(body.data.preferredSkills).toEqual(fixture.expected.preferredSkills);
      expect(body.data.techStack).toEqual(fixture.expected.techStack);
      expect(mockedRunSkillJson.mock.calls.at(-1)?.[0]?.inputText).toContain(fixture.sourceText);

      fixture.expected.jobDescriptionIncludes?.forEach((text) => {
        expect(body.data.jobDescription).toContain(text);
      });

      fixture.expected.jobDescriptionExcludes?.forEach((text) => {
        expect(body.data.jobDescription).not.toContain(text);
      });
    });
  }
});
