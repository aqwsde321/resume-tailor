import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/pdf/route";
import type { PdfAtsAudit } from "@/entities/pdf/model/ats-audit";
import { HttpError } from "@/server/http";
import { auditResumePdf } from "@/server/pdf/ats-audit";
import { buildResumePdf } from "@/server/pdf/build";
import { serializeResumeIntroSnapshot } from "@/entities/resume/model/resume-utils";
import type { Company, Intro, Resume } from "@/shared/lib/types";

vi.mock("@/server/pdf/build", () => ({
  buildResumePdf: vi.fn(),
  buildPdfContentDisposition: vi.fn(() => 'attachment; filename="resume.pdf"')
}));

vi.mock("@/server/pdf/ats-audit", () => ({
  auditResumePdf: vi.fn()
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

const atsAuditFixture: PdfAtsAudit = {
  status: "checked",
  message: "PDF 텍스트를 추출했어요.",
  textCharacterCount: 42,
  nameFound: true,
  contacts: [],
  requiredTerms: { total: 0, matchedCount: 0, matched: [], missing: [] },
  preferredTerms: { total: 0, matchedCount: 0, matched: [], missing: [] },
  textPreview: ""
};

function makeRequestBody(overrides: Partial<Record<string, unknown>> = {}) {
  const resumeSnapshot = serializeResumeIntroSnapshot(resumeFixture);
  const companySnapshot = JSON.stringify(companyFixture, null, 2);

  return {
    resume: resumeFixture,
    company: companyFixture,
    intro: introFixture,
    introSource: {
      resumeConfirmedJson: resumeSnapshot,
      companyConfirmedJson: companySnapshot
    },
    resumeSnapshot,
    companySnapshot,
    ...overrides
  };
}

describe("POST /api/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditResumePdf).mockResolvedValue(atsAuditFixture);
  });

  it("유효한 요청이면 PDF를 반환한다", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeRequestBody())
    });

    const response = await POST(request);
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(body.byteLength).toBe(4);
    expect(
      JSON.parse(Buffer.from(response.headers.get("x-resume-pdf-ats-audit") ?? "", "base64url").toString("utf8"))
    ).toEqual(atsAuditFixture);
    expect(auditResumePdf).toHaveBeenCalledWith(Buffer.from("%PDF"), normalizedResumeFixture, companyFixture);
    expect(buildResumePdf).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "classic",
      "cobalt",
      undefined
    );
  });

  it("returns the PDF even when the optional text extraction tool is unavailable", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));
    vi.mocked(auditResumePdf).mockResolvedValue({
      ...atsAuditFixture,
      status: "unavailable",
      message: "pdftotext is not installed."
    });

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeRequestBody())
    });

    const response = await POST(request);
    const auditHeader = response.headers.get("x-resume-pdf-ats-audit");

    expect(response.status).toBe(200);
    expect(auditHeader).not.toBeNull();
    expect(JSON.parse(Buffer.from(auditHeader ?? "", "base64url").toString("utf8")).status).toBe("unavailable");
  });

  it("PDF 직전 draft로 수정한 resume 값도 그대로 출력에 사용한다", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));

    const editedResume: Resume = {
      ...resumeFixture,
      desiredPosition: "Senior Backend Engineer",
      experience: [
        {
          company: "Scale Infra",
          role: "Backend Engineer",
          period: "2023-2026",
          description: "대규모 API 운영과 장애 대응을 맡았습니다."
        }
      ]
    };

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          resume: editedResume
        })
      )
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(buildResumePdf).toHaveBeenCalledWith(
      {
        ...editedResume,
        pdfProfileImageDataUrl: "",
        pdfProfileImageVisible: false
      },
      introFixture,
      companyFixture,
      "classic",
      "cobalt",
      undefined
    );
  });

  it("요청에 templateId와 themeId가 있으면 해당 값으로 PDF를 만든다", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          templateId: "modern",
          themeId: "forest"
        })
      )
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(buildResumePdf).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "modern",
      "forest",
      undefined
    );
  });

  it("customAccentHex가 있으면 custom 테마와 함께 전달한다", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          themeId: "custom",
          customAccentHex: "#111111"
        })
      )
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(buildResumePdf).toHaveBeenCalledWith(
      normalizedResumeFixture,
      introFixture,
      companyFixture,
      "classic",
      "custom",
      "#111111"
    );
  });

  it("프로필 이미지 draft가 있으면 resume와 함께 PDF 빌더로 전달한다", async () => {
    vi.mocked(buildResumePdf).mockResolvedValue(Buffer.from("%PDF"));

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          resume: {
            ...resumeFixture,
            pdfProfileImageDataUrl: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
            pdfProfileImageVisible: true
          }
        })
      )
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(buildResumePdf).toHaveBeenCalledWith(
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
    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          intro: {
            ...introFixture,
            oneLineIntro: "",
            shortIntro: "",
            longIntro: ""
          }
        })
      )
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("소개글 스냅샷이 stale이면 409를 반환한다", async () => {
    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        makeRequestBody({
          introSource: {
            resumeConfirmedJson: serializeResumeIntroSnapshot({
              ...resumeFixture,
              summary: "예전 요약"
            }),
            companyConfirmedJson: JSON.stringify(companyFixture, null, 2)
          }
        })
      )
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.ok).toBe(false);
  });

  it("Typst가 없으면 503을 반환한다", async () => {
    vi.mocked(buildResumePdf).mockRejectedValue(
      new HttpError(503, "Typst가 설치되어 있지 않아 PDF를 만들 수 없어요.")
    );

    const request = new Request("http://localhost/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeRequestBody())
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
  });
});
