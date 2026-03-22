# 운영 런북

- 문서 버전: v0.7
- 마지막 업데이트: 2026-03-17
- 기준 범위: 로컬 MVP 운영 점검, 장애 대응, 복구

## 1. 목적

로컬 환경에서 ResumeTailor를 운영할 때 필요한 점검, 장애 대응, 복구 절차를 정의합니다.

## 2. 운영 전제

- 최초 설치와 실행 방법은 [README](../README.md)를 기준으로 합니다.
- 운영 모드는 `Docker 실행` 또는 `로컬 실행` 중 하나를 사용합니다.
- Docker 실행은 `docker pull`/`docker run` 직접 실행 또는 저장소 clone 후 `docker compose` 실행 두 흐름을 모두 지원합니다.
- 두 방식 모두 Codex 인증이 필요합니다.
- 이 문서는 앱이 이미 실행 가능한 상태라는 전제에서, 실행 이후 점검과 복구 절차에 집중합니다.

## 3. 기준 문서

설치/실행 관련 상세 절차는 아래 문서를 기준으로 유지합니다.

- Docker 직접 실행, Docker 저장소 clone, 공개 이미지 pull, 포트 변경, 이미지 교체: [README](../README.md)
- 로컬 개발 실행: [README](../README.md)
- GitHub Actions와 Docker Hub publish 설정: [README](../README.md)

운영 런북에는 위 내용을 다시 복제하지 않고, 실행 이후 점검과 복구 절차만 유지합니다.

## 4. 일상 점검 체크리스트

### 4.1 공통

1. 앱 기본 접속 확인

- 브라우저에서 `/resume` 진입 확인
- 단계 이동이 `/resume -> /company -> /result -> /pdf` 흐름으로 동작하는지 확인

2. 핵심 플로우 점검

- `/resume`에서 이력서 분석/확정
- `/company`에서 공고 분석/확정
- `/result`에서 자기소개 생성
- `/pdf`에서 템플릿 선택, 색상 선택, 프로필 이미지/연락처/링크 수정, 실제 Typst 미리보기 확인, PDF 다운로드 확인
- `생각 깊이` 변경 후 로그와 결과 흐름이 유지되는지 확인
- `톤` 변경 후 소개글 생성이 정상 동작하는지 확인
- 각 단계에 마지막 저장/생성 시각이 표시되는지 확인
- 작업 중 중앙 모달의 스피너, 단계형 진행 상태, 하단 작업 기록 패널이 정상 표시되는지 확인

### 4.2 로컬 실행 점검

1. Codex 실행 및 인증 상태 확인

```bash
codex --version
codex login
```

2. 품질 점검

- 검증 명령은 [README](../README.md)의 `검증 명령` 섹션을 기준으로 실행합니다.
- 운영 중 이상이 의심되면 최소 `npm run test`까지는 다시 확인합니다.
- 로컬 실행에서 `/pdf` step 4 미리보기나 PDF 내보내기 오류가 나면 `typst --version`으로 Typst CLI가 잡히는지 먼저 확인합니다.

### 4.3 Docker 실행 점검

1. 컨테이너 상태 확인

직접 실행한 경우:

```bash
docker ps --filter name=resume-tailor-app
docker logs --tail 100 resume-tailor-app
```

`docker compose`를 쓰는 경우:

```bash
docker compose ps
docker compose logs --tail 100 app
```

2. Codex 로그인 상태 확인

직접 실행한 경우:

```bash
docker run --rm -it \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest \
  codex login status
```

`docker compose`를 쓰는 경우:

```bash
docker compose run --rm app codex login status
```

3. 이상이 의심되는 경우

- 먼저 [README](../README.md)의 절차에 따라 이미지를 다시 pull하고 컨테이너를 재실행합니다.
- Docker Hub 이미지만 사용하는 환경에서는 `npm run test`보다 앱 접속, 핵심 플로우, 로그 확인을 먼저 점검합니다.

## 5. 장애 대응 가이드

### A. `zsh: command not found: codex`

원인:

- PATH 미설정

조치:

```bash
/Applications/Codex.app/Contents/Resources/codex login
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
2. Docker에서는 실행 방식에 맞게 아래 명령으로 다시 로그인합니다.

`docker run` 직접 실행:

```bash
docker run --rm -it \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest \
  codex login --device-auth

docker run --rm -it \
  -v resume-tailor-codex:/root/.codex \
  qrqr/resume-tailor:latest \
  codex login status
```

`docker compose` 실행:

```bash
docker compose run --rm app codex login --device-auth
docker compose run --rm app codex login status
```

3. 로그인 후 [README](../README.md)의 절차에 따라 앱을 다시 실행합니다.

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
- 현재 OCR fallback은 macOS에서는 Vision, Docker/Linux에서는 Tesseract 기준

조치:

- Docker/Linux에서는 이미지 본문 감지 시 Tesseract OCR을 먼저 시도하고, 결과가 약하면 경고나 직접 붙여넣기 안내가 먼저 보일 수 있습니다.
- macOS 로컬 실행인지 확인합니다.
- 가능하면 공고 본문을 직접 붙여넣어 비교합니다.
- 이미지가 너무 흐리거나 작은 경우 붙여넣기 또는 `txt` 입력으로 우회합니다.

### H. `결과를 끝까지 받지 못했어요` 또는 `결과 형식을 확인하지 못했어요`가 표시된다

원인:

- AI 응답이 비었거나 중간에 끊김
- 스키마와 맞지 않는 결과가 생성됨

조치:

- 같은 단계의 `내용 정리` 또는 `소개글 만들기`를 다시 실행합니다.
- 같은 문제가 반복되면 입력 텍스트가 지나치게 짧지 않은지 확인합니다.
- `npm run test`로 stream 오류 회귀 테스트가 깨지지 않는지 확인합니다.

### I. `Typst가 설치되어 있지 않아 PDF를 만들 수 없어요`

원인:

- 로컬 실행 환경 PATH에 `typst`가 없음
- Docker 이미지를 새로 받지 않아 Typst 포함 이전 이미지가 실행 중

조치:

```bash
typst --version
```

- 로컬 실행이라면 Typst CLI 설치 후 앱을 다시 실행합니다.
- Docker 실행이라면 최신 이미지를 다시 pull하고 컨테이너를 재기동합니다.

### J. `/pdf`에서 실제 Typst 미리보기가 보이지 않고 fallback만 보인다

원인:

- `typst` CLI 실행 실패
- preview API 호출 실패
- 렌더 직전 수정이 너무 빠르게 반복되어 이전 요청이 취소됨

조치:

```bash
typst --version
```

- 먼저 Typst CLI가 설치되어 있는지 확인합니다.
- 브라우저 새로고침 후 `/pdf` step 4를 다시 엽니다.
- 최종 PDF 다운로드가 정상 동작하는지 먼저 확인합니다.
- fallback 안내가 계속 보이면 서버 로그 또는 브라우저 네트워크에서 `POST /api/pdf/preview` 응답을 확인합니다.

## 6. SSE 로그 점검 팁

resume 스트림 확인:

```bash
curl -N -sS -X POST http://localhost:3000/api/resume/stream \
  -H 'Content-Type: application/json' \
  -d '{"text":"샘플 이력서 텍스트"}'
```

포트를 바꿔 실행했다면 `3000` 대신 해당 포트를 사용합니다.

정상 패턴:

- `event: log` 여러 건
- `event: result` 1건
- `event: done` 1건

## 7. 브라우저 저장 상태와 초기화

로컬 상태는 브라우저 `LocalStorage`의 `resume-tailor.pipeline.v2` 키에 저장됩니다.

- 상태 초기화가 필요하면 브라우저 저장소에서 해당 키를 삭제합니다.
- 브라우저를 바꾸면 기존 상태가 자동으로 이어지지 않습니다.

## 8. 배포 관련 주의

현재 문서 범위는 로컬 MVP입니다.

- 서버리스나 원격 배포 시 Codex 인증과 세션 정책을 별도로 재설계해야 합니다.
- 공고 이미지 OCR fallback은 macOS Vision과 Linux Tesseract의 품질 차이를 고려해야 합니다.
