# AI 실행 설정

설정 화면에서 **Codex / Claude Code → 모델 → Reasoning effort(Codex) / Effort(Claude Code)**를 고른다. 선택은 작업 공간과 함께 로컬 저장되고 이력서·공고 정리, 댓글 반영, 경험 보완, 회사별 맞춤 생성, 소개글 생성에 공통 적용된다.

## 모델 목록

- Codex: `CODEX_HOME/models_cache.json` 또는 `~/.codex/models_cache.json`의 `visibility: list` 모델만 표시한다. 자격 증명이나 모델 외 설정은 응답에 포함하지 않는다. 캐시가 없으면 ‘Codex 기본 모델’을 표시한다. Codex에서 목록을 갱신한 뒤 설정 화면을 다시 열면 반영된다.
- Claude Code: 기본 모델 및 `sonnet`, `opus`, `haiku`, `fable` 별칭을 표시한다. 별칭의 실제 버전과 사용 권한은 CLI·계정·연결 제공자가 결정한다. [공식 모델 설정 문서](https://code.claude.com/docs/en/model-config).
- 기존에 직접 지정한 모델은 ‘기존 선택’ 옵션으로 보존한다. 제공자를 바꾸면 다른 제공자의 모델 ID가 전달되지 않도록 기본 모델과 ‘모델 기본값’ effort로 초기화한다. 모델만 바꾸는 경우에도 이전 모델의 effort를 새 모델에 강제로 전달하지 않는다.
- 목록 표시는 로그인·이용 권한 검증이 아니다. 실행 오류를 통해 설치·인증·권한 문제를 구분한다.

## 모델별 Reasoning effort

Codex는 모델 캐시의 `supported_reasoning_levels`와 `default_reasoning_level`을 함께 읽는다. 모든 모델에 공통 목록이나 `medium` 기본값을 강제하지 않는다. 선택 모델의 지원 범위에 따라 `low`, `medium`, `high`, `xhigh`, `max`, `ultra` 등을 표시하고 ‘모델 기본값’ 옆에 캐시에 기록된 기본 단계를 보여 준다.

‘모델 기본값’은 빈 값으로 저장하고 실행 요청에서 effort 옵션을 생략해 CLI의 해당 모델 기본 설정을 사용한다. CLI 사용자 설정에 별도의 override가 있다면 그 설정이 적용될 수 있으며, 화면의 기본 단계는 모델 캐시 기준이다.

기존에 직접 고른 유효한 effort는 유지한다. 모델 지원 범위에서 벗어난 기존 값은 경고와 함께 표시하며 서버에서도 실행 전에 차단한다. 지원 정보가 없는 모델은 목록을 추측하지 않고 기본값과 기존 설정을 표시한다.

설치된 Codex SDK의 타입 정의는 `xhigh`까지만 선언하지만 런타임은 값을 그대로 CLI의 `model_reasoning_effort` 설정으로 전달한다. `max`·`ultra`도 앱 스키마에서 검증하고 모델 캐시와 대조한 뒤 해당 경로로 전달한다. 테스트는 SDK 전달 인자를 검증하며, 각 단계의 실제 유료 분석을 모두 실행하는 것은 아니다.

Claude의 명시적 단계는 기존 CLI 대응 범위를 유지하고 ‘모델 기본값’ 선택을 제공한다. `ultra`를 Claude로 전달하지 않도록 실행 전에 차단한다. 별칭별 지원 여부와 실제 적용은 Claude CLI가 최종 검증한다.

## 실행 환경

Codex는 기존 `@openai/codex-sdk` 경로를 사용한다. `CODEX_CLI_PATH`로 실행 파일을 지정할 수 있다.

Claude Code는 설치된 `claude` CLI를 사용한다. `CLAUDE_CLI_PATH`로 실행 파일을 지정할 수 있다. Claude Code 인증이 필요한 환경에서는 터미널의 `claude auth login`으로 로그인한다. 웹 화면에서 API 키나 토큰을 입력받거나 Git에 저장하지 않는다. Docker 이미지는 Claude CLI를 자동 설치하지 않으므로 해당 실행 환경에 별도로 준비해야 한다.

Claude 호출은 다음과 같이 처리한다.

- `--print --output-format json --json-schema ...`로 구조화 JSON을 받아 기존 API의 스키마 검사로 검증한다.
- 원문은 shell/명령행 인자가 아닌 stdin으로 전달한다. 이력서와 공고의 입력 데이터 경계는 기존 프롬프트를 유지한다.
- 임시 작업 디렉터리, `--safe-mode`, 도구 비활성화, 빈 MCP 구성, 세션 저장 비활성화를 사용한다. 로그인 정보를 사용하기 위해 `--bare`는 사용하지 않는다.
- CLI 오류 원문은 비공개 입력을 포함할 수 있어 그대로 응답하지 않는다. 설치·인증·실행·JSON 오류를 구분해 안내한다.
- 3분 제한, 출력 크기 제한, 취소 시 프로세스 종료를 적용한다. 기존 요청 직렬화도 유지한다.
- 스트림 API는 시작/완료 상태를 전송한다. Claude의 내부 토큰·사고 과정을 스트리밍하지 않는다.
- 기존 `minimal` 깊이는 Claude에서 `low`로 변환한다. 새 Claude 선택에서는 가볍게 단계를 표시하지 않는다.

CLI 구조화 출력은 [공식 비대화형 실행 문서](https://code.claude.com/docs/en/headless)를 기준으로 구현했다. 설치 CLI 버전에 따라 플래그 지원이 달라질 수 있다.

## 검증 범위

단위 테스트는 CLI 프로세스를 mock하여 제공자 분기, JSON 결과, 인증 오류, 취소를 확인한다. 자동 E2E는 모델 선택·제공자 전환·저장·새로고침·저장 실패 복구를 확인한다. 2026-11-15 합성 공고로 Claude Code(Haiku)의 실제 실행과 공고 JSON 스키마 검증을 확인했다. 개인 이력서를 Claude에 전송하는 검증과 수동 브라우저·시각 검증은 수행하지 않았다.
