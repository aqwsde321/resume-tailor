# 운영 런북 (Local MVP)

## 1) 목적

로컬 환경에서 ResumeMake를 안정적으로 실행/복구하기 위한 절차를 정의한다.

## 2) 필수 전제

- Node.js 20+
- Codex 앱 또는 Codex CLI 설치 완료
- Codex 인증 완료 상태

## 3) 초기 실행 절차

```bash
git clone <repo-url>
cd resumeMake
npm install
codex auth login
npm run dev
```

브라우저 접속:
- [http://localhost:3000](http://localhost:3000)

## 4) 환경 변수

필수/권장 변수:
- `CODEX_CLI_PATH` (권장)
  - 예: `/Applications/Codex.app/Contents/Resources/codex`
- `CODEX_SKILLS_DIR` (선택)
  - 기본: `~/.codex/skills`

예시:
```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
export CODEX_SKILLS_DIR="$HOME/.codex/skills"
```

## 5) 일상 점검 체크리스트

1. 인증 상태 확인
```bash
codex --version
codex auth login
```

2. 품질 점검
```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

3. 플로우 점검
- `/resume`에서 resume 분석/확정
- `/company`에서 company 분석/확정
- `/result`에서 intro 생성
- 로그 패널에 `log -> result -> done` 이벤트가 보이는지 확인

## 6) 장애 대응 가이드

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
- 로그인 세션 만료/미인증

조치:
```bash
codex auth login
# dev 서버 재시작
```

### C. `Unable to locate Codex CLI binaries`
원인:
- SDK가 내부 바이너리 탐색 실패

조치:
```bash
export CODEX_CLI_PATH=/Applications/Codex.app/Contents/Resources/codex
npm run dev
```

### D. `Unable to acquire lock ... .next/dev/lock`
원인:
- 이미 실행 중인 `next dev` 프로세스 존재

조치:
```bash
lsof -iTCP -sTCP:LISTEN -nP | rg node
# 기존 dev 프로세스 종료 후 재실행
```

## 7) SSE 로그 점검 팁

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

## 8) 백업/복구 메모

로컬 상태는 브라우저 LocalStorage(`resume-make.pipeline.v2`)에 저장된다.
- 상태 초기화가 필요하면 브라우저 저장소에서 해당 키 삭제

## 9) 배포 관련 주의

현재 문서 범위는 로컬 MVP다.
- 서버리스/원격 배포 시 Codex 인증/세션 정책을 별도로 재설계해야 한다.
