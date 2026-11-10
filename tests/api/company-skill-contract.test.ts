import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const skill = readFileSync(path.resolve(process.cwd(), "skills/company-to-json/SKILL.md"), "utf8");

describe("company-to-json skill", () => {
  it("원문에 있는 주요 업무를 1~2문장으로 과도하게 압축하지 않는다", () => {
    expect(skill).not.toContain("1~2문장 요약만");
    expect(skill).toContain("핵심 업무와 책임 범위");
    expect(skill).toContain("서로 다른 주요 업무는 각각 한 문장으로 보존");
    expect(skill).toContain("최대 5개 업무");
    expect(skill).toContain("여러 업무를 추상적인 한 문장으로 합치지 않기");
  });
});
