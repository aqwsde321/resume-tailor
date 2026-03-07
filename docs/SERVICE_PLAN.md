# ResumeMake 서비스 기획서

- 문서 버전: v0.3
- 작성일: 2026-03-06
- 기준 범위: 로컬 MVP

## 1. 서비스 정의

정의:
`Next.js` 기반 로컬 웹앱. 이력서/채용공고를 텍스트 입력, txt 업로드, URL 불러오기로 받아, `@openai/codex-sdk + SKILL.md` 파이프라인으로 구조화 JSON을 생성하고, 회사 맞춤 자기소개를 웹 화면에서 확인/수정할 수 있다.

핵심 가치:
- 이력서와 공고의 핵심 정보를 빠르게 구조화한다.
- 생성 결과를 사용자가 직접 수정/확정 가능하게 둔다.
- 회사별 반복 지원 시 `회사 공고만 교체 -> 결과 재생성` 비용을 낮춘다.
- raw JSON을 사용자에게 직접 노출하지 않고, 한글 폼 중심 편집 경험으로 조작 부담을 줄인다.

## 2. 대상 사용자와 사용 시나리오

대상:
- 소규모 지인 사용자(인증/DB 없이 로컬 실행 가능한 환경)

대표 시나리오:
1. 사용자가 `/resume`에서 이력서를 입력/업로드하고 `resume.json`을 확정한다.
2. 사용자가 `/company`에서 채용공고를 입력/업로드하고 `company.json`을 확정한다.
3. 사용자가 `/result`에서 자기소개를 생성한다.
4. 이후 채용공고만 바꾸는 경우 `/company`만 다시 확정 후 `/result` 재생성한다.
5. 사용자는 상단 고정 스텝 영역에서 현재 확정 상태와 결과 최신 여부를 계속 확인한다.

## 3. 범위 정의

MVP 포함:
- 페이지 분리 3단계 플로우(`/resume` -> `/company` -> `/result`)
- JSON 확정 상태 관리(`resumeConfirmedJson`, `companyConfirmedJson`)
- API 6개(일반 3개 + SSE 스트림 3개)
- txt 업로드 -> textarea 반영
- 공고 URL 불러오기 -> 본문 텍스트 추출 -> textarea 반영
- 작업 중 상태 표시(스피너/경과시간)
- AI 분석 로그 실시간 표시(SSE)
- 상단 고정 스텝/상태 셸
- 한글 폼 기반 항목 편집 UI(raw JSON 직접 노출 없음)
- 필수 항목 하이라이트 + 단계별 확정 가드
- 이전 결과와 현재 결과 비교 UI
- 복사 버튼, 재생성 버튼

MVP 제외(후순위):
- PDF 업로드/파싱
- 사용자 인증/권한
- 원격 DB 저장
- 다중 사용자/배포 환경 운영

## 4. 기능 요구사항

STEP 1 `/resume`:
- 이력서: textarea / txt 업로드 탭 전환
- 구조화 결과 생성
- 한글 폼 기반 인라인 수정
- 필수 항목(`이름`, `희망 직무`, `기술 스택`) 강조 표시
- 카드 하단 `이력서 정보 확정` 버튼
- 확정 완료 후에만 STEP 2 이동 버튼 노출

STEP 2 `/company`:
- STEP 1 확정 전 진입 제한
- 채용공고: textarea / txt 업로드 / URL 불러오기 탭 전환
- 구조화 결과 생성
- 한글 폼 기반 인라인 수정
- 필수 항목(`회사명`, `채용 직무`, `필수 요구사항`) 강조 표시
- 카드 하단 `채용공고 정보 확정` 버튼
- 확정 완료 후에만 STEP 3 이동 버튼 노출

STEP 3 `/result`:
- STEP 1/2 확정 전 생성 제한
- `oneLineIntro`, `shortIntro`, `longIntro` 생성/출력
- 복사 버튼
- 재생성 버튼
- 공고 수정 페이지로 이동 버튼
- 직전 결과와 현재 결과 비교 영역
- 결과 최신 여부 표시(`최신` / `재생성 필요`)

공통:
- 상단 고정 스텝 이동(`/resume`, `/company`, `/result`)
- 스텝 상태 표시(`완료`, `진행`, `대기`, `잠김`)
- 확정 상태 배지(이력서/채용공고)
- 결과 최신 여부 배지(최신/재생성 필요)
- 분석 로그 패널(기본 최근 5개, 펼치기 가능)

## 5. 비기능 요구사항

- 실행 환경: 로컬(Node.js 기반)
- API 런타임: Node runtime 고정(Edge 미사용)
- 실패 처리: 요청 유효성 검증 + 명확한 에러 메시지
- 응답 형식: 스키마 기반 JSON 고정
- 안정성: Codex 호출 직렬 큐로 충돌 최소화
- 관측성: 분석 이벤트를 SSE로 스트리밍

## 6. 아키텍처

구성:
- React UI(페이지 분리 + 전역 파이프라인 상태)
- Next.js API Routes
- `@openai/codex-sdk`
- SKILL.md 3종(`resume-to-json`, `company-to-json`, `generate-intro`)

데이터 흐름:
1. UI 입력
2. `/api/resume/stream`, `/api/company/stream`, `/api/intro/stream` 호출
3. SSE 로그(`log`) 실시간 반영
4. 결과(`result`) 수신 후 내부 JSON/자기소개 갱신
5. 확정 상태와 stale 상태를 기반으로 단계 가드

공고 URL 보조 흐름:
1. `/company`에서 URL 입력
2. `POST /api/company/fetch-url`
3. 서버가 정적 HTML, 숨겨진 JSON, 사이트 전용 상세 경로, 브라우저 렌더링, OCR fallback 순서로 본문 추출
4. 추출된 텍스트를 textarea에 채움
5. 이후 `POST /api/company` 또는 `/api/company/stream`으로 동일 분석 플로우 진행

## 7. API 명세(현재 기준)

일반 API:
- `POST /api/resume` -> `Resume`
- `POST /api/company` -> `Company`
- `POST /api/company/fetch-url` -> `FetchedCompanyPage`
- `POST /api/intro` -> `Intro`

스트림 API(SSE):
- `POST /api/resume/stream`
- `POST /api/company/stream`
- `POST /api/intro/stream`

SSE 이벤트:
- `log`: `{ level, phase, message }`
- `result`: `{ data }`
- `error`: `{ message, details? }`
- `done`: `{ ok, elapsedMs }`

## 8. 데이터 스키마(요약)

`Resume`:
- `name`, `summary`, `desiredPosition`, `careerYears`
- `techStack[]`
- `experience[]`
- `projects[]`
- `achievements[]`, `strengths[]`

`Company`:
- `companyName`, `companyDescription`
- `jobTitle`, `jobDescription`
- `requirements[]`, `preferredSkills[]`, `techStack[]`

`Intro`:
- `oneLineIntro`
- `shortIntro`
- `longIntro`

## 9. 상태 전이 규칙(중요)

- `resume` 원문 또는 폼 수정 시작 시:
  - `resumeConfirmedJson` 무효화
  - `companyConfirmedJson` 무효화
  - 결과(`intro`, `introSource`) stale 처리
- `resume` 재확정 시:
  - 최신 `resumeConfirmedJson` 저장
- `company` 재확정 시:
  - 결과(`intro`, `introSource`) stale 처리
- `company` 원문 또는 폼 수정 시작 시:
  - `companyConfirmedJson` 무효화
  - 결과(`intro`, `introSource`) stale 처리
- 결과 최신 조건:
  - `introSource.resumeConfirmedJson === resumeConfirmedJson`
  - `introSource.companyConfirmedJson === companyConfirmedJson`

## 10. 핵심 리스크와 대응

R1. `@openai/codex-sdk` 로컬 로그인 세션 의존성:
- 영향: 인증 실패 시 전체 파이프라인 중단
- 대응: `codex auth login` 선행, 인증 오류 메시지 표준화

R2. 서버 환경 이식성:
- 영향: 서버리스/원격 배포에서 세션 재사용 불안정 가능성
- 대응: 현재 문서 범위는 로컬 MVP로 제한

R3. 생성 JSON 품질 편차:
- 영향: 후속 자기소개 품질 저하
- 대응: output schema 강제 + 사용자 확정 단계 유지

## 11. 운영/관리 규칙

문서 업데이트 규칙:
- 요구사항/범위/리스크 변경 시 이 문서를 먼저 갱신한다.
- API/스키마/상태 전이 규칙 변경 시 `7~9`장을 함께 수정한다.
- 주요 의사결정은 아래 결정 로그에 기록한다.

결정 로그:
- 2026-03-06: MVP 입력 포맷을 txt로 제한, PDF는 후순위 처리.
- 2026-03-06: 인증/DB 없이 로컬 실행 시나리오 우선.
- 2026-03-06: API 3개 + 3단계 UI 구조 확정.
- 2026-03-06: 페이지 분리(`/resume`, `/company`, `/result`) 및 JSON 확정 기반 플로우로 전환.
- 2026-03-06: SSE 기반 분석 로그 실시간 표시 도입.
- 2026-03-06: 사용자 편집 UI는 raw JSON 대신 한글 폼 기반으로 고정.
- 2026-03-06: 확정 버튼은 각 단계 카드 하단에 배치하고, 확정 후에만 다음 단계 이동을 허용.
- 2026-03-06: 상단 스텝/확정/최신 상태 영역을 sticky로 고정.
- 2026-03-06: 결과 페이지에 이전/현재 자기소개 비교 영역 추가.

## 12. 다음 마일스톤

우선순위와 세부 작업은 [다음 작업 로드맵](./NEXT_STEPS.md)에서 관리한다.
