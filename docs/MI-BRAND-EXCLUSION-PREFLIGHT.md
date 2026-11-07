# Main Story 제외 · 404 후보 제외 — **구현 전 선행 보고**(CPO §5)

> 🔴 **운영 코드 변경 0.** matcher · Identity · 추출기 · alias · BRAND 정책 · 품번 판정 ·
> GT 적용 · DB · schema 전부 **손대지 않았다**. 이 문서는 **조사와 설계 보고** 다.
> 🟢 추가된 것 — CEO GT 보존 fixture 1 · fixture 분류 1줄(기존 가드가 요구) · 이 문서.

---

## 0. CEO GT 11/11 — 먼저 숫자를 고정한다

🟢 보존 — `fixtures/ceo-evidence-review-gt.json`(라벨·`ceoNote` **원문 그대로** · 가공 0).

| id | 판매처 | CEO | 운영 «재현» | 평가 | Main Story |
|---|---|---|---|---|:-:|
| C27 | beaumonde.co.kr | **SAME** | PRESUMED_SAME | 🔴 **누락(FN)** | |
| C50 | tinyapple.net | **UNDECIDED** | PRESUMED_SAME | 🔴 **404 · 측정불가** | |
| C22 | donokids.com | DIFFERENT | SIMILAR | 🟢 올바름 | ✅ |
| C05 | tinyapple.net | **SAME** | SAME | 🟢 일치 | |
| C06 | global.trenbe.com | **SAME** | SAME | 🟢 일치 | |
| C19 | junioredition.com | DIFFERENT | PRESUMED_SAME | 🟡 보류 | ✅ |
| C20 | junioredition.com | DIFFERENT | PRESUMED_SAME | 🟡 보류 | ✅ |
| C42 | main-story.com | DIFFERENT | **SAME** | 🔴 **오포함(FP)** | ✅ |
| C25 | main-story.com | DIFFERENT | PRESUMED_SAME | 🟡 보류 | ✅ |
| S1-5 | junioredition.com | DIFFERENT | CONFLICT | 🟢 올바름 | |
| S1-6 | tinyapple.net | DIFFERENT | **SAME** | 🔴 **오포함(FP)** | |

```
🔴 이전 판정과 «뒤집힌» 쌍 — **C42 하나**(SAME → DIFFERENT)
🔴 운영 재현이 SAME 인 4건 중 CEO SAME 은 **2** ⟹ 이 표본 FP **2**(C42 · S1-6)
🟢 **Main Story 5건을 빼면** 분모 11 → **6** · FP **2 → 1** · 보류 3건이 분모에서 사라진다
🟢 404(C50)까지 빼면 유효 분모 **5** — 올바름 3 · FP 1(S1-6) · FN 1(C27)
```

🔴🔴 **남는 FP 1건(S1-6)은 Main Story 가 아니다** — Bobo Choses 이고 축은 **반팔 ↔ 긴팔** 이다.
🟢 그런데 CEO 가 그 칸에 적었다 — 「**유사상품으로 분류가 되어도 문제되지 않는다**」(S1-5·S1-6 공통).
🔴 **그래서 CTO 는 소매 길이 규칙을 만들지 않았다** — ⒜ CPO 가 matcher 변경을 금지했고
⒝ 그 축은 WU-125 에서 **18건 표본에서 재현 0** 으로 이미 닫혔다. **CPO 판정 사안** 으로 올린다(§6).

🔴 **C42 뒤집힘을 «적용하지 않았다»** — `core-same05-gt.ts` 의 `SAME05_BASELINE`
(`same 18 · different 9 · fp 1`)이 바뀌는 변경이다. 기존 GT 변경 금지에 걸린다 ⟹ §6.

---

## 1. Main Story 제외 — **적용 위치와 영향 범위**

### 🔴🔴 먼저 — **원본 자체가 Main Story 다**

```
탐지 신호별 적중(분모 5쌍 · 실측)
  원본 brand == "Main Story"        **5 / 5**   🟢 하나로 전부 잡힌다
  후보 brand == "Main Story"         4 / 5      🔴 C22(donokids)는 후보 brand 가 **null**
  후보 도메인 main-story.com         2 / 5
원본 URL 은 5쌍 전부 같다 — junioredition.com/.../bubble-sweatshirt-in-grey-melange-**by-main-story**
⟹ 🔴 **「후보만 제외」하면 그 원상품은 계속 분석되고 후보가 0 이 되어**
   화면에 「후보를 찾지 못했습니다」로 보인다(= 공급 실패와 구별되지 않는다)
```

### 적용 위치 후보 **셋** — 🔴 CTO 가 고르지 않았다

| | 위치 | 적용 단위 | 비용 | 사유 기록 | 다른 브랜드 영향 |
|---|---|---|---|---|---|
| ① | `run-domestic-price-check.ts:1113` **입구** (`runDomesticPriceCheck`) | **원상품** | 🟢 **0**(검색 자체를 돌리지 않는다) | 🟡 반환 칸 추가 필요 | 🟢 술어가 브랜드 하나 |
| ② | 같은 파일 `:1015` — `judgeDomesticCandidate` 의 `isSelfReferenceCandidate` 필터 **옆** | **후보** | 🔴 수집·fetch 를 이미 끝낸 뒤다 | 🟢 `selfReferenceExcluded` 와 **같은 모양** | 🟢 같음 |
| ③ | `url-candidate-pool.ts:64` — `UrlCandidateDropReason` 에 `BRAND_EXCLUDED` | **후보 URL** | 🟢 fetch 전 | 🟢 **`dropped[]` 가 이미 있다** | 🟢 같음 |

🟢 **①의 선례가 그 파일 안에 이미 있다** — `skipIfCheckedToday` 조기 종료가
`{ linksCreatedOrUpdated: 0, pricesRecorded: 0, sourceErrors: [], domesticModelCodeFetchCount: 0 }`
을 반환한다 ⟹ **같은 반환 타입** 으로 끝낼 수 있다(새 계약 0).

🟢 **②의 선례** — `DomesticJudgement` 세 분기가 전부 `selfReferenceExcluded: number` 를 들고 있다.
`brandExcluded: number` 를 같은 모양으로 더하면 **판정 로직을 건드리지 않고** 집계만 늘어난다.

🟢 **③의 선례** — `COLLECTION_NOT_AVAILABLE` 주석이 정확히 이 성질을 적어 뒀다:
「**「URL 을 못 찾았다」가 아니다 — 찾았고 «일부러» 열지 않았다**」. `BRAND_EXCLUDED` 가 그 자리다.

### 🔴 ③의 치명적 한계 — **생산자 6개 중 사유를 기록하는 곳이 2개뿐이다**(실측)

```
factsFromProductUrl 호출 / dropped[] 보유
  url-candidate-pool      🟢 4회 · dropped[] 있음
  ai-answer-pool          🟢 호출 · dropped[] 있음(`status !== "OK"` → dropped)
  overseas-auto-pool      🔴 **0회** · dropped 칸 없음
  web-search-pool         🔴 **0회** · dropped 칸 없음
  domestic-listing-pool   🔴 **0회** · dropped 칸 없음
  등록부 검색(comparison-search/index.ts)  🔴 **0회**
⟹ ③만으로는 **Main Story 후보가 네 경로에서 그대로 통과한다**
```

🟢 **그래서 ② 가 「모든 경로를 덮는 유일한 choke point」다** — `judgeDomesticCandidate` 는
`run-domestic-price-check.ts` 에서 **한 곳에서만** 불린다(그 파일 주석이 「판정 «전체» 를
이 함수 하나로 부른다 — 사본이 아니라 유일한 자리」라고 명시).

🟡 **CTO 권고(판정은 CPO)** — **① + ②** 를 같이 둔다. ①이 비용을 0 으로 만들고,
②가 **다른 생산자에서 들어오는 후보까지** 덮는다. ③은 ②가 있으면 **중복** 이다.

---

## 2. 다른 브랜드에 영향이 없음을 **보장하는 방법**

```
⒜ 술어를 **브랜드 문자열 하나** 로 좁힌다 — `Main Story` 의 NFKC·소문자·공백/하이픈 변형만.
   🔴 `Story` 단독 부분일치 **금지**(「Story Loris」 같은 다른 브랜드를 지운다) ⟹
      기존 `brandMatches` 의 **경계 검사**(양 끝이 글자/숫자가 아니어야 한다)를 그대로 쓴다.
   🔴 **새 정규화기 0 · alias 등록부 변경 0**(CPO 금지) — `brand-alias.ts` 는 건드리지 않는다.
⒝ **품번·소재·색상 축을 한 글자도 건드리지 않는다.** 제외는 `compareModelCode` ·
   `compareCrossSellerProducts` **앞** 에서 끝난다 ⟹ 판정 함수 입력이 바뀌지 않는다.
   🟢 그래서 「Main Story 사례로 전체 품번 신뢰도를 낮추지 않는다」가 **구조적으로** 지켜진다.
⒞ **반사실 계약** — 이번 11쌍 중 Main Story 신호가 **0인 6쌍**
   (`C27 · C50 · C05 · C06 · S1-5 · S1-6`)의 재현 verdict 가 **한 글자도 바뀌지 않는다** 를 단언한다.
   🟢 그 6쌍은 **실측으로 신호 0** 이다(도메인·후보 brand·후보 제목·원본 brand·원본 제목·원본 URL 전수).
⒟ **음성 대조** — 제외 술어를 「모든 브랜드」로 넓히는 변이를 넣으면 그 계약이 **FAIL** 해야 한다.
⒠ 전수 회귀 **10,274** 가 기존 판정 계약을 그대로 지킨다(지금 기준선).
```

---

## 3. 404 후보 제외 — **구현 위치와 정상 상품 회귀 방지**

### 🟢 **이미 절반은 구현돼 있다** — 새로 만들 것이 아니다

```
`factsFromProductUrl` 은 `!response.ok` 면 **`UNREACHABLE`** 을 낸다(404 포함).
그리고 `UrlCandidateDropReason` 이 `ProductUrlFactsStatus` 를 **합집합으로 포함** 한다 ⟹
url-candidate-pool · ai-answer-pool 경로는 **404 를 이미 제외하고 사유까지 기록** 한다.
```

### 🔴 남은 네 경로 — 그리고 **비용**

```
overseas-auto-pool · web-search-pool · domestic-listing-pool · 등록부 검색
  ⟹ reachability 검사가 **없다**(후보가 검색 어댑터 응답에서 바로 온다)
  🔴 넣으면 **후보당 HTTP 1회 추가** 다 — WU-088/089 가 측정한 그 비용 축이다
```

### 🔴🔴 **`UNREACHABLE` 은 「거부됨」과 「닿지 못함」을 뭉갠다** — 404 만 빼려면 선행 작업이 있다

```
WU-105 가 기록했다 — `skroutz.ro` 는 **HTTP 403** 인데 `UNREACHABLE` 로 떨어진다.
⟹ 🔴 지금 구조로 「404 제외」를 켜면 **403 · 타임아웃 · 일시 오류도 같이** 빠진다.
🟢 분리하려면 `ProductUrlFactsResult` 에 **상태코드를 보존** 해야 한다(현재 버린다).
🔴 그것은 **수집 계약 변경** 이라 CPO 승인 사안이다 — CTO 가 임의로 하지 않았다.
```

### 🟢 CPO 요구 「접근 불가를 DIFFERENT 로 처리하지 않는다」 — **현재도 그렇다**(실측)

```
`UNREACHABLE` 은 pool 의 `dropped[]` 로 가고 **verdict 가 되지 않는다**.
⟹ 🟢 그 조건은 **이미 충족** 돼 있다. 바꿀 것이 없다.
🔴 단 C50 처럼 **저장된 facts 로 만든 화면** 에는 죽은 URL 이 남는다 —
   그 facts 는 URL 이 살아 있던 때 수집된 것이다(화면이 아니라 **데이터 수명** 문제다).
```

### 정상 상품 회귀 방지

```
🔴 분모를 먼저 적는다 — WU-076 실측(N=90): OK 66 · **UNREACHABLE 15** ·
   REDIRECTED_AWAY 8 · NO_FACTS 1.
🔴 그 15 중 「진짜 죽은 URL」이 몇 건인지는 **미측정** 이다(403 이 섞여 있다).
⟹ 🔴 **먼저 재야 한다** — 상태코드를 보존하지 않으면 「정상 상품을 몇 건 잃는지」를 말할 수 없다.
🟡 그래서 CTO 권고는 **측정 선행** 이다: 기존 90 URL 에 상태코드만 기록해 404 ↔ 403 ↔ 타임아웃을
   가른 뒤, 그 숫자를 보고 CPO 가 제외 범위를 정한다(추가 수집 없이 기존 하니스 재실행).
```

---

## 4. 기존 검색 · 수집 · MI 흐름에 미치는 영향

```
검색   ① 적용 시 Main Story 원상품은 **검색을 돌리지 않는다** ⟹ 그 상품의 HTTP 가 0 이 된다
       🔴 다른 브랜드의 검색 범위·쿼리·순서는 **불변**(술어가 브랜드 하나다)
수집   ② 적용 시 후보는 **수집된 뒤** 제외된다 ⟹ 수집 HTTP 는 그대로다(비용 변화 0)
       ③ 적용 시 fetch 전에 빠진다 ⟹ HTTP 가 **줄어든다**(단 네 경로에 그 자리가 없다)
MI     🟢 `compareCrossSellerProducts` · `compareModelCode` · `deriveMatchTruth` ·
       `priceTierFromLink` **입력과 로직 모두 불변** — 제외는 그 앞에서 끝난다
집계   🔴 Main Story 후보가 사라지면 그 원상품의 **국내/해외 금액 집계가 비워진다**
       🟢 다른 상품의 집계는 불변(쌍 단위 제외)
저장   🔴 `candidate_reviews` 에 **쓰지 않는다** — 제외는 그 앞이다(기존 행도 그대로 보존)
화면   🟡 ① 을 쓰면 「취급하지 않는 브랜드」임을 **화면이 말해야** 한다 —
       안 적으면 「분석이 실패했다」로 읽힌다(이 리포에서 반복된 함정) ⟹ 문구는 CPO 소관
```

---

## 5. 테스트 계획 · 예상 변경 파일

### 테스트 계획

```
Positive  Main Story 원상품 → ① 조기 종료 · 후보 0 · 사유 `BRAND_EXCLUDED`
          Main Story 후보(후보 brand null 인 C22 포함) → ② 제외 카운트 +1
Negative  🔴 **다른 브랜드 6쌍의 재현 verdict 가 바뀌면 FAIL**
          (`C27 PRESUMED_SAME · C50 PRESUMED_SAME · C05 SAME · C06 SAME ·
            S1-5 CONFLICT · S1-6 SAME` — 지금 값을 계약으로 못 박는다)
          🔴 「Story」 부분일치로 다른 브랜드가 제외되면 FAIL
음성 대조  ⒜ 제외 술어 제거 → Main Story 계약 FAIL ⒝ 술어를 전 브랜드로 확대 →
          다른 브랜드 불변 계약 FAIL ⒞ 경계 검사 제거 → 부분일치 계약 FAIL
회귀      전수 **10,274**(현 기준선) · typecheck 0 · build exit 0
🔴 GT 적용 테스트는 **넣지 않는다** — C42 뒤집힘 반영은 CPO 승인 사안이다
```

### 예상 변경 파일 — **운영 2 · 테스트 2**

| 파일 | 변경 | 성격 |
|---|---|---|
| `apps/.../_lib/run-domestic-price-check.ts` | ① 입구 조기 종료 + ② `judgeDomesticCandidate` 필터 1줄 · `DomesticJudgement` 에 `brandExcluded` 칸 | 운영 |
| `packages/crawler/src/comparison-search/brand-alias.ts` 또는 신규 순수 모듈 | 제외 술어 **하나**(🔴 alias 등록부는 **건드리지 않는다** ⟹ 신규 파일 권고) | 운영 |
| `apps/.../__tests__/mi-brand-exclusion-*.test.ts` | 신규 계약(Positive/Negative/음성 대조) | 테스트 |
| `apps/.../__tests__/core-same06-safety-gt-search.test.ts` | fixture 분류(이번 세션에 **이미** 1줄 추가) | 테스트 |

🔴 **404 제외는 위 목록에 넣지 않았다** — §3 의 상태코드 분리가 선행이고 그것은 별 건이다.

---

## 6. 🔴 CPO 판정이 필요한 것 — **다섯**

```
① 적용 단위 — ①(원상품 제외) ↔ ②(후보 제외) ↔ 둘 다
   🔴 CPO 문구는 「후보 제외」인데 **원본이 Main Story** 라 ② 만으로는 그 상품이 계속 분석된다
② ① 을 쓸 때 **화면 문구** — 「취급하지 않는 브랜드」를 어떻게 말하는가(안 적으면 실패로 읽힌다)
③ **C42 뒤집힘 적용 여부** — `SAME05_BASELINE`(same 18 · different 9 · fp 1)이 바뀐다.
   이번 세션은 **적용하지 않았다**(기존 GT 변경 금지)
④ **S1-6 오포함 1건** — Main Story 가 아니고 축은 **반팔 ↔ 긴팔** 이다.
   🟢 CEO 가 「유사상품 분류는 문제되지 않는다」고 적었다 ⟹ 그 등급을 쓸 것인가.
   🔴 CTO 는 소매 길이 규칙을 **만들지 않았다**(matcher 변경 금지 · WU-125 재현 0)
⑤ **404 제외 범위** — 상태코드 보존(수집 계약 변경)을 먼저 할 것인가.
   지금 켜면 **403·타임아웃도 같이** 빠지고, 정상 상품 손실은 **미측정** 이다
```

🔴 **CPO 승인 전까지 운영 코드를 바꾸지 않는다.**
