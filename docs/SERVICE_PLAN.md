# 서비스 기획서

- 문서 버전: v0.9
- 마지막 업데이트: 2026-11-09
- 기준 범위: 로컬 MVP

## 1. 서비스 정의

정의:
`Next.js` 기반 로컬 웹앱. 이력서와 채용공고를 텍스트 입력, `txt` 업로드, URL 불러오기로 받아 구조화 JSON을 만들고, 원본 근거를 확인할 수 있는 회사 맞춤 이력서와 자기소개를 PDF로 만든다.

핵심 가치:
- 이력서와 공고의 핵심 정보를 빠르게 구조화한다.
- 생성 결과를 사용자가 수정하고 확정할 수 있게 둔다.
- 공고 관련성이 높은 기존 경력과 프로젝트를 우선 배치하고, 바뀐 표현의 원본 근거를 검토한 뒤 이력서에 적용한다.
- 필수·우대 요건마다 근거 연결 유형과 원본 근거를 표시하고, 연결되지 않는 요건은 갭으로 드러낸다.
- 이력서에 없는 경력, 기술, 성과, 수치를 만들지 않는다.
- 회사별 반복 지원 시 `회사 공고만 교체 -> 결과 재생성` 비용을 낮춘다.
- 저장된 이력서의 직무·기술과 공고를 비교해 회사별 맞춤 이력서 시작점을 제공한다.
- raw JSON을 직접 노출하지 않고, 한글 폼 중심 편집 경험으로 조작 부담을 줄인다.

## 2. 대상 사용자와 사용 시나리오

대상:
- 소규모 지인 사용자(인증/DB 없이 로컬 실행 가능한 환경)

대표 시나리오:
1. 사용자가 `/resume`에서 이력서를 입력하거나 `txt`, URL로 불러온 뒤 `resume.json`을 확정한다.
2. 사용자가 `/jobs`에서 사람인·고용24 공고를 검색하거나 원하는 사이트에서 고른 공고 URL을 가져온다.
3. 사용자가 `/company`에서 채용공고를 입력/업로드하고 `company.json`을 확정한다.
4. 사용자가 `/result`에서 자기소개를 생성한다.
5. 사용자가 `/pdf`에서 공고 맞춤 이력서 초안을 근거와 함께 검토하고, 적용하거나 기존 내용을 유지한다.
6. 사용자가 템플릿, 색상, 프로필 이미지와 PDF 전용 필드를 마지막으로 조정한다.
7. 이후 채용공고만 바꾸는 경우 `/company`만 다시 확정 후 `/result` 재생성한다.
8. 사용자는 상단 스텝 영역에서 현재 확정 상태와 결과 최신 여부를 계속 확인한다.

## 3. 범위 정의

MVP 포함:
- `/jobs` 이력서 기반 공고 검색, 적합 근거 표시, 선택한 공고를 `/company`에 연결
- 사람인·고용24 공식 API 검색 및 원티드·점핏·잡코리아 공고 URL 직접 가져오기
- 페이지 분리 4단계 플로우(`/resume` -> `/company` -> `/result` -> `/pdf`)
- JSON 확정 상태 관리(`resumeConfirmedJson`, `companyConfirmedJson`)
- 일반 API, fetch-url API, SSE 스트림 API, PDF preview/export API
- 이력서와 공고의 `textarea` 입력, `txt` 업로드, URL 불러오기
- AI 분석 로그 실시간 표시(SSE)
- 작업 중 중앙 모달 + 하단 접이식 작업 기록
- 상단 고정 스텝/상태 셸
- 단계별 `생각 깊이` 선택 UI
- 소개글 단계 `톤` 선택 UI
- 한글 폼 기반 항목 편집 UI(raw JSON 직접 노출 없음)
- 필수 항목 하이라이트 + 저장 전 확인 클릭 이동 + 단계별 확정 가드
- 각 단계의 마지막 저장/생성 시각 표시
- 이전 결과와 현재 결과 비교 UI
- 복사 버튼, 재생성 버튼
- step 4 공고 요건별 근거·갭 검토와 회사 맞춤 이력서 초안 생성, 사용자 승인 후 PDF draft 적용
- step 4 실제 Typst SVG 미리보기와 PDF 내보내기
- `Classic`, `Sidebar`, `Modern`, `Typographic` 템플릿 선택
- 색상 프리셋과 사용자 지정 HEX 색상 선택
- 프로필 이미지 업로드와 표시 여부 제어

MVP 제외(후순위):
- PDF 업로드/파싱
- 사용자 인증/권한
- 원격 DB 저장
- 다중 사용자/배포 환경 운영

## 4. 기능 요구사항

공고 검색 `/jobs`:
- 확정된 이력서의 희망 직무를 기본 검색어로 사용하고, 검색어를 수정할 수 있다.
- 사람인과 고용24 공식 API 결과를 조회하고, 기술·직무 키워드와 경력 조건이 맞는 이유를 표시한다.
- 검색 API 키는 서버 환경 변수에서만 읽는다.
- 선택한 공고 원문을 `/company`에 전달하고 기존 회사 맞춤 이력서 흐름으로 이어간다.
- 원티드·점핏·잡코리아에서 직접 선택한 공고 URL도 기존 URL 가져오기로 연결한다.
- 사람인·고용24 출처 표기와 원문 링크를 제공한다.

STEP 1 `/resume`:
- 이력서: textarea / txt 업로드 / URL 불러오기 탭 전환
- 구조화 결과 생성
- 한글 폼 기반 수정
- 필수 항목(`희망 직무`, `기술 스택`) 강조 표시
- 저장 전 확인에서 누락 항목을 누르면 해당 입력 위치로 스크롤 및 포커스 이동
- 카드 하단 `이력서 저장` 버튼
- 확정 완료 후에만 STEP 2 이동 버튼 노출

STEP 2 `/company`:
- STEP 1 확정 전 진입 제한
- 채용공고: textarea / txt 업로드 / URL 불러오기 탭 전환
- 구조화 결과 생성
- 한글 폼 기반 수정
- 필수 항목(`회사명`, `포지션`, `필수 조건`) 강조 표시
- 저장 전 확인에서 누락 항목을 누르면 해당 입력 위치로 스크롤 및 포커스 이동
- 카드 하단 `공고 저장` 버튼
- 확정 완료 후에만 STEP 3 이동 버튼 노출

STEP 3 `/result`:
- STEP 1/2 확정 전 생성 제한
- `oneLineIntro`, `shortIntro`, `longIntro` 생성/출력
- `fitReasons`, `matchedSkills`, `gapNotes`, `missingButRelevant` 기반 근거 카드 표시
- 소개글 생성 전 `공고 요건 -> 내 경험/성과/강점 -> 기여` 방향의 내부 작성 앵커 계산
- 결과 화면에 `공고와 연결한 내 경험` 섹션 표시
- 결과 화면에 `더 살릴 수 있는 점` 섹션 표시
- 소개글 생성 시 `톤` 선택 반영
- 복사 버튼
- 재생성 버튼
- 직전 결과와 현재 결과 비교 영역
- 결과 최신 여부 표시(`최신` / `재생성 필요`)
- `이력서 변경`, `공고 변경` 등 재생성 이유 배지 표시

STEP 4 `/pdf`:
- 필수·우대 요건별 매칭 유형(`직접 일치`, `전이 가능`, `인접 경험`, `근거 없음`), 이유와 원본 근거 표시
- 회사 맞춤 이력서 생성과 원본 근거 비교
- 생성 결과를 승인하거나 취소한 뒤 PDF 편집기에 반영
- 템플릿 선택(`Classic`, `Sidebar`, `Modern`, `Typographic`)
- 색상 프리셋과 사용자 지정 HEX 색상 선택
- 실제 Typst SVG 미리보기 확인
- `Header`, `Contacts`, `About Me`, `Experience`, `Highlights`, `Projects`, `Skills`, `Strengths` 수정
- 프로필 이미지 업로드/삭제와 표시 여부 제어
- 최종 PDF 다운로드

공통:
- 상단 스텝 이동(`/resume`, `/company`, `/result`, `/pdf`)
- 스텝 상태 표시(`완료`, `진행`, `대기`, `잠김`)
- 단계별 `생각 깊이` 선택
- 소개글 단계 `톤` 선택
- 확정 상태 배지(이력서/채용공고)
- 마지막 저장/생성 시각 표시
- 결과 최신 여부 배지(최신/재생성 필요)
- 작업 중 중앙 진행 모달 + 배경 오버레이 + 단계형 진행 상태
- 하단 접이식 작업 기록 패널

## 5. 비기능 요구사항

- 실행 환경: 로컬(Node.js 기반)과 Docker
- API 런타임: Node runtime 고정(Edge 미사용)
- 실패 처리: 요청 유효성 검증 + 명확한 에러 메시지 + 빈 결과/형식 오류 재시도 안내
- 응답 형식: 스키마 기반 JSON 고정
- 안정성: Codex 호출 직렬 큐로 충돌 최소화
- 관측성: 분석 이벤트를 SSE로 스트리밍

## 6. 시스템 개요

구성:
- React UI와 전역 파이프라인 상태
- Next.js API Routes
- `@openai/codex-sdk`와 로컬 `SKILL.md`
- URL fetch / OCR 보조 처리
- `typst` CLI 기반 SVG preview / PDF export

주요 흐름:
1. 사용자가 `/resume`, `/company`, `/result`, `/pdf`에서 단계별 입력과 확인을 진행한다.
2. 구조화와 소개글 생성은 일반 API 또는 SSE 스트림 API를 통해 실행된다.
3. 사용자는 생성 결과를 폼으로 수정하고 확정한 뒤 다음 단계로 이동한다.
4. `/result`는 현재 확정된 이력서와 공고를 기준으로 소개글을 생성하고 stale 여부를 계산한다.
5. `/pdf`는 확정된 데이터와 소개글을 기반으로 실제 Typst 미리보기와 최종 PDF 내보내기를 제공한다.

세부 구현 위치는 [프로젝트 구조](./PROJECT_STRUCTURE.md), URL 불러오기 세부 규칙은 [채용공고 불러오기 가이드](./COMPANY_FETCH_GUIDE.md), 소개글 품질 기준은 [자기소개 품질 가이드](./INTRO_QUALITY_GUIDE.md)를 기준으로 관리한다.

## 7. API 명세(현재 기준)

일반 API:
- `GET /api/jobs/search` -> 검색 API 설정 상태(키 값은 반환하지 않음)
- `POST /api/jobs/search` -> 이력서 기준으로 정렬한 검색 공고 목록
- `POST /api/resume` -> `Resume`
- `POST /api/resume/fetch-url` -> `FetchedResumePage`
- `POST /api/company` -> `Company`
- `POST /api/company/fetch-url` -> `FetchedCompanyPage`
- `POST /api/intro` -> `Intro`
- `POST /api/pdf/preview` -> `SvgPreview`
- `POST /api/pdf` -> PDF 파일 응답

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
- `fitReasons[]`
- `matchedSkills[]`
- `gapNotes[]`
- `missingButRelevant[]`

`PdfExportDraft`:
- `templateId`, `themeId`, `customAccentHex`
- `headline`, `careerDurationText`, `contacts[]`
- `pdfHighlights[]`, `pdfStrengths[]`
- `pdfProfileImageDataUrl`, `pdfProfileImageVisible`
- `projects[].subtitle`, `projects[].link`, `projects[].linkLabel`, `projects[].highlights[]`

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
- 대응: `codex login` 선행, 인증 오류 메시지 표준화

R2. 서버 환경 이식성:
- 영향: 서버리스/원격 배포에서 세션 재사용 불안정 가능성
- 대응: 현재 문서 범위는 로컬 MVP로 제한

R3. 생성 JSON 품질 편차:
- 영향: 후속 자기소개 품질 저하
- 대응: output schema 강제 + 사용자 확정 단계 유지

R4. URL 불러오기와 OCR 품질 편차:
- 영향: 사이트 구조 변경이나 이미지 본문 때문에 현재 공고가 약하게 추출될 수 있음
- 대응: 사이트 전용 경로, 품질 점수화, OCR fallback, 직접 붙여넣기 안내를 함께 유지
