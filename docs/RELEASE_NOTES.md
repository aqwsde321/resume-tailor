# 릴리즈 노트

- 마지막 업데이트: 2026-03-15
- 기준: 버전별 기능, 문서, 검증 기록

## Unreleased

### Added

- step 4 `/pdf`에 `Classic`, `Sidebar`, `Modern` Typst 템플릿 선택 추가
- step 4 `/pdf`에 `Onyx`, `Teal`, `Rose`, `Plum` 프리셋과 사용자 지정 HEX 색상 선택 추가
- step 4 `Header` 모달에 프로필 이미지 업로드/삭제와 `PDF에 표시` 토글 추가
- `tests/lib/pdf-build.test.ts` 실제 Typst SVG/PDF smoke test 추가

### Changed

- step 4는 템플릿을 먼저 고른 뒤 같은 템플릿 기준으로 SVG 미리보기와 PDF export를 수행하도록 조정
- step 4 색상 선택 UI를 큰 카드에서 미리보기 헤더 내부의 세그먼트/팝오버 방식으로 단순화
- 사용자 지정 색상은 팝오버 안에서 draft로 고른 뒤 `선택 완료`를 눌렀을 때만 적용되도록 조정
- `Sidebar` 템플릿의 좌측 레일 가독성을 조정하고, `Modern` 템플릿의 Skills 영역 빈 공간을 줄이도록 재배치
- `Classic`, `Sidebar`, `Modern` 템플릿의 프로필 이미지 헤더 배치와 이름 아래 메타 간격을 각각 다듬어 템플릿별 균형을 조정
- PDF preview/export 요청에 `customAccentHex`를 추가해 사용자 지정 색상을 최종 출력까지 그대로 전달
- 프로필 이미지는 step 4 PDF draft에만 저장하고, export/preview 시 temp workdir의 실제 이미지 파일로 풀어 Typst에 전달하도록 조정
- 소개글 후처리에 exact 중복 문장 제거와 `gapNotes` 공백 표현 필터를 추가
- 소개글 품질 평가기 `evaluateIntroQuality()`를 추가하고, `shortIntro` 요건 직접 언급/`longIntro` 앵커 커버리지/정보량 차이 규칙을 코드로 고정
- `fitReasons`, `gapNotes`, `missingButRelevant`가 공고 근거 범위를 벗어나지 않도록 정규화 규칙을 강화

### Verified

- `typst compile`로 3종 템플릿 실제 컴파일 확인
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `tests/lib/intro-quality.test.ts`로 frontend/backend/data/AI fixture 품질 회귀 검증
- `tests/api/intro-route.test.ts`로 반복 문장 제거와 보조 필드 범위 필터링 검증
- `tests/lib/pdf-build.test.ts`로 템플릿 3종의 실제 Typst SVG/PDF 생성 검증

## v0.8.0 (2026-03-15)

### Changed

- 프론트엔드 구조를 `route-first feature modules` 기준으로 재편
  - `app`: 얇은 라우트 엔트리
  - `features`: step 전용 화면 기능
  - `entities`: pipeline, intro, resume, pdf 공통 모델
  - `shared`: 공통 UI, 훅, 유틸, 스타일
  - `server`: Codex 실행, URL fetch, OCR, PDF build
- `src/app` 구조에서 발생하는 Turbopack dev panic을 피하기 위해 기본 개발 서버를 `next dev --webpack`으로 전환하고, 필요할 때만 `npm run dev:turbopack`을 사용하도록 조정
- `/resume`, `/company`, `/pdf`의 기술 스택 입력이 쉼표 기반 raw text를 입력 중에도 유지하도록 수정
- step 4 PDF 기술 스택 자동 분류에 `Frontend` 그룹 추가
- step 4 PDF 기술 스택 분류에서 `TypeScript`, `JavaScript` 같은 공유 웹 스택을 주변 기술 맥락에 따라 `Frontend` 또는 `Backend`로 분류하도록 개선

### Verified

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

### Tag

- Git tag: `v0.8.0`

## v0.7.0 (2026-03-15)

### Added

- GitHub Actions Docker publish 워크플로 추가: `main` push 시 검증 후 Docker Hub에 이미지 업로드
- 이력서 URL 불러오기 지원: `/resume`에서 노션, GitHub Pages 같은 공개 이력서/포트폴리오 URL 본문을 읽어 textarea에 채우는 흐름 추가
- Typst 기반 PDF step 4 추가: `/pdf`에서 export 전용 draft를 수정하고 PDF를 생성하는 흐름 추가
- 실제 Typst SVG 미리보기 API 추가: `POST /api/pdf/preview`
- PDF 전용 필드와 override 추가: `headline`, `careerDurationText`, `contacts[]`, `projects[].subtitle/link/linkLabel/highlights[]`, `pdfHighlights[]`, `pdfStrengths[]`
- PDF export와 preview 관련 API/unit/E2E 테스트 추가
- step 4 모바일 4열 수정 칩, 섹션 모달 viewport, 수정값 유지/미리보기 반영 E2E 추가

### Changed

- `docker-compose.yml` 기본 실행 방식을 로컬 build에서 Docker Hub 공개 이미지 pull 기반으로 변경
- 결과 비교 UI를 문장 단위 하이라이트와 추가/삭제/유지 요약 배지 중심으로 재구성
- Docker 실행 안내를 `docker pull`/`docker run`, 저장소 clone 후 `docker compose`, 로컬 개발 실행 세 경로로 재정리
- `README`에 Docker 직접 실행과 `docker compose` 실행 각각의 종료 절차와 volume 정리 절차를 추가
- `README`의 Docker 직접 실행 예시에서 `종료(stop)`와 `삭제(rm)` 의미를 분리해 명령 설명을 더 정확하게 정리
- Docker/Linux 실행에도 `tesseract` 기반 OCR fallback을 추가하고, 이미지 기반 상세 공고는 더 구체적인 경고/실패 안내를 반환하도록 개선
- Docker Hub 기본 이미지 경로를 실제 공개 저장소 `qrqr/resume-tailor` 기준으로 정정하고, Docker publish 워크플로를 `linux/amd64`와 `linux/arm64` 멀티아키 이미지 빌드로 확장
- 프로젝트 표시 이름과 내부 식별자를 `ResumeTailor` / `resume-tailor` 기준으로 정리하고, 기존 localStorage 키를 자동 마이그레이션하도록 조정
- Docker 이미지 override 환경 변수를 `RESUME_TAILOR_IMAGE` 기준으로 정리하고, 기존 `RESUME_MAKE_IMAGE`는 fallback으로 유지
- `README`, 서비스 기획서, 운영 런북, 로드맵의 API/CI/로그인 명령 설명을 현재 코드와 CLI 기준으로 맞추고, 문서 인덱스 중복을 축소
- `/resume`에서 PDF 전용 입력을 제거하고, step 4 `/pdf`에서만 마감 편집하도록 역할 분리
- step 4 미리보기를 HTML 중심에서 실제 Typst SVG 렌더 중심으로 변경하고, 실패 시 HTML fallback 유지
- 작업 중 중앙 모달에 `작업 중지`를 추가하고 클라이언트/서버 AI 호출 abort를 연결
- 리팩터링으로 `app-frame`, `result`, `resume-editor`, `pdf-editor` 상태/섹션 분리와 전역 스타일 파일 분리 적용
- 미사용 `TagInput` 컴포넌트와 관련 죽은 스타일 제거

### Verified

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- 실제 `POST /api/pdf/preview` 호출로 SVG 미리보기 생성 확인

### Tag

- Git tag: `v0.7.0`

## v0.6.0 (2026-03-07)

### Added

- 소개글 단계에 `톤` 선택 추가: `담백하게`, `자신감 있게`, `협업 중심`, `문제 해결 중심`
- 이력서, 공고, 소개글의 마지막 저장/생성 시각 표시 추가
- 스트림 클라이언트와 stream API의 빈 결과, 형식 오류, 본문 누락 대응 테스트 추가

### Changed

- `generate-intro` 스킬과 입력 프롬프트가 `[톤 가이드]`를 우선 반영하도록 조정
- 작업 중 중앙 모달에 스피너와 단계형 진행 상태를 추가하고, 사용자 용어로 `결과 준비` 문구를 사용하도록 정리
- stream API가 빈 결과와 형식 오류를 더 구체적인 사용자용 메시지로 반환하도록 개선

### Verified

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e -- tests/e2e/flow.spec.ts`

### Tag

- Git tag: `v0.6.0`

## v0.5.0 (2026-03-07)

### Added

- Docker 실행 환경 추가: `Dockerfile`, `docker-compose.yml`, `codex-home` volume 기반 공유 실행
- 프로젝트 구조 문서 추가: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)
- 채용공고 URL 불러오기 지원: `/company`에서 붙여넣기, `txt`, URL 입력을 같은 분석 흐름으로 연결
- 채용공고 불러오기 가이드 문서 추가: [COMPANY_FETCH_GUIDE.md](./COMPANY_FETCH_GUIDE.md)
- 상세 본문이 이미지인 공고를 위한 macOS Vision OCR fallback 추가
- 채용공고 정규화 회귀 테스트 11개와 소개글 stale 이유 헬퍼 테스트 추가
- 소개글 생성 전에 필수와 우대 요건, 이력서 근거를 묶는 내부 `작성 앵커` 계산과 결과 화면의 `공고와 연결한 내 경험` 섹션 추가
- 소개글에 아직 덜 반영된 연결 포인트를 위한 `missingButRelevant[]`와 결과 화면의 `더 살릴 수 있는 점` 섹션 추가
- Wanted 와 Jumpit URL 추출 결과를 반영한 company route golden case 추가
- stale 흐름 E2E 추가: 이력서 수정 시 회사와 결과 무효화, 공고 수정 시 소개글 재생성 필요
- 중앙 진행 모달과 하단 기록 패널의 SSE 로그 표시 스모크 테스트 추가

### Changed

- `README`와 `docs` 인덱스를 설치, 구조, 운영 기준으로 재정리
- 문서 링크를 저장소 상대경로 기준으로 통일
- 사람인 relay 공고는 `view -> view-ajax -> view-detail` 순서로 현재 공고 상세를 우선 추출하도록 개선
- 잡코리아 `GI_Read` 공고는 `GI_Read_Comt_Ifrm` 상세 iframe을 직접 읽도록 개선
- 잡코리아와 사람인 공고 추출 시 추천공고, 하단 안내, footer 문구가 본문에 섞이지 않도록 정제 규칙 강화
- 원티드와 점핏 공고는 정적 HTML만으로 본문이 안정적으로 잡히는지 회귀 테스트를 추가
- `company` API 응답 전에 `normalizeCompany()` 후처리를 적용해 복지, 추천공고, 중복 bullet 노이즈를 정리
- 결과 단계에서 `이력서 변경`, `공고 변경` 기준으로 다시 만들기 이유와 배지를 표시
- 소개글 기준 정보(`introSource`)를 유지해 수정 후에도 stale 이유가 계속 보이도록 조정
- `shortIntro`와 `longIntro`가 공고 요건과 프로젝트, 성과 근거를 더 직접 연결하도록 프롬프트와 후처리를 강화
- 소개글 후처리에서 공고 요건이 본문에 직접 드러났는지 기준으로 `missingButRelevant[]`를 계산하도록 조정
- `저장 전 확인`의 누락 항목을 누르면 해당 입력 위치로 스크롤 및 포커스 이동하도록 개선
- 작업 중 상태는 중앙 모달만 대표로 보이고, 스티키와 카드 내부의 중복 진행 알림은 제거하도록 정리

### Verified

- `docker compose config`
- `docker compose build app`
- 컨테이너 내부 `codex --version` 확인
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e -- tests/e2e/flow.spec.ts`
- 실제 사람인 URL 추출 확인
- 실제 잡코리아 URL 추출 확인

### Tag

- Git tag: `v0.5.0`

## v0.4.0 (2026-03-07)

### Added

- 소개글 결과 구조에 `longIntro`를 추가하고, 생성 가이드와 저장, 복원, 검증 로직을 3단계(`oneLineIntro`, `shortIntro`, `longIntro`)로 확장
- 작업 실행 중 상단을 가리지 않는 중앙 진행 모달과 하단 접이식 작업 기록 패널 추가
- 기본은 현재 값만 보이고 hover 또는 focus 때만 `생각 깊이` 힌트가 드러나는 미니멀 칩 UI 추가

### Changed

- 이력서, 공고, 소개글 단계 카드를 작업 중 상태가 드러나는 입력과 확인 흐름으로 재구성
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

- 실행 설정 연동 추가: 이력서, 채용공고, 자기소개 생성 API와 SSE 경로에서 `modelReasoningEffort` 옵션을 받을 수 있도록 확장
- 실행 옵션 전달 검증 테스트 추가

### Changed

- 편집 UI를 한글 폼 중심으로 정리하고 반복 상태 카드와 배지를 제거해 화면 밀도를 단순화
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
- SSE 스트림 API 추가
  - `POST /api/resume/stream`
  - `POST /api/company/stream`
  - `POST /api/intro/stream`
- AI 분석 로그 실시간 표시(UI 로그 패널)
- 작업 중 상태 표시(스피너와 경과 시간)
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
- `txt` 업로드와 텍스트 입력, JSON 편집, 소개문 생성 기본 UI
- API 라우트 테스트(Vitest)
- 기본 개발 문서와 서비스 기획서

### Tag

- Git tag: `v0.1.0`
