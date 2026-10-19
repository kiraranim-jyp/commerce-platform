# WU-109 — MI 가격집계 정확도 확정 (조사 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「`UNJUDGED` 집계와 `SAME/EXACT + Trenbe 가격 누락` **두 건만**
> 조사하여 국내/해외 가격비교 정확도를 **실제로 떨어뜨리는 결함인지 확정**하고
> **필요한 경우에만 최소 수정**」

---

# [WU-109 완료 보고]

## 1. `UNJUDGED` 가격 집계 — 🟢 **정상. 결함이 아니다 (내 하니스 오류였다)**

```
운영은 `transientEvidenceSink.push` 를 **한 곳**(run-domestic-price-check.ts:1255)에서만
부르고, 그 자리는 `judgement.kind === "JUDGED"` 분기 **안** 이다.
⟹ 🟢 **샵당 `best` 1건** 만 가격 집계 입력이 된다. `UNJUDGED` 라는 상태는 **존재하지 않는다**.
🔴 WU-108 의 「UNJUDGED 2/1 건이 집계에 들어간다」는 **내가 전 후보를 넣어서** 생긴 값이다.
   이 트랙에서 **네 번째** 같은 종류의 하니스 오류다.
```

🟢 **운영 규칙으로 재현한 결과**(샵당 best 1건):

| | 샵 | sink | `byPriceTier` |
|---|---:|---:|---|
| **S1** | 10(DROPPED 2) | **8** | `{EXACT 3 · EXCLUDED 2}` — 🟢 **UNJUDGED 0** |
| **S2** | 12(DROPPED 3) | **9** | `{EXACT 2 · EXCLUDED 3 · COMPARISON 1}` — 🟢 **UNJUDGED 0** |

### CPO 4문에 대한 답
```
① tier 가 샵당 best 1건만인가            🟢 **그렇다**(코드로 확인)
② UNJUDGED 가 집계에 들어가는 게 정상인가  🟢 **그런 일이 일어나지 않는다**
③ 들어간다면 어떤 조건인가                 🟢 **해당 없음**
④ 같은 샵 후보 여러 개일 때 중복/오대표     🟢 **중복 0**(샵당 1건)
   🔴 단 「best 가 올바른 대표인가」는 `selectDomesticCandidate` 소관이고 **이번 범위 밖**
```

### 🔴 WU-108 의 집계 숫자를 **정정한다**
```
S1 OS  count 7 → **5** · USD 최저 44 → **53** · GBP 최저 33 → **37** · CAD 64(동일)
S2 OS  count 7 → **6** · USD 58(2) · GBP 33(1) · 🔴 **EUR 40 이 사라졌다**
       (stockmann.ee 가 그 샵의 best 가 아니었거나 DROPPED — 🔴 가르지 않았다)
S2 KR  **1 · KRW 88,000 · COMPARISON** (변화 없음) 🟢
```

## 2. Trenbe 가격 누락 — 🔴🔴 **원인 확정. 진짜 결함이다**

```
운영 owner  status **OK** · fetchPath **SHOPIFY_JSON** · httpCalls 1
            price **null** · priceStatus **undefined**
raw fetch   HTTP 200 · 본문 766,131 bytes
```

### 🔴 가격은 **두 곳에 다 있다**
```
① 운영이 «이미 받은» Shopify JSON
   variants[0].price = **"84.00"**
   variants[0] 키에 **`price_currency`** 가 **있다**(전수 출력으로 확인)
② HTML
   JSON-LD `priceCurrency` **USD** · og:price:amount **84.00** · og:price:currency **USD**
```

🔴🔴 **즉 통화까지 있는데 운영이 읽지 않는다.** WU-019R 이 기록한 「`factsFromProductUrl`
이 price 를 **의도적으로 null** 로 둔다」가 그 자리이고, WU-079 가 「`SHOPIFY_JSON` 경로는
HTML 을 안 받아 JSON-LD 를 영구히 못 본다 · 🟢 지금은 `enrichCandidatePrices` 가 메운다 ·
🔴 **그 실패 조건은 미측정**」으로 **보류 보관** 한 바로 그 자리다.

🟢🟢 **그 「미측정」이 이번에 측정됐다** — `enrichCandidatePrices` 가 **메우지 못한 실례** 이고,
그 후보가 하필 **MI SAME / tier EXACT / URL 에 품번이 있는 동일상품** 이다.

## 3. 국내 가격비교 정확도 — 🟢 **PASS**

```
S2  KRW 88,000(biskuit.kr · COMPARISON · market KR) **1/1 정확**
🟢 `.com`+KRW 인 m.luxboy ₩59,000 은 **UNKNOWN** 이라 들어가지 않았다
   🟢🟢 그리고 WU-077 이 그 금액을 **Human DIFFERENT** 로 측정했다 ⟹ **안 넣은 것이 정답**
🔴 단 **사람이 biskuit 를 확인하지 않았다**(근거는 URL 품번 하나)
```

## 4. 해외 가격비교 정확도 — 🟡 **부분 PASS**

```
🟢 `EXCLUDED` 가 금액에서 정확히 빠진다 — S1 count 5 인데 byCurrency 합 **3**
   (EUR 35 · GBP 35 가 EXCLUDED 라 빠졌고 GBP 최저가가 **37** 이 됐다)
🟢 통화를 섞지 않는다 · 환산 0 · 국내↔해외 중복 0
🔴 **Trenbe 1건 누락**(§2) — SAME/EXACT 인데 금액이 없어 해외 집계에 못 들어간다
```

## 5. DIFFERENT 가격 **오포함** — 🟢 **0 건**
`CONFLICT` → `EXCLUDED` → **금액 집계 제외** 가 전건 성립했다(S1 2 · S2 3).

## 6. SAME 가격 **누락** — 🔴 **1 건** (`global.trenbe.com`)

## 7. 수정 여부 — 🔴 **이번 세션에서 하지 않았다**

```
🔴🔴 **헌장 §4-B 의 「용량 판단」 규칙을 적용했다**:
   「한 세션에 끝까지 못 갈 크기면 **착수 전에** 범위를 줄이거나 다음 세션으로 넘긴다.
    **작업트리를 더럽힌 채 중간에 끊기는 것이 가장 나쁘다.**」
   남은 컨텍스트로 **구현 + 계약 테스트 + 음성대조 + 전체 회귀 + build + 배포** 를
   안전하게 끝낼 수 없다고 판단했다. 🔴 **작업트리를 clean 으로 둔다.**
```

### 🟡 다음 세션용 **최소 수정안** (🔴 아직 구현 안 함)

```
위치  packages/crawler/src/comparison-search/product-url-facts.ts
      `fetchPath: "SHOPIFY_JSON"` 분기(약 :205) — price 를 null 로 두는 자리
방법  **이미 받은 Shopify product JSON** 에서 `variants[0].price` +
      `variants[0].price_currency` 를 읽는다
비용  🟢 **추가 HTTP 0** (JSON 을 이미 받았다)
안전  🔴 `price_currency` 가 **없으면 null 을 유지** 한다 —
      통화 없는 숫자를 가격으로 쓰지 않는다(헌장 `resolveSourcePrice` 계약)
🔴 **사이트 전용 parser 가 아니다** · **generic 숫자 parser 가 아니다**(WU-079 금지 밖)
🔴 그러나 **모든 Shopify 후보의 가격이 새로 생긴다** ⟹ 영향 범위가 넓다.
   ⟹ 🔴 **구현 전에 CPO 승인이 필요하다**(WU-079 가 REJECT 한 축과 인접하다)
```

## 8. E2E / 회귀 / 배포

```
typecheck **0** · apps/admin **600 files / 8,367 passed** · failed **0**
🔴 배포 **없음** — 운영 코드가 **한 줄도** 바뀌지 않았다
HTTP 약 110(read-only)
```

## 9. 1차 목표 완료 가능 여부 — 🔴 **아직 아니다**

```
① 동일상품 판별 정확     🟡 이 표본에서 오탐 0 · 🔴 **사람 확인 없음**
② 국내 동일상품 가격 정확 🟢 **PASS**(1/1)
③ 해외 동일상품 가격 정확 🟡 **부분** — 🔴 SAME/EXACT 1건 누락
④ 화면에 정확히 표시     🔴 **CTO 측정 불가**(로그인 뒤)
⟹ 🔴 **③의 결함 1건을 닫고 ①④를 CEO 가 확인해야** 1차 목표 완료를 말할 수 있다
```

---

## 🔴 Known Unknowns

```
① 🔴 **S2 의 EUR 40(stockmann.ee)이 왜 사라졌는지 가르지 않았다**(best 아님 ↔ DROPPED)
② 🔴 표본 **상품 2개 · 샵 22곳** 이다
③ 🔴 `biskuit` ₩88,000 과 `trenbe` 가 **진짜 동일상품인지** 사람 확인 없음
④ 🔴 최소 수정안의 **영향 범위를 측정하지 않았다** — 「모든 Shopify 후보에 가격이
   새로 생긴다」가 국내/해외 최저가를 **어떻게 바꾸는지** 미측정
⑤ 🔴 `price_currency` 가 **항상 채워지는지** 확인하지 않았다(trenbe 1건에서만 봤다)
```

## CEO Action — **없음** (배포가 없다)

## 결론 — 🟡 **HOLD / 다음 세션 구현 대기**

```
1. UNJUDGED 집계  🟢 **정상**(내 하니스 오류 · 정정 완료)
2. Trenbe 누락    🔴 **원인 확정** — SHOPIFY_JSON 경로가 **이미 받은 JSON 의 price·
                  price_currency 를 읽지 않는다**(추가 HTTP 0 으로 고칠 수 있다)
3. 국내 정확도    🟢 **PASS**
4. 해외 정확도    🟡 **부분**(누락 1)
5. DIFFERENT 오포함 🟢 **0**
6. SAME 누락      🔴 **1**
7. 수정           🔴 **안 함**(용량 판단 · 작업트리 clean 유지 · **CPO 승인 필요**)
```
