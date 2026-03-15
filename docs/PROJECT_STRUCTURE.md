# 프로젝트 구조

- 문서 버전: v0.6
- 마지막 업데이트: 2026-03-15
- 기준 범위: 현재 로컬 MVP 코드베이스

## 1. 구조 요약

현재 프론트엔드 구조는 `src/` 아래에 `route-first feature modules`를 담는 방식입니다.

- `src/app/`: Next.js 라우트와 API 진입점만 둡니다.
- `src/features/`: step 1~4 화면 기능을 모읍니다.
- `src/entities/`: 여러 step에서 공통으로 읽는 핵심 도메인 상태와 모델을 둡니다.
- `src/shared/`: 공통 UI, 훅, 유틸, 스타일을 둡니다.
- `src/server/`: Codex 실행, URL fetch, OCR, PDF build 같은 서버 연동 코드를 둡니다.

```text
resume-tailor/
├─ .github/
│  └─ workflows/                 # main push 시 검증 후 Docker Hub publish
├─ src/
│  ├─ app/                       # Next.js App Router 진입점
│  ├─ features/                  # step 전용 화면 기능
│  ├─ entities/                  # 전역 도메인 모델과 상태
│  ├─ shared/                    # 여러 feature가 공유하는 UI/훅/유틸/스타일
│  ├─ server/                    # 서버 전용 실행/연동 코드
│  └─ templates/typst/           # Typst PDF 템플릿
├─ tests/                        # API/lib/E2E 테스트
├─ docs/                         # 운영, 구조, 품질, 릴리즈 문서
├─ scripts/                      # 보조 스크립트
├─ Dockerfile
├─ docker-compose.yml
├─ package.json
└─ README.md
```

이 문서에서는 `node_modules`, `.next`, `output`, `test-results`, `tmp` 같은 생성 산출물은 제외합니다.

## 2. 핵심 원칙

- `src/app/`은 얇게 유지합니다.
  - 화면 구현은 `src/features/*/page.tsx`가 담당하고, `src/app/<step>/page.tsx`는 재export 엔트리만 둡니다.
- step 전용 코드는 `src/features/<step>` 안에서 닫히게 둡니다.
- 여러 step이 같이 쓰는 상태나 모델만 `src/entities/`에 둡니다.
- 두 feature 이상이 공유하지 않으면 `src/shared/`에 두지 않습니다.
- 서버에서만 쓰는 fetch, OCR, Codex 실행, PDF 빌드는 `src/server/`에 둡니다.

## 3. 폴더별 역할

### `src/app/`

라우트와 HTTP API의 엔트리만 둡니다.

- `src/app/resume/page.tsx`
  - `src/features/resume/page.tsx`를 그대로 노출하는 STEP 1 엔트리
- `src/app/company/page.tsx`
  - STEP 2 엔트리
- `src/app/result/page.tsx`
  - STEP 3 엔트리
- `src/app/pdf/page.tsx`
  - STEP 4 엔트리
- `src/app/api/*`
  - resume/company/intro/pdf route
- `src/app/providers.tsx`
  - `PipelineProvider` 연결
- `src/app/globals.css`
  - `src/shared/styles/*`를 불러오는 전역 CSS import 진입점

### `src/features/`

step별 화면 기능을 모읍니다.

#### `src/features/resume/`

- `page.tsx`
  - STEP 1 화면 조립
- `ui/*`
  - 핵심 정보, 소개글 근거, 경력, 프로젝트, 저장 요약 UI

#### `src/features/company/`

- `page.tsx`
  - STEP 2 화면 조립
- `ui/*`
  - 공고 상세 입력/정리 섹션 UI

#### `src/features/result/`

- `page.tsx`
  - STEP 3 화면 조립
- `hooks/use-result-page-view.ts`
  - 결과 화면 파생 상태 계산
- `model/result-view.ts`
  - 비교/배지/출력 보조 뷰모델 계산
- `ui/*`
  - 소개글 생성 카드, 출력 카드, 근거 카드, 비교 카드, PDF 이동 카드

#### `src/features/pdf/`

- `page.tsx`
  - STEP 4 화면 조립
- `hooks/use-pdf-workspace-state.ts`
  - PDF 편집 상태와 export 흐름
- `hooks/use-pdf-workspace-dock.ts`
  - STEP 4 스크롤 UX
- `ui/*`
  - 수정 칩 바, 섹션 모달, Typst preview, 각 섹션 폼

### `src/entities/`

여러 step에서 공통으로 읽는 핵심 도메인 상태와 모델을 둡니다.

#### `src/entities/pipeline/`

- `model/pipeline-context.tsx`
  - 이력서/공고/소개글의 전역 상태
  - stale 판단, intro freshness, 현재 task 상태, 로그 저장

#### `src/entities/intro/`

- `model/intro-insights.ts`
  - 소개글 생성 전 근거 계산
- `model/intro-tone.ts`
  - 톤 라벨과 유효성 판단

#### `src/entities/resume/`

- `model/resume-utils.ts`
  - resume 정규화, intro snapshot 비교, 기본 draft 생성

#### `src/entities/pdf/`

- `model/view-model.ts`
  - `Resume + Intro + Company -> Typst view model`
  - 기술 스택 자동 그룹화, fallback 규칙, 파일명 생성

### `src/shared/`

여러 feature가 함께 쓰는 공통 코드입니다.

#### `src/shared/ui/`

- `auto-grow-textarea.tsx`
- `list-preview.tsx`
- `reasoning-inline.tsx`
- `tone-inline.tsx`
- `frame/*`
  - 공통 shell, step bar, live task modal, log drawer, status toast
- `workflow/*`
  - 원문 입력 카드, 저장 카드, URL fetch 패널

#### `src/shared/hooks/`

- `use-pipeline-stream-task.ts`
  - resume/company/intro SSE 실행 공통 흐름
- `use-required-field-focus.ts`
  - 누락 필드 포커스 이동

#### `src/shared/lib/`

- `agent-settings.ts`
  - 생각 깊이 정규화와 API 옵션 변환
- `date-format.ts`
  - 저장 시각 포맷
- `list-input.ts`
  - 쉼표/줄단위 입력 파싱과 stringify
- `schemas.ts`, `types.ts`
  - 공통 타입과 Zod 스키마
- `stream-client.ts`
  - 클라이언트 SSE 호출

#### `src/shared/styles/`

- `base.css`
- `pdf-and-frame.css`
- `editorial-refresh.css`

### `src/server/`

서버 전용 연동 코드를 둡니다.

- `codex-client.ts`
  - Codex SDK 실행, SKILL.md 로드, 스트림 로그 변환
- `company-url-fetch.ts`
  - URL 기반 공고 본문 추출
- `company-image-ocr.ts`
  - 공고 이미지 OCR fallback
- `company-normalize.ts`
  - 구조화된 공고 후처리
- `resume-url-fetch.ts`
  - URL 기반 이력서 본문 추출
- `http.ts`
  - API 에러/응답 유틸
- `sse.ts`
  - stream route 응답 유틸
- `task-result.ts`
  - task 결과 파싱
- `skills.ts`
  - 로컬 `skills/*/SKILL.md` 탐색과 로드
- `pdf/build.ts`
  - Typst compile, SVG preview, PDF 파일 생성

## 4. 주요 실행 흐름

### STEP 1 이력서

1. `src/app/resume/page.tsx`
2. `src/features/resume/page.tsx`
3. `src/shared/ui/workflow/source-input-card.tsx`
4. `src/shared/hooks/use-pipeline-stream-task.ts`
5. `src/app/api/resume/*`
6. `src/server/codex-client.ts`

### STEP 2 공고

1. `src/app/company/page.tsx`
2. `src/features/company/page.tsx`
3. URL이면 `src/app/api/company/fetch-url/route.ts`
4. `src/server/company-url-fetch.ts`
5. 분석은 `src/app/api/company/* -> src/server/codex-client.ts`

### STEP 3 소개글

1. `src/app/result/page.tsx`
2. `src/features/result/page.tsx`
3. `src/features/result/hooks/use-result-page-view.ts`
4. `src/entities/intro/model/intro-insights.ts`
5. `src/app/api/intro/* -> src/server/codex-client.ts`

### STEP 4 PDF

1. `src/app/pdf/page.tsx`
2. `src/features/pdf/page.tsx`
3. `src/features/pdf/hooks/use-pdf-workspace-state.ts`
4. `src/entities/pdf/model/view-model.ts`
5. `src/app/api/pdf/* -> src/server/pdf/build.ts`
6. `src/templates/typst/resume.typ`

## 5. 테스트 구조

- `tests/api`
  - route/API 테스트
- `tests/lib`
  - entities/shared/server의 순수 로직 테스트
- `tests/e2e`
  - step 1~4 실제 사용자 흐름 회귀
- `tests/fixtures`
  - 공고와 소개글 샘플 데이터

## 6. 파일 배치 규칙

- 새 라우트 엔트리는 `src/app/`
- step 전용 화면/훅/모델은 `src/features/<step>/`
- 전역 상태와 공통 도메인 모델은 `src/entities/`
- 두 feature 이상이 공유하는 UI와 유틸은 `src/shared/`
- 서버 전용 실행/외부 연동은 `src/server/`
- Typst 템플릿은 `src/templates/typst/`
- 회귀 검증은 `tests/`

## 7. 구조 점검 기준

구조가 다시 흐트러졌다고 판단하는 기준은 아래와 같습니다.

- `src/app/`에 화면 구현이 다시 쌓이기 시작할 때
- `src/shared/`에 사실상 step 전용 코드가 들어갈 때
- `src/server/`가 아닌 곳에서 서버 전용 fetch/OCR/PDF build를 직접 다룰 때
- `src/entities/`가 UI 조립 코드까지 품기 시작할 때
- 하나의 step 관련 파일이 `src/features/` 바깥 여러 곳으로 새기 시작할 때
