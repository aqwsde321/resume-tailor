import { afterEach, describe, expect, it, vi } from "vitest";
const launch = vi.hoisted(() => vi.fn());
vi.mock("playwright", () => ({ chromium: { launch } }));
import { fetchCompanyPage } from "@/server/company-url-fetch";
const url = "https://www.wanted.co.kr/wd/123456";
const intro = "Java 백엔드 개발자가 API 서비스를 설계하고 운영합니다. ".repeat(15);
const html = (expanded: boolean) => `<html><head><title>예시 회사 백엔드 채용</title></head><body><main><article class="JobDescription_JobDescription__example"><h2>포지션 상세</h2><p>${intro}</p><h3>주요업무</h3><p>API 개발<br>테스트 작성</p><h3>자격요건</h3><p>Java 경험</p>${expanded ? '<h3>우대사항</h3><p>분산 처리 경험</p><h3>혜택 및 복지</h3><p>교육비 지원</p><h3>채용 전형</h3><p>서류와 면접</p>' : '<button>상세 정보 더 보기</button>'}</article><section>${"다른 공고 추천 저작권 안내 ".repeat(100)}</section></main></body></html>`;
function mockPage(fail = false) {
  let expanded = false;
  const button = { isVisible: vi.fn().mockResolvedValue(true), click: vi.fn(async () => { if (fail) throw new Error("timeout"); expanded = true; }), waitFor: vi.fn().mockResolvedValue(undefined) };
  const first = vi.fn().mockReturnValue(button);
  const getByRole = vi.fn().mockReturnValue({ first });
  const page = { route: vi.fn(), on: vi.fn(), goto: vi.fn(), waitForTimeout: vi.fn(), waitForLoadState: vi.fn().mockResolvedValue(undefined), url: () => url, content: async () => html(expanded), locator: vi.fn().mockReturnValue({ getByRole }) };
  launch.mockResolvedValue({ newPage: async () => page, close: vi.fn().mockResolvedValue(undefined) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html(false), { headers: { "content-type": "text/html" } })));
  return { button, page };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("원티드 접힌 공고 추출", () => {
  it("초기 본문이 길어도 상세 더 보기를 펼치고 전체 본문과 줄바꿈을 보존한다", async () => {
    const { button } = mockPage();
    const result = await fetchCompanyPage(url);
    expect(button.click).toHaveBeenCalledOnce();
    expect(result.text).toContain("우대사항\n분산 처리 경험");
    expect(result.text).toContain("API 개발\n테스트 작성");
    expect(result.text).toContain("채용 전형\n서류와 면접");
    expect(result.text).not.toContain("다른 공고 추천");
    expect(result.text).not.toContain("상세 정보 더 보기");
  });
  it("펼치기에 실패하면 전체 추출로 오인하지 않도록 경고한다", async () => {
    mockPage(true);
    const result = await fetchCompanyPage(url);
    expect(result.warning).toMatch(/펼|추가/);
  });
});
