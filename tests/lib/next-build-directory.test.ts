import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("E2E 빌드는 실행 중인 개발 서버와 출력 디렉터리를 분리한다", () => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", "import config from './next.config.mjs'; console.log(config.distDir);"], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_DIST_DIR: ".next/e2e" },
    encoding: "utf8",
  });
  expect(output.trim()).toBe(".next/e2e");
});
