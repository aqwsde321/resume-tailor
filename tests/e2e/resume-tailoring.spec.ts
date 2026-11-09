import { expect, test } from "@playwright/test";

const resume = {
  name: "홍길동",
  headline: "Frontend Engineer",
  summary: "React와 TypeScript 기반 프론트엔드 개발자",
  desiredPosition: "Frontend Engineer",
  careerYears: 4,
  careerDurationText: "4년",
  pdfProfileImageDataUrl: "",
  pdfProfileImageVisible: false,
  contacts: [],
  techStack: ["React", "TypeScript", "Next.js"],
  experience: [
    {
      company: "Acme",
      role: "Frontend Engineer",
      period: "2022-2025",
      description: "사내 대시보드와 운영 도구를 개발했습니다."
    }
  ],
  projects: [
    {
      name: "Admin Console",
      description: "운영 데이터를 시각화하는 관리 도구를 구축했습니다.",
      subtitle: "운영 대시보드",
      link: "",
      linkLabel: "",
      techStack: ["React", "Next.js", "TypeScript"],
      highlights: []
    }
  ],
  achievements: ["대시보드 초기 로딩 성능 개선"],
  pdfHighlights: ["대시보드 초기 로딩 성능 개선"],
  strengths: ["협업", "문제 해결"],
  pdfStrengths: ["협업", "문제 해결"]
};

const company = {
  companyName: "Beta Corp",
  companyDescription: "B2B SaaS를 만드는 팀",
  jobTitle: "Frontend Engineer",
  jobDescription: "관리자용 제품 화면과 내부 운영 도구를 개발합니다.",
  requirements: ["React 실무 경험", "TypeScript 사용 경험", "대시보드 개발 경험"],
  preferredSkills: ["Next.js", "디자인 시스템 운영"],
  techStack: ["React", "TypeScript", "Next.js"]
};

const intro = {
  oneLineIntro: "React 기반 대시보드 경험의 프론트엔드 개발자",
  shortIntro: "운영 대시보드와 관리자 도구를 구축한 프론트엔드 개발자입니다.",
  longIntro: "운영 대시보드와 관리자 도구를 구축한 프론트엔드 개발자입니다.",
  fitReasons: ["React와 TypeScript 기반 관리자 도구 개발 경험이 공고와 연결됩니다."],
  matchedSkills: ["React", "TypeScript", "Next.js"],
  gapNotes: [],
  missingButRelevant: []
};

const resumeIntroSnapshot = JSON.stringify({
  name: resume.name,
  summary: resume.summary,
  desiredPosition: resume.desiredPosition,
  careerYears: resume.careerYears,
  techStack: resume.techStack,
  experience: resume.experience,
  projects: resume.projects.map(({ name, description, techStack }) => ({
    name,
    description,
    techStack
  })),
  achievements: resume.achievements,
  strengths: resume.strengths
});

function toSse(events: Array<{ event: string; data: unknown }>) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

test("회사 맞춤 이력서를 검토하고 적용한 버전으로 지원 기록을 저장한다", async ({ page }) => {
  await page.addInitScript(
    (state) => {
      window.localStorage.setItem("resume-tailor.pipeline.v2", JSON.stringify(state));
    },
    {
      resumeConfirmedJson: JSON.stringify(resume),
      companyConfirmedJson: JSON.stringify(company),
      intro,
      introSource: {
        resumeConfirmedJson: resumeIntroSnapshot,
        companyConfirmedJson: JSON.stringify(company)
      }
    }
  );

  await page.route("**/api/pdf/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          pages: [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123"><rect width="794" height="1123" fill="white"/></svg>'
          ]
        }
      })
    });
  });

  await page.route("**/api/pdf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    });
  });

  await page.route("**/api/resume/tailor/stream", async (route) => {
    const requestBody = route.request().postDataJSON() as { resume: typeof resume };
    const plan = {
      headline: {
        text: "Beta Corp 제품에 맞는 관리자 도구 경험을 가진 개발자",
        evidenceIds: ["experience-1", "project-1"]
      },
      summary: {
        text: "Beta Corp 공고에 맞춰 관리자 도구와 대시보드 경험을 정리했습니다.",
        evidenceIds: ["experience-1", "project-1"]
      },
      experience: [
        {
          sourceId: "experience-1",
          description: "운영 대시보드와 관리자 도구를 개발했습니다.",
          evidenceIds: ["experience-1"]
        }
      ],
      projects: [
        {
          sourceId: "project-1",
          description: "운영 데이터를 시각화하는 관리 도구를 구축했습니다.",
          evidenceIds: ["project-1"]
        }
      ],
      skillIds: ["skill-2", "skill-1"],
      highlightIds: ["highlight-1"],
      strengthIds: ["strength-2"]
    };
    const tailoredResume = {
      ...requestBody.resume,
      headline: plan.headline.text,
      summary: plan.summary.text,
      experience: requestBody.resume.experience.map((item) => ({
        ...item,
        description: plan.experience[0].description
      })),
      projects: requestBody.resume.projects.map((item) => ({
        ...item,
        description: plan.projects[0].description
      })),
      techStack: ["TypeScript", "React"],
      achievements: ["대시보드 초기 로딩 성능 개선"],
      pdfHighlights: ["대시보드 초기 로딩 성능 개선"],
      pdfStrengths: ["문제 해결"]
    };

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        { event: "result", data: { data: { plan, resume: tailoredResume } } },
        { event: "done", data: { ok: true, elapsedMs: 35 } }
      ])
    });
  });

  await page.goto("/pdf");
  await expect(page.getByRole("button", { name: "회사 맞춤 이력서 만들기" })).toBeVisible();
  await page.getByRole("button", { name: "회사 맞춤 이력서 만들기" }).click();

  await expect(
    page.getByText("Beta Corp 공고에 맞춰 관리자 도구와 대시보드 경험을 정리했습니다.")
  ).toBeVisible();
  await expect(page.getByText("프로젝트 · Admin Console").first()).toBeVisible();

  await page.getByRole("button", { name: "맞춤 이력서 적용" }).click();
  await page.getByRole("button", { name: "지원 기록 저장" }).click();
  await expect(page.getByRole("link", { name: "지원 기록 1" })).toBeVisible();

  const savedResume = await page.evaluate(() => {
    const state = JSON.parse(window.localStorage.getItem("resume-tailor.pipeline.v2") ?? "{}");
    return state.applications[0].snapshot.resume;
  });
  expect(savedResume.summary).toBe(
    "Beta Corp 공고에 맞춰 관리자 도구와 대시보드 경험을 정리했습니다."
  );
  expect(savedResume.techStack).toEqual(["TypeScript", "React"]);
});
