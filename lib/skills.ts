import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { SkillName } from "@/lib/types";

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readSkillMarkdown(skillName: SkillName): Promise<string> {
  const codexSkillsDir =
    process.env.CODEX_SKILLS_DIR ?? path.join(os.homedir(), ".codex", "skills");

  const candidates = [
    path.join(codexSkillsDir, skillName, "SKILL.md"),
    path.join(process.cwd(), "skills", skillName, "SKILL.md")
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return fs.readFile(candidate, "utf8");
    }
  }

  throw new Error(
    `SKILL.md를 찾을 수 없습니다: ${skillName}. 확인 경로: ${candidates.join(", ")}`
  );
}
