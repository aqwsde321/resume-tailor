---
name: company-to-json
description: 채용공고 텍스트를 구조화된 company.json으로 변환하는 스킬
---

# company-to-json

## 목적
`input/company.txt`를 읽어 구조화된 `output/company.json`으로 변환한다.
지원 회사가 바뀔 때마다 단독 실행한다.

---

## 트리거
- `company-to-json`
- `채용공고 분석해줘`
- `company json으로 변환해줘`

---

## 전제 조건
- `input/company.txt` 파일이 존재해야 한다
- 없으면 사용자에게 안내하고 중단한다

---

## 실행

`input/company.txt`를 읽고 아래 스키마에 맞는 JSON을 생성해
`output/company.json`으로 저장한다.

**규칙:**
- requirements는 채용공고에서 "필수" 기술·역량 키워드만 넣고, 복지·문화·지원 안내 문구는 제외
- preferredSkills는 "우대" 기술·경험 목록만 넣고, 혜택 문구와 중복 항목은 제거
- techStack은 기술명만 짧게 분리하고, 쉼표/줄바꿈/슬래시로 붙은 항목은 나눠서 배열로 넣기
- jobDescription은 핵심 업무와 책임 범위를 요약하되, 서로 다른 주요 업무는 각각 한 문장으로 보존하고 최대 5개 업무까지만 정리
- 원문에 업무가 적으면 적은 만큼만 작성하고 없는 내용을 보태지 않으며, 여러 업무를 추상적인 한 문장으로 합치지 않기
- 같은 내용의 반복과 추천공고/지원방법/footer 문구는 제외
- 업무 설명을 지나치게 압축하지 말고, 원문에 있는 시스템·운영·성능 개선·협업 책임의 차이를 유지
- companyDescription은 회사 성격·목표만 간략화하고 채용 사이트 안내문은 제외
- 같은 의미의 bullet이 반복되면 1개만 남기기
- 설명문·주석 없이 유효한 JSON만 출력

**스키마:**
```json
{
  "companyName": "",
  "companyDescription": "",
  "jobTitle": "",
  "jobDescription": "",
  "requirements": [],
  "preferredSkills": [],
  "techStack": []
}
```

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| `input/company.txt` 없음 | 파일 경로 안내 후 중단 |
| JSON 파싱 실패 | 1회 재시도, 실패 시 raw 출력 후 수동 수정 요청 |

---

## 폴더 구조

```
company-to-json/
├── SKILL.md
├── input/
│   └── company.txt    ← 사용자 작성 (지원할 때마다 교체)
└── output/
    └── company.json   ← 생성 결과
```

---

## 사용법

```
company-to-json
```

> 완료 후 `output/company.json`을 열어 내용 확인·수정 가능.
> 특히 requirements, preferredSkills 필드를 꼼꼼히 검토할 것.
> 수정한 JSON은 `generate-intro` Skill의 입력으로 그대로 사용된다.
