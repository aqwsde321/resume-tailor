import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const launchMock = vi.hoisted(() => vi.fn());

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock
  }
}));

import { POST } from "@/app/api/company/fetch-url/route";

function mockBrowser(renderedHtml: string) {
  const page = {
    route: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue(renderedHtml),
    url: vi.fn().mockReturnValue("https://jobs.example.com/frontend")
  };

  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined)
  };

  launchMock.mockResolvedValue(browser);
  return { browser, page };
}

describe("POST /api/company/fetch-url", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    launchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("유효한 URL이면 공고 본문을 추출한다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="Example Jobs" />
          <title>프론트엔드 엔지니어 채용</title>
        </head>
        <body>
          <main>
            <h1>프론트엔드 엔지니어</h1>
            <section>
              <h2>주요 업무</h2>
              <p>React와 TypeScript 기반 서비스 화면을 개발합니다.</p>
            </section>
            <section>
              <h2>자격 요건</h2>
              <p>React 개발 경험, 협업 경험, 문제 해결 역량</p>
            </section>
            <section>
              <h2>우대 사항</h2>
              <p>Next.js 경험</p>
            </section>
          </main>
        </body>
      </html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        })
      )
    );

    const request = new Request("http://localhost/api/company/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://jobs.example.com/frontend"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe("프론트엔드 엔지니어");
    expect(body.data.companyNameHint).toBe("Example Jobs");
    expect(body.data.jobTitleHint).toBe("프론트엔드 엔지니어");
    expect(body.data.text).toContain("React와 TypeScript 기반 서비스 화면을 개발합니다.");
    expect(body.data.text).toContain("Next.js 경험");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("숨겨진 JSON 데이터가 있으면 브라우저 없이 공고 본문을 추출한다", async () => {
    const html = `
      <html>
        <head>
          <title>채용 페이지</title>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "job": {
                    "title": "프론트엔드 엔지니어",
                    "companyName": "Next Careers",
                    "description": "주요 업무\\nReact 서비스 화면을 개발합니다.\\n자격 요건\\nTypeScript 경험, 협업 경험"
                  }
                }
              }
            }
          </script>
        </head>
        <body>
          <div id="__next"></div>
        </body>
      </html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        })
      )
    );

    const request = new Request("http://localhost/api/company/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://jobs.example.com/frontend"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe("프론트엔드 엔지니어");
    expect(body.data.companyNameHint).toBe("Next Careers");
    expect(body.data.text).toContain("React 서비스 화면을 개발합니다.");
    expect(body.data.text).toContain("TypeScript 경험");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("정적 본문이 부족하면 브라우저 렌더링으로 다시 읽는다", async () => {
    const html = `
      <html>
        <head>
          <title>프론트엔드 엔지니어 채용</title>
        </head>
        <body>
          <main>
            <h1>프론트엔드 엔지니어</h1>
            <p>지금 채용 중입니다.</p>
          </main>
        </body>
      </html>
    `;

    const renderedHtml = `
      <html>
        <head>
          <meta property="og:site_name" content="Dynamic Careers" />
          <title>프론트엔드 엔지니어 채용</title>
        </head>
        <body>
          <main>
            <h1>프론트엔드 엔지니어</h1>
            <section>
              <h2>주요 업무</h2>
              <p>React와 TypeScript 기반 제품 화면을 개발합니다.</p>
            </section>
            <section>
              <h2>자격 요건</h2>
              <p>웹 프론트엔드 개발 경험, 협업 경험, 문제 해결 역량</p>
            </section>
          </main>
        </body>
      </html>
    `;

    mockBrowser(renderedHtml);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(html, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        })
      )
    );

    const request = new Request("http://localhost/api/company/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://jobs.example.com/frontend"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("Dynamic Careers");
    expect(body.data.jobTitleHint).toBe("프론트엔드 엔지니어");
    expect(body.data.text).toContain("React와 TypeScript 기반 제품 화면을 개발합니다.");
    expect(launchMock).toHaveBeenCalledTimes(1);
  });

  it("사람인 relay 공고는 ajax 상세를 우선 읽는다", async () => {
    const headers = new Headers({
      "content-type": "text/html; charset=utf-8"
    });
    headers.append("set-cookie", "RSRVID=web38; Path=/");
    headers.append("set-cookie", "PHPSESSID=test-session; Path=/; HttpOnly");

    const baseHtml = `
      <html>
        <head>
          <meta property="og:title" content="[인스피언(주)] [청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원(D-9) - 사람인" />
          <meta property="og:site_name" content="사람인" />
          <title>[인스피언(주)] [청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원(D-9) - 사람인</title>
        </head>
        <body>
          <div class="wrap_jview"></div>
          <script>
            var jv_options = { requestUrl: "/zf_user/jobs/relay/view-ajax" };
          </script>
        </body>
      </html>
    `;

    const ajaxHtml = `
      <div class="wrap_jv_cont">
        <div class="wrap_jv_header">
          <div class="jv_header">
            <a class="company">인스피언(주)</a>
            <h1 class="tit_job">[청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원</h1>
          </div>
        </div>
        <div class="jv_cont jv_summary">
          <dl><dt>경력</dt><dd><strong>신입·경력 7년 ↓</strong></dd></dl>
          <dl><dt>학력</dt><dd><strong>대졸(4년제) 이상</strong></dd></dl>
          <dl><dt>우대사항</dt><dd>Spring 개발 경험</dd></dl>
        </div>
        <div class="jv_cont jv_detail">
          <iframe class="iframe_content" src="/zf_user/jobs/relay/view-detail?rec_idx=52833510&rec_seq=0&t_category=non-logged_relay_view&t_content=view_detail&t_ref=avatar&t_ref_content=SRI_050_MYPAGE_MIX_RCT"></iframe>
        </div>
      </div>
    `;

    const detailHtml = `
      <!doctype html>
      <html>
        <body>
          <div class="user_content">
            <main class="job-posting">
              <p>[청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원</p>
              <p>📋 주요업무</p>
              <p>EAI 시스템 구축 및 전환 개발/컨설팅 수행</p>
              <p>webMethods, Kafka 등 미들웨어 기반 연계 시나리오 구현</p>
              <p>📋 자격요건</p>
              <p>신입 / 경력 7년 이하</p>
              <p>대학교졸업(4년)이상, 졸업 예정자 지원가능</p>
              <p>📋 우대사항</p>
              <p>Spring 개발 경험</p>
              <p>🚀 채용절차</p>
              <p>서류전형 → 과제수행 → 면접 → 최종합격</p>
            </main>
          </div>
        </body>
      </html>
    `;

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/zf_user/jobs/relay/view?")) {
        return new Response(baseHtml, {
          status: 200,
          headers
        });
      }

      if (url.endsWith("/zf_user/jobs/relay/view-ajax")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>)["X-Requested-With"]).toBe("XMLHttpRequest");
        expect((init?.headers as Record<string, string>).Cookie).toContain("RSRVID=web38");

        return new Response(ajaxHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        });
      }

      if (url.includes("/zf_user/jobs/relay/view-detail?rec_idx=52833510")) {
        expect((init?.headers as Record<string, string>).Cookie).toContain("PHPSESSID=test-session");

        return new Response(detailHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/company/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?isMypage=no&rec_idx=52833510&recommend_ids=x&view_type=avatar&t_ref_scnid=817&t_ref_content=SRI_050_MYPAGE_MIX_RCT&t_ref=avatar&referNonce=nonce"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("인스피언(주)");
    expect(body.data.jobTitleHint).toBe("[청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원");
    expect(body.data.text).toContain("EAI 시스템 구축 및 전환 개발/컨설팅 수행");
    expect(body.data.text).toContain("서류전형 → 과제수행 → 면접 → 최종합격");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("내부 주소는 차단한다", async () => {
    const request = new Request("http://localhost/api/company/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "http://localhost:3000/jobs/frontend"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("내부 네트워크 주소는 불러올 수 없어요.");
  });
});
