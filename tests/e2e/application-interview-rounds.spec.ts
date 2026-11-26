import { expect, test } from "@playwright/test";
import { createApplicationRecord } from "../../src/entities/application/model/application-record";
import { companyFixture, createPdfResumeFixture, introFixture } from "../fixtures/pdf-fixture";

test("면접 차수마다 일정과 준비 내용을 저장하고 달력에서 해당 차수로 이동한다", async ({ page }) => {
  const record = createApplicationRecord({
    resume: createPdfResumeFixture(), company: companyFixture, intro: introFixture, resumeSnapshot: "이력서",
    companySnapshot: "공고", templateId: "modern", themeId: "forest", customAccentHex: "",
  });
  await page.addInitScript((record) => {
    const key = "resume-tailor.pipeline.v2";
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ applications: [record] }));
  }, record);
  await page.route("**/api/application/interview-prep", (route) => {
    expect(route.request().postDataJSON().interviewRound).toBe("실무진 면접");
    const questions = ["API 운영", "협업", "장애 대응"].map((topic) => ({
      question: `${topic} 경험을 알려주세요.`, focus: "직접 맡은 역할", resumeEvidence: "이력서에 정리한 API 개발",
      answerOutline: ["상황을 설명한다.", "맡은 역할을 설명한다."],
    }));
    return route.fulfill({ json: { ok: true, data: {
      generatedAt: new Date().toISOString(), openingPitch: "실무진 면접용 소개입니다.", questions,
      questionsToAsk: ["팀의 배포 흐름은 어떻게 되나요?", "현재 우선순위는 무엇인가요?"],
    } } });
  });

  await page.goto("/applications");
  await page.getByText("면접 차수", { exact: true }).click();
  const add = page.getByRole("button", { name: "면접 차수 추가", exact: true });
  await add.click();
  await page.getByRole("textbox", { name: "차수 이름", exact: true }).fill("실무진 면접");
  const today = await page.evaluate(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  });
  await page.getByLabel("면접 날짜", { exact: true }).fill(today);
  await page.getByLabel("면접 시간", { exact: true }).fill("14:30");
  await page.getByRole("textbox", { name: "새 준비 항목", exact: true }).fill("아키텍처 설명 연습");
  await page.getByRole("button", { name: "항목 추가", exact: true }).click();
  await page.getByRole("checkbox", { name: "아키텍처 설명 연습", exact: true }).check();
  await page.getByRole("textbox", { name: "면접 복기", exact: true }).fill("DB 인덱스 기준을 물어봤다.");
  await page.getByText("이 차수의 예상 질문", { exact: true }).click();
  await page.getByRole("button", { name: "이 차수의 예상 질문 만들기", exact: true }).click();
  await expect(page.getByText("실무진 면접용 소개입니다.")).toBeVisible();

  await add.click();
  await expect(page.getByRole("textbox", { name: "차수 이름", exact: true })).toHaveValue("2차 면접");
  await expect(page.getByRole("textbox", { name: "면접 복기", exact: true })).toBeEmpty();
  await page.getByRole("button", { name: "달력 보기", exact: true }).click();
  await page.getByRole("button", { name: "Beta Corp · 14:30 실무진 면접", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "차수 이름", exact: true })).toHaveValue("실무진 면접");
  await expect(page.getByRole("checkbox", { name: "아키텍처 설명 연습", exact: true })).toBeChecked();

  await page.reload();
  await page.getByText("면접 차수 · 2개", { exact: true }).click();
  await page.getByText("실무진 면접", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "면접 복기", exact: true })).toHaveValue("DB 인덱스 기준을 물어봤다.");
  await page.getByText("이 차수의 예상 질문 · 저장됨", { exact: true }).click();
  await expect(page.getByText("실무진 면접용 소개입니다.")).toBeVisible();
});
