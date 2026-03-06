# ResumeMake (Local MVP)

로컬에서 이력서와 채용공고 텍스트를 입력하면 `@openai/codex-sdk`와 `SKILL.md` 파이프라인으로 구조화 JSON을 만들고, 회사 맞춤 자기소개를 생성하는 Next.js 앱입니다.

## 문서

- [서비스 기획서](./docs/SERVICE_PLAN.md)
- [다음 작업 로드맵](./docs/NEXT_STEPS.md)
- [문서 인덱스](./docs/README.md)
- [릴리즈 노트](./docs/RELEASE_NOTES.md)
- [운영 런북](./docs/OPS_RUNBOOK.md)
- [자기소개 품질 가이드](./docs/INTRO_QUALITY_GUIDE.md)

## 1) 필요한 설치

이 프로젝트를 실행하려면 아래가 먼저 준비되어 있어야 합니다.

- Node.js 20 이상
- npm
- Codex 앱 또는 Codex CLI
- Codex 로그인 가능 계정

### Node.js 설치

Node.js는 공식 다운로드 페이지에서 LTS 버전 설치를 권장합니다.

- 공식 다운로드: [https://nodejs.org/en/download](https://nodejs.org/en/download)
- 설치 후 확인:

```bash
node -v
npm -v
```

### Codex 설치

Codex CLI는 공식 문서 기준으로 npm 전역 설치가 가장 간단합니다.

- 공식 문서: [https://developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)

```bash
npm i -g @openai/codex
codex --version
```

macOS에서 Codex 앱을 설치해 사용 중이라면 앱에 포함된 바이너리를 직접 지정해도 됩니다.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
$CODEX_CLI_PATH --version
```

버전 확인:

```bash
node -v
npm -v
codex --version
```

`codex` 명령이 잡히지 않으면 `CODEX_CLI_PATH`를 설정해서 실행할 수 있습니다.

macOS 예시:

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
$CODEX_CLI_PATH --version
```

터미널에서 `codex`를 바로 쓰고 싶다면 PATH에 추가하세요.

macOS 예시:

```bash
export PATH="/Applications/Codex.app/Contents/Resources:$PATH"
codex --version
```

## 2) Codex 인증

처음 한 번은 Codex 인증이 필요합니다.

```bash
codex auth login
```

`CODEX_CLI_PATH`를 사용 중이라면 아래처럼 실행해도 됩니다.

```bash
$CODEX_CLI_PATH auth login
```

## 3) 프로젝트 설치

저장소를 받은 뒤 프로젝트 루트에서 아래 순서로 실행하세요.

```bash
git clone <repo-url>
cd resumeMake
npm install
```

의존성 재현성을 더 중시하면 `npm install` 대신 `npm ci`를 사용해도 됩니다.

## 4) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 루트 경로가 `/resume`으로 이동합니다.

`codex`가 PATH에 없으면 같은 터미널 세션에서 아래처럼 실행하세요.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
npm run dev
```

## 5) 첫 사용 흐름

1. `/resume` 에서 이력서 텍스트를 붙여넣고 분석 후 폼을 수정한 뒤 확정합니다.
2. `/company` 에서 채용공고 텍스트를 붙여넣고 분석 후 폼을 수정한 뒤 확정합니다.
3. `/result` 에서 자기소개를 생성하거나 다시 생성합니다.

화면에는 현재 단계, 작업 중 상태, AI 분석 로그, 이전 결과와 현재 결과 비교가 표시됩니다.

## 6) 환경 변수

필수는 아니지만 아래 변수를 알면 실행이 쉬워집니다.

- `CODEX_CLI_PATH`: `codex` 바이너리가 PATH에 없을 때 직접 경로 지정
- `CODEX_SKILLS_DIR`: 외부 스킬 디렉터리를 우선 탐색하고 싶을 때 지정

기본 스킬 탐색 순서:

1. `$CODEX_SKILLS_DIR/<skill>/SKILL.md`
2. `./skills/<skill>/SKILL.md`

예시:

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
export CODEX_SKILLS_DIR="$HOME/.codex/skills"
```

## 7) API 구성

- `POST /api/resume`: `resume-to-json`
- `POST /api/resume/stream`: `resume-to-json` + SSE 로그
- `POST /api/company`: `company-to-json`
- `POST /api/company/stream`: `company-to-json` + SSE 로그
- `POST /api/intro`: `generate-intro`
- `POST /api/intro/stream`: `generate-intro` + SSE 로그

모든 API route는 `runtime = "nodejs"`로 고정되어 있습니다.

## 8) 주의사항

- 현재 MVP는 `txt` 입력만 우선 지원합니다.
- 로컬 단일 사용자 시나리오를 기준으로 설계되어 있습니다.
- 서버리스나 원격 배포용 문서는 아직 포함하지 않습니다.

## 9) 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

문제 해결 절차와 운영 체크리스트는 [운영 런북](./docs/OPS_RUNBOOK.md)을 참고하세요.
