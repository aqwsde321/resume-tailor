# ResumeMake (Local MVP)

Next.js 기반 로컬 웹앱입니다. 이력서/채용공고 텍스트를 받아 `@openai/codex-sdk`와 `SKILL.md` 파이프라인으로 구조화 JSON을 만들고, 회사 맞춤 자기소개를 생성합니다.

## 기획 문서

- [서비스 기획서](/Users/jino/study/project/resumeMake/docs/SERVICE_PLAN.md)
- [다음 작업 로드맵](/Users/jino/study/project/resumeMake/docs/NEXT_STEPS.md)
- [문서 인덱스](/Users/jino/study/project/resumeMake/docs/README.md)
- [릴리즈 노트](/Users/jino/study/project/resumeMake/docs/RELEASE_NOTES.md)
- [운영 런북](/Users/jino/study/project/resumeMake/docs/OPS_RUNBOOK.md)
- [자기소개 품질 가이드](/Users/jino/study/project/resumeMake/docs/INTRO_QUALITY_GUIDE.md)

## 1) 준비

1. Node.js 20+
2. Codex 로그인

```bash
codex auth login
```

## 2) 설치/실행

```bash
npm install
npm run dev
```

Codex CLI 경로가 기본 PATH에 없다면 환경변수를 지정하세요.

```bash
CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
```

## 3) API 구성

- `POST /api/resume` : resume-to-json
- `POST /api/resume/stream` : resume-to-json (SSE 로그 포함)
- `POST /api/company` : company-to-json
- `POST /api/company/stream` : company-to-json (SSE 로그 포함)
- `POST /api/intro` : generate-intro
- `POST /api/intro/stream` : generate-intro (SSE 로그 포함)

모든 API route는 `runtime = "nodejs"`로 고정되어 있습니다.

## 4) 화면 플로우

- `/resume` : 이력서 입력 -> 구조화 분석 -> 한글 폼 수정 -> 확정
- `/company` : 채용공고 입력 -> 구조화 분석 -> 한글 폼 수정 -> 확정
- `/result` : 확정된 이력서/채용공고 기준 자기소개 생성/재생성

상단 고정 스텝 상태, 작업 중 상태(스피너/경과시간), AI 분석 로그, 이전/현재 결과 비교가 화면에 표시됩니다.

## 5) 스킬 경로

기본 탐색 순서:

1. `$CODEX_SKILLS_DIR/<skill>/SKILL.md`
2. `./skills/<skill>/SKILL.md`

환경변수로 경로를 바꿀 수 있습니다.

```bash
CODEX_SKILLS_DIR=/Users/your-name/.codex/skills
```

## 6) 주의사항

- MVP는 `txt` 업로드만 지원합니다.
- PDF는 추후 `pdf-parse` 연동으로 확장 가능합니다.
- 로컬 1인 사용 시나리오를 우선 대상으로 설계했습니다.

## 7) 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
