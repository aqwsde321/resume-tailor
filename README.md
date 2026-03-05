# ResumeMake (Local MVP)

Next.js 기반 로컬 웹앱입니다. 이력서/채용공고 텍스트를 받아 `@openai/codex-sdk`와 `SKILL.md` 파이프라인으로 구조화 JSON을 만들고, 회사 맞춤 자기소개를 생성합니다.

## 기획 문서

- [서비스 기획서](/Users/jino/study/project/resumeMake/docs/SERVICE_PLAN.md)

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

## 3) API 구성

- `POST /api/resume` : resume-to-json
- `POST /api/company` : company-to-json
- `POST /api/intro` : generate-intro

모든 API route는 `runtime = "nodejs"`로 고정되어 있습니다.

## 4) 스킬 경로

기본 탐색 순서:

1. `$CODEX_SKILLS_DIR/<skill>/SKILL.md`
2. `./skills/<skill>/SKILL.md`

환경변수로 경로를 바꿀 수 있습니다.

```bash
CODEX_SKILLS_DIR=/Users/your-name/.codex/skills
```

## 5) 주의사항

- MVP는 `txt` 업로드만 지원합니다.
- PDF는 추후 `pdf-parse` 연동으로 확장 가능합니다.
- 로컬 1인 사용 시나리오를 우선 대상으로 설계했습니다.
