# 운영 런북

- 문서 버전: v0.4
- 마지막 업데이트: 2026-03-07
- 기준 범위: 로컬 MVP 운영 및 복구

## 1. 목적

로컬 환경에서 ResumeMake를 안정적으로 실행하고 복구하기 위한 절차를 정의합니다.

## 2. 운영 전제

- 최초 설치와 실행 방법은 [README](../README.md)를 기준으로 합니다.
- 운영 모드는 `Docker 실행` 또는 `로컬 실행` 중 하나를 사용합니다.
- 두 방식 모두 Codex 인증이 필요합니다.

## 3. 실행 모드별 기본 절차

### 3.1 Docker 실행

최초 1회:

```bash
docker compose pull
docker compose run --rm app codex login --device-auth
docker compose up -d
```

포트를 바꾸고 싶으면 실행할 때만 아래처럼 지정합니다. 지정하지 않으면 기본값은 `3000`입니다.

```bash
APP_PORT=3100 docker compose up -d
```

일상 운영:

```bash
docker compose pull
docker compose up -d
docker compose logs -f app
docker compose down
```

메모:

- 일반 사용자 기준으로 `docker compose build`는 필요하지 않습니다.
- 인증 정보는 `codex-home` volume에 저장됩니다.
- Docker 로그인 전에 ChatGPT 설정 `보안`에서 `Codex용 장치 코드 인증 활성화`가 켜져 있는지 확인합니다.
- 최신 공개 이미지를 반영하려면 `docker compose pull` 후 `docker compose up -d`를 실행합니다.
- 인증 정보까지 초기화하려면 `docker compose down -v`를 사용합니다.
- 개발자가 현재 소스를 직접 이미지로 검증하려면 `docker build -t resume-tailor:local .` 후 `RESUME_MAKE_IMAGE=resume-tailor:local docker compose up -d`를 사용합니다.

### 3.2 로컬 실행

```bash
npm install
codex auth login
npm run dev
```

`codex`가 PATH에 없으면 `CODEX_CLI_PATH`를 설정합니다.

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
npm run dev
```

브라우저 접속:

- 기본: [http://localhost:3000](http://localhost:3000)
- 포트를 바꿨다면 `http://localhost:<APP_PORT>`

## 4. 일상 점검 체크리스트

1. Codex 실행 및 인증 상태 확인

```bash
codex --version
codex auth login
```

2. 앱 기본 접속 확인

- 브라우저에서 `/resume` 진입 확인
- 단계 이동이 `/resume -> /company -> /result` 흐름으로 동작하는지 확인

3. 핵심 플로우 점검

- `/resume`에서 이력서 분석/확정
- `/company`에서 공고 분석/확정
- `/result`에서 자기소개 생성
- `생각 깊이` 변경 후 로그와 결과 흐름이 유지되는지 확인
- `톤` 변경 후 소개글 생성이 정상 동작하는지 확인
- 각 단계에 마지막 저장/생성 시각이 표시되는지 확인
- 작업 중 중앙 모달의 스피너, 단계형 진행 상태, 하단 작업 기록 패널이 정상 표시되는지 확인

4. 품질 점검

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 5. 장애 대응 가이드

### A. `zsh: command not found: codex`

원인:

- PATH 미설정

조치:

```bash
/Applications/Codex.app/Contents/Resources/codex auth login
echo 'export PATH="/Applications/Codex.app/Contents/Resources:$PATH"' >> ~/.zshrc
source ~/.zshrc
hash -r
```

### B. `Codex 인증이 필요합니다`

원인:

- 로그인 세션 만료 또는 미인증

조치:

```bash
codex login
# dev 서버 재시작
```

### C. `Unable to locate Codex CLI binaries`

원인:

- SDK가 내부 바이너리 탐색에 실패

조치:

```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
npm run dev
```

### D. Docker 로그인 중 `localhost에서 연결을 거부했습니다`

원인:

- 컨테이너 안 로그인에서 브라우저 리다이렉트 콜백 포트를 직접 받지 못함
- 장치 코드 인증이 비활성화되어 있음

조치:

1. ChatGPT 설정 `보안`에서 `Codex용 장치 코드 인증 활성화`를 켭니다.
2. Docker에서는 아래 명령으로 다시 로그인합니다.

```bash
docker compose run --rm app codex login --device-auth
docker compose run --rm app codex login status
```

3. 로그인 후 앱을 다시 실행합니다.

```bash
docker compose up -d
```

### E. `Unable to acquire lock ... .next/dev/lock`

원인:

- 이미 실행 중인 `next dev` 프로세스 존재

조치:

```bash
lsof -iTCP -sTCP:LISTEN -nP | rg node
# 기존 dev 프로세스 종료 후 재실행
```

### F. `URL 불러오기`가 현재 공고 대신 주변 문구를 읽는다

원인:

- 사이트가 상세 본문을 iframe, ajax, 숨겨진 JSON으로 별도 로드
- 추천공고나 푸터 문구가 generic selector에 섞임

조치:

- 먼저 최신 코드인지 확인합니다.
- [채용공고 불러오기 가이드](./COMPANY_FETCH_GUIDE.md)에서 사이트별 처리 방식을 확인합니다.
- 실제 추출 결과에 `추천공고`, `취업 전략`, footer 문구가 섞였는지 확인합니다.
- 같은 URL을 `/company`의 `URL 불러오기`로 다시 실행해 textarea에 어떤 본문이 들어오는지 확인합니다.

### G. 이미지 기반 상세 공고가 약하게 읽힌다

원인:

- 상세 본문이 이미지이거나 OCR 품질이 낮음
- 현재 OCR fallback은 macOS Vision 기준

조치:

- macOS 로컬 실행인지 확인합니다.
- 가능하면 공고 본문을 직접 붙여넣어 비교합니다.
- 이미지가 너무 흐리거나 작은 경우 붙여넣기 또는 `txt` 입력으로 우회합니다.

### H. `결과를 끝까지 받지 못했어요` 또는 `결과 형식을 확인하지 못했어요`가 표시된다

원인:

- AI 응답이 비었거나 중간에 끊김
- 스키마와 맞지 않는 결과가 생성됨

조치:

- 같은 단계의 `내용 정리` 또는 `소개글 만들기`를 한 번 더 실행합니다.
- 같은 문제가 반복되면 입력 텍스트가 지나치게 짧지 않은지 확인합니다.
- `npm run test`로 stream 오류 회귀 테스트가 깨지지 않는지 확인합니다.

## 6. SSE 로그 점검 팁

resume 스트림 확인:

```bash
curl -N -sS -X POST http://localhost:3000/api/resume/stream \
  -H 'Content-Type: application/json' \
  -d '{"text":"샘플 이력서 텍스트"}'
```

정상 패턴:

- `event: log` 여러 건
- `event: result` 1건
- `event: done` 1건

## 7. 브라우저 저장 상태와 초기화

로컬 상태는 브라우저 `LocalStorage`의 `resume-make.pipeline.v2` 키에 저장됩니다.

- 상태 초기화가 필요하면 브라우저 저장소에서 해당 키를 삭제합니다.
- 브라우저를 바꾸면 기존 상태가 자동으로 이어지지 않습니다.

## 8. 배포 관련 주의

현재 문서 범위는 로컬 MVP입니다.

- 서버리스나 원격 배포 시 Codex 인증과 세션 정책을 별도로 재설계해야 합니다.
- 공고 이미지 OCR fallback도 현재는 macOS 로컬 실행 기준입니다.

## 9. GitHub Actions와 Docker Hub publish

`main` 브랜치에 push되면 `.github/workflows/docker-publish.yml`이 실행됩니다.

동작 순서:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. Docker Hub에 `latest`, `sha-<commit>` 태그 push

필수 GitHub 설정:

- Repository secret `DOCKERHUB_TOKEN`
- Repository variable `DOCKER_USERNAME`
  - 비우면 워크플로 기본값 `aqwsde321` 사용
- Repository variable `DOCKERHUB_IMAGE`
  - 비우면 워크플로 기본값 `aqwsde321/resume-tailor` 사용

사용자 배포 흐름:

- 사용자는 저장소를 받은 뒤 `docker compose pull`로 공개 이미지를 받습니다.
- 최초 1회만 `docker compose run --rm app codex login --device-auth`로 Codex 인증을 합니다.
- 이후에는 `docker compose up -d`로 실행하고, 업데이트가 필요할 때만 다시 `docker compose pull`을 실행합니다.
