# 백로그 — Smallable 관련 (CPO 확정 2026-11-07)

> 🔴🔴 **이 건들은 `a0b3c08`(Smallable 현지통화) CLOSED 를 «다시 열기 위한 조건이 아니다».**
> CPO 명시: 「현재 CLOSED 판정을 재개하지 않는다.」 각각 **별도 이슈** 로 관리한다.
> 🟢 발견 경로 — `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md` §8(부수 관측).
>
> **현재 상태 — 등록 2건 중 1건이 즉시 닫혔다**
> ```
> BL-1 Smallable 원본가격 행 부재   🟢 **CLOSED** — 「부재」가 **내 측정 오류** 였다(행 63 실재)
> BL-2 배송 가능 국가 가드 부재      🔴 **P1 유지** — 조사 미착수
> ```
> 🔴 BL-1 을 **CPO 표의 P1 으로 남기지 않는다** — 작업할 것이 없다(아래 정정 참조).

---

## BL-1 · ~~Smallable 원본가격 행 부재~~ → 🟢🟢 **CLOSED · 「부재」는 내 측정 오류였다**

🔴🔴 **등록 즉시 닫혔다.** CPO 원칙 ⒟(근거 없는 판정 금지)에 따라 **제목이 맞는지 1번 질의로
가른 결과**, 그 행은 **실재한다.** 🔴 그러므로 **P1 작업이 아니다.**

### 정정 (운영 DB 실측 · 2026-11-07)
```
🔴 내가 틀린 것 — 분모를 **`source_product_url` 축** 으로 셌다.
   `source_product_url ilike '%smallable%'` → 248행(4시장 × 62) · 원본 행 **0** 으로 보였다.
🟢 **`snapshot_id` 축** 으로 다시 세니 원본가격 행이 **63행 실재** 한다:
     market (원본) · source_label **ORIGIN_FX** · EUR · n **63** · with_url **0** · last 2026-10-29
   ⟹ 🔴 「행이 없다」가 아니라 **「그 행에 URL 이 없어서 내 질의가 못 센 것」** 이었다.
🟢 그리고 `with_url 0` 은 **설계대로** 다 — `buildCostBasisObservation`(`run-price-check.ts:222`)이
   `sourceProductUrl: probe?.sourceUrl ?? null` 이고, Smallable 은 **원본 probe 가 없다**
   (사이트별 probe 는 **시장 행** 을 만든다) ⟹ 원본 행은 URL 없이 선다.
🟢 부수 관측도 같은 성질이었다 — PHASE 2 §8 의 「`currency='JPY'` 중 host null 15행」.
```

### 🟢 그래서 남는 것
```
🔴 **작업 없음.** 추정·환산·대체를 할 이유가 애초에 없었다(값이 있다).
🟢 **교훈만 남는다** — 「price_observations 를 URL 축으로 세면 원가 행이 조용히 빠진다.
   원가 행은 `source_product_url` 이 null 일 수 있으므로 **`snapshot_id` 축으로 센다**.」
🔴 그리고 CPO 처리 기준은 **그대로 유효** 하다(다른 판매처에서 진짜 부재가 나올 때를 위해):
   현재가를 정가로 **복사하지 않는다** — 할인 없는 상품에 **가짜 할인** 이 생긴다
   (`smallable-market-probe.ts:294-297` 이 `regularPrice: null` 로 둔 이유).
```

---

## BL-2 · Smallable **배송 가능 국가 가드 부재** — P1

### 관측된 사실
```
🟢 Shopify 축에는 가드가 **있다** — `marketMayBeObserved(shopMeta, marketCode)`
   (`shopify-market-probe.ts:124` · `/meta.json` 의 `ships_to_countries` 를 읽는다)
   🟢 그 가드가 실제로 일한다 — 「Bobo Choses 는 일본에 배송하지 않는다 → false」
      (계약 `global-source-price-policy.test.ts:173`)
   🔴 그것이 없으면 **배송하지 않는 나라에 프로브를 돌려 본국 가격이 그 나라 관측으로 저장** 된다
      (Bobo 실측: `?country=JP` ≡ `?country=XX` → EUR 75 스페인 가격)
🔴 **Smallable 경로에는 그에 해당하는 가드가 없다**(`probeSmallableMarkets` 전수 확인).
🔴 그리고 Smallable 이 유효 배송국가를 **선언하는지 확인되지 않았다** —
   PHASE 2 라이브(HTML 706KB)에서 `ships_to`/`shippingCountries`/`availableCountries`
   계열 선언 **0건**. 🔴 「선언하지 않는다」로 단정하지 않는다(별도 endpoint·쿠키 축 미조사).
🟡 Smallable 은 **네 국가에서 금액이 실제로 다르다**(fr 49~54 · 지역별 차이 실측) ⟹
   Bobo 의 「무시하고 본국 가격을 돌려준다」 모양과는 다르다. 🔴 그러나 그것이
   **배송 가능의 증거는 아니다**(§처리 기준).
```

### 🔴 처리 기준 (CPO 확정)
```
**배송 가능 여부를 확인할 수 있는 근거와 판정 기준부터 조사** 한다 — 구현이 먼저가 아니다.
🔴🔴 **국가별 가격이 관측된다는 사실만으로 그 국가에 배송할 수 있다고 판단하지 않는다.**
🔴 이것은 **가격 표시와 별도 문제** 다(CPO 명시) ⟹ 글로벌 시장 카드 문구 작업과 섞지 않는다.
```

### 🔴 이 건이 이미 한 번 영향을 줬다 (기록)
```
글로벌 시장 카드 문구 작업지시서(`docs/WORKORDER-GLOBAL-MARKET-CURRENCY-NOTE.md` §3-2)가
CPO 권장 문구의 「배송국가별 가격」을 **「배송국가를 지정해 조회한 가격」** 으로 바꿨다 —
🔴 우리가 Smallable 의 JP 배송 가능 여부를 **모르기 때문** 이다.
🟢 ⟹ BL-2 가 닫히면 그 문구를 다시 볼 수 있다(그때까지는 **우리가 한 행위만** 말한다).
```

---

## 🔴 두 건에 공통으로 적용되는 금지

```
❌ `a0b3c08` CLOSED 재개              ❌ `market_country` 의미 변경
❌ §F(국가→통화 하드코딩) 해제         ❌ 현재가 → 정가 복사 · 환산으로 메우기
❌ 「가격이 관측된다」를 「배송 가능」으로 읽기
🟢 PHASE 2 의 계약 10건은 **그대로 유지** 된다
   (`packages/crawler/src/__tests__/phase2-market-currency-is-not-site-fx.test.ts`)
```
