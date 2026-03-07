# Release Notes

## Unreleased

### Added
- 채용공고 URL 불러오기 지원: `/company`에서 붙여넣기, `txt`, URL 입력을 같은 분석 흐름으로 연결
- 채용공고 불러오기 가이드 문서 추가: [COMPANY_FETCH_GUIDE.md](/Users/jino/study/project/resumeMake/docs/COMPANY_FETCH_GUIDE.md)
- 상세 본문이 이미지인 공고를 위한 macOS Vision OCR fallback 추가
- 채용공고 정규화 회귀 테스트 11개와 소개글 stale 이유 헬퍼 테스트 추가
- 소개글 생성 전에 필수/우대 요건과 이력서 근거를 묶는 `[작성 앵커]` 추가

### Changed
- 사람인 relay 공고는 `view -> view-ajax -> view-detail` 순서로 현재 공고 상세를 우선 추출하도록 개선
- 잡코리아 `GI_Read` 공고는 `GI_Read_Comt_Ifrm` 상세 iframe을 직접 읽도록 개선
- 잡코리아/사람인 공고 추출 시 추천공고, 하단 안내, footer 문구가 본문에 섞이지 않도록 정제 규칙 강화
- 원티드/점핏 공고는 정적 HTML만으로 본문이 안정적으로 잡히는지 회귀 테스트를 추가
- `company` API 응답 전에 `normalizeCompany()` 후처리를 적용해 복지/추천공고/중복 bullet 노이즈를 정리
- 결과 단계에서 `이력서 변경`, `공고 변경` 기준으로 다시 만들기 이유와 배지를 표시
- `shortIntro`와 `longIntro`가 공고 요건과 프로젝트/성과 근거를 더 직접 연결하도록 프롬프트와 후처리를 강화
- `저장 전 확인`의 누락 항목을 누르면 해당 입력 위치로 스크롤 및 포커스 이동하도록 개선

### Verified
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- 실제 사람인 URL 추출 확인
- 실제 잡코리아 URL 추출 확인

## v0.4.0 (2026-03-07)

### Added
- 소개글 결과 구조에 `longIntro`를 추가하고, 생성 가이드와 저장/복원/검증 로직을 3단계(`oneLineIntro`, `shortIntro`, `longIntro`)로 확장
- 작업 실행 중 상단을 가리지 않는 중앙 진행 모달과 하단 접이식 작업 기록 패널 추가
- 기본은 현재 값만 보이고 hover/focus 때만 `생각 깊이` 힌트가 드러나는 미니멀 칩 UI 추가

### Changed
- 이력서/공고/소개글 단계 카드를 작업 중 상태가 드러나는 입력·확인 흐름으로 재구성
- 단계 이동 스티키의 클릭 영역을 카드 전체로 확장하고, 소개글 단계의 중복 안내와 불필요한 버튼을 제거
- 이력서 정리 화면에서 이름 입력을 제거하고, 필수 항목 안내를 저장 영역의 강조 노트로 이동
- 작업 기록 문구를 사용자 중심 문장으로 정리하고, `더 보기`와 `비우기` 동작을 제거

### Verified
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e -- tests/e2e/flow.spec.ts`

### Tag
- Git tag: `v0.4.0`

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
