# 채용공고 불러오기 가이드

- 문서 버전: v0.1
- 작성일: 2026-03-07
- 기준 범위: 로컬 MVP

## 1. 목적

`/company` 단계에서 채용공고를 어떤 방식으로 읽고, 어떤 사이트는 왜 별도 처리하는지 정리한다.

이 문서는 특히 아래 상황을 설명한다.

- 사용자가 공고 텍스트를 직접 붙여넣는 경우
- `txt` 파일을 업로드하는 경우
- URL만 넣었을 때 현재 공고 본문을 자동으로 가져오는 경우
- 사이트마다 구조가 달라 별도 처리 로직이 필요한 경우
- 상세 본문이 이미지일 때 OCR fallback이 어떻게 동작하는지

## 2. 현재 지원 입력 방식

`/company`에서는 아래 3가지 입력을 지원한다.

- 붙여넣기: 사용자가 채용공고 본문을 textarea에 직접 넣는다.
- 파일 업로드: `txt` 파일을 읽어 textarea에 채운다.
- URL 불러오기: 서버가 공고 페이지를 읽어 본문 텍스트를 추출한 뒤 textarea에 채운다.

핵심 원칙은 하나다.

- 어떤 입력 방식이든 최종적으로는 `companyText` 하나로 합친 뒤, 같은 `company-to-json` 분석 흐름으로 보낸다.

즉 URL 지원은 별도 분석기가 아니라 `공고 텍스트를 채우는 입력 방식 하나 추가`에 가깝다.

## 3. 전체 URL 추출 흐름

URL 입력 시 서버는 아래 순서로 공고 본문을 찾는다.

1. URL 유효성 검사
2. 정적 HTML / plain text 응답 확인
3. 숨겨진 JSON(`JobPosting`, `__NEXT_DATA__`, `ld+json`) 추출 시도
4. 사이트 전용 상세 추출 시도
5. 필요하면 브라우저 렌더링 fallback
6. 상세 본문이 이미지면 OCR fallback

구현 진입점:

- [app/api/company/fetch-url/route.ts](/Users/jino/study/project/resumeMake/app/api/company/fetch-url/route.ts)
- [lib/company-url-fetch.ts](/Users/jino/study/project/resumeMake/lib/company-url-fetch.ts)

## 4. 공통 처리 규칙

공통 규칙:

- `http/https`만 허용한다.
- `localhost`, 사설 IP, 내부 네트워크 주소는 차단한다.
- 응답 크기와 타임아웃을 제한한다.
- 본문 길이와 `주요 업무`, `자격 요건`, `requirements` 같은 신호 키워드로 품질을 점수화한다.
- 충분히 강한 후보를 찾으면 더 무거운 fallback으로 넘어가지 않는다.

공통 fallback:

- 정적 HTML만으로 약하면 브라우저 렌더링을 한 번 더 시도한다.
- 렌더링된 DOM도 약하고 본문 이미지가 있으면 OCR을 추가로 시도한다.

## 5. 사이트별 처리 방식

### 5.1 사람인 relay (`saramin.co.kr/zf_user/jobs/relay/view`)

사람인은 현재 공고 본문이 첫 HTML에 거의 없고, 아래 순서로 다시 불러온다.

1. 메인 `view` 페이지 로드
2. `POST /zf_user/jobs/relay/view-ajax`
3. 응답 HTML 안의 `iframe.iframe_content`
4. `view-detail` 페이지에서 실제 상세 본문 추출

사람인 전용 처리 이유:

- 첫 HTML에는 현재 공고 본문이 비어 있는 경우가 많다.
- 추천 공고 데이터와 현재 공고 데이터가 섞여 있어 generic parser가 잘못 집기 쉽다.
- 쿠키와 `Referer`가 필요해 연속 요청을 같은 세션처럼 이어야 한다.

현재 처리:

- `view` 응답의 쿠키를 추출해 `view-ajax`, `view-detail`까지 전달한다.
- `view-detail`의 `.user_content`, `main.job-posting`을 우선 읽는다.
- 텍스트가 약하고 이미지가 있으면 상세 이미지 OCR을 추가한다.

관련 코드:

- [lib/company-url-fetch.ts](/Users/jino/study/project/resumeMake/lib/company-url-fetch.ts#L183)
- [lib/company-url-fetch.ts](/Users/jino/study/project/resumeMake/lib/company-url-fetch.ts#L400)

### 5.2 잡코리아 GI_Read (`jobkorea.co.kr/Recruit/GI_Read/...`)

잡코리아는 메인 `GI_Read` 페이지에 공고 헤더와 요약은 보이지만, 실제 상세 모집 요강은 별도 iframe에서 로드된다.

실제 흐름:

1. `GI_Read/<id>` 페이지 로드
2. 메인 페이지에서 현재 공고 헤더, 모집요강, 지원자격 요약 확인
3. `iframe[src*="GI_Read_Comt_Ifrm"]` 에서 상세 본문 로드

잡코리아 전용 처리 이유:

- 메인 페이지를 그대로 읽으면 `추천공고`, `취업 전략`, footer 문구가 쉽게 섞인다.
- 현재 공고 상세는 `GI_Read_Comt_Ifrm?Gno=<id>` 안에 따로 들어 있다.
- 따라서 메인 페이지 전체를 읽는 것보다 상세 iframe을 직접 읽는 편이 정확하다.

현재 처리:

- URL의 공고 ID를 읽어 `GI_Read_Comt_Ifrm` 상세 URL을 직접 호출한다.
- 상세 iframe 본문을 우선 사용한다.
- 메인 페이지에서는 `모집요강`까지만 요약 후보로 보조 사용하고,
  `이 기업의 취업 전략`, `AI추천공고`, `관련 태그`, 법적 문구 이후는 잘라낸다.
- 상세 텍스트가 약하고 이미지가 있으면 OCR fallback을 붙인다.

관련 코드:

- [lib/company-url-fetch.ts](/Users/jino/study/project/resumeMake/lib/company-url-fetch.ts#L553)
- [lib/company-url-fetch.ts](/Users/jino/study/project/resumeMake/lib/company-url-fetch.ts#L591)

### 5.3 일반 사이트

특정 사이트 전용 규칙이 없으면 아래 순서로 처리한다.

1. meta title / site name 추출
2. `main`, `article`, `.job-description`, `#content` 등 공통 selector 평가
3. 숨겨진 JSON 후보 평가
4. 브라우저 렌더링 후 다시 추출
5. 이미지가 많고 텍스트가 약하면 OCR fallback

대상 예:

- Greenhouse
- Lever
- Workable
- Wanted
- Jumpit

이 사이트들은 전용 selector 우선순위만 두고, 현재는 별도 API 체인은 없다.

## 6. 이미지 OCR fallback

상세 본문이 이미지면 아래 방식으로 보강한다.

1. 본문 영역 안의 `img` 수집
2. 상대경로를 절대 URL로 변환
3. 필요하면 쿠키와 `Referer`를 유지한 채 이미지 다운로드
4. macOS Vision OCR로 텍스트 추출
5. 기존 DOM 텍스트와 중복 제거 후 병합

구현 위치:

- [lib/company-image-ocr.ts](/Users/jino/study/project/resumeMake/lib/company-image-ocr.ts)
- [scripts/vision_ocr.swift](/Users/jino/study/project/resumeMake/scripts/vision_ocr.swift)

현재 제약:

- OCR fallback은 macOS 로컬 실행 기준이다.
- Linux 서버나 서버리스 환경에서는 다른 OCR 경로가 추가로 필요하다.
- 이미지 품질이 너무 낮거나 장식 요소가 많으면 정확도가 떨어질 수 있다.

## 7. 실패 시 동작

자동 추출이 충분히 강하지 않으면 아래 메시지로 fallback 한다.

- 공고 내용을 직접 붙여넣어 달라는 안내
- 또는 `txt` 파일로 넣어 달라는 안내

원칙:

- 잘못된 다른 공고를 섞어 넣는 것보다, 현재 공고 일부만 정확히 주는 편이 낫다.
- 그래서 사이트 전용 경로가 있으면 generic parser보다 우선한다.

## 8. 점검 포인트

URL 추출 변경 시 확인할 것:

- 실제 회사명과 직무명이 현재 공고와 일치하는가
- `추천공고`, `취업 전략`, footer 문구가 본문에 섞이지 않는가
- `주요 업무`, `자격 요건`, `우대 사항` 같은 핵심 구간이 유지되는가
- 이미지 기반 상세 공고도 최소 핵심 문장은 추출되는가

관련 테스트:

- [tests/api/company-fetch-url.test.ts](/Users/jino/study/project/resumeMake/tests/api/company-fetch-url.test.ts)
