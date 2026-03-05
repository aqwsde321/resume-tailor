# ResumeMake 서비스 기획서

- 문서 버전: v0.1
- 작성일: 2026-03-06
- 기준 범위: 로컬 MVP

## 1. 서비스 정의

정의:
`Next.js` 기반 로컬 웹앱. 이력서/채용공고를 텍스트 입력 또는 txt 업로드로 받아, `@openai/codex-sdk + SKILL.md` 파이프라인으로 구조화 JSON을 생성하고, 회사 맞춤 자기소개를 웹 화면에서 확인/수정할 수 있다.

핵심 가치:
- 이력서와 공고의 핵심 정보를 빠르게 구조화한다.
- 생성 결과(JSON/자기소개)를 사용자가 직접 수정 가능하게 둔다.
- 회사별 반복 지원 시 재생성 비용을 낮춘다.

## 2. 대상 사용자와 사용 시나리오

대상:
- 소규모 지인 사용자(인증/DB 없이 로컬 실행 가능한 환경)

대표 시나리오:
1. 사용자가 이력서 텍스트와 채용공고 텍스트를 입력한다.
2. 시스템이 `resume.json`, `company.json`을 생성한다.
3. 사용자가 JSON을 수정한다.
4. 자기소개(`oneLineIntro`, `shortIntro`)를 생성한다.
5. 회사 정보만 바꿔 자기소개를 재생성한다.

## 3. 범위 정의

MVP 포함:
- 3단계 UI 플로우(입력 -> JSON 확인/수정 -> 결과)
- API 3개(`/api/resume`, `/api/company`, `/api/intro`)
- txt 업로드 -> textarea 반영
- 복사 버튼, 재생성 버튼
- SKILL 기반 JSON 생성

MVP 제외(후순위):
- PDF 업로드/파싱
- 사용자 인증/권한
- 원격 DB 저장
- 다중 사용자/배포 환경 운영

## 4. 기능 요구사항

STEP 1 입력:
- 이력서: textarea / txt 업로드 탭 전환
- 채용공고: textarea / txt 업로드 탭 전환
- 분석 시작 버튼

STEP 2 JSON 확인/수정:
- `resume.json`과 `company.json` 나란히 표시
- 인라인 수정 가능
- 자기소개 생성 버튼

STEP 3 결과:
- `oneLineIntro`, `shortIntro` 출력
- 각 결과 복사 버튼
- 다시 생성
- company만 바꿔서 재생성

## 5. 비기능 요구사항

- 실행 환경: 로컬(Node.js 기반)
- API 런타임: Node runtime 고정(Edge 미사용)
- 실패 처리: 요청 유효성 검증, 명확한 에러 메시지 반환
- 응답 형식: 스키마 기반 JSON 고정
- 안정성: Codex 호출은 직렬 큐로 충돌 최소화

## 6. 아키텍처

구성:
- React UI
- Next.js API Routes
- `@openai/codex-sdk`
- SKILL.md 3종(`resume-to-json`, `company-to-json`, `generate-intro`)

데이터 흐름:
1. UI에서 텍스트 입력/업로드
2. `/api/resume`, `/api/company` 호출로 구조화 JSON 생성
3. UI에서 JSON 수정
4. `/api/intro` 호출로 자기소개 생성
5. 결과 확인/복사/재생성

## 7. API 명세(현재 기준)

`POST /api/resume`
- Request: `{ text: string }`
- Response: `Resume` JSON

`POST /api/company`
- Request: `{ text: string }`
- Response: `Company` JSON

`POST /api/intro`
- Request: `{ resume: Resume, company: Company }`
- Response: `Intro` JSON

에러 응답 공통:
- `{ ok: false, error: { message, details? } }`

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

## 9. 핵심 리스크와 대응

R1. `@openai/codex-sdk` 로컬 로그인 세션 의존성:
- 영향: 인증 실패 시 전체 파이프라인 중단
- 대응: 시작 전 `codex auth login` 확인, 인증 실패 메시지 표준화

R2. 서버 환경 이식성:
- 영향: 서버리스/원격 배포에서 세션 재사용 불안정 가능성
- 대응: 현재 문서 범위는 로컬 MVP로 제한, 배포형은 별도 설계 트랙 운영

R3. 생성 JSON 품질 편차:
- 영향: 후속 자기소개 품질 저하
- 대응: output schema 강제 + 사용자 수정 단계 유지

## 10. 개발 우선순위

1. Codex 로컬 인증 동작 검증(최우선)
2. API Route 3개 + SKILL 연동
3. 3단계 UI 구현
4. txt 업로드 UX
5. PDF 파싱 확장(후순위)

## 11. 운영/관리 규칙

문서 업데이트 규칙:
- 요구사항/범위/리스크 변경 시 이 문서를 먼저 갱신한다.
- API/스키마 변경 시 `7. API 명세`, `8. 데이터 스키마`를 함께 수정한다.
- 주요 의사결정은 아래 결정 로그에 기록한다.

결정 로그:
- 2026-03-06: MVP 입력 포맷을 txt로 제한, PDF는 후순위 처리.
- 2026-03-06: 인증/DB 없이 로컬 실행 시나리오 우선.
- 2026-03-06: API 3개 + 3단계 UI 구조 확정.

## 12. 다음 마일스톤

M1. 로컬 End-to-End 검증:
- 실제 이력서/공고 샘플로 전체 플로우 확인
- 에러 케이스(빈 입력, 잘못된 JSON 수정) 점검

M2. 품질 보강:
- 스키마 보완(필드 정교화)
- 프롬프트 가이드 튜닝

M3. 확장:
- PDF 파싱(`pdf-parse`) 도입
- 배포형 인증 전략 별도 설계
