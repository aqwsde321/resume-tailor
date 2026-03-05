---
name: resume-to-json
description: 이력서 텍스트를 구조화된 resume.json으로 변환하는 스킬
---

# resume-to-json

## 목적
`input/resume.txt`를 읽어 구조화된 `output/resume.json`으로 변환한다.
이력서가 바뀔 때만 단독 실행한다.

---

## 트리거
- `resume-to-json`
- `이력서 분석해줘`
- `resume json으로 변환해줘`

---

## 전제 조건
- `input/resume.txt` 파일이 존재해야 한다
- 없으면 사용자에게 안내하고 중단한다

---

## 실행

`input/resume.txt`를 읽고 아래 스키마에 맞는 JSON을 생성해
`output/resume.json`으로 저장한다.

**규칙:**
- 필드가 없으면 빈값(빈 문자열, 빈 배열, 숫자는 0)으로 채운다
- techStack, strengths, achievements는 중복 없이 핵심 키워드만
- careerYears는 정수
- 설명문·주석 없이 유효한 JSON만 출력

**스키마:**
```json
{
  "name": "",
  "summary": "",
  "desiredPosition": "",
  "careerYears": 0,
  "techStack": [],
  "experience": [
    {
      "company": "",
      "role": "",
      "period": "",
      "description": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "techStack": []
    }
  ],
  "achievements": [],
  "strengths": []
}
```

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| `input/resume.txt` 없음 | 파일 경로 안내 후 중단 |
| JSON 파싱 실패 | 1회 재시도, 실패 시 raw 출력 후 수동 수정 요청 |

---

## 폴더 구조

```
resume-to-json/
├── SKILL.md
├── input/
│   └── resume.txt    ← 사용자 작성
└── output/
    └── resume.json   ← 생성 결과
```

---

## 사용법

```
resume-to-json
```

> 완료 후 `output/resume.json`을 열어 내용 확인·수정 가능.
> 수정한 JSON은 `generate-intro` Skill의 입력으로 그대로 사용된다.
