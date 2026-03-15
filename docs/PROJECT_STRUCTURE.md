# 프로젝트 구조

- 문서 버전: v0.6
- 마지막 업데이트: 2026-03-15
- 기준 범위: 현재 로컬 MVP 코드베이스

## 1. 구조 요약

현재 프론트엔드 구조는 `route-first feature modules` 하이브리드입니다.

- `app/`: Next.js 라우트와 API 진입점만 둡니다.
- `features/`: step 1~4 화면 기능을 모읍니다.
- `entities/`: 여러 step에서 공통으로 읽는 핵심 도메인 상태와 모델을 둡니다.
- `shared/`: 공통 UI, 훅, 유틸, 스타일을 둡니다.
- `server/`: Codex 실행, URL fetch, OCR, PDF build 같은 서버 연동 코드를 둡니다.

```text
resume-tailor/
├─ .github/
│  └─ workflows/                 # main push 시 검증 후 Docker Hub publish
├─ app/                          # Next.js App Router 진입점
│  ├─ api/                       # resume/company/intro/pdf API route
│  ├─ resume/page.tsx            # STEP 1 라우트 엔트리
│  ├─ company/page.tsx           # STEP 2 라우트 엔트리
│  ├─ result/page.tsx            # STEP 3 라우트 엔트리
│  ├─ pdf/page.tsx               # STEP 4 라우트 엔트리
│  ├─ page.tsx                   # 루트에서 /resume 이동
│  ├─ layout.tsx                 # 공통 레이아웃
│  ├─ providers.tsx              # 전역 provider 연결
│  └─ globals.css                # shared/styles import 진입점
├─ features/                     # step 전용 화면 기능
│  ├─ resume/
│  ├─ company/
│  ├─ result/
│  └─ pdf/
├─ entities/                     # 전역 도메인 모델과 상태
│  ├─ pipeline/
│  ├─ intro/
│  ├─ resume/
│  └─ pdf/
├─ shared/                       # 여러 feature가 공유하는 UI/훅/유틸/스타일
│  ├─ ui/
│  ├─ hooks/
│  ├─ lib/
│  └─ styles/
├─ server/                       # 서버 전용 실행/연동 코드
│  ├─ pdf/
│  ├─ codex-client.ts
│  ├─ company-url-fetch.ts
│  ├─ company-image-ocr.ts
│  └─ ...
├─ templates/typst/              # Typst PDF 템플릿
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

- `app/`은 얇게 유지합니다.
  - 화면 구현은 `features/*/page.tsx`가 담당하고, `app/<step>/page.tsx`는 재export 엔트리만 둡니다.
- step 전용 코드는 `features/<step>` 안에서 닫히게 둡니다.
- 여러 step이 같이 쓰는 상태나 모델만 `entities/`에 둡니다.
- 두 feature 이상이 공유하지 않으면 `shared/`에 두지 않습니다.
- 서버에서만 쓰는 fetch, OCR, Codex 실행, PDF 빌드는 `server/`에 둡니다.

## 3. 폴더별 역할

### `app/`

라우트와 HTTP API의 엔트리만 둡니다.

- `app/resume/page.tsx`
  - `features/resume/page.tsx`를 그대로 노출하는 STEP 1 엔트리
- `app/company/page.tsx`
  - STEP 2 엔트리
- `app/result/page.tsx`
  - STEP 3 엔트리
- `app/pdf/page.tsx`
  - STEP 4 엔트리
- `app/api/*`
  - resume/company/intro/pdf route
- `app/providers.tsx`
  - `PipelineProvider` 연결
- `app/globals.css`
  - `shared/styles/*`를 불러오는 전역 CSS import 진입점

### `features/`

step별 화면 기능을 모읍니다.

#### `features/resume/`

- `page.tsx`
  - STEP 1 화면 조립
- `ui/*`
  - 핵심 정보, 소개글 근거, 경력, 프로젝트, 저장 요약 UI

#### `features/company/`

- `page.tsx`
  - STEP 2 화면 조립
- `ui/*`
  - 공고 상세 입력/정리 섹션 UI

#### `features/result/`

- `page.tsx`
  - STEP 3 화면 조립
- `hooks/use-result-page-view.ts`
  - 결과 화면 파생 상태 계산
- `model/result-view.ts`
  - 비교/배지/출력 보조 뷰모델 계산
- `ui/*`
  - 소개글 생성 카드, 출력 카드, 근거 카드, 비교 카드, PDF 이동 카드

#### `features/pdf/`

- `page.tsx`
  - STEP 4 화면 조립
- `hooks/use-pdf-workspace-state.ts`
  - PDF 편집 상태와 export 흐름
- `hooks/use-pdf-workspace-dock.ts`
  - STEP 4 스크롤 UX
- `ui/*`
  - 수정 칩 바, 섹션 모달, Typst preview, 각 섹션 폼

### `entities/`

여러 step에서 공통으로 읽는 핵심 도메인 상태와 모델을 둡니다.

#### `entities/pipeline/`

- `model/pipeline-context.tsx`
  - 이력서/공고/소개글의 전역 상태
  - stale 판단, intro freshness, 현재 task 상태, 로그 저장

#### `entities/intro/`

- `model/intro-insights.ts`
  - 소개글 생성 전 근거 계산
- `model/intro-tone.ts`
  - 톤 라벨과 유효성 판단

#### `entities/resume/`

- `model/resume-utils.ts`
  - resume 정규화, intro snapshot 비교, 기본 draft 생성

#### `entities/pdf/`

- `model/view-model.ts`
  - `Resume + Intro + Company -> Typst view model`
  - 기술 스택 자동 그룹화, fallback 규칙, 파일명 생성

### `shared/`

여러 feature가 함께 쓰는 공통 코드입니다.

#### `shared/ui/`

- `auto-grow-textarea.tsx`
- `list-preview.tsx`
- `reasoning-inline.tsx`
- `tone-inline.tsx`
- `frame/*`
  - 공통 shell, step bar, live task modal, log drawer, status toast
- `workflow/*`
  - 원문 입력 카드, 저장 카드, URL fetch 패널

#### `shared/hooks/`

- `use-pipeline-stream-task.ts`
  - resume/company/intro SSE 실행 공통 흐름
- `use-required-field-focus.ts`
  - 누락 필드 포커스 이동

#### `shared/lib/`

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

#### `shared/styles/`

- `base.css`
- `pdf-and-frame.css`
- `editorial-refresh.css`

### `server/`

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

1. `app/resume/page.tsx`
2. `features/resume/page.tsx`
3. `shared/ui/workflow/source-input-card.tsx`
4. `shared/hooks/use-pipeline-stream-task.ts`
5. `app/api/resume/*`
6. `server/codex-client.ts`

### STEP 2 공고

1. `app/company/page.tsx`
2. `features/company/page.tsx`
3. URL이면 `app/api/company/fetch-url/route.ts`
4. `server/company-url-fetch.ts`
5. 분석은 `app/api/company/* -> server/codex-client.ts`

### STEP 3 소개글

1. `app/result/page.tsx`
2. `features/result/page.tsx`
3. `features/result/hooks/use-result-page-view.ts`
4. `entities/intro/model/intro-insights.ts`
5. `app/api/intro/* -> server/codex-client.ts`

### STEP 4 PDF

1. `app/pdf/page.tsx`
2. `features/pdf/page.tsx`
3. `features/pdf/hooks/use-pdf-workspace-state.ts`
4. `entities/pdf/model/view-model.ts`
5. `app/api/pdf/* -> server/pdf/build.ts`
6. `templates/typst/resume.typ`

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

- 새 라우트 엔트리는 `app/`
- step 전용 화면/훅/모델은 `features/<step>/`
- 전역 상태와 공통 도메인 모델은 `entities/`
- 두 feature 이상이 공유하는 UI와 유틸은 `shared/`
- 서버 전용 실행/외부 연동은 `server/`
- Typst 템플릿은 `templates/typst/`
- 회귀 검증은 `tests/`

## 7. 구조 점검 기준

구조가 다시 흐트러졌다고 판단하는 기준은 아래와 같습니다.

- `app/`에 화면 구현이 다시 쌓이기 시작할 때
- `shared/`에 사실상 step 전용 코드가 들어갈 때
- `server/`가 아닌 곳에서 서버 전용 fetch/OCR/PDF build를 직접 다룰 때
- `entities/`가 UI 조립 코드까지 품기 시작할 때
- 하나의 step 관련 파일이 `features/` 바깥 여러 곳으로 새기 시작할 때
