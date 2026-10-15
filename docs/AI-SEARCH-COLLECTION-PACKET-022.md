# WU-022 수집 패킷 — **한 번에 6회**. 이 문서만 보고 끝낼 수 있다

🔴 자동화 **0** — Playwright 0 · Extension 0 · DOM scraping 0 · AI API 0 · 키 0 · 결제 ₩0.
🟢 **사람이 자기 브라우저에서 직접** 입력하고 답변을 복사한다. 그래서 약관 문제가 없다
(WU-002 가 막은 것은 「자동 입력」이지 「사람이 쓰는 것」이 아니다).

🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(헌장 §3). 이 문서는 **CPO 가 전달**한다.

---

## 0. 한 장 요약

```
무엇을   AI 1개를 열고 아래 프롬프트 6개를 «그대로» 넣는다
몇 번    **6회** (🔴 14회가 아니다 — 14 는 (원상품,후보) 쌍 수다)
무엇을 돌려주나  각 답변의 **원문 전체**를 그대로 복사
어디에   아래 §4 의 JSON 한 파일
걸리는 시간  대화 6회 + 복사 6회
```

---

## 1. 🔴 지켜야 할 것 다섯 (어기면 측정이 무효다)

```
① 프롬프트를 **고치지 않는다.** 6회 모두 «같은 문장» 이다(모델 간·상품 간 유불리 방지)
② 원상품 URL **말고는 아무것도 주지 않는다.** 정답 후보 URL·브랜드·품번·색상 힌트 금지
③ 답변을 **가공하지 않는다.** URL 만 골라 적지 말고 **원문 전체**를 넣는다
④ 「못 찾았다」도 **그 답변 원문을 넣는다.** 🔴 빈 문자열과 「후보 0」은 다른 상태다
⑤ 한 대화에 한 상품. **새 대화**로 시작한다(앞 상품의 문맥이 섞이면 측정이 오염된다)
```

🔴 **왜 ②가 중요한가** — 정답을 알려주면 그건 Search 측정이 아니라 「받아쓰기」가 된다.

---

## 2. 고정 프롬프트 (6회 모두 동일 · `<여기에 URL>` 만 바꾼다)

```
다음 상품과 "완전히 같은 실제 상품"을 판매하는 다른 판매처 페이지를 웹에서 찾아 주세요.

원상품: <여기에 URL>

규칙:
- 상품 상세 페이지 URL 만 제시하세요(검색 결과·목록·카테고리 페이지 금지).
- 색상이 다른 상품은 제외하세요.
- 다른 국가/시장에서 파는 같은 상품은 포함하세요.
- 추측으로 URL 을 만들지 마세요.
- 찾을 수 없으면 반드시 그 사실을 적어 주세요. 아래 중 하나로 시작하세요:
    "검색 결과 없음"              웹 검색 자체가 아무 결과도 주지 않은 경우
    "동일상품 후보 없음"          검색 결과는 있었지만 같은 상품이 없는 경우
    "후보 있음"                   하나 이상 찾은 경우

"후보 있음" 이면 그 아래에 번호 목록으로 각 줄에 URL 전체를 그대로 적어 주세요.
```

🔴 마지막 「셋 중 하나로 시작하라」가 **다섯 상태를 가르는 장치**다 —
①검색 결과 없음 ②후보 없음 ③후보 찾음 ④잘못된 후보 ⑤정답 후보.
①②를 못 가르면 **Search 실패와 Candidate 실패가 한 숫자로 뭉친다.**

---

## 3. 원상품 6건 — `<여기에 URL>` 에 넣을 값

| # | searchId | URL |
|---|---|---|
| 1 | **S1** | `https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses` |
| 2 | **S2** | `https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses` |
| 3 | **S3** | `https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses` |
| 4 | **S4** | `https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story` |
| 5 | **S5** | `https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe` |
| 6 | **S6** | `https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket` |

🟢 이 6건은 **운영 DB 실데이터**이고 `SEARCH_TARGETS`(코드)와 **같은 배열**이다
(테스트가 「6건 · 사본 금지」를 단언으로 잠근다).

---

## 4. 붙여넣을 파일

```
경로   %TEMP%\mi-p0-02\mi-019a-search-results.json
```

```json
[
  { "searchId": "S1", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" },
  { "searchId": "S2", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" },
  { "searchId": "S3", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" },
  { "searchId": "S4", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" },
  { "searchId": "S5", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" },
  { "searchId": "S6", "model": "<모델 이름>", "rawAnswer": "<답변 원문 전체>" }
]
```

🔴 `model` 은 **필수**다(모델별 비교가 목적이라 없으면 거부된다). 6건 모두 같은 값이면 된다.
🟢 검증기가 자동으로 잡는 것 — `model` 누락 · 빈 `rawAnswer` · 모르는 `searchId` ·
`(model, searchId)` 중복 · 최상위 비배열. 🔴 **빠진 건을 채우지 않는다**(누락은 누락으로 보고).

---

## 5. 들어오면 CTO 가 하는 일 (추가 수집 요청 **없다**)

```
① 검증기   mi-019a-search-ingest        파일 형식·누락·중복
② 추출     extractCandidateUrlsFromAiAnswer   🔴 새 파서 0
③ identity discoveryUrlRecord           rawSearchUrl / canonicalUrl / identityKey
④ Discovery known-positive discovery rate (분모 **5** · S3 제외) · 미검증 신규 후보
⑤ fetch    factsFromProductUrl          후보 상세 페이지를 실제로 연다
⑥ MI       withConfidence → crossSellerVerdict   🔴 기존 운영 경로 그대로
⑦ GT       CTO 가 독립 증거(품번·모델명·색상·옵션)로 적고 `gtToken` 으로 제목과 대조
⑧ KPI      AI/MI Accuracy · Precision · False SAME · missed-SAME · Agreement · 4분면
```

🔴 ⑦의 GT 는 **MI 에서 복사하지 않는다** — 하니스가 그것을 구조로 막는다(GT 규격에 MI 칸이 없고,
근거(`gtReason`)가 비면 거부된다). 음성 대조 2종으로 잠겨 있다.

🔴 **AI Identity(SAME/DIFFERENT/UNCERTAIN) 축은 «선택»이다.** 그 파일이 없으면
AI KPI 는 **「측정불가」로 적고 0% 로 적지 않는다.** 필요하면 2차로 수집한다
(같은 후보를 AI 에게 보여 주고 **세 단어 중 하나만** 받는다 · 산문/확신도/가격 섞이면 버려진다).

---

## 6. 🔴 이 수집으로 **답이 나오는 질문 / 안 나오는 질문**

```
🟢 나온다   AI 가 알려진 정답 후보를 찾는가(분모 5) · 후보를 몇 개 주는가 ·
           그 후보가 실제로 열리는가 · MI 가 그 후보를 어떻게 판정하는가 ·
           MI Accuracy / Precision / False SAME / missed-SAME (GT 대비)
🟡 조건부  AI vs MI 비교 — **AI Identity 파일을 2차로 수집해야** 나온다
🔴 안 나온다 「AI 가 MI 보다 낫다」의 일반화 — 원상품 **6건 · 모델 1개** 다.
           🔴 그리고 known-positive 집합은 **하한** 이다. 못 찾았다고 AI 가 틀린 것이 아니고,
              목록에 없는 URL 을 가져왔다고 오탐도 아니다(「미검증 신규 후보」로 센다).
```
