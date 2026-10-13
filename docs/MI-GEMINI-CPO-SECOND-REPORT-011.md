# MI-GEMINI-CPO-SECOND-REPORT-011

> **CEO Action Required: NONE**
> 🔴 Production 전환은 CPO 판단 영역이다. 이 문서 하나만 읽으면 된다.

---

## 1. Executive Summary

```
🟢 사슬은 끝까지 «배선» 됐다 — Discovery → self-ref → 가격보강 → 국내집계 → MI 판정
🔴🔴 그런데 **유효 국내 EXACT = 0** 이다. WU-4 와 같은 결론이고, 이번에는 **이유가
     정확히 하나로 좁혀졌다** — 「가격이 붙지 않는다」.
🟢 Gemini 는 identity 축에서는 작동한다 — SAME 2 · PRESUMED_SAME 4 (N=6).
🔴 그 판정이 **국내 가격 증거가 되지 못한다** — KRW 가격 확보 **0/12**.
🟢🟢 **grounding 비용이 처음으로 측정됐다** — 호출당 **5.5 쿼리**(44/8).
     내가 이전에 「측정 불가」로 보고한 것은 **틀렸다**(엉뚱한 칸을 봤다).
🟢 안전성은 확인됐다 — 기존 국내 증거가 줄어든 상품 **0**. Gemini 가 덮어쓰지 않는다.
🔴 Production readiness: **HOLD** (근거 §7)
```

🔴🔴 **표본 2건이 오염돼 있었고 그것을 내가 찾아 제외했다** — 아래 §2 를 먼저 읽어야
나머지 숫자를 올바르게 해석할 수 있다.

---

## 2. 🔴🔴 측정 전제 — 표본 오염과 예산 제약 둘

### ⓐ 내 덤프가 비-아동 상품을 KIDS scope 에 넣었다

```
오염 2건   「【楽天市場】…」 일본 라쿠텐 리스팅 · 그중 하나는 **골프 드라이버**
원인       덤프 조건을 `brand NOT ILIKE '%sergio%'` 로 넓혀 브랜드 공백/비-의류가 들어왔다
피해       Gemini 호출 2회 + 후보 6개 소모 ·
           🔴 `store.shopping.yahoo.co.jp`(일본)가 **COMPARISON tier** 를 받았다 —
              일본 야후가 「국내 비교가격」 증거가 될 뻔했다
🟢 막힌 지점  KRW 가격이 없어 집계에 **들어가지 않았다** — §3 가격 게이트가 막았다
조치       덤프 조건 수정(브랜드 공백·AW26·라쿠텐/ゴルフ 제외) + **그 2건을 측정에서 제외**
           🔴 추가 Gemini 호출 **0** 으로 재집계했다(예산 때문).
```

### ⓑ 예산이 discovery 조건을 바꿨다 — Before/After 를 그대로 비교하면 안 된다

```
CPO 한도 ₩7,607 · 추가 충전 없음
오늘 차감 ₩17,393 ÷ grounded 호출 약 20~26 → 호출당 약 ₩670~870 → 한도 ≈ 9~11 호출
→ §12 권장(아동 12~15 · 테니스 5~10 × 상품당 2쿼리 = 최대 36호출)은 **예산 초과**
🟢 그래서 **상품당 쿼리를 2 → 1** 로 줄였다(MI-GEMINI-INTEG-002 와 같은 조건)
🔴 **WU-4 는 쿼리 2 였다.** discovery 조건이 다르므로 Discovery 계열 KPI 를
   1:1 로 비교하지 않는다(§2 「조건이 다른 KPI 는 억지로 비교하지 않는다」).
```

---

## 3. KPI Dashboard (`sample 상품 N=6` · 상품당 쿼리 1)

### 5단계를 섞지 않는다 — 각 단계의 전이율

```
① Discovery       Gemini 발견 URL **74**  →  상품페이지 해석 19  →  MI 후보 **12**
                  outcome OK 7 · API_FAILURE 1(TimeoutError)
② Self-reference  제거 **1** (008A 가 잡았다 — junioredition)
③ Match (MI)      JUDGED **6** / DROPPED 4(전부 `EVIDENCE_NOT_WORTHWHILE`)
                  matchTruth  STRONG_IDENTIFIER 2 · TEXT_CONFIRMED 4
                  verdict     **SAME 2** · PRESUMED_SAME 4
                  tier        **EXACT 2** · COMPARISON 4
④ Domestic+Price  handle 추출 가능 URL 5 / handle 없음 12
                  가격 확보(VERIFIED_CURRENT) **1** / 미확보 16
                  🔴🔴 **KRW 국내가격 evidence 0**
⑤ Decision        집계가 바뀐 상품 **0** · 🟢 기존 증거가 줄어든 상품 **0**
```

🔴 **Precision/Recall 은 「측정불가」로 남긴다** — Ground Truth 를 세울 근거가
부족하다(§3: 억지로 PASS/FAIL 을 만들지 않는다). 아래 §6 이 그 대신 **무엇을 더
찾았는가** 를 사례로 적는다.

---

## 4. 🔴🔴 유효 국내 EXACT = 0 — 그 2건의 정체

| 원상품 | 후보 host | matchTruth | tier | 가격 | 판정 |
|---|---|---|---|---|---|
| Bobo Booty Ghosts | `tinyapple.net` | STRONG_IDENTIFIER | EXACT | 🔴 `UNVERIFIED_SEARCH` | 가격 미확보 |
| Bobo Booty Ghosts | `bobochoses.com` | STRONG_IDENTIFIER | EXACT | 🟢 확보 · **EUR** | 🔴 KRW 아님 → 제외 |

🟢 **identity 는 맞았다**(둘 다 `SAME`). 🔴 **국내 가격 증거가 되지 못했다** —
하나는 가격을 못 얻었고, 하나는 **해외 통화** 다.
🔴 그래서 **「tier EXACT」 ≠ 「유효 국내 EXACT」** 다. 이 구분을 KPI 에서 섞지 않는다.

🔴 `tinyapple.net` 의 국내 여부는 **미확인** 이다(`.net`). 확인 없이 국내로 세지 않았다.

---

## 5. Domain Coverage

| domain | 후보 | handle 추출 | 가격 성공 | 실패 | 통화 | tier |
|---|---:|---:|---:|---:|---|---|
| `bobochoses.com` | 1 | 1 | **1** | 0 | **EUR** | EXACT 1 |
| `tinyapple.net` | 1 | 1 | 0 | 1 | — | EXACT 1 |
| `familynet.looxloo.com` | 1 | 0 | 0 | 1 | — | — |
| `babybubble.co.kr` | 1 | 0 | 0 | 1 | — | — |
| `checkanddot.com` | 1 | 0 | 0 | 1 | — | — |
| `tennis-warehouse.com` | 2 | 0 | 0 | 2 | — | COMPARISON 2 |
| `pickleballwarehouse.com` | 1 | 0 | 0 | 1 | — | COMPARISON 1 |
| `sergiotacchini.com` | 1 | 1 | 0 | 1 | — | COMPARISON 1 |
| `musinsa.com` | 2 | 2 | 0 | 2 | — | — |
| *(제외됨)* `store.shopping.yahoo.co.jp` · `lotteon.com` | — | — | — | — | — | 오염 표본 |

🔴 **`enrichCandidatePrices` 는 Shopify 전용** 이다. 국내 후보 host 중 handle 을
뽑을 수 있던 것은 `musinsa.com` 2건뿐이고 그마저 가격 실패다.
🔴 `musinsa.com` 은 **포털/오픈마켓이라 약관상 대상이 아니다**(헌장 §12).
🔴 그리고 내 1차 분류가 틀렸다 — `/products/<slug>` 정규식만 보고 무신사를
   「Shopify」로 셌다. 라벨을 **「handle 추출 가능(= enrich 시도 대상)」** 으로 고쳤다.

---

## 6. 실제 Business Value — Gemini 가 더 찾아낸 것

```
OFF(기존 국내 Discovery)  후보 **57** (6상품 합)
Gemini 가 추가로 낸 MI 후보  **12**
🟢 그중 기존이 못 내던 것: `tinyapple.net`·`babybubble.co.kr`·`checkanddot.com`·
   `familynet.looxloo.com` — 등록부에 없거나 등록부 검색이 못 찾은 국내/해외 샵
🔴 그런데 **그중 KRW 가격 증거가 된 것은 0** 이다.
→ 🔴🔴 현재 시점의 결론: **Gemini 는 「후보 URL」을 더 찾지만, 「등록 판단에 쓸 수
   있는 국내 가격 증거」를 아직 하나도 더 만들지 못했다.**
```

🔴 **그리고 Gemini 가 0건을 낸 상품이 2/6 이다**(Louise Misha Tender coat ·
Pèpè Lulu T Bar). 그 둘은 OFF 국내후보가 12·19개로 많았다 — 즉 기존 경로가 이미
후보를 내던 상품에서 Gemini 가 **아무것도 추가하지 못했다.**

---

## 7. Production Readiness — 🔴 **HOLD**

```
🟢 코드/안전성   flag OFF 기본 · fail-soft 확인(API_FAILURE 1건에도 전체 정상) ·
                 DB 저장 0 · 기존 증거 감소 0 · P-32 유지 · threshold 0
🔴 제품 가치      유효 국내 EXACT **0** · KRW 가격 증거 **0** · 집계 변화 **0**
                 → **flag 를 켜도 셀러가 보는 판정이 바뀌지 않는다**
🔴 비용           호출당 grounding **5.5 쿼리** · 총 44 쿼리 / 8 호출 / 28,570 토큰
                 🔴 실제 KRW 소모액은 **CTO 측정 불가**(AI Studio 가 ground truth)
→ **지금 켜면 비용만 발생하고 판정은 그대로다.** 그래서 HOLD 다.
```

---

## 8. Error Taxonomy — 잔여 문제 분류

| 분류 | 내용 | 등급 |
|---|---|---|
| **Price unavailable / Non-Shopify** | `enrichCandidatePrices` 가 Shopify 전용. 국내 후보 host 대부분이 handle 을 못 준다 → 가격 0 | 🔴 **BLOCKER** |
| **Price currency** | 가격을 얻은 1건이 **EUR**(브랜드 공식몰). 국내 가격 계약은 KRW | 🔴 **HIGH** |
| **Identity miss (gate)** | `DROPPED 4` 전부 `EVIDENCE_NOT_WORTHWHILE` — 가격 보강 **전** 단계에서 탈락 | 🟡 MEDIUM |
| **Discovery miss** | Gemini 0건 2/6 — 기존 경로가 이미 후보를 내던 상품 | 🟡 MEDIUM |
| **Infrastructure** | API_FAILURE 1(TimeoutError) → fail-soft 정상 | 🟢 LOW |
| **Self-reference** | 1건 제거(008A 작동) | 🟢 CLOSED |
| **Market mismatch** | 0건 — `marketCode: null` 고정이 작동 | 🟢 CLOSED |
| **Sample contamination** | 내 덤프가 비-아동(골프)을 포함 → 수정 + 제외 재집계 | 🟢 **수정 완료** |
| **Cost measurement** | grounding 쿼리 미포착 → **수정 완료**(호출당 5.5 실측) | 🟢 **수정 완료** |

---

## 9. 다음 단계 — CPO 가 바로 고를 수 있게

```
🔴 ①【정책 결정 필요】 국내 비-Shopify 샵의 가격을 어떻게 얻을 것인가
   현재 BLOCKER 다. 선택지:
     ⒜ 기존 어댑터 재사용 — 🔴 `searchDomesticShops` 의 샵별 어댑터는 **등록부 샵
        전용** 이고 Gemini 가 물어온 임의 host 에는 쓸 수 없다(미확인 아님 · 구조)
     ⒝ 공통 가격 추출기 신설 — 🔴 사실상 새 수집기이고 §6 의 4조건 심사 대상
     ⒞ **국내 가격 증거를 포기하고 identity 증거로만 쓴다** — 그러면 WU-009 가
        막혔던 「화면이 거짓말한다」 문제로 되돌아간다
   🔴 어느 쪽도 CTO 가 단독 결정할 수 없다.

🔴 ②【추가 데이터 필요】 표본이 N=6 이고 상품당 쿼리 1 이다. 예산이 허락하면
   정화된 덤프로 아동 12 + 테니스 6 · 쿼리 2 로 재측정해야 결론이 단단해진다.
   🔴 비용 추정: 18상품 × 2쿼리 = 36호출 × 5.5쿼리 ≈ **198 grounding 쿼리**.

🟢 ③【배포 가능하지만 의미 없음】 코드는 안전하다(회귀/빌드/가드 전부 PASS,
   flag OFF). 🔴 그러나 켜도 판정이 안 바뀌므로 **지금 배포할 이유가 없다.**
```

---

## 10. 검증 증거

```
🟢 admin regression   **509 files / 7,594 tests passed** / 53 skipped · failed **0**
🟢 crawler regression Files 1 failed / **61 passed** / 19 skipped ·
                      Tests **852 passed** / 23 skipped · 실패 «테스트» **0**
                      🔴 그 1 파일은 선재 collection failure(match-truth-priority →
                         apps/admin 깊은 import → `@/lib` alias 미해석)
🟢 typecheck          **10 = baseline 10**
🟢 guard              no-production-coupling **6/6**
🟢 build              exit 0 · Compiled successfully
🟢 mutation(선행 010R) 5/5 전부 잡힘 → 복구 PASS
🔴 Gemini 호출 8 · grounding 44 쿼리 · 토큰 28,570 (실행창 UTC 05:35:49~05:44:35)
🔴 DB insert 0 · migration 0 · schema 0 · UI 0 · merge 0 · deploy 0
```

### 이번 스프린트에서 내가 고친 것 (정책 변경 아님 · §15)

```
① grounding 쿼리 포착 — `webSearchQueries` 를 응답 타입/usage/metrics 에 배선.
   🔴 「측정 불가」라던 내 이전 보고를 **정정** 했다(엉뚱한 칸을 봤다).
   낡은 단언 둘을 **왜 바뀌었는지와 함께** 갱신했다(005 negative · p54c).
② 표본 오염 수정 — 덤프가 브랜드 공백/AW26/라쿠텐/골프를 넣지 않게.
③ 분류 라벨 수정 — 「Shopify 모양」 → 「handle 추출 가능(= enrich 시도 대상)」.
```

🔴 **정책이 필요한 것은 코드로 우회하지 않았다** — §9-① 이 그것이다.
