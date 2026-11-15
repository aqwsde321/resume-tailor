# 공고 URL 추출: 플랫폼별 관리

사용자가 제공한 URL 한 건의 본문을 읽는다. 공고 검색·목록 수집이나 공식 채용 API 연동은 하지 않는다. 로그인·차단을 우회하지 않으며, 추출 실패 시 원문 붙여넣기를 안내한다.

## 코드 위치

- `src/server/company-platforms.ts`: 호스트 판별, 본문 CSS 선택자, 펼치기 버튼 이름, 상세 페이지 요청 경로의 기준 파일.
- `src/server/wanted-job-description.ts`: 원티드 본문 범위와 줄바꿈 보존.
- `src/server/company-url-fetch.ts`: HTTP/브라우저/페이지 내 JSON/이미지 OCR의 공통 처리와 사람인·잡코리아 상세 요청.
- `src/app/api/workspace/source/route.ts`: 추출 텍스트를 검토 문서로 등록. AI로 요약하지 않는다.

선택자에는 CSS 모듈의 해시 전체를 쓰지 않는다. 호스트는 정확한 도메인 또는 하위 도메인으로 판별하며, 점핏은 사람인보다 먼저 판별한다.

## 플랫폼별 현재 구현

| 플랫폼 | 호스트 | 본문 태그·선택자 | 추가 동작·요청 | 검증 범위·제한 |
| --- | --- | --- | --- | --- |
| 원티드 | `wanted.co.kr` 및 하위 도메인 | `article[class*='JobDescription_JobDescription__']` 우선 | 해당 본문 안의 `상세 정보 더 보기` 버튼을 브라우저에서 펼침. 제목·목록·`br` 줄바꿈 유지 | 2026-11-15 실제 공고의 접힘/펼침 비교. 우대사항·복지·전형이 추가되는 것 확인. 펼침 실패 시 누락 가능성 경고. 선택자 변경 시 재검증 필요 |
| 사람인 | `saramin.co.kr` 및 하위 도메인, 점핏 제외 | 일반: `#content`, `.tplJobView`, `.viewArea`, `main`. relay: `.wrap_jv_header`, `.jv_summary`, `.jv_benefit`, `.jv_location`, `iframe.iframe_content` | `/zf_user/jobs/relay/view`의 `rec_idx` → `POST /zf_user/jobs/relay/view-ajax` → 응답의 상세 iframe. 필요한 경우 이미지 OCR | 기존 mock 기반 API 테스트. 이번 변경에서 실제 사이트 재검증하지 않음 |
| 점핏 | `jumpit.saramin.co.kr`, `jumpit.co.kr` | `main`, `[class*='JobDescription']`, `[class*='Position']`, `.content` | 공통 HTML/페이지 내 JSON/브라우저 폴백 | 전용 펼침·상세 API 미구현. 이번 변경에서 실제 사이트 재검증하지 않음 |
| 잡코리아 | `jobkorea.co.kr` 및 하위 도메인 | `#content`, `.tplJobView`, `.viewArea`, `main`. GI_Read 요약+상세 iframe 병합 | `/Recruit/GI_Read/{id}` → `GET /Recruit/GI_Read_Comt_Ifrm?Gno={id}`. 필요한 경우 이미지 OCR | 기존 mock 기반 API 테스트. 이번 변경에서 실제 사이트 재검증하지 않음 |
| 그룹바이 | `groupby.kr` 및 하위 도메인 | 전용 선택자 없음. 공통 선택자로 추출 | 공통 HTML/페이지 내 JSON/브라우저 폴백 | 전용 어댑터·API 미구현. 수집 완전성을 보장하지 않음 |
| Greenhouse / Lever / Workable | 설정 파일의 도메인 목록 참고 | 기존 ATS별 선택자 유지 | 공통 폴백 | 이번 변경에서 실제 사이트 재검증하지 않음 |

사람인·잡코리아 요청 경로는 웹 페이지가 사용하는 상세 콘텐츠 경로이며 **공식 API 계약을 의미하지 않는다**. 이 프로젝트는 API 키를 발급하거나 검색 API를 호출하지 않는다. 경로가 바뀌거나 접근이 제한되면 실패 안내로 처리한다.

## 원티드 추출 흐름

1. 초기 HTML의 본문 article을 확인한다. 본문 밖의 추천 공고·저작권·지원 버튼을 섞지 않는다.
2. 본문에 펼치기 버튼이 있으면 텍스트가 충분히 길더라도 초기 추출만으로 완료하지 않는다.
3. 브라우저에서 동일 본문 범위의 펼치기 버튼만 누르고 버튼이 사라지는 것을 기다린다. 상단 메뉴의 ‘더보기’는 누르지 않는다.
4. 펼친 본문의 DOM에서 텍스트를 추출하고 줄바꿈을 유지한다. 전용 본문 후보를 일반 페이지·JSON 후보보다 우선한다.
5. 펼칠 수 없거나 브라우저 접근이 실패하면 초기 텍스트와 함께 추가 내용 누락 경고를 반환한다. 필수/우대 항목의 존재를 임의로 만들어 채우지 않는다.

기존 저장 문서는 자동 덮어쓰지 않는다. 재추출은 별도 작업이며, 사용자가 수정한 문장·댓글을 보존할 방식을 확인하고 수행한다.

## 변경 시 검증

- 합성 HTML fixture로 접힘·펼침·실패 경고·줄바꿈·추천 공고 제외를 확인한다.
- 플랫폼 우선순위와 도메인 경계를 테스트한다.
- `tests/api/company-fetch-url.test.ts`, `tests/lib/wanted-job-extraction.test.ts`, `tests/lib/company-platforms.test.ts` 실행.
- 실제 회사 공고 HTML·지원 자료는 Git에 넣지 않는다. 실제 비교에 쓴 원본은 임시 파일 또는 Git 제외 개인 저장소에만 둔다.
