import { expect, test, type Page } from "@playwright/test";

let lastPdfRequestBody: unknown = null;

function toSse(events: Array<{ event: string; data: unknown }>) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

function getResumeOverviewSection(page: Page) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "이력서 다듬기" }) });
}

function getResumeCoreSection(page: Page) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "소개글의 뼈대" }) });
}

function getSourceInputSection(page: Page, title: string) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: title }) });
}

function getCompanyReviewSection(page: Page) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: "공고 다듬기" }) });
}

async function completeResumeStep(page: Page) {
  await page.goto("/resume");
  const resumeSection = getResumeCoreSection(page);

  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(resumeSection.getByLabel("희망 직무")).toHaveValue("Frontend Engineer");
  await expect(resumeSection.locator(".inline-stack-input")).toHaveValue("React, TypeScript, Next.js");

  await page.getByRole("button", { name: "이력서 저장" }).click();
  await expect(page.getByRole("link", { name: "공고 정리로 가기" })).toBeVisible();
}

async function completeResumeStepByUrl(page: Page) {
  await page.goto("/resume");
  const sourceCard = getSourceInputSection(page, "이력서 원문");
  const resumeSection = getResumeCoreSection(page);

  await sourceCard.locator(".input-mode-tabs").getByRole("button", { name: "URL 불러오기" }).click();
  await sourceCard.locator(".url-fetch-panel input[type='url']").fill("https://portfolio.example.com");
  await sourceCard.locator(".url-fetch-panel").getByRole("button", { name: "URL 불러오기" }).click();

  await expect(sourceCard.locator(".url-preview-title")).toHaveText("홍길동 | Frontend Engineer");
  await expect(sourceCard.locator(".url-preview-chip").filter({ hasText: "이름" })).toContainText("홍길동");
  await expect(sourceCard.locator("textarea")).toHaveValue(
    /홍길동[\s\S]*React, TypeScript, Next\.js, Storybook/
  );

  await sourceCard.getByRole("button", { name: "내용 정리" }).click();

  await expect(resumeSection.getByLabel("희망 직무")).toHaveValue("Frontend Engineer");
  await resumeSection.getByLabel("희망 직무").fill("Senior Frontend Engineer");

  await page.getByRole("button", { name: "이력서 저장" }).click();
  await expect(page.getByRole("link", { name: "공고 정리로 가기" })).toBeVisible();
}

async function completeCompanyStep(page: Page) {
  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);

  await page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.").fill("Beta Corp 채용공고 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(companySection.getByLabel("회사명")).toHaveValue("Beta Corp");
  await expect(companySection.getByLabel("포지션")).toHaveValue("Frontend Engineer");
  await expect(companySection.locator(".list-preview li").filter({ hasText: "React 실무 경험" })).toBeVisible();

  await page.getByRole("button", { name: "공고 저장" }).click();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toBeVisible();
}

async function completeCompanyStepByUrl(page: Page) {
  await page.goto("/company");
  const sourceCard = getSourceInputSection(page, "공고 원문");
  const companySection = getCompanyReviewSection(page);

  await sourceCard.locator(".input-mode-tabs").getByRole("button", { name: "URL 불러오기" }).click();
  await sourceCard.locator(".url-fetch-panel input[type='url']").fill("https://jobs.example.com/frontend");
  await sourceCard.locator(".url-fetch-panel").getByRole("button", { name: "URL 불러오기" }).click();

  await expect(sourceCard.locator(".url-preview-title")).toHaveText("프론트엔드 엔지니어 채용");
  await expect(sourceCard.locator(".url-preview-chip").filter({ hasText: "회사" })).toContainText("Example Jobs");
  await expect(sourceCard.locator("textarea")).toHaveValue(
    /React와 TypeScript 기반 서비스 화면을 개발합니다\./
  );

  await sourceCard.getByRole("button", { name: "내용 정리" }).click();

  await expect(companySection.getByLabel("회사명")).toHaveValue("Beta Corp");
  await companySection.getByLabel("포지션").fill("Senior Frontend Engineer");
  await expect(companySection.getByText("수정됨")).toBeVisible();

  await page.getByRole("button", { name: "공고 저장" }).click();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toBeVisible();
}

async function generateIntro(page: Page) {
  await page.goto("/result");
  await page.getByRole("button", { name: "소개글 만들기" }).click();

  await expect(page.getByText("이 소개글의 근거")).toBeVisible();
  await expect(page.getByText("최신 결과가 준비돼 있어요")).toBeVisible();
}

async function completeIntroFlow(page: Page) {
  await completeResumeStep(page);
  await completeCompanyStep(page);
  await generateIntro(page);
}

async function completeIntroFlowByUrl(page: Page) {
  await completeResumeStepByUrl(page);
  await completeCompanyStepByUrl(page);
  await generateIntro(page);
}

test.beforeEach(async ({ page }) => {
  lastPdfRequestBody = null;

  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("__resume_make_e2e_init__")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("__resume_make_e2e_init__", "1");
    }
  });

  await page.route("**/api/resume/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "이력서 구조화 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              name: "홍길동",
              summary: "React와 TypeScript 기반 프론트엔드 개발자",
              desiredPosition: "Frontend Engineer",
              careerYears: 4,
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
                  techStack: ["React", "Next.js", "TypeScript"]
                }
              ],
              achievements: ["대시보드 초기 로딩 성능 개선"],
              strengths: ["협업", "문제 해결"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 42 }
        }
      ])
    });
  });

  await page.route("**/api/company/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "채용공고 구조화 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              companyName: "Beta Corp",
              companyDescription: "B2B SaaS를 만드는 팀",
              jobTitle: "Frontend Engineer",
              jobDescription: "관리자용 제품 화면과 내부 운영 도구를 개발합니다.",
              requirements: ["React 실무 경험", "TypeScript 사용 경험", "대시보드 개발 경험"],
              preferredSkills: ["Next.js", "디자인 시스템 운영"],
              techStack: ["React", "TypeScript", "Next.js"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 35 }
        }
      ])
    });
  });

  await page.route("**/api/intro/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "자기소개 생성 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              oneLineIntro: "React 기반 대시보드 경험의 프론트엔드 개발자",
              shortIntro:
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품 개발을 맡아왔습니다. 운영 대시보드와 관리자 도구를 구축하며 데이터 중심 화면 설계 경험을 쌓았습니다. Beta Corp의 요구사항인 React, TypeScript, 대시보드 개발 경험과 직접 연결되는 이력이 있습니다.",
              longIntro:
                "4년 차 프론트엔드 개발자로 React와 TypeScript 기반 제품을 꾸준히 개발해 왔습니다. 운영 대시보드와 관리자 도구를 만들며 복잡한 데이터를 사용자가 이해하기 쉬운 화면으로 정리하는 경험을 쌓았습니다. 특히 관리 화면에서 필요한 상태 흐름과 화면 구조를 설계하고, Next.js와 TypeScript 기반 코드베이스를 안정적으로 운영해 온 점이 강점입니다. Beta Corp의 요구사항인 React 실무 경험, TypeScript 사용 경험, 대시보드 개발 경험과 직접 연결되는 이력이 있으며, 협업 과정에서도 요구사항을 빠르게 정리해 화면으로 옮겨 왔습니다. 입사 후에도 관리자용 제품 화면과 내부 운영 도구를 빠르게 이해하고 사용자 경험 개선에 기여할 수 있습니다.",
              fitReasons: [
                "React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.",
                "운영 대시보드 구축 경험이 채용공고의 데이터 중심 화면 개발 업무와 맞닿아 있습니다."
              ],
              matchedSkills: ["React", "TypeScript", "Next.js"],
              gapNotes: ["디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다."],
              missingButRelevant: [
                "우대 조건 'Next.js 경험'은 Admin Console 프로젝트 근거를 써서 한 문장 더 보강할 수 있습니다."
              ]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 28 }
        }
      ])
    });
  });

  await page.route("**/api/resume/fetch-url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: "https://portfolio.example.com",
          title: "홍길동 | Frontend Engineer",
          nameHint: "홍길동",
          desiredPositionHint: "Frontend Engineer",
          text: [
            "홍길동",
            "Frontend Engineer",
            "React와 TypeScript 기반 제품을 설계하고 개선해 온 프론트엔드 개발자입니다.",
            "React, TypeScript, Next.js, Storybook"
          ].join("\n")
        }
      })
    });
  });

  await page.route("**/api/company/fetch-url", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          url: "https://jobs.example.com/frontend",
          title: "프론트엔드 엔지니어 채용",
          companyNameHint: "Example Jobs",
          jobTitleHint: "프론트엔드 엔지니어",
          text: [
            "프론트엔드 엔지니어",
            "React와 TypeScript 기반 서비스 화면을 개발합니다.",
            "React 개발 경험, 협업 경험, 문제 해결 역량",
            "Next.js 경험"
          ].join("\n")
        }
      })
    });
  });

  await page.route("**/api/pdf/preview", async (route) => {
    const requestBody = route.request().postDataJSON() as {
      intro?: { longIntro?: string };
      resume?: { name?: string; pdfHighlights?: string[] };
    };
    const highlights = Array.isArray(requestBody.resume?.pdfHighlights)
      ? requestBody.resume?.pdfHighlights
      : [];
    const intro = requestBody.intro?.longIntro || "";
    const name = requestBody.resume?.name || "홍길동";
    const svgLines = [
      `<text x="48" y="60" font-size="24" font-weight="700">${name}</text>`,
      `<text x="48" y="108" font-size="12">${intro}</text>`,
      ...highlights.map(
        (item, index) =>
          `<text x="48" y="${160 + index * 24}" font-size="12">${item}</text>`
      )
    ].join("");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          pages: [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="794" height="1123"><rect width="794" height="1123" fill="white"/>${svgLines}</svg>`
          ]
        }
      })
    });
  });

  await page.route("**/api/pdf", async (route) => {
    lastPdfRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    });
  });
});

test("이력서 미확정이면 채용공고 단계가 차단된다", async ({ page }) => {
  await page.goto("/company");

  await expect(page.getByText("먼저 이력서를 저장해 주세요.")).toBeVisible();
  await expect(page.getByText("대기")).toBeVisible();
  await expect(page.getByRole("button", { name: "내용 정리" })).toBeDisabled();
});

test("3단계 흐름을 완료하면 AI 근거와 소개문이 표시된다", async ({ page }) => {
  await completeIntroFlow(page);

  const anchorSection = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "공고와 연결한 내 경험" })
  });

  await expect(anchorSection.getByRole("heading", { name: "공고와 연결한 내 경험" })).toBeVisible();
  await expect(anchorSection.locator(".anchor-type.requirement").first()).toBeVisible();
  await expect(anchorSection.getByText("React 실무 경험")).toBeVisible();
  await expect(
    anchorSection
      .getByText("프로젝트: Admin Console / 운영 데이터를 시각화하는 관리 도구를 구축했습니다. / 기술: React, Next.js, TypeScript")
      .first()
  ).toBeVisible();
  await expect(page.getByText("이 소개글의 근거")).toBeVisible();
  await expect(
    page.getByText("React와 TypeScript 기반 관리자 도구 개발 경험이 공고 요구사항과 직접 연결됩니다.")
  ).toBeVisible();
  await expect(page.getByText("디자인 시스템 운영 경험은 자기소개에서 추가로 보강하면 좋습니다.")).toBeVisible();
  await expect(page.getByText("더 살릴 수 있는 점")).toBeVisible();
  await expect(page.getByText("우대 조건 'Next.js 경험'은 Admin Console 프로젝트 근거를 써서 한 문장 더 보강할 수 있습니다.")).toBeVisible();
  await expect(page.getByText("React 기반 대시보드 경험의 프론트엔드 개발자")).toBeVisible();
  await expect(
    page.getByText("입사 후에도 관리자용 제품 화면과 내부 운영 도구를 빠르게 이해하고 사용자 경험 개선에 기여할 수 있습니다.")
  ).toBeVisible();
  await expect(page.locator(".keyword-chip").filter({ hasText: "React" }).first()).toBeVisible();
  await expect(page.locator(".keyword-chip").filter({ hasText: "Next.js" }).first()).toBeVisible();
});

test("최신 소개글이 있으면 step 4 PDF 화면으로 이동해 바로 미리볼 수 있다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();

  await expect(page.getByRole("heading", { name: "PDF 내보내기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "출력 미리보기" })).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF 내보내기" })).toBeVisible();
});

test("이력서 URL을 불러와 정리한 뒤 수정하고 저장할 수 있다", async ({ page }) => {
  await completeResumeStepByUrl(page);

  await page.goto("/resume");
  await expect(getResumeCoreSection(page).getByLabel("희망 직무")).toHaveValue(
    "Senior Frontend Engineer"
  );
});

test("공고 URL을 불러와 정리한 뒤 수정하고 저장할 수 있다", async ({ page }) => {
  await completeResumeStep(page);
  await completeCompanyStepByUrl(page);

  await page.goto("/company");
  await expect(getCompanyReviewSection(page).getByLabel("포지션")).toHaveValue(
    "Senior Frontend Engineer"
  );
});

test("이력서와 공고 기술 스택 입력은 쉼표를 입력하는 도중 raw text를 유지한다", async ({ page }) => {
  await completeResumeStep(page);

  const resumeTechStackInput = getResumeCoreSection(page).locator(".inline-stack-input");
  await resumeTechStackInput.fill("");
  await resumeTechStackInput.type("React,");
  await expect(resumeTechStackInput).toHaveValue("React,");
  await page.getByRole("button", { name: "이력서 저장" }).click();

  await page.getByRole("link", { name: "공고 정리로 가기" }).click();
  const companySection = getCompanyReviewSection(page);

  await page.getByPlaceholder("채용 공고 내용을 붙여넣어 주세요.").fill("Beta Corp 채용공고 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  const companyTechStackInput = companySection.getByLabel("공고 기술 스택");
  await companyTechStackInput.fill("");
  await companyTechStackInput.type("Java,");
  await expect(companyTechStackInput).toHaveValue("Java,");
});

test("PDF 단계의 Highlights는 Enter 줄바꿈으로 여러 항목을 바로 편집할 수 있다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Highlights" }).click();
  const highlightsField = page.locator(".pdf-editor-modal").getByLabel("Highlights");
  await highlightsField.fill("첫 번째 근거");
  await highlightsField.press("Enter");
  await expect(highlightsField).toHaveValue("첫 번째 근거\n");
  await highlightsField.type("두 번째 근거");

  const preview = page.locator(".pdf-preview-pane");
  await expect(preview.getByText("첫 번째 근거")).toBeVisible();
  await expect(preview.getByText("두 번째 근거")).toBeVisible();
});

test("PDF 기술 스택 입력은 쉼표와 줄바꿈이 완성되기 전 raw text를 유지한다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Skills" }).click();
  const skillsModal = page.locator(".pdf-editor-modal");
  const skillsField = skillsModal.getByLabel("PDF 기술 스택");
  await skillsField.fill("");
  await skillsField.type("Java,");
  await expect(skillsField).toHaveValue("Java,");
  await skillsModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Projects" }).click();
  const projectsModal = page.locator(".pdf-editor-modal");
  const projectTechStackField = projectsModal.getByLabel("프로젝트 1 기술 스택");
  await projectTechStackField.fill("");
  await projectTechStackField.type("Node.js,");
  await expect(projectTechStackField).toHaveValue("Node.js,");
});

test("모바일 PDF 단계는 4열 수정 칩을 유지하고 섹션 모달을 화면 안에서 연다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeIntroFlow(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();

  const editorPane = page.locator(".pdf-editor-pane");
  const chips = editorPane.locator(".pdf-editor-chip");
  await expect(chips).toHaveCount(8);

  const widths = await editorPane.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);

  const positions = await chips.evaluateAll((nodes) =>
    nodes.slice(0, 5).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top)
      };
    })
  );

  expect(Math.abs(positions[0].top - positions[1].top)).toBeLessThanOrEqual(2);
  expect(Math.abs(positions[1].top - positions[2].top)).toBeLessThanOrEqual(2);
  expect(Math.abs(positions[2].top - positions[3].top)).toBeLessThanOrEqual(2);
  expect(positions[4].top).toBeGreaterThan(positions[0].top + 8);

  await page.locator(".pdf-editor-chip").filter({ hasText: "Strengths" }).click();

  const modal = page.locator(".pdf-editor-modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/pdf-modal-open/);

  const modalBounds = await modal.boundingBox();
  expect(modalBounds).not.toBeNull();
  expect(modalBounds!.x).toBeGreaterThanOrEqual(0);
  expect(modalBounds!.y).toBeGreaterThanOrEqual(0);
  expect(modalBounds!.x + modalBounds!.width).toBeLessThanOrEqual(390);
  expect(modalBounds!.y + modalBounds!.height).toBeLessThanOrEqual(844);
});

test("PDF 섹션 모달에서 수정한 값은 미리보기에 반영되고 다시 열어도 유지된다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Header" }).click();
  const headerModal = page.locator(".pdf-editor-modal");
  await headerModal.getByLabel("이름").fill("김테스트");
  await headerModal.getByRole("button", { name: "닫기" }).click();

  const preview = page.locator(".pdf-preview-pane");
  await expect(preview.getByText("김테스트")).toBeVisible();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Highlights" }).click();
  const highlightsModal = page.locator(".pdf-editor-modal");
  const highlightsField = highlightsModal.getByLabel("Highlights");
  await highlightsField.fill("첫 번째 근거\n두 번째 근거");
  await highlightsModal.getByRole("button", { name: "닫기" }).click();

  await expect(preview.getByText("첫 번째 근거")).toBeVisible();
  await expect(preview.getByText("두 번째 근거")).toBeVisible();
  await expect(page.locator(".pdf-editor-chip").filter({ hasText: "Highlights" }).locator(".pdf-editor-chip-meta")).toHaveText("2개");

  await page.locator(".pdf-editor-chip").filter({ hasText: "Highlights" }).click();
  await expect(page.locator(".pdf-editor-modal").getByLabel("Highlights")).toHaveValue(
    "첫 번째 근거\n두 번째 근거"
  );
});

test("URL 기반으로 step 1~4를 진행하고 PDF export 요청까지 보낼 수 있다", async ({ page }) => {
  await completeIntroFlowByUrl(page);

  await page.getByRole("link", { name: "PDF 단계로 가기" }).click();
  await page.getByRole("button", { name: /Sidebar/ }).click();
  await page.getByRole("button", { name: /Forest/ }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Header" }).click();
  const headerModal = page.locator(".pdf-editor-modal");
  await headerModal.getByLabel("이름").fill("김테스트");
  await headerModal.getByLabel("헤드라인").fill("React 제품 경험을 가진 프론트엔드 개발자");
  await headerModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Contacts" }).click();
  const contactsModal = page.locator(".pdf-editor-modal");
  await contactsModal.getByRole("button", { name: "연락처 추가" }).click();
  await contactsModal.getByLabel("구분").fill("GitHub");
  await contactsModal.getByLabel("표시 값").fill("github.com/qrqr");
  await contactsModal.getByLabel("링크 URL").fill("https://github.com/qrqr");
  await contactsModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Tailored Intro" }).click();
  const introModal = page.locator(".pdf-editor-modal");
  await introModal
    .getByLabel(/기준 최종 소개글$/)
    .fill("최종 소개글을 PDF 기준으로 다시 다듬었습니다.");
  await introModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Experience" }).click();
  const experienceModal = page.locator(".pdf-editor-modal");
  await experienceModal.getByLabel("역할").first().fill("Lead Frontend Engineer");
  await experienceModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Highlights" }).click();
  const highlightsModal = page.locator(".pdf-editor-modal");
  await highlightsModal.getByLabel("Highlights").fill("첫 번째 근거\n두 번째 근거");
  await highlightsModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Projects" }).click();
  const projectsModal = page.locator(".pdf-editor-modal");
  await projectsModal.getByLabel("부제목").first().fill("관리자 도구");
  await projectsModal
    .getByLabel("프로젝트 1 기술 스택")
    .fill("React, TypeScript, Next.js, Storybook");
  await projectsModal.getByLabel("링크 URL").first().fill("https://github.com/qrqr/admin-console");
  await projectsModal.getByLabel("링크 라벨").first().fill("GitHub");
  await projectsModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Skills" }).click();
  const skillsModal = page.locator(".pdf-editor-modal");
  await skillsModal
    .getByLabel("PDF 기술 스택")
    .fill("React, TypeScript, Next.js, Storybook, PostgreSQL, Docker");
  await skillsModal.getByRole("button", { name: "닫기" }).click();

  await page.locator(".pdf-editor-chip").filter({ hasText: "Strengths" }).click();
  const strengthsModal = page.locator(".pdf-editor-modal");
  await strengthsModal.getByLabel("Strengths").fill("협업\n문제 해결");
  await strengthsModal.getByRole("button", { name: "닫기" }).click();

  const preview = page.locator(".pdf-preview-pane");
  await expect(preview.getByText("김테스트")).toBeVisible();
  await expect(preview.getByText("첫 번째 근거")).toBeVisible();
  await expect(preview.getByText("두 번째 근거")).toBeVisible();

  const downloadPromise = page.waitForEvent("download").catch(() => null);
  await page.getByRole("button", { name: "PDF 내보내기" }).click();

  await expect(page.getByText("PDF를 내려받았어요.")).toBeVisible();

  const download = await downloadPromise;
  if (download) {
    expect(download.suggestedFilename()).toContain("Beta-Corp-Senior-Frontend-Engineer");
  }

  expect(lastPdfRequestBody).not.toBeNull();
  expect(lastPdfRequestBody).toMatchObject({
    templateId: "compact",
    themeId: "forest",
    company: {
      companyName: "Beta Corp",
      jobTitle: "Senior Frontend Engineer"
    },
    intro: {
      longIntro: "최종 소개글을 PDF 기준으로 다시 다듬었습니다."
    },
    resume: {
      name: "김테스트",
      headline: "React 제품 경험을 가진 프론트엔드 개발자",
      contacts: [
        {
          label: "GitHub",
          value: "github.com/qrqr",
          url: "https://github.com/qrqr"
        }
      ],
      techStack: ["React", "TypeScript", "Next.js", "Storybook", "PostgreSQL", "Docker"],
      pdfHighlights: ["첫 번째 근거", "두 번째 근거"],
      pdfStrengths: ["협업", "문제 해결"]
    }
  });
});

test("실행 중 로그 모달이 보이고 완료 후 하단 기록 패널에서 다시 확인할 수 있다", async ({ page }) => {
  await page.unroute("**/api/resume/stream");
  await page.route("**/api/resume/stream", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "이력서 구조화 시작" }
        },
        {
          event: "log",
          data: { level: "success", phase: "response", message: "이력서 초안 정리 완료" }
        },
        {
          event: "result",
          data: {
            data: {
              name: "홍길동",
              summary: "React와 TypeScript 기반 프론트엔드 개발자",
              desiredPosition: "Frontend Engineer",
              careerYears: 4,
              techStack: ["React", "TypeScript", "Next.js"],
              experience: [],
              projects: [],
              achievements: ["대시보드 초기 로딩 성능 개선"],
              strengths: ["협업", "문제 해결"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 420 }
        }
      ])
    });
  });

  await page.goto("/resume");
  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  const liveLogModal = page.locator(".live-log-modal");
  await expect(liveLogModal).toBeVisible();
  await expect(liveLogModal.getByRole("heading", { name: "이력서 정리" })).toBeVisible();
  await expect(liveLogModal.locator(".live-log-spinner")).toBeVisible();
  await expect(liveLogModal.getByLabel("작업 진행 상태")).toBeVisible();
  await expect(liveLogModal.locator(".live-progress-step").filter({ hasText: "입력 준비" })).toBeVisible();
  await expect(liveLogModal.locator(".live-progress-step").filter({ hasText: "이력서 분석" })).toBeVisible();
  await expect(liveLogModal.locator(".live-progress-step").filter({ hasText: "결과 준비" })).toBeVisible();

  await expect(page.getByRole("button", { name: "이력서 저장" })).toBeEnabled();
  await expect(liveLogModal).toHaveCount(0);

  const logDrawer = page.locator(".log-drawer");
  await expect(logDrawer).toBeVisible();
  await expect(logDrawer.getByText("이력서 초안 정리 완료")).toBeVisible();

  await page.getByRole("button", { name: "기록 보기" }).click();
  await expect(page.getByRole("heading", { name: "지난 작업 기록" })).toBeVisible();
  await expect(logDrawer.getByText("이력서 구조화 시작")).toBeVisible();
  await expect(logDrawer.getByText("이력서 초안 정리 완료")).toBeVisible();
});

test("작업 중지 버튼으로 진행 중인 AI 호출을 끊을 수 있다", async ({ page }) => {
  await page.unroute("**/api/resume/stream");
  await page.route("**/api/resume/stream", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: toSse([
        {
          event: "log",
          data: { level: "info", phase: "reasoning", message: "이력서 구조화 시작" }
        },
        {
          event: "result",
          data: {
            data: {
              name: "홍길동",
              summary: "React와 TypeScript 기반 프론트엔드 개발자",
              desiredPosition: "Frontend Engineer",
              careerYears: 4,
              techStack: ["React", "TypeScript", "Next.js"],
              experience: [],
              projects: [],
              achievements: ["대시보드 초기 로딩 성능 개선"],
              strengths: ["협업", "문제 해결"]
            }
          }
        },
        {
          event: "done",
          data: { ok: true, elapsedMs: 1500 }
        }
      ])
    });
  });

  await page.goto("/resume");
  await page.getByPlaceholder("이력서 내용을 붙여넣어 주세요.").fill("홍길동 이력서 원문");
  await page.getByRole("button", { name: "내용 정리" }).click();

  await expect(page.locator(".live-log-modal")).toBeVisible();
  await page.getByRole("button", { name: "작업 중지" }).click();

  await expect(page.getByText("이력서 정리를 중단했어요.")).toBeVisible();
  await expect(page.locator(".live-log-modal")).toHaveCount(0);
});

test("이력서를 수정하고 저장하면 공고와 소개글이 다시 저장 필요 상태가 된다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.goto("/resume");
  const overviewSection = getResumeOverviewSection(page);
  const resumeSection = getResumeCoreSection(page);

  await resumeSection.getByLabel("희망 직무").fill("Senior Frontend Engineer");
  await expect(overviewSection.getByText("수정됨")).toBeVisible();
  await page.getByRole("button", { name: "이력서 저장" }).click();

  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);
  await expect(companySection.getByText("수정됨")).toBeVisible();
  await expect(page.getByRole("link", { name: "소개글 만들기로 가기" })).toHaveCount(0);

  await page.goto("/result");
  await expect(page.getByRole("heading", { name: "먼저 저장해 주세요." })).toBeVisible();
  await expect(page.getByRole("button", { name: "소개글 만들기" })).toBeDisabled();
});

test("공고를 수정하고 다시 저장하면 소개글에 공고 변경 stale 이유가 표시된다", async ({ page }) => {
  await completeIntroFlow(page);

  await page.goto("/company");
  const companySection = getCompanyReviewSection(page);

  await companySection.getByLabel("포지션").fill("Senior Frontend Engineer");
  await expect(companySection.getByText("수정됨")).toBeVisible();
  await page.getByRole("button", { name: "공고 저장" }).click();

  await page.goto("/result");
  await expect(page.locator(".intro-action-copy strong")).toHaveText("공고 변경");
  await expect(page.locator(".reason-chip").filter({ hasText: "공고 변경" })).toBeVisible();

  await page.getByRole("button", { name: "소개글 만들기" }).click();

  await expect(page.getByText("최신 결과가 준비돼 있어요")).toBeVisible();
  await expect(page.locator(".reason-chip").filter({ hasText: "공고 변경" })).toHaveCount(0);
});
