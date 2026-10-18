# WU-060 — C06 False EXACT 원인 확정 (롱스프린트 · 운영 동작 변경 0)

> 🔴 CPO 지시 2026-10-18. 「WU-060 은 기능 완화보다 `C06 False EXACT` 원인 확정에 먼저 집중」
> 🔴 「현재 `BRAND_UNCONFIRMED` 완화는 승인하지 않습니다. 품번 exact 하나만으로 게이트를 열지도 않습니다.」

---

## 0. 한 줄 결론

```
🔴🔴 C06 은 **게이트가 놓친 FP 가 아니다.** 우리가 읽을 수 있는 **다섯 축이 전부 일치** 하고
     후보 페이지가 **스스로** 원상품과 같은 품번(B226AC009)·같은 색상명(Light Blue)을 적는다.
     사람은 **눈으로** 다른 색을 봤다(`humanReason: "컬러가 다름"`).
     ⟹ **텍스트 축에 신호가 없다.** 막을 수 있는 유일한 축은 **이미지** 다(Vision · 금지 영역).
🔴🔴 **보호조건을 «고를» 수 없다 — 분모가 1 이다.** 차단에 성공하는 조건이 셋 있고 그중 둘은
     이 표본에서 recall 비용 0 이지만, **전부 「데이터 풍부도」 프록시** 이고 상품 동일성과
     **인과가 없다.** 실측으로 그 성질이 드러났다(§4). **하나도 구현하지 않았다.**
🟢🟢 **CF-3 을 열어도 알림 경로는 열리지 않는다** — 승격 5건 중 국내 축 자격이 **0** 이고
     막는 것이 **시장 4건 + 가격 1건** 이다. 즉 ①②는 커플링돼 있지만 **실제 게이트는 ④(가격)** 다.
🟢 구현 = **계약 테스트 9건** · 운영 코드 변경 **0**
```

---

## 1. C06 역추적 — 원본 → URL → 실제 extraction facts

```
GT 행   id C06 · searchId S2 · humanGt **DIFFERENT** · humanReason **"컬러가 다름"**
        priorGt SAME  🔴 사전 라벨은 SAME 이었다 — CEO 블라인드 리뷰가 뒤집었다
원상품  junioredition.com/…/hug-hairy-monster-t-shirt-by-bobo-choses
        brand "Bobo Choses" · code **B226AC009** · color **"Light Blue"** · cat "T Shirt"
        설명문: 「Relaxed fit tee in a soft blue, featuring **long sleeves**, …
                 Colour - **Light Blue**. 100% Organic Cotton. Product code **B226AC009** AW26」
후보    global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-…
        fetchPath **SHOPIFY_JSON**
        brand "BOBO CHOSES" · code null(제목에서 **B226AC009 확인**) · color **"shirt light blue"**
        title 「Bobo Choses Kids Hug Hairy Monster **Long Sleeve** T-Shirt (**Light Blue**) **B226AC009** …」
```

🔴 **원상품 설명문에 「long sleeves」가 있으므로 「긴팔 ↔ 반팔」 차이도 아니다.** 상품군·대상·품번·색상명이 전부 일치한다.

## 2. owner 함수 단위 추적 — 왜 EXACT 까지 올라갔는가

```
compareCrossSellerProducts  → verdict **SAME** · blockers **[]** · conflicts []
  axes 5개 전부 획득 (총 7점)
    TITLE       +1  핵심 상품명 일부 hairy/hug/monster
    MODEL_CODE  +3  브랜드 품번 일치
    CATEGORY    +1  상품군 TOP↔TOP
    COLOR       +1  색상 BLUE                ← 🔴 후보가 스스로 적은 색상명이다
    AUDIENCE    +1  대상 KIDS
compareModelCode(B226AC009, B226AC009) → **exact**
isColorUnverified("Light Blue", "shirt light blue") → **false**  (일치로 센다)
deriveMatchTruth(very_high, exact, SAME, [], [], false)
  observedDifference **false** · crossSellerReserved **false** · colorUnverified **false**
  → :238 `modelCode === "exact"` → **EXACT_IDENTIFIER**
priceTierFromLink → **EXACT**
```

🟢 **게이트 넷이 모두 「막을 이유가 없다」고 정확히 판단했다.** 그것이 이 케이스의 성질이다.

## 3. 전수 동일 패턴 (GT 51)

```
False EXACT                        **1건** (C06)
verdict SAME & Human DIFFERENT     **1건** (C06 · 같은 건)
현행 EXACT 12 = Human SAME 11 + DIFFERENT 1  ⟹ precision **11/12 = 91.7%**
```

🟢🟢 **색상 보호장치가 Human DIFFERENT 23건 중 22건을 막고 있다** — 사유별로 보면 누출이 C06 하나뿐이다:
```
사유 없음           9  → COMPARISON/REFERENCE/EXCLUDED  (EXACT 0)
다른 컬러           5  → COMPARISON/EXCLUDED           (EXACT 0)
디자인+컬러+재질     3  → EXCLUDED/COMPARISON           (EXACT 0)
수영복 상의/하의     3  → EXCLUDED/COMPARISON           (EXACT 0)
디자인 다름 / 컬러 다름 2 → COMPARISON                   (EXACT 0)
🔴 컬러가 다름       1  → **C06: EXACT**  ← 유일한 누출
```

🔴🔴 **그리고 C05 ↔ C06 이 같은 원상품(S2)의 두 후보인데 가를 수 없다**:
```
C05 tinyapple.net      Human **SAME**       colorText "shirt light blue"  code **unavailable** → EXACT
C06 global.trenbe.com  Human **DIFFERENT**  colorText "shirt light blue"  code **exact**       → EXACT
⟹ 🔴 `colorText` 가 **글자 그대로 같다**
⟹ 🔴 그리고 **틀린 쪽이 식별자 증거가 «더» 많다**
```
🔴 나머지 차이는 전부 정답과 무관하다 — brand 대소문자 · 자기 CDN 이미지 · `categoryText`
(C05 가 **"Cardigans and Sweaters"** 인데 **티셔츠다** · C06 은 "NEW").

## 4. 🔴🔴 False EXACT 0 을 보장할 최소 보호조건 — **고를 수 없다**

현행 EXACT 12(SAME 11 · DIFFERENT 1) 위에서 6개 후보를 전수로 쟀다:

| | 조건 | 차단 | 🔴 SAME 손실 | 🟢 FP 차단 | C05↔C06 분리 | 판정 |
|---|---|---|---|---|---|---|
| P1 | 후보 `sizeLabels` 부재 → 금지 | 1 | **0** | 1 | 🟢 가른다 | 🔴 **인과 없음** |
| P2 | 후보 `materialText` 부재 → 금지 | 1 | **0** | 1 | 🟢 가른다 | 🔴 **쓰레기를 보상** |
| P3 | `categoryText` 가 상품군 아니면 금지 | 2 | 1 (C42) | 1 | 🟢 | 🔴 **틀린 값을 통과** |
| P4 | `colorText` 완전일치 요구 | 5 | **4** | 1 | 🔴 못 가른다 | 🔴 기각 |
| P5 | 구조화 `brandModelCode` 요구 | 5 | **4** | 1 | 🔴 못 가른다 | 🔴 기각 |
| P6 | 사이즈 교집합 0 → 금지 | 3 | 2 | 1 | 🟢 | 🔴 인과 없음 |

🔴🔴 **P2·P3 의 실체가 실측으로 드러났다 — 게이트가 쓰레기를 보상한다**:
```
C05(Human SAME · 통과)  materialText = "Tinyapple | FW26 Bobo Choses | Hug Hairy Monster T-shirt…"
                        🔴 **소재가 아니다** — 제목/브레드크럼 덤프다
                        categoryText = **"Cardigans and Sweaters"**  🔴 티셔츠인데 가디건이다
C42(Human SAME)         categoryText = **null** → 🔴 P3 가 **진짜 동일상품을 차단한다**
C06(Human DIFFERENT)    materialText = ""  categoryText = "NEW"  sizeLabels = []
```

🔴 **그러므로**:
```
① **분모가 1 이다.** 보호조건을 고르는 근거가 없다(§5-B — 분모 1 로 전략 판단 금지)
② 차단에 성공하는 셋(P1·P2·P6)은 **「데이터 풍부도」 프록시** 이고 상품 동일성과 **인과가 없다**.
   다른 표본에서는 **진짜 동일상품을 막을 이유가 없는데 막는다**
③ P1 은 **WU-045 의 사이즈 축 비차단 계약과 인접** 하다(차이가 아니라 부재지만 같은 축이다)
④ 🔴 **C06 을 막는 유일한 비프록시 축은 이미지** 이고 Vision 은 비용/금지 영역이다
⟹ **하나도 구현하지 않았다.** 대신 §4 의 사실을 계약으로 고정했다.
```

🟡 **CTO 권고**: C06 을 「고쳐야 할 결함」으로 보지 않고 **「텍스트 증거의 구조적 상한」** 으로
기록한다. 🔴 정밀도 목표를 「False EXACT 0」으로 세우면 **이미지 축을 열어야** 하고 그것은
별개의 비용/정책 결정이다.

## 5. CF-3 에서 품번 재사용이 실제로 어떻게 보호되는가

```
C19 junioredition  code exact · blockers [SAME_SELLER_DISTINCT_LISTING]            → solo **false** → CF-3 밖 → COMPARISON
C20 junioredition  code exact · blockers [COLOR_VARIANT+SAME_SELLER_DISTINCT_LISTING] → solo false → COMPARISON
C16 C18            verdict **CONFLICT** → 맨 위에서 조기 반환 → REFERENCE
C25 main-story     code unavailable · [COLOR_VARIANT]                              → CF-3 밖
🔴🔴 C22 donokids  code **exact** · blockers [BRAND_UNCONFIRMED] **solo=true** → **CF-3 조건 충족**
                   그런데 막힌다 — 막는 것은 **색상 축 하나** 다
CF-3 로 tier 가 바뀌는 것: C11 C14 C27 C37 C48 — **전부 Human SAME** (FP +0)
```

🔴🔴 **그런데 C22 의 방어가 「색이 달라서」가 «아니다»**:
```
oColor "Grey Melange" ↔ cColor **null**  → isColorUnverified = **true**
🔴 후보 제목에 `Conker Stripe` 가 있는데 **colorText 추출이 실패했다.**
⟹ 즉 **추출 실패가 «우연히» 방어로 작동했다.**
🟢 추출이 성공하면? "conker stripe" ↔ "Grey Melange" 불일치 → 색상 blocker 가 추가돼
   **solo 조건이 깨진다** → 여전히 막힌다(두 경로 모두 안전).
🔴 **그러나 후보가 원상품과 «같은» 색상명을 적으면 막히지 않는다** — 그것이 C06 의 클래스다.
   🔴 CF-3 의 미측정 FP 모드는 바로 이것이고, GT 51 에 표본이 **없다**.
```

🟢 **이중 잠금이 하나 확인됐다**(음성 대조가 찾았다): C19/C20 은
`SAME_SELLER_DISTINCT_LISTING`(OBSERVED 분류) **그리고** `crossSellerReserved`(PRESUMED_SAME)
**둘로** 막혀 있다. 분류표에서만 빼도 결과가 바뀌지 않는다(§9 N2).

## 6. 국내 EXACT → `price_alerts` 체인 재검증

```
CF-3 승격 5건의 국내 축 자격 — **0**
  C11 bobochoses.co.jp   해외          → 🟢 시장 게이트
  C37 bobochoses.co.jp   해외          → 🟢 시장 게이트
  C48 bobochoses.com     해외(EUR)     → 🟢 시장 게이트
  C14 kihanan.com        .kr 아님 · 등록부 아님 → 🟢 시장 게이트(UNKNOWN)
  C27 beaumonde.co.kr    **.kr** 이다  → 🔴 **가격 게이트**(priceStatus **PRICE_UNAVAILABLE** · price null)
운영 게이트 (run-domestic-price-check)  `priceStatus === "VERIFIED_CURRENT"` && `"KRW"`
```

🟢🟢 **그래서 결론이 CPO 의 우려를 «정밀화» 한다**:
> ①(CF-3)과 ②(파생 알림)이 커플링돼 있다는 판단은 **정확하다.** 🔴 그러나 **실제로 체인을
> 막고 있는 것은 ④(가격 추출)** 이다. §2 가 HOLD 인 동안 ①을 열어도 **국내 축 진입이 0**
> 이므로 `price_alerts` 경로는 **열리지 않는다.**
> 🔴 단 N=5 다. 「다른 상품에서도 안 열린다」로 일반화하지 않는다.

## 7. 해외 `EXCLUDED` · C27 본문가격 — **이번 WU 에서 유지**

```
해외 EXCLUDED 집계   🔴 손대지 않았다(WU-059 §5 그대로 · CPO HOLD)
C27 본문 가격        🔴 손대지 않았다(WU-059 §2 그대로 · CPO HOLD)
🟢 단 §6 에서 **C27 의 가격 미확보가 알림 체인을 막는 유일한 국내 게이트** 라는 사실이
   추가로 확인됐다 — ④를 열면 ①②의 결합이 실제로 발화할 수 있다.
```

## 8. 구현 결과

```
운영 코드 변경  **0**
테스트          wu-060-false-exact.test.ts **9건** 신규
fixture         wu-059-gt-facts.json 에 C05 C06 C14 C19 C20 C25 C37 C42 추가(실측 facts · 손으로 만들지 않았다)
                🔴 `priceStatus`·`price`·`humanReason` 칸도 함께 보존했다(§6 가 그것을 쓴다)
```

## 9. Negative / Mutation

baseline **22 passed**(WU-059 13 + WU-060 9) · 변형마다 원상복구 확인

| | 변형 | 결과 |
|---|---|---|
| N1 | `colorUnverified` 를 EXACT 게이트에서 제거 | 🔴 **2 failed** |
| N2 | `SAME_SELLER_DISTINCT_LISTING` 을 **OBSERVED 분류표**에서 제거 | 🟡 **22 passed** |
| N2b | `sameSellerDistinctListing` **push 자체** 를 `if (false)` 로 죽임 | 🔴 **3 failed** |
| N3 | `crossSellerReserved = false` (보류 무력화) | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **22 passed** |

🟢 **N2 의 통과가 결함이 아니라 «발견» 이다** — 내가 분류표만 건드렸고 blocker 는 그대로
남았다. C19/C20 은 `crossSellerReserved` 로 **이중 잠금** 돼 있어 분류 하나를 빼도 결과가
같다. 🔴 그래서 N2b 로 **push 자체** 를 죽여 가드가 무는지 확인했다(3 FAIL).
🔴 「분류표를 건드렸는데 통과했다」를 「가드가 없다」로 읽지 않는다 — 잠금이 둘이었다.

## 10~12. Regression / Typecheck / Build

```
회귀      apps/admin  **568 files / 8,233 passed** / failed 0 (skipped 94)
typecheck **0 errors**
build     **exit 0**
```

## 13~16. Commit / Deploy / Evidence / External API

```
외부 API  AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 **₩0** · 외부 HTTP **0**(전부 기존 캐시)
🟢 Gemini 잔액 ₩3,171 보존 · flag 미변경
🔴 운영 동작 변경이 0 이므로 Production 에서 «새로 보일 것» 이 없다 — §15 는 무변경 증거다.
```

## 17. 🔴 Known Unknowns — 0% 로 적지 않는다

```
① 🔴 **C06 의 «실제» 색 차이를 CTO 가 확인할 수 없다.** 셋 중 어느 것인지 미확정 —
   ⒜ trenbe 페이지가 Light Blue 라고 적고 **다른 색을 판다** ⒝ 사람이 이미지로 판정했다
   ⒞ GT 라벨 오류. 🔴 「페이지가 거짓말한다」로 단정하지 않았다
② 🔴 **분모 1.** False EXACT 가 1건이므로 보호조건의 효과/비용을 통계로 말할 수 없다
③ 🔴 N=51 · 원상품 호스트 **2개** · CF-3 승격 5건. 전수 498 값이 아니다
④ 🔴 **CF-3 의 미측정 FP 모드가 그대로 남아 있다** — 「후보가 원상품과 같은 색상명을 적지만
   실제로는 다른 상품」(= C06 의 클래스). GT 51 에 그 표본이 **없다**
⑤ 🔴 P1~P6 의 **운영 전수 효과는 미측정** 이다. 이 표의 숫자는 GT 51 안의 값이다
⑥ 🔴 이미지 축(Vision)의 실제 판별력도 **미측정** 이다 — 「이미지면 막을 수 있다」로 적지 않았다
```

## 18. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음(외부 호출 0)
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 19. 🔴🔴 CPO 최종 판정 요청 — **①②를 함께**

| | 안건 | CTO 권고 | 근거 |
|---|---|---|---|
| ① | **CF-3** 승인 여부 | 🟡 **보류 유지 권고** | GT 51 FP +0 이지만 **C06 클래스의 미측정 FP 모드** 가 남는다 |
| ② | **파생 알림** 영속 허용 | 🟢 **지금은 판정을 미룰 수 있다** | ①을 열어도 **가격 게이트** 때문에 체인이 닫혀 있다(§6 · N=5) |
| ⑤→ | **C06 을 결함으로 볼 것인가** | 🔴 **아니오 권고** | 텍스트 축에 신호가 없다. 「False EXACT 0」은 **이미지 축을 열어야** 달성된다 |
| 신규 | **이미지 축(Vision)을 식별 증거로 열 것인가** | 🔴 **CPO/CEO 비용 결정** | 이 WU 에서 **측정하지 않았다**(금지 영역) |

🔴 **CEO Action: 없음.** 운영 동작·UI 변경이 0 이므로 Production 테스트가 필요하지 않다.
