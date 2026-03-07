import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["test-results/**", "playwright-report/**", ".playwright-cli/**", "output/playwright/**"]
  },
  ...nextCoreWebVitals,
  ...nextTypeScript
];

export default eslintConfig;
