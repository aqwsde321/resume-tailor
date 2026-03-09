# 다음 작업 로드맵

- 문서 버전: v0.6
- 마지막 업데이트: 2026-03-10
- 기준: 현재 로컬 MVP(v0.6.0) 이후 우선 작업
- 상태 표기:
  - `[x]` 반영 완료
  - `[~]` 일부 반영
  - `[ ]` 미반영

## 1. 추천 작업 순서

1. [~] 자기소개 생성 품질 개선
2. [~] 채용공고 구조화와 URL 추출 안정화
3. [~] 테스트 자동화와 회귀 방지
4. [~] 단계별 UX 정교화
5. [~] Typst PDF 출력 품질과 미리보기 안정화
6. [ ] 입력 확장과 배포 검토

## 2. 왜 이 순서인가

- 사용자 체감 가치는 여전히 `자기소개 결과 품질`과 `공고 구조화 정확도`에 크게 좌우됩니다.
- PDF step 4와 Typst 기반 내보내기 1차는 들어갔으므로, 이제는 “있는 기능을 더 정확하고 빠르게” 다듬는 쪽이 우선입니다.
- 특히 실제 Typst SVG 미리보기는 사용자 체감 품질이 높지만, 렌더 비용과 회귀 검증을 따로 관리하지 않으면 응답성 문제가 생길 수 있습니다.
- CI는 들어왔지만, PDF preview/PDF export 시각 회귀까지 자동으로 잡는 수준은 아직 아니므로 렌더 검증을 보강할 필요가 있습니다.

## 3. 우선순위별 작업

### P1. 자기소개 생성 품질 개선

목표:

- 소개문이 덜 일반적이고, 공고와 이력서의 매칭 근거가 보이는 결과로 바꿉니다.

작업:

- [x] `generate-intro` 출력 스키마 확장
- [x] `oneLineIntro`, `shortIntro`, `longIntro`, `fitReasons[]`, `matchedSkills[]` 반영
- [x] `missingButRelevant[]`, `tone` 반영
- [x] 자기소개 생성 전 `resume`와 `company`의 매칭 포인트를 중간 구조로 먼저 계산하는 단계 추가
- [x] 필수와 우대 요건, 이력서 근거를 연결하는 내부 `작성 앵커`와 결과 화면의 `공고와 연결한 내 경험` 섹션 추가
- [x] `missingButRelevant[]`와 결과 화면의 `더 살릴 수 있는 점` 섹션 추가
- [x] 프롬프트 금지 규칙 명시
  - [x] 근거 없는 과장
  - [x] 공고에 없는 표현 임의 추가 억제
  - [x] 지나치게 일반적인 문장 반복 방지 강화
- [~] `tone`별 결과 차이와 반복 표현 품질 점검 추가
- [ ] fixture 기반 소개글 품질 회귀 케이스를 결과 문장 수준까지 확장

현재 반영:

- [x] 소개글 단계 `톤` 선택 UI와 API 입력 반영
- [x] `buildIntroGuidance()`와 `normalizeIntroWithGuidance()` 기반 후처리
- [x] `tests/lib/intro-insights.test.ts`에서 fixture 기반 매칭 근거 회귀 검증

완료 기준:

- 결과가 공고 요구사항 3개 이상과 직접 연결됩니다.
- 같은 이력서로 회사만 바꿨을 때 결과 차이가 명확히 보입니다.
- 선택한 톤에 따라 문장 결이 달라지되, 과장과 반복 표현은 늘어나지 않습니다.

### P2. Typst PDF 출력 품질과 미리보기 안정화

목표:

- step 4 `/pdf`에서 실제 Typst 결과를 더 빠르고 안정적으로 확인하게 합니다.
- PDF 출력 결과와 미리보기의 차이를 더 줄이고, 회귀를 자동으로 잡을 수 있게 합니다.

작업:

- [x] `resume-typst` 템플릿과 빌드 경로를 현재 프로젝트 내부로 이식
- [x] `Resume + Intro + Company`를 Typst 전용 view model로 변환하는 어댑터 추가
- [x] 결과 페이지에서 `PDF` step 4로 이동하는 흐름과 다운로드 연결 추가
- [x] 로컬/도커 환경에서 Typst 실행 경로 추가
- [x] 임시 작업 디렉터리와 산출물 정리 규칙 추가
- [x] step 4에서 실제 Typst SVG 미리보기 API 추가
- [x] Typst 미리보기 실패 시 HTML fallback 유지
- [ ] Typst SVG preview 렌더 성능 최적화
  - [ ] 동일 입력 해시 기준 preview 캐시
  - [ ] 연속 수정 중 preview compile 병합 또는 rate limit
  - [ ] multi-page preview의 스크롤/줌 UX 검토
- [ ] 시각 회귀 검증 추가
  - [ ] fixture 기준 SVG 또는 PNG snapshot smoke test
  - [ ] 대표 PDF 1페이지 PNG diff 절차 문서화

필드 설계:

- [x] 1차 필수 또는 권장 필드 추가
  - [x] `headline`
  - [x] `careerDurationText`
  - [x] `contacts[]`
    - [x] `label`
    - [x] `value`
    - [x] `url`
  - [x] `projects[].subtitle`
  - [x] `projects[].link`
  - [x] `projects[].linkLabel`
  - [x] `projects[].highlights[]`
  - [x] `pdfHighlights[]`
  - [x] `pdfStrengths[]`
- [ ] 2차 확장 필드 검토
  - [ ] `experience[].highlights[]`
  - [ ] `experience[].projects[]`
  - [ ] `techGroups[]` 수동 override
  - [ ] `summaryParagraphs[]`

UX 방침:

- [x] `자기소개 작성` 단계를 새로 만들지 않고, 기존 `/result`에서 만든 `longIntro` 중심으로 PDF 소개 섹션에 재사용
- [x] `/resume`은 소개글 생성용 입력에 집중하고, PDF용 프로필 메타는 step 4 `/pdf`에서 편집
- [x] 1차 PDF 내보내기는 별도 step 4 `/pdf`에서 제공
- [x] step 4에서는 왼쪽 편집과 오른쪽 실제 Typst 미리보기를 동시에 제공
- [x] step 4에서는 step 1에 없던 연락처, 링크, PDF용 Highlights/Strengths를 바로 수정 가능
- [ ] 이후 필요하면 `intro` 없이도 일반 이력서 PDF만 내보내는 흐름을 별도 검토

누락 필드 fallback 규칙:

- [x] `headline`이 없으면 `intro.oneLineIntro -> resume.summary 첫 문장 -> desiredPosition` 순서로 대체
- [x] `careerDurationText`가 없으면 `careerYears` 기반 기본 문구로 대체
- [x] `contacts[]`가 비어 있으면 있는 값만 출력하고, 전부 비어 있으면 연락처 줄 전체를 숨김
- [x] 프로젝트 `link`가 없으면 링크 영역을 숨김
- [x] 프로젝트 `highlights[]`가 없으면 `description`만 출력
- [x] `techStack`을 규칙 기반으로 자동 분류하고, 분류되지 않는 항목은 `DevOps / Tool`로 보냄
- [x] `pdfHighlights[]`, `pdfStrengths[]`가 없으면 기존 `achievements`, `strengths`로 fallback
- [ ] `experience[].projects[]`가 없으면 경력 설명만 출력하고 하위 프로젝트 블록은 숨김

스킬 필요 여부:

- [x] 1차 구현은 새 skill 없이 진행
  - 이유: PDF 변환은 `Resume`와 `Intro`를 Typst JSON으로 옮기는 결정적 매핑과 템플릿 렌더링 문제에 가깝습니다.
- [ ] 2차에서 sparse 데이터 자동 보강이 필요하면 새 skill 검토
  - 후보: `resume-to-pdf-profile`
  - 용도: `headline`, `project highlights`, `techGroups`, `summaryParagraphs` 초안 자동 보강

현재 반영:

- [x] step 4 `/pdf`와 `POST /api/pdf` PDF export 경로
- [x] `POST /api/pdf/preview` Typst SVG preview 경로
- [x] 실제 Typst 미리보기 실패 시 HTML fallback
- [x] 현재 환경에서 `typst compile`과 `typst compile --format svg` 가능

완료 기준:

- `/result`에서 소개글 생성 후 `/pdf` step 4로 이동해 실제 Typst 미리보기를 보며 수정할 수 있습니다.
- 연락처, 링크, 하이라이트가 비어 있어도 PDF 생성이 깨지지 않습니다.
- 로컬 실행과 Docker 실행 모두 preview/PDF 빌드 경로가 동작합니다.

### P3. 채용공고 구조화와 URL 추출 안정화

목표:

- 붙여넣은 공고 텍스트나 URL에서 불러온 본문이 지저분해도 핵심 필드가 안정적으로 분리되게 만듭니다.

작업:

- [~] `company-to-json` 스킬에서 추출 규칙 강화
- [~] `requirements`, `preferredSkills`, `techStack`, `jobDescription` 분리 기준 재정의
- [~] 공고 노이즈 처리
  - [x] 복지와 문화 문구
  - [x] 중복 bullet
  - [x] 링크와 마크다운 잔여 문자열
- [x] 샘플 공고 fixture 10~20개 확보 후 회귀 테스트 추가
- [~] URL 추출 도메인별 회귀 케이스 확대
- [ ] URL 불러오기에서 `title`, `companyNameHint`, `jobTitleHint` 불일치 케이스 보강

현재 반영:

- [x] API 응답 직전에 `normalizeCompany()` 후처리 추가
- [x] fixture 기반 정규화 회귀 테스트 11개 추가
- [x] Wanted 와 Jumpit URL 추출 결과를 반영한 company route golden case 추가
- [x] `fetch-url` route 테스트로 숨겨진 JSON, 브라우저 fallback, 사람인 relay, 잡코리아 iframe, Wanted, Jumpit, OCR fallback, 내부 주소 차단 검증

완료 기준:

- 동일 공고 재분석 시 핵심 필드 흔들림이 줄어듭니다.
- `필수 요구사항` 누락률이 눈에 띄게 줄어듭니다.
- URL 불러오기에서도 추천공고, 하단 안내, 이미지 의존 본문 누락이 눈에 띄게 줄어듭니다.

### P4. 테스트 자동화와 회귀 방지

목표:

- 프롬프트, 스키마, URL 추출 규칙, 상태 규칙, PDF 출력 경로를 자주 수정해도 회귀를 빠르게 잡습니다.

작업:

- Playwright 기반 E2E
  - [x] 이력서 확정 -> 채용공고 확정 -> 결과 생성
  - [x] 이력서 수정 시 회사와 결과 무효화
  - [x] 회사 수정 시 결과 stale 처리
  - [x] 이력서 미확정이면 채용공고 단계 차단
- [x] SSE 로그 표시 스모크 테스트
- [~] 실패 응답, 빈 응답, 스키마 오류에 대한 API 테스트 추가
- [~] fixture 기반 golden test 범위 확장
- [x] CI에서 `lint`, `typecheck`, `test`, `build` 자동 실행
- [~] PDF export, preview, fallback 규칙 테스트 추가

현재 반영:

- [x] stream API에서 빈 결과와 스키마 오류를 구분하는 테스트 추가
- [x] 스트림 클라이언트에서 빈 결과, 본문 누락, 비JSON 실패 응답 처리 테스트 추가
- [x] `intro` 매칭 근거 계산에 fixture 기반 golden test 추가
- [x] `company/fetch-url` route에 도메인별 추출과 보안 차단 테스트 추가
- [x] GitHub Actions에서 `main` push 시 검증 후 Docker Hub publish 추가
- [x] `pdf/view-model` fallback 규칙 테스트 추가
- [x] `POST /api/pdf`, `POST /api/pdf/preview` API 테스트 추가
- [x] step 4의 Enter 기반 Highlights 편집 E2E 추가

완료 기준:

- 핵심 플로우 회귀가 로컬과 CI에서 빠르게 포착됩니다.
- 프롬프트 또는 정규화 규칙 수정 후 어떤 fixture가 깨졌는지 빠르게 확인할 수 있습니다.
- PDF 출력 시 누락 필드 fallback이 자동 테스트로 검증됩니다.

### P5. 단계별 UX 정교화

목표:

- 현재 3단계 흐름을 유지하면서도 수정과 재생성 비용을 더 낮춥니다.

작업:

- [x] 각 단계에 `마지막 확정 시각` 표시
- [x] 어떤 변경 때문에 `결과 재생성 필요`가 되었는지 원인 메시지 표시
- [x] 결과 페이지에서 `회사 공고만 바뀜` 같은 변경 원인 배지 표시
- [~] 비교 UI를 텍스트 diff 또는 강조 표시 형태로 개선
- [ ] 필드 수가 많은 배열 섹션에 접기와 펼치기 추가
- [x] PDF용 추가 필드를 입력해도 1단계 폼이 과하게 무거워지지 않도록 4단계로 분리

현재 반영:

- [x] 단계 가드와 stale 상태 기반 이동 제어
- [x] 작업 중 중앙 모달과 하단 작업 기록 표시, 스티키와 카드 내부 중복 진행 알림 제거
- [x] 작업 중 중앙 모달에 스피너와 단계형 진행 상태 표시 추가
- [x] 결과 페이지 이전 결과 비교 2열 레이아웃
- [x] 상단 스텝에 `다시 만들기` 상태 문구와 sticky 안내 추가
- [x] 저장 전 확인에서 누락 항목 클릭 시 해당 필드로 이동
- [x] step 4에서 실제 Typst 미리보기와 하단 고정 PDF 내보내기 CTA 추가
- [x] 작업 중 중앙 모달에 `작업 중지` 버튼과 실제 abort 연결

완료 기준:

- 사용자가 현재 막힌 이유와 다음 행동을 화면만 보고 판단할 수 있습니다.
- 긴 배열 섹션과 이전/현재 결과 차이를 스크롤 부담 없이 검토할 수 있습니다.
- PDF용 메타 필드가 추가돼도 기본 사용 흐름이 과하게 복잡해지지 않습니다.

### P6. 입력 확장과 배포 검토

목표:

- MVP 바깥의 입력 형식과 실행 환경 제약을 다음 단계에서 검토합니다.

작업:

- [~] 공고 URL 불러오기와 사이트별 상세 추출 1차 도입
- [ ] `pdf-parse` 기반 PDF 텍스트 추출 프로토타입
- [~] macOS Vision OCR fallback의 Linux 대체 경로 보강
- [ ] 로컬 인증 의존성을 제거할 수 있는 구조 조사
- [ ] 원격 배포 시 인증 전략과 비밀 관리 방식 문서화

현재 반영:

- [x] 공고 URL 불러오기 입력 모드 추가
- [x] 사람인 relay 상세 추출
- [x] 잡코리아 `GI_Read_Comt_Ifrm` 상세 추출
- [x] Wanted 와 Jumpit 정적 HTML 추출 회귀 테스트 추가
- [x] 숨겨진 JSON 추출과 브라우저 fallback
- [x] 내부 주소 차단
- [x] 이미지 상세 공고 OCR fallback
- [x] Docker/Linux용 Tesseract OCR fallback 1차 추가

완료 기준:

- PDF 입력 지원 실현 가능성이 확인됩니다.
- 로컬 전용 구조를 유지할지, 배포형으로 갈지 판단 근거가 생깁니다.
- macOS 로컬 실행 전제 없이도 URL 추출/OCR 대안을 설명할 수 있습니다.
