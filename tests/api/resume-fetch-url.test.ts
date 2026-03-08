import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const launchMock = vi.hoisted(() => vi.fn());

vi.mock("playwright", () => ({
  chromium: {
    launch: launchMock
  }
}));

import { POST } from "@/app/api/resume/fetch-url/route";

function mockBrowser(renderedHtml: string, url = "https://portfolio.example.com") {
  const page = {
    route: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue(renderedHtml),
    url: vi.fn().mockReturnValue(url)
  };

  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined)
  };

  launchMock.mockResolvedValue(browser);
  return { browser, page };
}

function mockNotionApi(pageId: string) {
  const pageIdWithDashes = pageId;
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = input.toString();

    if (url.includes("/api/v3/getPublicPageData")) {
      return new Response(
        JSON.stringify({
          pageId: pageIdWithDashes,
          spaceName: "개발자 포트폴리오",
          requireLogin: false
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    if (url.includes("/api/v3/loadCachedPageChunkV2")) {
      return new Response(
        JSON.stringify({
          cursors: [],
          recordMap: {
            block: {
              [pageIdWithDashes]: {
                value: {
                  id: pageIdWithDashes,
                  type: "page",
                  properties: {
                    title: [["김지원 | Backend Developer"]]
                  },
                  content: [
                    "summary",
                    "tech-header",
                    "career-header",
                    "project-header",
                    "project-item"
                  ]
                }
              },
              summary: {
                value: {
                  id: "summary",
                  type: "text",
                  properties: {
                    title: [[
                      "서비스 안정성과 데이터 흐름을 함께 고민하는 백엔드 개발자입니다. Java와 Spring을 중심으로 API 설계와 자동화 작업을 경험했습니다."
                    ]]
                  }
                }
              },
              "tech-header": {
                value: {
                  id: "tech-header",
                  type: "sub_header",
                  properties: {
                    title: [["🛠 Tech Stack"]]
                  },
                  content: ["tech-item-1", "tech-item-2"]
                }
              },
              "tech-item-1": {
                value: {
                  id: "tech-item-1",
                  type: "bulleted_list",
                  properties: {
                    title: [["Java, Spring Boot, JPA"]]
                  }
                }
              },
              "tech-item-2": {
                value: {
                  id: "tech-item-2",
                  type: "bulleted_list",
                  properties: {
                    title: [["NestJS, TypeScript, PostgreSQL"]]
                  }
                }
              },
              "career-header": {
                value: {
                  id: "career-header",
                  type: "sub_header",
                  properties: {
                    title: [["🛠 Career"]]
                  },
                  content: ["career-company", "career-role", "career-bullet"]
                }
              },
              "career-company": {
                value: {
                  id: "career-company",
                  type: "sub_sub_header",
                  properties: {
                    title: [["알파데이터"]]
                  }
                }
              },
              "career-role": {
                value: {
                  id: "career-role",
                  type: "text",
                  properties: {
                    title: [["자바 개발자 | 2023.01 ~ 2024.05"]]
                  }
                }
              },
              "career-bullet": {
                value: {
                  id: "career-bullet",
                  type: "bulleted_list",
                  properties: {
                    title: [["대규모 캐시 시스템 구축 프로젝트"]]
                  }
                }
              },
              "project-header": {
                value: {
                  id: "project-header",
                  type: "sub_header",
                  properties: {
                    title: [["🚀 Projects"]]
                  }
                }
              },
              "project-item": {
                value: {
                  id: "project-item",
                  type: "numbered_list",
                  properties: {
                    title: [["포지션 매칭 플랫폼 (NestJS)"]]
                  }
                }
              }
            }
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    throw new Error(`Unexpected URL: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("POST /api/resume/fetch-url", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    launchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("유효한 URL이면 이력서 본문과 힌트를 추출한다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="홍길동 포트폴리오" />
          <meta property="og:title" content="홍길동 | Frontend Engineer" />
          <title>홍길동 | Frontend Engineer</title>
        </head>
        <body>
          <main>
            <h1>홍길동</h1>
            <h2>Frontend Engineer</h2>
            <section>
              <h3>Summary</h3>
              <p>React와 TypeScript 기반 제품을 설계하고 개선해 온 프론트엔드 개발자입니다.</p>
            </section>
            <section>
              <h3>Projects</h3>
              <p>대시보드 성능 최적화와 실험 플랫폼 개발 경험이 있습니다.</p>
            </section>
            <section>
              <h3>Skills</h3>
              <p>React, TypeScript, Next.js, Testing Library</p>
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

    const request = new Request("http://localhost/api/resume/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://portfolio.example.com"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe("홍길동 | Frontend Engineer");
    expect(body.data.nameHint).toBe("홍길동");
    expect(body.data.desiredPositionHint).toBe("Frontend Engineer");
    expect(body.data.text).toContain("React와 TypeScript 기반 제품을 설계하고 개선해 온 프론트엔드 개발자입니다.");
    expect(body.data.text).toContain("React, TypeScript, Next.js, Testing Library");
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("노션 형태 제목에서도 이름과 직무 힌트를 분리한다", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="Notion" />
          <meta property="og:title" content="김개발 - Product Engineer 포트폴리오" />
          <title>김개발 - Product Engineer 포트폴리오</title>
        </head>
        <body>
          <main>
            <h1>김개발</h1>
            <h2>Product Engineer</h2>
            <section>
              <p>경력 5년차 개발자로 제품 지표와 사용성 개선을 함께 다뤄 왔습니다.</p>
              <p>프로젝트마다 문제 정의, 실험 설계, React 기반 구현을 주도했습니다.</p>
              <p>기술 스택은 React, TypeScript, Node.js입니다.</p>
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

    const request = new Request("http://localhost/api/resume/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://resume.notion.site/product-engineer"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.nameHint).toBe("김개발");
    expect(body.data.desiredPositionHint).toBe("Product Engineer");
  });

  it("노션 pageId URL은 공개 API로 전체 블록을 읽어 본문을 확장한다", async () => {
    const fetchMock = mockNotionApi("aaaaaaaa-1111-2222-3333-444455556666");

    const request = new Request("http://localhost/api/resume/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.notion.so/backend-portfolio-aaaaaaaa111122223333444455556666"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.nameHint).toBe("김지원");
    expect(body.data.desiredPositionHint).toBe("Backend Developer");
    expect(body.data.text).toContain("대규모 캐시 시스템 구축 프로젝트");
    expect(body.data.text).toContain("포지션 매칭 플랫폼 (NestJS)");
    expect(body.data.text.length).toBeGreaterThan(180);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(launchMock).not.toHaveBeenCalled();
  });

  it("초기 HTML이 빈 셸이면 브라우저 렌더 결과로 다시 추출한다", async () => {
    const shellHtml = `
      <html>
        <head>
          <title>홍길동 포트폴리오</title>
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `;

    const renderedHtml = `
      <html>
        <head>
          <title>홍길동 | Frontend Engineer</title>
        </head>
        <body>
          <main>
            <h1>홍길동</h1>
            <h2>Frontend Engineer</h2>
            <section>
              <p>프론트엔드 개발과 디자인 시스템 운영 경험이 있습니다.</p>
              <p>React, TypeScript, Next.js 기반 프로젝트를 수행했습니다.</p>
              <p>프로젝트와 경력 내용을 포트폴리오에 정리했습니다.</p>
            </section>
          </main>
        </body>
      </html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(shellHtml, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        })
      )
    );
    mockBrowser(renderedHtml);

    const request = new Request("http://localhost/api/resume/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://portfolio.example.com/app"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.nameHint).toBe("홍길동");
    expect(body.data.desiredPositionHint).toBe("Frontend Engineer");
    expect(body.data.text).toContain("디자인 시스템 운영 경험");
    expect(launchMock).toHaveBeenCalledTimes(1);
  });

  it("내부 네트워크 주소는 차단한다", async () => {
    const request = new Request("http://localhost/api/resume/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "http://127.0.0.1:3000/private"
      })
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.message).toBe("내부 네트워크 주소는 불러올 수 없어요.");
  });
});
