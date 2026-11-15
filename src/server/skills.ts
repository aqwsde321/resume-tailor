import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { SkillName } from "@/shared/lib/types";

export async function readSkillSource(skillName: SkillName) {
  // 외부 스킬은 명시적으로 선택할 때만 사용한다. 잘못된 설정은 fallback으로 숨기지 않는다.
  const root = process.env.CODEX_SKILLS_DIR || path.join(process.cwd(), "skills");
  const sourcePath = path.resolve(root, skillName, "SKILL.md");
  const markdown = await fs.readFile(sourcePath, "utf8");
  return {
    path: sourcePath,
    markdown,
    sha256: createHash("sha256").update(markdown).digest("hex")
  };
}

export async function readSkillMarkdown(skillName: SkillName): Promise<string> {
  return (await readSkillSource(skillName)).markdown;
}
