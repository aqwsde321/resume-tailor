# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js App Router app for resume parsing, job-post parsing, and tailored intro generation. Put routes and pages in `app/`, shared business logic in `lib/`, and reusable UI in `app/components/`. API handlers live under `app/api/*`. Local prompt workflows belong in `skills/<skill>/SKILL.md`, and supporting docs belong in `docs/`. Keep tests under `tests/` by scope: `tests/api`, `tests/lib`, `tests/e2e`, and fixtures in `tests/fixtures`.

## Build, Test, and Development Commands
Use `npm run dev` for local development at `http://localhost:3000`. Use `npm run build` to create a production build and `npm run start` to serve it. Run `npm run lint` for ESLint, `npm run typecheck` for strict TypeScript checks, `npm run test` for Vitest unit/API tests, and `npm run test:e2e` for Playwright flow coverage. For a containerized setup, use `docker compose up --build` after initial Codex authentication.

## Coding Style & Naming Conventions
Write TypeScript with `strict` mode in mind and prefer the `@/*` import alias over deep relative paths. Follow the existing style: double quotes, semicolons, trailing commas where the formatter would add them, and PascalCase for React components such as `AppFrame`. Keep route files as `page.tsx` or `route.ts`, and use kebab-case for utility file names such as `company-normalize.ts`. Rely on `eslint.config.mjs`; there is no separate Prettier config in this repo.

## Testing Guidelines
Add unit and route tests as `tests/**/*.test.ts`, matching the Vitest include pattern. Add browser flows in `tests/e2e/*.spec.ts`. Prefer focused fixtures in `tests/fixtures/` and mock Codex calls in API tests rather than hitting real services. Before opening a PR, run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`; run `npm run test:e2e` for UI or routing changes.

## Commit & Pull Request Guidelines
Recent history uses short Korean commit subjects focused on the change outcome, for example `소개글 톤 선택 기능을 추가` or `작업 모달 진행 상태 표시를 개선`. Keep commits single-purpose and descriptive. PRs should include a brief summary, affected routes or skills, linked issue if one exists, test results, and screenshots or short recordings for UI changes.

## Security & Configuration Tips
Do not commit Codex credentials or generated artifacts from `.next/`, `test-results/`, or `output/`. When Codex is not on `PATH`, use `CODEX_CLI_PATH`; when external skills are needed, use `CODEX_SKILLS_DIR`. If you change any `skills/*/SKILL.md`, verify the related API route and test coverage together.
