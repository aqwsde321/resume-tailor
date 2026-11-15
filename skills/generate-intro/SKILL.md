---
name: generate-intro
description: resume.json과 company.json으로 회사 맞춤 자기소개를 생성하는 스킬
---

# generate-intro

## 목적
`output/resume.json`과 `output/company.json`을 읽어
회사 맞춤 한줄 소개(oneLineIntro), 짧은 소개(shortIntro), 긴 소개(longIntro), 지원 근거(fitReasons, matchedSkills, gapNotes, missingButRelevant)를 생성하고
`output/intro.json`으로 저장한다.

---

## 트리거
- `generate-intro`
- `자기소개 생성해줘`
- `intro 만들어줘`

---

## 전제 조건
아래 두 파일이 모두 존재해야 한다.
없으면 해당 Skill을 먼저 실행하도록 안내하고 중단한다.

- `output/resume.json` → 없으면: `resume-to-json` 먼저 실행
- `output/company.json` → 없으면: `company-to-json` 먼저 실행

---

## 실행

`output/resume.json`과 `output/company.json`을 읽고
아래 가이드라인에 따라 자기소개를 생성해 `output/intro.json`으로 저장한다.

입력에 `[분석 힌트]` 섹션이 함께 주어지면, 그 안의 `requirementMatches`, `preferredMatches`, `matchedSkills`, `gapCandidates`를 우선 참고한다.
다만 힌트와 원본 JSON이 충돌하면 원본 JSON만 신뢰한다.

입력에 `[핵심 요건]` 섹션이 함께 주어지면, 그 안의 상위 항목을 이번 소개글에서 가장 먼저 반영할 요건으로 사용한다.
특히 `최우선 필수 요건`은 `shortIntro`와 `longIntro` 본문에 직접 드러나게 작성한다.

입력에 `[작성 앵커]` 섹션이 함께 주어지면, 각 항목의 `필수 요건/우대 조건 -> 내 근거 -> 작성 방식`을 실제 소개글 문장에 반영한다.
특히 필수 요건은 소개글 본문에 최소 1개 이상 직접 녹이고, 우대 조건은 직접 근거가 있을 때만 자연스럽게 덧붙인다.

입력에 `[톤 가이드]` 섹션이 함께 주어지면, 그 지시를 현재 생성의 최우선 톤 기준으로 사용한다.
기본 문체는 지원서에 맞는 전문적이고 자연스러운 비즈니스 톤으로 유지하되, `[톤 가이드]`가 있으면 세부 말투와 강조 방향은 그 지시를 따른다.

**우선순위와 예외:**
- 규칙 충돌 시 사실성 > 근거 연결 > 구성 > 분량 > 톤 순으로 따른다. 출력 스키마는 유지한다.
- 직접 근거가 없는 필수 요건을 보유 역량으로 표현하지 않는다. 해당 항목은 허용된 gapCandidates 범위에서 gapNotes로만 기록한다.
- 핵심 요건 반영과 아래 분량·문장 구성은 연결 가능한 근거가 있을 때의 목표다. 근거가 부족하면 최소 분량과 문장 수보다 짧게 작성하고 일반론으로 채우지 않는다.
- careerYears가 0이고 경력 연차가 원문에서 확인되지 않으면 연차를 생략한다. 0만으로 신입 또는 0년 경력이라고 단정하지 않는다.
- 톤은 표현 방식만 바꾸며 숙련도, 역할, 성과의 강도를 높이지 않는다.

**가이드라인:**
- `oneLineIntro`: 25~45자, 지원 직무와 핵심 강점 중심
- `shortIntro`: 120~220자, 2~4문장 한국어
  - 1문장: 직무·경력 연차 요약
  - 2문장: `[핵심 요건]`의 최우선 필수 요건 1개와 내 프로젝트·성과·강점을 직접 연결
  - 3문장(선택): `company.json`의 requirements 또는 preferredSkills와 `[작성 앵커]`의 근거를 자연스럽게 포함
  - 4문장(선택): 기여 기대 또는 마무리
- `longIntro`: 450~700자, 5~8문장 한국어
  - 첫 1~2문장: 직무, 경력 연차, 핵심 강점 요약
  - 중간 2~4문장: 대표 프로젝트, 성과, 협업 방식, 문제 해결 경험을 `[핵심 요건]`의 상위 필수 요건 2개까지와 직접 연결
  - 후반 1~2문장: `company.json`의 preferredSkills 또는 추가 requirements와 맞닿는 근거를 구체적으로 설명
  - 마지막 1문장(선택): 입사 후 기여 방향 또는 마무리
  - `shortIntro`를 단순히 늘이지 말고, 근거와 맥락을 추가해 정보량 차이가 분명해야 한다
  - 문장 구조는 가능하면 `공고 요건 -> 내 경험/성과/강점 -> 입사 후 기여` 흐름을 따른다
- `fitReasons`: 0~4개 문자열 배열
  - 왜 이 이력서가 공고와 맞는지 구체적 근거를 문장으로 작성
  - 지원자에 대한 주장은 `resume.json`에서, 회사와 요구사항에 대한 주장은 `company.json`에서 확인하고 두 자료의 연결 이유를 설명
  - 첫 항목은 가능하면 `[핵심 요건]`의 최우선 필수 요건을 기준으로 작성
  - 가능하면 `[분석 힌트]`의 `requirementMatches`, `preferredMatches`에 있는 근거 문장을 재조합해 사용
  - 일반론 금지, 요구사항/프로젝트/기술스택 연결 중심
- `matchedSkills`: 0~6개 문자열 배열
  - 공고와 이력서에서 직접 겹치는 기술/역량만 추출
  - `[분석 힌트]`의 `matchedSkills` 범위를 넘기지 않는다
  - 하나만 겹치면 하나만 반환하고, 없으면 빈 배열
- `gapNotes`: 0~3개 문자열 배열
  - 공고 요구사항 중 이력서에서 직접 근거가 약한 항목만 작성
  - `[분석 힌트]`의 `gapCandidates`에 없는 항목은 추가하지 않는다
  - 억지로 채우지 말고 없으면 빈 배열
- `missingButRelevant`: 0~3개 문자열 배열
  - 이력서 근거는 있지만 소개글 본문에 아직 직접 드러나지 않은 필수/우대 요건만 작성
  - `[작성 앵커]`에 있는 항목만 사용하고, `gapNotes`처럼 부족한 점이 아니라 보강하면 좋은 포인트로 작성
  - 예: `우대 조건 'Next.js 경험'은 Admin Console 프로젝트 근거를 써서 한 문장 더 보강할 수 있습니다.`
- 과장 금지, resume.json의 사실 기반으로만 작성
- `fitReasons`, `matchedSkills`, `gapNotes`, `missingButRelevant`도 모두 사실 기반으로만 작성
- 기본은 전문적이고 자연스러운 비즈니스 톤으로 작성한다.
- `[톤 가이드]`가 있으면 oneLineIntro, shortIntro, longIntro 전체에 그 톤을 일관되게 반영한다.
- 설명문·주석 없이 유효한 JSON만 출력

**스키마:**
```json
{
  "oneLineIntro": "",
  "shortIntro": "",
  "longIntro": "",
  "fitReasons": [],
  "matchedSkills": [],
  "gapNotes": [],
  "missingButRelevant": []
}
```

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| `resume.json` 없음 | `resume-to-json` 먼저 실행 안내 후 중단 |
| `company.json` 없음 | `company-to-json` 먼저 실행 안내 후 중단 |
| JSON 파싱 실패 | 1회 재시도, 실패 시 raw 출력 후 수동 수정 요청 |

---

## 폴더 구조

```
generate-intro/
├── SKILL.md
└── output/
    ├── resume.json     ← resume-to-json 결과 (읽기 전용)
    ├── company.json    ← company-to-json 결과 (읽기 전용)
    └── intro.json      ← 생성 결과 (최종 출력)
```

---

## 사용법

```
generate-intro
```

> **일반적인 실행 순서:**
> 1. `resume-to-json` — 이력서 바뀔 때만
> 2. `company-to-json` — 지원 회사 바뀔 때마다
> 3. `generate-intro` — 매번 실행

> **재생성이 필요하면:** company.json만 수정 후 `generate-intro` 단독 재실행.

## 경계 사례

- 입력: 이력서는 Docker 운영만 확인되고 공고는 AWS 운영을 요구한다. 결과: AWS 운영 경험을 본문이나 matchedSkills에 넣지 않는다. AWS가 gapCandidates에 있으면 gapNotes에 확인되지 않는다고 기록한다.
- 입력: 공고와 이력서에 공통 기술이 React 하나뿐이다. 결과: `matchedSkills`는 `["React"]`다. 최소 개수를 맞추려고 다른 기술을 추가하지 않는다.
- 입력: 경력 연차는 불명이고 프로젝트 설명 한 문장만 있다. 결과: 연차를 생략하고 확인된 프로젝트만 짧게 설명한다. 분량을 채우려고 협업·성과를 만들어내지 않는다.
