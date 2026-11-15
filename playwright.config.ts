import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "NEXT_DIST_DIR=.next/e2e npm run build && NEXT_DIST_DIR=.next/e2e npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/resume",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
