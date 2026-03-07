# Release Notes

## Unreleased

## v0.3.0 (2026-03-07)

### Added
- 실행 설정 연동 추가: 이력서/채용공고/자기소개 생성 API와 SSE 경로에서 `modelReasoningEffort` 옵션을 받을 수 있도록 확장
- 실행 옵션 전달 검증 테스트 추가

### Changed
- 편집 UI를 한글 폼 중심으로 정리하고 반복 상태 카드/배지를 제거해 화면 밀도를 단순화
- 상단 sticky 영역을 단계 이동 중심으로 축소하고, 태블릿 이하에서는 고정을 해제해 본문 가림 문제를 줄임
- 결과 화면을 세로 검토 흐름으로 재배치해 문장 확인과 복사 동선을 단순화
- 모델 ID 입력을 제거하고 이성 수준만 선택하도록 변경
- 이성 수준 기본값을 `Medium`으로 조정

### Verified
- `npm run lint`
- `npm run typecheck`
- `npm run test`

### Tag
- Git tag: `v0.3.0`

## v0.2.0 (2026-03-06)

### Added
- 페이지 분리 플로우 도입: `/resume`, `/company`, `/result`
- JSON 확정 상태 기반 파이프라인(`resumeConfirmedJson`, `companyConfirmedJson`)
- SSE 스트림 API 추가:
  - `POST /api/resume/stream`
  - `POST /api/company/stream`
  - `POST /api/intro/stream`
- AI 분석 로그 실시간 표시(UI 로그 패널)
- 작업 중 상태 표시(스피너 + 경과 시간)
- 파이프라인 전역 상태 관리(`PipelineProvider`)

### Changed
- 루트(`/`) 진입 시 `/resume`으로 리다이렉트
- 결과 최신성(stale) 규칙 추가
- `@openai/codex-sdk` 스트리밍 실행 경로(`runStreamed`) 지원
- 에러 정규화 처리 강화(`normalizeApiError`)

### Verified
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `/api/resume/stream` SSE 스모크 테스트

## v0.1.0 (2026-03-06)

### Added
- 로컬 MVP 기본 구조(Next.js + 3개 API + SKILL 연동)
- txt 업로드/텍스트 입력, JSON 편집, 소개문 생성 기본 UI
- API 라우트 테스트(Vitest)
- 기본 개발 문서 및 서비스 기획서

### Tag
- Git tag: `v0.1.0`
