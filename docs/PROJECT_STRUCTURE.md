# 프로젝트 구조

- 문서 버전: v0.4
- 마지막 업데이트: 2026-03-08
- 기준 범위: 현재 로컬 MVP 코드베이스

## 1. 구조 요약

```text
resume-tailor/
├─ .github/
│  └─ workflows/             # main push 시 검증 후 Docker Hub publish
├─ app/                      # Next.js App Router 화면과 API route
│  ├─ api/                   # resume/company/intro 분석 API, SSE route
│  ├─ resume/                # STEP 1 이력서 입력/확정 화면
│  ├─ company/               # STEP 2 공고 입력/확정 화면
│  ├─ result/                # STEP 3 자기소개 생성/검토 화면
│  ├─ components/            # 화면 공용 컴포넌트
│  ├─ page.tsx               # 루트에서 /resume 으로 이동
│  ├─ layout.tsx             # 공통 레이아웃
│  └─ providers.tsx          # 전역 provider 연결
├─ lib/                      # 도메인 로직, Codex 연동, 스키마/유틸
│  ├─ codex-client.ts        # Codex SDK 실행 브릿지
│  ├─ skills.ts              # SKILL.md 로드/파싱
│  ├─ pipeline-context.tsx   # 단계별 상태 저장과 stale 관리
│  ├─ agent-settings.ts      # 생각 깊이 값 정규화
│  ├─ schemas.ts             # 요청/응답 스키마
│  ├─ types.ts               # 공용 타입
│  ├─ company-*.ts           # 공고 추출/정규화/OCR 관련 로직
│  └─ intro-*.ts             # 자기소개 생성 보조 계산
├─ skills/                   # Codex가 읽는 로컬 스킬 정의
│  ├─ resume-to-json/
│  ├─ company-to-json/
│  └─ generate-intro/
├─ tests/                    # API/lib/E2E 테스트
├─ docs/                     # 기획, 운영, 구조, 가이드 문서
├─ scripts/                  # 보조 스크립트
├─ Dockerfile                # Docker 이미지 정의
├─ docker-compose.yml        # 공개 이미지 pull 기반 공유 실행 설정
├─ package.json              # 의존성 및 npm scripts
└─ README.md                 # 설치/실행/사용 흐름 진입점
```

이 문서에서는 `node_modules`, `.next`, `.git`, `test-results`, `output` 같은 생성 산출물은 제외합니다.

## 2. 구조 원칙

현재 구조는 `Next.js route-first + shared lib` 방식입니다.

- 화면과 API 진입점은 `app/` 아래에 둡니다.
- 여러 단계에서 공통으로 쓰는 도메인 로직은 `lib/`로 뺍니다.
- 모델 프롬프트와 작업 절차는 `skills/`의 `SKILL.md`로 분리합니다.
- 테스트는 `tests/`에서 API, lib, E2E 기준으로 나눕니다.

이 구조는 로컬 MVP를 빠르게 확장하는 단계에서는 충분히 적절합니다. 기능 수가 더 커지기 전까지는 무리하게 feature 폴더 체계로 재배치할 필요가 없습니다.

## 3. 폴더별 역할

### `app/`

`app/`은 사용자 진입점과 HTTP API를 포함합니다.

- `app/resume/page.tsx`
  - 이력서 입력, 분석, 폼 수정, 확정
- `app/company/page.tsx`
  - 채용공고 입력, URL 불러오기, 분석, 폼 수정, 확정
- `app/result/page.tsx`
  - 자기소개 생성, 비교, 복사, 재생성
  - `공고와 연결한 내 경험`, `더 살릴 수 있는 점` 같은 결과 근거 섹션 표시
- `app/api/resume/*`
  - 이력서 구조화 API와 스트림 API
- `app/api/company/*`
  - 공고 구조화 API, URL 불러오기 API, 스트림 API
- `app/api/intro/*`
  - 자기소개 생성 API와 스트림 API
- `app/components/*`
  - 여러 페이지에서 재사용하는 UI 컴포넌트
  - `reasoning-inline.tsx`는 단계별 `생각 깊이` 선택 UI를 담당합니다.

즉 `app/`은 라우트와 UI 조립에 집중하고, 실제 분석 로직은 최대한 `lib/`로 넘깁니다.

### `lib/`

`lib/`는 앱의 핵심 동작을 담당합니다.

- `codex-client.ts`
  - Codex SDK 실행, 스킬 호출, 스트리밍 처리
- `skills.ts`
  - `skills/<name>/SKILL.md` 탐색과 로드
- `pipeline-context.tsx`
  - 이력서/공고/결과의 전역 상태와 확정 상태 관리
- `agent-settings.ts`
  - `생각 깊이` 값을 정규화하고 실행 옵션으로 변환
- `schemas.ts`, `types.ts`
  - API 입출력과 화면 상태의 공용 타입 정의
- `company-url-fetch.ts`
  - 공고 URL에서 본문 텍스트 추출
- `company-image-ocr.ts`
  - 공고 이미지 OCR fallback
- `company-normalize.ts`
  - 공고 구조화 결과 후처리
- `intro-insights.ts`
  - 자기소개 생성 전에 매칭 근거 계산
  - `missingButRelevant[]` 같은 소개글 후처리 보조 계산
- `stream-client.ts`, `sse.ts`, `http.ts`
  - 스트림/HTTP 처리 유틸

### `skills/`

`skills/`는 실제 생성 작업의 지시문 저장소입니다.

- `resume-to-json`
  - 이력서 텍스트를 `resume` 구조로 변환
- `company-to-json`
  - 채용공고 텍스트를 `company` 구조로 변환
- `generate-intro`
  - 확정된 이력서와 공고를 바탕으로 자기소개 생성

런타임에서는 `lib/skills.ts`가 여기 있는 `SKILL.md`를 읽어 Codex에 전달합니다.

### `tests/`

테스트는 책임 기준으로 나뉩니다.

- `tests/api`
  - API route 단위 테스트
- `tests/lib`
  - 정규화와 가이드 계산 같은 순수 로직 테스트
- `tests/e2e`
  - 실제 사용자 흐름 회귀 테스트
- `tests/fixtures`
  - 공고와 소개글 샘플 데이터

### `docs/`

운영, 기획, 구조 설명 문서를 보관합니다.

- `README.md`
  - 설치와 실행 진입점
- `PROJECT_STRUCTURE.md`
  - 현재 문서와 코드 구조 설명
- `SERVICE_PLAN.md`
  - 제품 범위와 규칙 기준
- `OPS_RUNBOOK.md`
  - 실행과 복구 절차

### `.github/workflows/`

배포 자동화를 담는 GitHub Actions 폴더입니다.

- `docker-publish.yml`
  - `main` push 시 `lint`, `typecheck`, `test`, `build`를 실행한 뒤 Docker Hub에 이미지를 publish

### `scripts/`

외부 도구나 플랫폼 종속 로직을 담는 보조 스크립트 폴더입니다.

현재는 OCR 보조용 `vision_ocr.swift`가 있습니다.

## 4. 주요 실행 흐름

### 이력서 분석

1. 사용자가 `/resume`에서 이력서를 입력합니다.
2. 화면에서 `생각 깊이`를 선택할 수 있습니다.
3. 화면은 `/api/resume` 또는 `/api/resume/stream`을 호출합니다.
4. API route는 입력을 검증하고 `lib/codex-client.ts`를 호출합니다.
5. `codex-client`는 `resume-to-json` 스킬을 로드해 Codex를 실행합니다.
6. 결과 JSON이 화면으로 돌아오고, 사용자가 수정 후 확정합니다.

### 공고 분석

1. 사용자가 `/company`에서 텍스트, `txt`, URL 중 하나로 공고를 넣습니다.
2. 화면에서 `생각 깊이`를 선택할 수 있습니다.
3. URL이면 `/api/company/fetch-url`이 먼저 본문 텍스트를 수집합니다.
4. 이후 `/api/company` 또는 `/api/company/stream`이 구조화 분석을 수행합니다.
5. 결과는 `normalizeCompany()` 후처리를 거쳐 화면에 반영됩니다.

### 자기소개 생성

1. `/result`는 확정된 `resume`과 `company`를 기준으로 동작합니다.
2. 화면에서 `생각 깊이`를 선택할 수 있습니다.
3. `intro-insights.ts`가 요건과 이력서 근거를 먼저 계산합니다.
4. `/api/intro` 또는 `/api/intro/stream`이 `generate-intro` 스킬을 호출합니다.
5. 생성 결과와 근거 카드, `더 살릴 수 있는 점` 섹션이 화면에 표시됩니다.

## 5. 파일 배치 규칙

새 파일을 추가할 때는 아래 기준을 따릅니다.

- 새 페이지나 API route는 `app/` 아래에 둡니다.
- 여러 라우트에서 공유하는 비즈니스 로직은 `lib/` 아래에 둡니다.
- 모델 지시문이나 작업 절차는 `skills/` 아래에 둡니다.
- 제품과 운영 문서는 `docs/` 아래에 둡니다.
- 회귀 방지용 검증은 `tests/` 아래 책임별 폴더에 둡니다.

이 규칙을 유지하면 현재 규모에서는 파일을 찾기 쉽고, 라우트와 도메인 로직의 경계도 비교적 선명하게 유지됩니다.

## 6. 구조 재편을 다시 볼 시점

아래 조건이 생기면 구조 재편을 검토할 수 있습니다.

- `lib/` 아래 파일 수가 크게 늘어나 feature 경계가 흐려질 때
- `resume`, `company`, `intro` 각각에 전용 컴포넌트와 유틸이 과도하게 많아질 때
- 로컬 MVP를 넘어서 배포형 서비스 구조로 확장할 때

그 전까지는 현재 구조를 유지하고, 필요한 경우에만 `lib/<feature>`처럼 점진적으로 세분화하는 편이 안전합니다.
