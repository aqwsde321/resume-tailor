import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const skill = readFileSync(path.resolve(process.cwd(), "skills/tailor-resume/SKILL.md"), "utf8");

describe("tailor-resume skill", () => {
  it("headline, summary, experience, and project evidence IDs are limited to one through four", () => {
    expect(skill).toContain("실제 제공된 근거 ID를 1~4개만 넣습니다");
    expect(skill).toContain("최대 6개까지 연결합니다");
  });
});
