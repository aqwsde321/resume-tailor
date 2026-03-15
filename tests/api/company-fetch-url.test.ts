import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const launchMock = vi.hoisted(() => vi.fn());
const extractTextFromImagesMock = vi.hoisted(() => vi.fn());
const isImageOcrAvailableMock = vi.hoisted(() => vi.fn());

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock
  }
}));

vi.mock("@/server/company-image-ocr", () => ({
  extractTextFromImages: extractTextFromImagesMock,
  isImageOcrAvailable: isImageOcrAvailableMock
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
    extractTextFromImagesMock.mockReset();
    isImageOcrAvailableMock.mockReset();
    extractTextFromImagesMock.mockResolvedValue([]);
    isImageOcrAvailableMock.mockReturnValue(true);
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

  it("제목 앞의 회사 prefix와 마감 표기를 분리해 힌트를 잡는다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="사람인" />
          <meta property="og:title" content="[인스피언(주)] [청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원(D-9) - 사람인" />
          <title>[인스피언(주)] [청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원(D-9) - 사람인</title>
        </head>
        <body>
          <main>
            <section>
              <h2>주요 업무</h2>
              <p>Java 기반 연계 서비스를 개발합니다.</p>
            </section>
            <section>
              <h2>자격 요건</h2>
              <p>Spring 경험, 협업 경험, 문제 해결 역량</p>
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
        url: "https://jobs.example.com/java-backend"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("인스피언(주)");
    expect(body.data.jobTitleHint).toBe("[청년디지털일자리]2026년 상반기 Java개발 신입/경력 사원");
  });

  it("회사명 채용 - 포지션 형식 제목도 회사와 포지션을 분리한다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="잡코리아" />
          <meta property="og:title" content="Product Metrics 채용 - Frontend Engineer | 잡코리아" />
          <title>Product Metrics 채용 - Frontend Engineer | 잡코리아</title>
        </head>
        <body>
          <main>
            <section>
              <h2>주요 업무</h2>
              <p>대시보드 성능을 개선하고 실험 화면을 개발합니다.</p>
            </section>
            <section>
              <h2>자격 요건</h2>
              <p>TypeScript 경험, 협업 경험</p>
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
        url: "https://jobs.example.com/frontend-metrics"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("Product Metrics");
    expect(body.data.jobTitleHint).toBe("Frontend Engineer");
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

  it("상세 공고가 이미지면 OCR로 본문을 보강한다", async () => {
    const headers = new Headers({
      "content-type": "text/html; charset=utf-8"
    });
    headers.append("set-cookie", "PHPSESSID=image-session; Path=/; HttpOnly");

    const baseHtml = `
      <html>
        <head>
          <title>백엔드 개발자 채용 - 사람인</title>
        </head>
        <body>
          <div class="wrap_jview"></div>
        </body>
      </html>
    `;

    const ajaxHtml = `
      <div class="wrap_jv_cont">
        <div class="wrap_jv_header">
          <div class="jv_header">
            <a class="company">테스트랩</a>
            <h1 class="tit_job">백엔드 개발자</h1>
          </div>
        </div>
        <div class="jv_cont jv_detail">
          <iframe class="iframe_content" src="/zf_user/jobs/relay/view-detail?rec_idx=1000"></iframe>
        </div>
      </div>
    `;

    const detailHtml = `
      <html>
        <body>
          <div class="user_content">
            <p>상세 내용은 아래 이미지에서 확인해 주세요.</p>
            <img src="/recruit-images/detail-1.png" />
          </div>
        </body>
      </html>
    `;

    extractTextFromImagesMock.mockResolvedValue([
      "주요 업무\nSpring Boot 기반 API 개발\n자격 요건\nJava 실무 경험\n우대 사항\nMSA 환경 경험"
    ]);

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/zf_user/jobs/relay/view?")) {
        return new Response(baseHtml, {
          status: 200,
          headers
        });
      }

      if (url.endsWith("/zf_user/jobs/relay/view-ajax")) {
        return new Response(ajaxHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        });
      }

      if (url.includes("/zf_user/jobs/relay/view-detail?rec_idx=1000")) {
        return new Response(detailHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        });
      }

      if (url.endsWith("/recruit-images/detail-1.png")) {
        expect((init?.headers as Record<string, string>).Referer).toContain("/zf_user/jobs/relay/view?");
        expect((init?.headers as Record<string, string>).Cookie).toContain("PHPSESSID=image-session");

        return new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: {
            "content-type": "image/png"
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
        url: "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1000&view_type=avatar&t_ref=avatar"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("테스트랩");
    expect(body.data.jobTitleHint).toBe("백엔드 개발자");
    expect(body.data.text).toContain("Spring Boot 기반 API 개발");
    expect(body.data.text).toContain("Java 실무 경험");
    expect(extractTextFromImagesMock).toHaveBeenCalledTimes(1);
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("OCR 미지원 환경에서도 이미지 본문 감지를 warning으로 돌려준다", async () => {
    isImageOcrAvailableMock.mockReturnValue(false);

    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="테스트랩" />
          <title>백엔드 개발자 채용</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "백엔드 개발자",
              "hiringOrganization": { "name": "테스트랩" },
              "description": "주요 업무\\nSpring Boot 기반 API 개발\\n자격 요건\\nJava 실무 경험\\n우대 사항\\nDocker 운영 경험"
            }
          </script>
        </head>
        <body>
          <main>
            <p>상세 내용은 이미지를 확인해 주세요.</p>
            <img src="/recruit-images/detail-2.png" />
          </main>
        </body>
      </html>
    `;

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://jobs.example.com/image-warning") {
        return new Response(html, {
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
        url: "https://jobs.example.com/image-warning"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.text).toContain("Spring Boot 기반 API 개발");
    expect(body.data.warning).toContain("상세 본문 이미지가 감지돼");
    expect(extractTextFromImagesMock).not.toHaveBeenCalled();
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("잡코리아 GI_Read 공고는 상세 iframe 본문을 우선 읽고 추천공고를 제외한다", async () => {
    const baseHtml = `
      <html>
        <head>
          <meta property="og:title" content="엔에이치엔케이씨피㈜ 채용 - [NHN KCP] Java 백엔드 웹개발 담당 | 잡코리아" />
          <meta property="og:site_name" content="잡코리아" />
          <title>엔에이치엔케이씨피㈜ 채용 - [NHN KCP] Java 백엔드 웹개발 담당 | 잡코리아</title>
        </head>
        <body>
          <main>
            <div>엔에이치엔케이씨피㈜ [NHN KCP] Java 백엔드 웹개발 담당</div>
            <div>모집요강 모집분야 Java 웹프로그래머 모집인원 1명 지원자격 경력 경력(3년이상) 학력 초대졸이상</div>
            <div>로그인하고 비슷한 조건의 AI추천공고를 확인해 보세요! 다른 회사 공고 A 다른 회사 공고 B</div>
          </main>
        </body>
      </html>
    `;

    const detailHtml = `
      <html>
        <body>
          <main>
            <h1>[NHN KCP] Java 백엔드 웹개발 담당</h1>
            <p>우리 팀을 소개합니다.</p>
            <p>온·오프라인 결제 데이터 서비스 플랫폼을 제공합니다.</p>
            <p>주요 업무</p>
            <p>PG/VAN 백엔드 시스템 개발</p>
            <p>자격 요건</p>
            <p>Java 기반 서버 개발 역량 보유</p>
            <p>우대 사항</p>
            <p>React 또는 Vue.js 기반 프론트엔드 개발 역량 보유자</p>
            <p>본 공고는 수시 채용으로 채용 완료 시 조기 마감될 수 있습니다.</p>
          </main>
        </body>
      </html>
    `;

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/Recruit/GI_Read/48559708")) {
        return new Response(baseHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        });
      }

      if (url.includes("/Recruit/GI_Read_Comt_Ifrm") && url.includes("Gno=48559708")) {
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
        url: "https://www.jobkorea.co.kr/Recruit/GI_Read/48559708?Oem_Code=C1&logpath=1&stext=java&listno=3&sc=630"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("엔에이치엔케이씨피㈜");
    expect(body.data.jobTitleHint).toBe("[NHN KCP] Java 백엔드 웹개발 담당");
    expect(body.data.text).toContain("PG/VAN 백엔드 시스템 개발");
    expect(body.data.text).toContain("Java 기반 서버 개발 역량 보유");
    expect(body.data.text).not.toContain("AI추천공고");
    expect(body.data.text).not.toContain("다른 회사 공고");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("원티드 공고는 정적 HTML 본문을 바로 읽는다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="원티드" />
          <meta property="og:title" content="원티드랩 - 백엔드 엔지니어 | 원티드" />
          <title>원티드랩 - 백엔드 엔지니어 | 원티드</title>
        </head>
        <body>
          <main>
            <article>
              <h1>백엔드 엔지니어</h1>
              <section>
                <h2>주요 업무</h2>
                <p>Java와 Kotlin 기반 결제 API를 개발합니다.</p>
                <p>대용량 트래픽 환경에서 서비스 안정성을 개선합니다.</p>
                <p>정산 도메인 요구사항을 제품과 운영 환경에 맞게 구조화합니다.</p>
              </section>
              <section>
                <h2>자격 요건</h2>
                <p>백엔드 개발 경력 3년 이상</p>
                <p>Spring Boot 기반 서비스 개발 경험</p>
                <p>RDBMS 설계 및 성능 최적화 경험</p>
              </section>
              <section>
                <h2>우대 사항</h2>
                <p>AWS 운영 경험</p>
                <p>MSA 환경 경험</p>
              </section>
              <section>
                <h2>기술 스택</h2>
                <p>Java, Kotlin, Spring Boot, MySQL, Redis</p>
              </section>
            </article>
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
        url: "https://www.wanted.co.kr/wd/246810"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("원티드랩");
    expect(body.data.jobTitleHint).toBe("백엔드 엔지니어");
    expect(body.data.text).toContain("Java와 Kotlin 기반 결제 API를 개발합니다.");
    expect(body.data.text).toContain("Spring Boot 기반 서비스 개발 경험");
    expect(body.data.text).toContain("AWS 운영 경험");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("점핏 공고는 정적 HTML 본문을 바로 읽는다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="점핏" />
          <meta property="og:title" content="카카오스타일 - 백엔드 개발자 | 점핏" />
          <title>카카오스타일 - 백엔드 개발자 | 점핏</title>
        </head>
        <body>
          <main>
            <div class="position-description">
              <h1>백엔드 개발자</h1>
              <section>
                <h2>주요 업무</h2>
                <p>주문/정산 도메인 백엔드 서비스를 개발합니다.</p>
              </section>
              <section>
                <h2>자격 요건</h2>
                <p>Java 또는 Kotlin 기반 서버 개발 경험</p>
                <p>RDBMS 설계 및 운영 경험</p>
              </section>
              <section>
                <h2>우대 사항</h2>
                <p>Kafka 운영 경험</p>
              </section>
              <section>
                <h2>기술 스택</h2>
                <p>Java, Kotlin, Spring Boot, MySQL, Kafka</p>
              </section>
            </div>
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
        url: "https://www.jumpit.co.kr/position/13579"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.companyNameHint).toBe("카카오스타일");
    expect(body.data.jobTitleHint).toBe("백엔드 개발자");
    expect(body.data.text).toContain("주문/정산 도메인 백엔드 서비스를 개발합니다.");
    expect(body.data.text).toContain("Java 또는 Kotlin 기반 서버 개발 경험");
    expect(body.data.text).toContain("Kafka 운영 경험");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("이미지 본문만 감지되고 OCR 미지원 환경이면 구체적인 안내로 실패한다", async () => {
    isImageOcrAvailableMock.mockReturnValue(false);

    const weakHtml = `
      <html>
        <head>
          <title>이미지 공고</title>
        </head>
        <body>
          <main>
            <p>상세 내용은 아래 이미지를 확인해 주세요.</p>
            <img src="/recruit-images/detail-only.png" />
          </main>
        </body>
      </html>
    `;

    mockBrowser(weakHtml);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(weakHtml, {
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
        url: "https://jobs.example.com/image-only"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("상세 본문 이미지가 감지됐지만 현재 실행 환경에서는 자동으로 읽지 못했어요.");
    expect(body.error.details).toContain("macOS 로컬 실행");
    expect(extractTextFromImagesMock).not.toHaveBeenCalled();
    expect(launchMock).toHaveBeenCalledTimes(1);
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
