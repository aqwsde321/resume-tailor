# ResumeTailor (Local MVP)

로컬에서 이력서와 채용공고 텍스트를 `@openai/codex-sdk`와 로컬 `SKILL.md` 파이프라인으로 구조화하고, 원본 근거를 확인할 수 있는 회사 맞춤 이력서와 자기소개를 PDF로 만드는 Next.js 앱입니다.

## 사용 흐름

- **내 이력서** (`/workspace/resume`): PDF·스캔 PDF·이미지·URL·텍스트·Markdown 등록 → 추출 문서에 드래그 댓글 또는 직접 수정 → 댓글 일괄 반영·변경 수락 → 공통 이력서 확정
- **회사별 이력서** (`/workspace/companies`): 공고별 작업 생성 → 공고 원문 검토·확정 → 맞춤 표현별 선택 적용 → 회사별 편집·버전 보관 → PDF/Markdown 다운로드
- **설정** (`/workspace/settings`): 기본 모델 또는 모델 ID 직접 지정, 생각 깊이, 원본 파일을 포함한 백업·복원, 이전 브라우저 자료 가져오기

소개글은 선택 사항입니다. 생성하지 않아도 회사별 맞춤 이력서를 편집하고 PDF를 출력할 수 있습니다. 부족한 경험은 AI 질문에 답하며 초안을 모아 검토 후 반영합니다.

원본 자료와 검토 문서·댓글·회사별 버전은 Git에서 제외한 `private-data/workspace/`에 저장합니다. 자동 저장 상태를 확인한 후 앱을 종료하세요. 다른 탭에서 같은 자료를 수정하면 충돌을 알리고 덮어쓰지 않습니다.

## 1. 빠른 시작

이 프로젝트는 세 가지 방식으로 실행할 수 있습니다.

- Docker Hub 이미지로 실행
- 저장소를 clone해서 `docker compose`로 실행
- 로컬 개발 실행: 개발자가 Node.js와 Codex CLI를 직접 설치해서 실행

### 1.1 Docker Hub 이미지로 바로 실행

기본 이미지는 `qrqr/resume-tailor:latest`입니다.

필요:

- Docker Desktop 또는 Docker Engine
- Codex 로그인 가능한 계정
- ChatGPT 설정 `보안`에서 `Codex용 장치 코드 인증 활성화`

실행:

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

중지, 재시작, 정리:

```bash
docker stop resume-tailor-app
docker start resume-tailor-app
docker rm -f resume-tailor-app
docker volume rm resume-tailor-codex
```

- `resume-tailor-codex` volume을 지우면 Codex 로그인 정보도 함께 삭제됩니다.

### 1.2 저장소를 clone해서 `docker compose`로 실행

반복 실행, 포트 관리, 커스텀 이미지 override가 필요하면 저장소를 clone한 뒤 `docker compose`로 실행합니다.

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

중지와 정리:

```bash
docker compose stop
docker compose down
docker compose down -v
```

- `docker compose down -v`를 실행하면 `codex-home` volume도 삭제되어 다시 로그인해야 합니다.

### 1.3 로컬 개발 실행

Docker를 쓰지 않고 직접 실행하려면 아래가 필요합니다.

- Node.js 20 이상
- npm
- Codex 앱 또는 Codex CLI
- Codex 로그인 가능한 계정
- `typst` CLI: `/pdf`의 실제 Typst 미리보기와 PDF 내보내기를 로컬에서 쓰려면 PATH에 있어야 합니다.
- `pdftotext` (Poppler): PDF 텍스트 검사용입니다. 설치하지 않아도 PDF 내보내기는 가능하지만 검사는 건너뜁니다.

Node.js는 LTS 설치를 권장합니다.

- 공식 다운로드: [https://nodejs.org/en/download](https://nodejs.org/en/download)
- Codex CLI 문서: [https://developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)

기본 실행 순서:

```bash
npm i -g @openai/codex
codex login
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속하면 루트 경로가 `/workspace/resume`으로 이동합니다.

<details>
<summary>macOS에서 Codex 앱 번들을 직접 쓰는 경우</summary>

macOS에서 Codex 앱 번들을 직접 쓸 때는 같은 터미널 세션에서 아래처럼 지정할 수 있습니다.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
$CODEX_CLI_PATH login
npm run dev
```

</details>

## 2. 첫 사용 흐름

1. 내 이력서에서 자료를 입력하고 **내용 추출**을 누릅니다. PDF는 Poppler로 읽고, 텍스트가 부족한 페이지는 OCR로 처리합니다. 로컬 macOS는 Vision, Linux는 한국어·영어 Tesseract를 사용합니다. 추출 실패·빈 페이지는 경고와 함께 원본 검토가 가능합니다.
2. 추출 문서에서 문장을 드래그하고 수정 댓글을 남깁니다. PDF·이미지는 원본 확인을 열어 사각형 영역에도 댓글을 달 수 있습니다. **수정 요청 반영**으로 제안을 받고, 변경을 선택해 수락합니다.
3. **검토한 내용으로 이력서 정리** 후 결과를 확인하고 **공통 이력서로 확정**합니다. AI 질문을 통해 빠진 경험도 모아 보완할 수 있습니다.
4. 회사별 이력서에서 공고를 입력·검토·확정합니다. 현재 편집본이나 선택한 공통 원본으로 맞춤 제안을 만들고 표현별로 적용합니다. 원본 변경이 기존 회사별 편집본을 자동으로 덮어쓰지 않습니다.
5. 소개글이 필요하면 선택해서 생성합니다. 버전을 보관하고 PDF/Markdown으로 내보냅니다. 생성 PDF도 로컬에 보관됩니다.
6. 설정에서 모델 ID와 생각 깊이를 지정하거나 Codex 기본 모델을 사용합니다. 백업은 원본과 PDF를 포함합니다. 현재 JSON 백업은 첨부자료 합계 100MB까지 지원하며 더 크면 저장 폴더를 직접 백업합니다.

파일은 20MB 이하, PDF는 40페이지 이하를 지원합니다. 로그인이나 접근 제한이 있는 URL은 읽지 못할 수 있으며, 사용자가 본문을 직접 입력할 수 있습니다. 공고 자동 검색이나 채용 사이트 API 키는 사용하지 않습니다.

이전 자료는 설정의 **이전 브라우저 자료 가져오기**에서 이전합니다. 이전 브라우저 자료는 삭제하지 않으며, **이전 지원 기록·PDF 확인** 링크로 기존 화면에 접근할 수 있습니다.

- 확정한 개편 설계: [작업 공간 개편](./docs/WORKSPACE_REDESIGN.md)
- URL 추출 제약: [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md)

## 3. 환경 변수

필수는 아니지만, 아래 변수를 사용하면 실행 환경을 조정할 수 있습니다.

- `CODEX_CLI_PATH`: `codex` 바이너리가 PATH에 없을 때 직접 경로 지정
- `CODEX_SKILLS_DIR`: 외부 스킬 디렉터리를 우선 탐색하고 싶을 때 지정
- `RESUME_TAILOR_IMAGE`: `docker compose` 실행 시 사용할 이미지 경로를 바꾸고 싶을 때 지정
- `APP_PORT`: `docker compose` 실행 시 앱 포트를 바꾸고 싶을 때 지정

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

## 4. 주의사항

- 로컬 단일 사용자 시나리오를 기준으로 설계되어 있습니다.
- 로컬 실행에서 `/pdf`의 실제 Typst 미리보기와 PDF 내보내기를 쓰려면 `typst` CLI가 필요합니다.
- 로컬에서 PDF 텍스트 검사를 쓰려면 macOS는 `brew install poppler`, Debian/Ubuntu는 `apt install poppler-utils`로 `pdftotext`를 설치하세요. Docker 이미지에는 포함되어 있습니다.
- 공고 URL 불러오기는 사이트 구조에 따라 정확도가 달라질 수 있습니다. 처리 방식은 [채용공고 불러오기 가이드](./docs/COMPANY_FETCH_GUIDE.md)를 참고하세요.
- 서버리스나 원격 배포용 문서는 아직 포함하지 않습니다.
- Docker 실행도 최초 1회 Codex 인증은 필요합니다.

## 5. 검증 명령

```bash
npm run lint
npm run typecheck
npm run test
npm run test:pdf-visual
npm run test:e2e
npm run build
```

- 실제 Typst SVG/PDF smoke test는 `tests/lib/pdf-build.test.ts`에 포함되어 있습니다.
- PDF 시각 회귀 baseline 검증은 `tests/lib/pdf-visual.test.ts`와 `npm run test:pdf-visual`로 실행할 수 있습니다.
- PDF 시각 회귀 검증은 `typst`와 `pdftoppm`이 둘 다 PATH에 있을 때만 실행됩니다.
- baseline을 의도적으로 갱신할 때는 `UPDATE_PDF_VISUAL_BASELINES=1 npm run test:pdf-visual`을 사용합니다.
- 시각 diff가 기준을 넘기면 비교용 PNG가 `output/pdf-visual/*.actual.png`에 저장됩니다.

## 6. 배포

`main` 브랜치에 push되면 GitHub Actions가 Docker Hub `qrqr/resume-tailor` 이미지를 자동으로 갱신합니다.

- 운영 점검과 장애 대응은 [운영 런북](./docs/OPS_RUNBOOK.md)을 참고하세요.

## 7. 문서

세부 문서와 역할 분리는 [문서 인덱스](./docs/README.md)를 참고하세요.
