# 문서 인덱스

- 문서 버전: v0.6
- 마지막 업데이트: 2026-03-17
- 기준 범위: 현재 로컬 MVP 문서 세트

ResumeTailor 문서는 `설치/실행 -> 구조 이해 -> 제품 기준 -> 운영/품질 -> 변경 이력` 순서로 읽습니다.

## 1. 권장 읽기 순서

1. [루트 README](../README.md)
   - 설치, 실행, 기본 사용 흐름
2. [프로젝트 구조](./PROJECT_STRUCTURE.md)
   - 폴더 역할, 주요 진입점, 실행 경로
3. [서비스 기획서](./SERVICE_PLAN.md)
   - 기능 범위, 상태 전이 규칙, API/스키마 기준
4. [운영 런북](./OPS_RUNBOOK.md)
   - 운영 점검, Typst 미리보기/PDF 장애 대응, 복구
5. [채용공고 불러오기 가이드](./COMPANY_FETCH_GUIDE.md)
   - URL 추출 방식과 사이트별 처리 이유
6. [자기소개 품질 가이드](./INTRO_QUALITY_GUIDE.md)
   - 결과 품질 기준과 금지 규칙
7. [릴리즈 노트](./RELEASE_NOTES.md)
   - 반영 이력과 검증 내역
8. [다음 작업 로드맵](./NEXT_STEPS.md)
   - 남은 우선순위와 후속 작업

## 2. 문서 역할

- [루트 README](../README.md)
  - 설치, 실행, 기본 사용 흐름
- [프로젝트 구조](./PROJECT_STRUCTURE.md)
  - `app / features / entities / shared / server` 기준의 구현 지도
- [서비스 기획서](./SERVICE_PLAN.md)
  - MVP 범위, 요구사항, 아키텍처, 상태 전이 규칙의 기준 문서
- [다음 작업 로드맵](./NEXT_STEPS.md)
  - 개선 우선순위와 후속 작업
- [운영 런북](./OPS_RUNBOOK.md)
  - 운영 점검, Typst 미리보기/PDF 장애 대응, 복구 절차
- [채용공고 불러오기 가이드](./COMPANY_FETCH_GUIDE.md)
  - `/company`의 URL 추출 흐름과 fallback 설명
- [자기소개 품질 가이드](./INTRO_QUALITY_GUIDE.md)
  - `generate-intro` 결과 품질 점검 기준
- [릴리즈 노트](./RELEASE_NOTES.md)
  - 버전별 추가/변경/검증 기록

## 3. 문서 관리 원칙

- 설치와 사용법은 `README.md`를 기준으로 유지합니다.
- 구조와 파일 배치는 `PROJECT_STRUCTURE.md`를 기준으로 유지합니다.
- 기능 범위와 상태 규칙은 `SERVICE_PLAN.md`를 기준으로 유지합니다.
- 운영 절차와 장애 대응은 `OPS_RUNBOOK.md`를 기준으로 유지합니다.
- 변경 이력은 `RELEASE_NOTES.md`에 누적합니다.
