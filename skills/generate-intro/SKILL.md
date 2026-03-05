---
name: generate-intro
description: resume.json과 company.json으로 회사 맞춤 자기소개를 생성하는 스킬
---

# generate-intro

## 목적
`output/resume.json`과 `output/company.json`을 읽어
회사 맞춤 한줄 소개(oneLineIntro)와 자기소개(shortIntro)를 생성하고
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

**가이드라인:**
- `oneLineIntro`: 30~40자, 지원 직무와 핵심 강점 중심
- `shortIntro`: 3~5문장 한국어
  - 1문장: 직무·경력 연차 요약
  - 2문장: 핵심 프로젝트·성과 연결
  - 3문장: `company.json`의 requirements와 `resume.json`의 techStack 교집합을 자연스럽게 포함
  - 4문장(선택): 기여 기대 또는 마무리
- 과장 금지, resume.json의 사실 기반으로만 작성
- 전문적·간결한 톤
- 설명문·주석 없이 유효한 JSON만 출력

**스키마:**
```json
{
  "oneLineIntro": "",
  "shortIntro": ""
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
