# ResumeTailor (Local MVP)

로컬에서 이력서와 채용공고 텍스트를 입력하면 `@openai/codex-sdk`와 `SKILL.md` 파이프라인으로 구조화 JSON을 만들고, 회사 맞춤 자기소개를 생성하는 Next.js 앱입니다.

## 화면 미리보기

![ResumeTailor 주요 흐름](./docs/images/app-flow-overview.png)

이력서 정리, 공고 정리, 소개글 만들기 주요 화면을 실제 앱 기준으로 다시 캡처한 미리보기입니다.

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

1. [README](./README.md): 설치, 실행, 전체 사용 흐름
2. [프로젝트 구조](./docs/PROJECT_STRUCTURE.md): 폴더 구조와 실행 흐름
3. [서비스 기획서](./docs/SERVICE_PLAN.md): 기능 범위와 제품 기준
4. 필요 시 [운영 런북](./docs/OPS_RUNBOOK.md), [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md), [자기소개 품질 가이드](./docs/INTRO_QUALITY_GUIDE.md), [릴리즈 노트](./docs/RELEASE_NOTES.md), [다음 작업 로드맵](./docs/NEXT_STEPS.md) 확인

## 1. 빠른 시작

이 프로젝트는 두 가지 방식으로 실행할 수 있습니다.

- Docker 실행: 다른 사용자에게 공유할 때 권장
  - 바로 실행: 저장소 clone 없이 `docker pull`/`docker run`
  - 관리 편한 실행: 저장소 clone 후 `docker compose`
- 로컬 실행: 개발자가 Node.js와 Codex CLI를 직접 설치해서 실행합니다.

### 1.1 Docker Hub 이미지로 바로 실행

가장 간단한 실행 방식입니다. 기본 이미지는 `qrqr/resume-tailor:latest`입니다.

중요:

- Docker Desktop 또는 Docker Engine
- Codex 로그인 가능한 계정
- ChatGPT 설정 `보안`에서 `Codex용 장치 코드 인증 활성화`
- Docker에서는 브라우저 리다이렉트보다 `--device-auth` 사용 권장
- `/company`의 `URL 불러오기`는 동작하지만, 이미지 기반 상세 공고 OCR fallback은 macOS 로컬 실행 기준이라 Docker/Linux에서는 이미지 본문 추출이 약할 수 있습니다.

가장 빠른 실행:

```bash
docker pull qrqr/resume-tailor:latest
docker volume create resume-tailor-codex

docker run --rm -it \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest \
  codex login --device-auth

docker run -d \
  --name resume-tailor-app \
  -p 3000:3000 \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest
```

- 접속 주소: [http://localhost:3000](http://localhost:3000)
- 로그인 정보는 `resume-tailor-codex` Docker volume에 저장됩니다.

<details>
<summary>선택 사항: 이미지 갱신, 포트 변경, 로그 확인</summary>

이미지를 갱신할 때:

```bash
docker pull qrqr/resume-tailor:latest
docker rm -f resume-tailor-app

docker run -d \
  --name resume-tailor-app \
  -p 3000:3000 \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest
```

포트를 바꾸고 싶을 때:

```bash
docker rm -f resume-tailor-app

docker run -d \
  --name resume-tailor-app \
  -p 3100:3000 \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest
```

로그 보기와 중지는 아래처럼 합니다.

```bash
docker logs -f resume-tailor-app
docker rm -f resume-tailor-app
```

</details>

### 1.2 저장소를 clone해서 `docker compose`로 실행

반복 실행, 포트/볼륨 관리, 커스텀 이미지 override가 필요하면 저장소를 clone한 뒤 `docker compose`를 써도 됩니다.

```bash
git clone https://github.com/aqwsde321/resume-tailor.git
cd resume-tailor
docker compose pull
docker compose run --rm app codex login --device-auth
docker compose up -d
```

- 접속 주소: [http://localhost:3000](http://localhost:3000)
- 일반 사용자는 `docker compose build`가 필요 없습니다.
- Compose 방식에서는 로그인 정보가 `codex-home` Docker volume에 저장됩니다.

<details>
<summary>선택 사항: 이미지 갱신, 포트 변경, 이미지 override</summary>

이미지를 갱신할 때:

```bash
docker compose pull
docker compose up -d
```

포트를 바꾸고 싶을 때:

```bash
APP_PORT=3100 docker compose up -d
```

다른 이미지를 쓰고 싶을 때:

```bash
export RESUME_TAILOR_IMAGE=my-dockerhub-id/resume-tailor:latest
docker compose pull
docker compose up -d
```

</details>

<details>
<summary>개발자용: 로컬 이미지 빌드</summary>

```bash
docker build -t resume-tailor:local .
RESUME_TAILOR_IMAGE=resume-tailor:local docker compose up -d
```

</details>

추가 운영 명령과 장애 대응은 [운영 런북](./docs/OPS_RUNBOOK.md)을 참고하세요.

### 1.3 로컬 개발 실행

Docker를 쓰지 않고 직접 실행하려면 아래가 필요합니다.

- Node.js 20 이상
- npm
- Codex 앱 또는 Codex CLI
- Codex 로그인 가능한 계정

Node.js는 LTS 설치를 권장합니다.

- 공식 다운로드: [https://nodejs.org/en/download](https://nodejs.org/en/download)
- Codex CLI 문서: [https://developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)

기본 실행 순서:

```bash
npm i -g @openai/codex
codex auth login
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속하면 루트 경로가 `/resume`으로 이동합니다.

<details>
<summary>macOS에서 Codex 앱 번들을 직접 쓰는 경우</summary>

macOS에서 Codex 앱 번들을 직접 쓸 때는 같은 터미널 세션에서 아래처럼 지정할 수 있습니다.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
$CODEX_CLI_PATH auth login
npm run dev
```

</details>

## 2. 첫 사용 흐름

1. `/resume` 에서 이력서 텍스트를 붙여넣고 분석 후 폼을 수정한 뒤 확정합니다.
2. `/company` 에서 채용공고 텍스트를 붙여넣거나 `txt`, URL로 불러온 뒤 분석 후 폼을 수정하고 확정합니다.
3. `/result` 에서 자기소개를 생성하거나 다시 생성합니다.

추가 메모:

- 각 단계 입력 카드에서 `생각 깊이`를 선택할 수 있고, 높을수록 결과 생성 시간이 늘어날 수 있습니다.
- 화면에는 현재 단계, 작업 중 상태, AI 분석 로그, 이전 결과와 현재 결과 비교가 표시됩니다.
- `저장 전 확인`에 보이는 누락 항목을 누르면 해당 입력 위치로 바로 이동합니다.
- 소개글은 공고의 필수/우대 요건과 이력서의 프로젝트/성과 근거를 먼저 계산한 뒤 생성합니다.

## 3. 환경 변수

필수는 아니지만 아래 변수를 알면 실행이 쉬워집니다.

- `CODEX_CLI_PATH`: `codex` 바이너리가 PATH에 없을 때 직접 경로 지정
- `CODEX_SKILLS_DIR`: 외부 스킬 디렉터리를 우선 탐색하고 싶을 때 지정
- `RESUME_TAILOR_IMAGE`: `docker compose` 실행 시 사용할 이미지 경로를 바꾸고 싶을 때 지정

기본 스킬 탐색 순서:

1. `$CODEX_SKILLS_DIR/<skill>/SKILL.md`
2. `./skills/<skill>/SKILL.md`

예시:

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
export CODEX_SKILLS_DIR="$HOME/.codex/skills"
```

Docker 실행에서는 `CODEX_CLI_PATH`가 필요하지 않습니다. Codex CLI는 컨테이너 안에 포함됩니다.

기존 `RESUME_MAKE_IMAGE`도 Docker Compose fallback으로 잠시 지원하지만, 새 설정은 `RESUME_TAILOR_IMAGE`를 기준으로 사용합니다.

## 4. API 구성

- `POST /api/resume`: `resume-to-json`
- `POST /api/resume/stream`: `resume-to-json` + SSE 로그
- `POST /api/company`: `company-to-json`
- `POST /api/company/stream`: `company-to-json` + SSE 로그
- `POST /api/intro`: `generate-intro`
- `POST /api/intro/stream`: `generate-intro` + SSE 로그

모든 API route는 `runtime = "nodejs"`로 고정되어 있습니다.

## 5. 주의사항

- 현재 공고 입력은 붙여넣기, `txt`, URL 불러오기를 지원합니다.
- URL 불러오기는 사이트 구조에 따라 정확도가 달라질 수 있습니다. 현재 처리 방식은 [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md)를 참고하세요.
- 로컬 단일 사용자 시나리오를 기준으로 설계되어 있습니다.
- 서버리스나 원격 배포용 문서는 아직 포함하지 않습니다.
- Docker 실행도 최초 1회 Codex 인증은 필요합니다.

## 6. 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7. GitHub Actions와 Docker Hub publish

`main` 브랜치에 push되면 `.github/workflows/docker-publish.yml`이 아래 순서로 실행됩니다.

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. Docker Hub에 이미지 push

기본 publish 대상은 `qrqr/resume-tailor`이며, Docker Hub에는 아래 태그가 올라갑니다.

- `latest`
- `sha-<git commit sha>`

처음 설정할 때 필요한 GitHub Actions 값:

- Repository secret `DOCKERHUB_TOKEN`
- Repository variable `DOCKER_USERNAME`
  - 기본값은 `qrqr`라 필요하면만 override
- Repository variable `DOCKERHUB_IMAGE`
  - 기본값은 `qrqr/resume-tailor`이라 필요하면만 override

즉, Docker Hub 저장소와 토큰만 준비하면 사용자는 `docker pull` 또는 `docker compose pull`로 공개 이미지를 바로 받아 쓸 수 있습니다.

문제 해결 절차와 운영 체크리스트는 [운영 런북](./docs/OPS_RUNBOOK.md)을 참고하세요.
