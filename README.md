# ResumeMake (Local MVP)

로컬에서 이력서와 채용공고 텍스트를 입력하면 `@openai/codex-sdk`와 `SKILL.md` 파이프라인으로 구조화 JSON을 만들고, 회사 맞춤 자기소개를 생성하는 Next.js 앱입니다.

## 문서

- [문서 인덱스](./docs/README.md)
- [프로젝트 구조](./docs/PROJECT_STRUCTURE.md)
- [서비스 기획서](./docs/SERVICE_PLAN.md)
- [운영 런북](./docs/OPS_RUNBOOK.md)
- [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md)
- [자기소개 품질 가이드](./docs/INTRO_QUALITY_GUIDE.md)
- [릴리즈 노트](./docs/RELEASE_NOTES.md)
- [다음 작업 로드맵](./docs/NEXT_STEPS.md)

처음 보는 사람은 아래 순서로 읽는 편이 빠릅니다.

1. `README.md`: 설치, 실행, 전체 사용 흐름
2. `docs/PROJECT_STRUCTURE.md`: 폴더 구조와 실행 흐름
3. `docs/SERVICE_PLAN.md`: 기능 범위와 제품 기준
4. 필요 시 운영/품질/URL 추출 가이드 문서 확인

## 1. 실행 방식

이 프로젝트는 두 가지 방식으로 실행할 수 있습니다.

- Docker 실행: 다른 사용자에게 공유할 때 권장. 로컬에 Node.js나 Codex CLI를 따로 설치하지 않아도 됩니다.
- 로컬 실행: Node.js와 Codex CLI를 직접 설치해서 실행합니다.

## 2. Docker로 실행

공유받은 사용자가 가장 적은 설치로 실행하려면 Docker 방식을 사용하세요.

필수:

- Docker Desktop 또는 Docker Engine
- Codex 로그인 가능한 계정

저장소를 받은 뒤 프로젝트 루트에서 아래 순서로 실행합니다.

```bash
git clone <repo-url>
cd resumeMake
docker compose build
docker compose run --rm app codex auth login
docker compose up
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 됩니다.

추가 메모:

- `codex auth login`은 컨테이너 안에서 실행되며, 인증 정보는 `codex-home` Docker volume에 저장됩니다.
- 한 번 로그인한 뒤에는 보통 `docker compose up`만 다시 실행하면 됩니다.
- 코드 변경 후 이미지를 다시 반영하려면 `docker compose up --build`를 사용하세요.
- 인증 정보를 포함한 Docker volume까지 지우려면 `docker compose down -v`를 사용합니다.

### 자주 쓰는 Docker 명령

최초 1회 로그인:

```bash
docker compose run --rm app codex auth login
```

백그라운드 실행:

```bash
docker compose up -d
```

로그 확인:

```bash
docker compose logs -f app
```

중지:

```bash
docker compose down
```

이미지 다시 빌드 후 실행:

```bash
docker compose up --build
```

인증 정보까지 초기화:

```bash
docker compose down -v
```

## 3. 로컬 실행 준비

Docker를 쓰지 않고 직접 실행하려면 아래가 필요합니다.

- Node.js 20 이상
- npm
- Codex 앱 또는 Codex CLI
- Codex 로그인 가능 계정

### 3.1 Node.js 설치

Node.js는 공식 다운로드 페이지에서 LTS 버전 설치를 권장합니다.

- 공식 다운로드: [https://nodejs.org/en/download](https://nodejs.org/en/download)

설치 후 확인:

```bash
node -v
npm -v
```

### 3.2 Codex 설치

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

터미널에서 `codex`를 바로 쓰고 싶다면 PATH에 추가하세요.

```bash
export PATH="/Applications/Codex.app/Contents/Resources:$PATH"
codex --version
```

## 4. 로컬 Codex 인증

처음 한 번은 Codex 인증이 필요합니다.

```bash
codex auth login
```

`CODEX_CLI_PATH`를 사용 중이라면 아래처럼 실행해도 됩니다.

```bash
$CODEX_CLI_PATH auth login
```

## 5. 로컬 프로젝트 설치

```bash
npm install
```

의존성 재현성을 더 중시하면 `npm install` 대신 `npm ci`를 사용해도 됩니다.

## 6. 로컬 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 루트 경로가 `/resume`으로 이동합니다.

`codex`가 PATH에 없으면 같은 터미널 세션에서 아래처럼 실행하세요.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
npm run dev
```

## 7. 첫 사용 흐름

1. `/resume` 에서 이력서 텍스트를 붙여넣고 분석 후 폼을 수정한 뒤 확정합니다.
2. `/company` 에서 채용공고 텍스트를 붙여넣거나 `txt`, URL로 불러온 뒤 분석 후 폼을 수정하고 확정합니다.
3. `/result` 에서 자기소개를 생성하거나 다시 생성합니다.

추가 메모:

- 각 단계 입력 카드에서 `생각 깊이`를 선택할 수 있고, 높을수록 결과 생성 시간이 늘어날 수 있습니다.
- 화면에는 현재 단계, 작업 중 상태, AI 분석 로그, 이전 결과와 현재 결과 비교가 표시됩니다.
- `저장 전 확인`에 보이는 누락 항목을 누르면 해당 입력 위치로 바로 이동합니다.
- 소개글은 공고의 필수/우대 요건과 이력서의 프로젝트/성과 근거를 먼저 계산한 뒤 생성합니다.

## 8. 환경 변수

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

Docker 실행에서는 `CODEX_CLI_PATH`가 필요하지 않습니다. Codex CLI는 컨테이너 안에 포함됩니다.

## 9. API 구성

- `POST /api/resume`: `resume-to-json`
- `POST /api/resume/stream`: `resume-to-json` + SSE 로그
- `POST /api/company`: `company-to-json`
- `POST /api/company/stream`: `company-to-json` + SSE 로그
- `POST /api/intro`: `generate-intro`
- `POST /api/intro/stream`: `generate-intro` + SSE 로그

모든 API route는 `runtime = "nodejs"`로 고정되어 있습니다.

## 10. 주의사항

- 현재 공고 입력은 붙여넣기, `txt`, URL 불러오기를 지원합니다.
- URL 불러오기는 사이트 구조에 따라 정확도가 달라질 수 있습니다. 현재 처리 방식은 [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md)를 참고하세요.
- 로컬 단일 사용자 시나리오를 기준으로 설계되어 있습니다.
- 서버리스나 원격 배포용 문서는 아직 포함하지 않습니다.
- Docker 실행도 최초 1회 Codex 인증은 필요합니다.

## 11. 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

문제 해결 절차와 운영 체크리스트는 [운영 런북](./docs/OPS_RUNBOOK.md)을 참고하세요.
