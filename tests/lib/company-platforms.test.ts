import { describe, expect, it } from "vitest";
import { getCompanyPlatform } from "@/server/company-platforms";
describe("공고 플랫폼 선택", () => {
  it("점핏을 사람인보다 먼저 구분한다", () => {
    expect(getCompanyPlatform("jumpit.saramin.co.kr")?.id).toBe("jumpit");
    expect(getCompanyPlatform("www.saramin.co.kr")?.id).toBe("saramin");
  });
  it("도메인 경계를 확인하고 미등록 플랫폼은 공통 경로에 맡긴다", () => {
    expect(getCompanyPlatform("www.wanted.co.kr")?.id).toBe("wanted");
    expect(getCompanyPlatform("wanted.co.kr.example.com")).toBeUndefined();
    expect(getCompanyPlatform("notwanted.co.kr")).toBeUndefined();
    expect(getCompanyPlatform("jobs.example.com")).toBeUndefined();
  });
});
