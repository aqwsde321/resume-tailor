import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/pdf/preview/route";
import { HttpError } from "@/server/http";
import { buildResumeSvgPreview } from "@/server/pdf/build";
import type { Company, Intro, Resume } from "@/shared/lib/types";

vi.mock("@/server/pdf/build", () => ({
  buildResumeSvgPreview: vi.fn()
}));

const resumeFixture: Resume = {
  name: "홍길동",
  headline: "",
  summary: "백엔드 개발자",
  desiredPosition: "Backend Engineer",
  careerYears: 3,
  careerDurationText: "",
  contacts: [],
  techStack: ["TypeScript", "Node.js"],
  experience: [],
  projects: [
    {
      name: "프로젝트",
      description: "설명",
      subtitle: "",
      link: "",
      linkLabel: "",
      techStack: ["TypeScript"],
      highlights: []
    }
  ],
  achievements: [],
  pdfHighlights: [],
  strengths: [],
  pdfStrengths: []
};

const normalizedResumeFixture: Resume = {
  ...resumeFixture,
  pdfProfileImageDataUrl: "",
  pdfProfileImageVisible: false
};

const companyFixture: Company = {
  companyName: "Scale Infra",
  companyDescription: "테크 회사",
  jobTitle: "Backend Engineer",
  jobDescription: "API 운영",
  requirements: ["Node.js"],
  preferredSkills: ["AWS"],
  techStack: ["TypeScript"]
};

const introFixture: Intro = {
  oneLineIntro: "문제 해결형 개발자",
  shortIntro: "짧은 소개",
  longIntro: "API 안정성과 운영 경험에 기여할 수 있습니다.",
  fitReasons: [],
  matchedSkills: [],
  gapNotes: [],
  missingButRelevant: []
};

describe("POST /api/pdf/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("유효한 요청이면 SVG 페이지 목록을 반환한다", async () => {
    vi.mocked(buildResumeSvgPreview).mockResolvedValue({
      pages: ["<svg>page-1</svg>"]
    });

    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeFixture,
        company: companyFixture,
        intro: introFixture
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.pages).toEqual(["<svg>page-1</svg>"]);
    expect(buildResumeSvgPreview).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "classic",
      "cobalt",
      undefined
    );
  });

  it("요청에 templateId와 themeId가 있으면 해당 값으로 SVG 미리보기를 만든다", async () => {
    vi.mocked(buildResumeSvgPreview).mockResolvedValue({
      pages: ["<svg>page-modern</svg>"]
    });

    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeFixture,
        company: companyFixture,
        intro: introFixture,
        templateId: "compact",
        themeId: "ember"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.pages).toEqual(["<svg>page-modern</svg>"]);
    expect(buildResumeSvgPreview).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "compact",
      "ember",
      undefined
    );
  });

  it("customAccentHex가 있으면 custom 테마로 SVG 미리보기를 만든다", async () => {
    vi.mocked(buildResumeSvgPreview).mockResolvedValue({
      pages: ["<svg>page-custom</svg>"]
    });

    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeFixture,
        company: companyFixture,
        intro: introFixture,
        themeId: "custom",
        customAccentHex: "#111111"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.pages).toEqual(["<svg>page-custom</svg>"]);
    expect(buildResumeSvgPreview).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "classic",
      "custom",
      "#111111"
    );
  });

  it("프로필 이미지 draft가 있으면 resume와 함께 SVG 미리보기 빌더로 전달한다", async () => {
    vi.mocked(buildResumeSvgPreview).mockResolvedValue({
      pages: ["<svg>page-image</svg>"]
    });

    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: {
          ...resumeFixture,
          pdfProfileImageDataUrl: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
          pdfProfileImageVisible: true
        },
        company: companyFixture,
        intro: introFixture
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(buildResumeSvgPreview).toHaveBeenCalledWith(
      {
        ...normalizedResumeFixture,
        pdfProfileImageDataUrl: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
        pdfProfileImageVisible: true
      },
      introFixture,
      companyFixture,
      "classic",
      "cobalt",
      undefined
    );
  });

  it("소개글이 비어 있으면 400을 반환한다", async () => {
    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeFixture,
        company: companyFixture,
        intro: {
          ...introFixture,
          oneLineIntro: "",
          shortIntro: "",
          longIntro: ""
        }
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("Typst가 없으면 503을 반환한다", async () => {
    vi.mocked(buildResumeSvgPreview).mockRejectedValue(
      new HttpError(503, "Typst가 설치되어 있지 않아 미리보기를 만들 수 없어요.")
    );

    const request = new Request("http://localhost/api/pdf/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume: resumeFixture,
        company: companyFixture,
        intro: introFixture
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
  });
});
