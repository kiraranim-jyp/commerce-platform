# WU-019A-SEARCH — AI Search 결과 **수집 규격 + 작업표**

🔴 AI 호출 **0** · Gemini API 0 · GPT API 0 · 키 0 · 결제 **₩0** · 자동 브라우저 0 ·
소비자 AI UI 자동화 0 · 엔진 변경 0 · DB 0 · UI 0 · 배포 0 · HTTP 0.
🔴 **AI Search 결과가 들어오기 전에는 AI Accuracy 를 계산하지 않는다.**

---

## 0. 🔴🔴 먼저 — 작업량은 **6건**이고 14건이 아니다

019A 의 14 는 **(원상품, 후보) 쌍** 의 수다. Search 는 **원상품 단위**이므로:

```
작업량 = 원상품 **6건** × 모델 수
   예) Gemini + GPT 두 모델이면 **12회** (24회가 아니다)
```

## 1. 순서 — CPO 정정 그대로

```
① AI Search(사람 수집 · **답변 원문 보존**)      ← 지금 비어 있는 단 하나
     ↓
② 후보 URL 추출      WU-017-1 `extractCandidateUrlsFromAiAnswer` **재사용**(새 파서 0)
     ↓               🔴 AI 의 「동일상품입니다」 문장은 증거가 아니다
③ 따져가 URL 검증    WU-017-2 경로(`factsFromProductUrl`)
     ↓
④ AI Identity vs MI Identity   WU-019A / 019A-EXT 하니스가 담당
```
🔴 **Search 실패 ≠ 후보 실패 ≠ Identity 실패** — 세 축을 섞지 않는다.

## 2. 고정 Search 프롬프트 (모델마다 **똑같이** · 변형 금지)

```
다음 상품과 "완전히 같은 실제 상품"을 판매하는 다른 판매처 페이지를 웹에서 찾아 주세요.

원상품: <sourceUrl>

규칙:
- 상품 상세 페이지 URL 만 제시하세요(검색 결과·목록·카테고리 페이지 금지).
- 색상이 다른 상품은 제외하세요.
- 다른 국가/시장에서 파는 같은 상품은 포함하세요.
- 추측으로 URL 을 만들지 마세요.
- 🔴 **찾을 수 없으면 반드시 그 사실을 적어 주세요.** 아래 중 하나로 시작하세요:
    "검색 결과 없음"              웹 검색 자체가 아무 결과도 주지 않은 경우
    "동일상품 후보 없음"          검색 결과는 있었지만 같은 상품이 없는 경우
    "후보 있음"                   하나 이상 찾은 경우

"후보 있음" 이면 그 아래에 번호 목록으로 각 줄에 URL 전체를 그대로 적어 주세요.
```

🔴🔴 **「없으면 없다고 답하라」를 명시하는 이유**(CPO) — 그래야 다섯이 갈린다:
```
① 검색 결과 자체가 없음          ② 결과는 있지만 동일상품 후보가 없음
③ 후보를 찾음                    ④ 후보를 찾았지만 잘못된 후보
⑤ 정답 후보를 찾음
🔴 ①②를 구분하지 못하면 **Search Failure 와 Candidate Failure 가 한 숫자로 뭉친다.**
🟢 ③④⑤는 수집이 아니라 **따져의 검증(③단계)과 GT 비교(④단계)** 가 가른다.
```

🔴 **모델별로 프롬프트를 바꾸지 않는다** — 바꾸면 모델 간 유불리가 생긴다.
🔴 **GT 유형 라벨(`EXACT_SAME` 등)을 AI 에게 보여주지 않는다.**
🔴 **원상품 외의 URL(정답 후보)을 프롬프트에 넣지 않는다** — 넣으면 Search 측정이 아니다.

## 3. 작업표 — 원상품 **6건** (전부 운영 DB 실데이터)

| searchId | 원상품 URL | 참고(원상품) |
|---|---|---|
| S1 | https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses | Bobo Choses `B226AC010` Heather Grey |
| S2 | https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses | Bobo Choses `B226AC009` Light Blue |
| S3 | https://www.junioredition.com/en-kr/products/curious-turnip-all-over-swim-cap-by-bobo-choses | Bobo Choses `B126AI018` Green |
| S4 | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story | Main Story `AW26MS185` **Grey Melange** |
| S5 | https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe | Pèpè `01195-VERNICE-NERO` |
| S6 | https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket | `B226AC117` Blue (일본 스토어) |

🔴 참고 칸은 **수집자용** 이고 **AI 에게 주지 않는다**(원상품 URL 만 준다).

## 4. 결과 붙여넣기 위치 — 파일 하나

```
%TEMP%\mi-p0-02\mi-019a-search-results.json
```
```json
[
  { "searchId": "S1", "model": "gemini", "rawAnswer": "<AI 답변 원문 전체>" },
  { "searchId": "S1", "model": "gpt",    "rawAnswer": "<AI 답변 원문 전체>" }
]
```

🔴 **가공하지 않는다.** URL 만 골라 적지 말고 **답변 원문 전체** 를 넣는다 — 추출은
우리가 하고(017-1), 원문은 재현·재분석에 필요하다.
🔴 `model` 은 **필수** 다(모델별 비교가 목적이라 없으면 거부된다).
🔴 찾지 못한 경우도 **그 답변 원문을 넣는다** — 「빈 문자열」과 「후보 0」은 다른 상태다
(검증기가 빈 `rawAnswer` 를 거부하고, 「없음」 답변은 **후보 0 으로 정상 집계**한다).

🟢 검증기가 잡아 주는 것 — `model` 누락 · 빈 `rawAnswer` · 작업표에 없는 `searchId` ·
`(model, searchId)` 중복 · 최상위 비배열. 🔴 **누락된 건을 채우지 않는다**(그대로 보고).

## 5. 🔴🔴 Discovery 지표의 분모 — 과장하지 않는다

우리가 가진 「정답 후보」는 019A 에서 GT=SAME 으로 확정된 **7건**이고 **하한**이다.

```
🟢 적을 수 있는 것   **known-positive discovery rate**(= 「알려진 정답 후보를 찾았는가」 ·
                    분모 = 정답 URL 이 지금도 열리는 원상품 **5건**)
🔴 적지 않는 것      「후보 Recall」 — 전수 정답 집합이 **없다**
🔴 AI 가 우리 목록에 없는 URL 을 가져오면 **오탐으로 세지 않는다** →
   「미검증 신규 후보」 이고 진짜 동일상품일 수 있다. 판정은 ③④가 한다.
🔴 S3 는 분모에서 빠진다 — 그 **URL 이** 019A 실측에서 **404** 였기 때문이고,
   정확한 표현은 「현재 페이지가 404 라 **이번 실험의 검증 가능한 정답 후보 집합에서
   제외**」 다. 🔴🔴 **「그 상품 자체가 존재하지 않는다」로 확대 해석하지 않는다**(CPO).
```

## 6. 들어오면 자동으로 나오는 것 (추가 개발 0)

```
① 모델별 「알려진 정답 발견 x/5」 · 원상품별 후보 수 · 미검증 신규 후보 수 · 후보 0 목록
② 017-1 이 거른 것과 이유(목록 URL · 자기참조 · 중복 · 상품 아님)
③ 그 다음 ③④ 단계로 넘길 후보 URL 집합
🔴 AI Identity verdict 는 **별 파일**(`mi-019a-ai-verdicts.json` · 019A-EXT 규격)이다 —
   Search 수집과 Identity 판정을 같은 칸에 담지 않는다.
```

## 7. 현재 상태

```
AI Search 결과   🔴 **측정불가** — 아직 수집하지 않았다(「AI 가 못 찾았다」가 아니다)
파이프라인       🟢 준비 완료 · 검증기 + Discovery 집계 테스트 6건 PASS(AI 0 · HTTP 0)
CEO Action       AI Search 수집 (🔴 CTO 가 직접 요청하지 않는다 — CPO 전달)
```
