# Release Notes

## Unreleased

### Added
- 한글 폼 기반 편집 UI 추가: raw JSON 대신 항목별 입력 필드로 이력서/채용공고 수정 가능
- 상단 고정 스텝 셸 추가: `STEP 1/2/3` 진행 상태와 확정 상태를 항상 표시
- 필수 항목 하이라이트 및 확정 가드 추가
- 결과 페이지 이전/현재 자기소개 비교 UI 추가
- 자동 높이 조절 textarea 컴포넌트 추가

### Changed
- 이력서/채용공고 단계에서 확정 버튼을 카드 하단으로 이동
- 다음 단계 이동 버튼은 현재 단계 확정 후에만 노출되도록 변경
- 로그 패널은 기본적으로 최근 5개만 노출하고 필요 시 펼치도록 변경
- 화면 문구를 `이력서 JSON` 중심에서 사용자용 편집 문구 중심으로 정리

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
