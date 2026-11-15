import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSkillSource } from "@/server/skills";

afterEach(() => vi.unstubAllEnvs());

describe("skill source", () => {
  it("기본 실행은 저장소 파일과 내용 해시를 사용한다", async () => {
    vi.stubEnv("CODEX_SKILLS_DIR", "");
    const source = await readSkillSource("generate-intro");
    expect(source.path).toBe(path.join(process.cwd(), "skills/generate-intro/SKILL.md"));
    expect(source.sha256).toBe(createHash("sha256").update(source.markdown).digest("hex"));
  });

  it("명시한 외부 디렉터리가 있으면 해당 파일을 사용한다", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "skill-source-"));
    try {
      await fs.mkdir(path.join(directory, "generate-intro"));
      await fs.writeFile(path.join(directory, "generate-intro/SKILL.md"), "external");
      vi.stubEnv("CODEX_SKILLS_DIR", directory);
      expect((await readSkillSource("generate-intro")).markdown).toBe("external");
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it("명시한 외부 파일이 없으면 조용히 다른 프롬프트를 실행하지 않는다", async () => {
    vi.stubEnv("CODEX_SKILLS_DIR", path.join(os.tmpdir(), "missing-resume-tailor-skills"));
    await expect(readSkillSource("generate-intro")).rejects.toThrow("SKILL.md");
  });
});
