import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/evals/**/*.eval.ts"],
    testTimeout: 180_000,
    fileParallelism: false
  }
});
