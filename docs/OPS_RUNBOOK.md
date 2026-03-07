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
  - 붙여넣기 입력 확인
  - `txt` 업로드 확인
  - URL 불러오기 확인
- `/result`에서 intro 생성
- 작업 중 중앙 모달이 뜨고 뒤 화면이 눌리는지 확인
- 완료 후 하단 작업 기록 패널에 `log -> result -> done` 흐름이 남는지 확인

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

### E. `URL 불러오기`가 현재 공고 대신 주변 문구를 읽는다
원인:
- 사이트가 상세 본문을 iframe, ajax, 숨겨진 JSON으로 별도 로드
- 추천공고/푸터 문구가 generic selector에 섞임

조치:
- 먼저 최신 코드인지 확인
- [채용공고 불러오기 가이드](/Users/jino/study/project/resumeMake/docs/COMPANY_FETCH_GUIDE.md)에서 사이트별 처리 방식을 확인
- 실제 추출 결과에 `추천공고`, `취업 전략`, footer 문구가 섞였는지 확인
- 같은 URL을 `/company`의 `URL 불러오기`로 다시 실행해 본문이 textarea에 어떻게 들어오는지 확인

### F. 이미지 기반 상세 공고가 약하게 읽힌다
원인:
- 상세 본문이 이미지이거나 OCR 품질이 낮음
- 현재 OCR fallback은 macOS Vision 기준

조치:
- macOS 로컬 실행인지 확인
- 가능하면 공고 본문을 직접 붙여넣어 비교
- 이미지가 너무 흐리거나 작은 경우 붙여넣기 또는 `txt` 입력으로 우회

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
- 공고 이미지 OCR fallback도 현재는 macOS 로컬 실행 기준이다.
