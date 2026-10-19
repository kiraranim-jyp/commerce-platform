# WU-111 — `priceStatus` 소비처 영향 조사 (STEP 2 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「**이번에는 코드 수정하지 않는다.** WU-110 에서 새로 생긴
> 가격이 **가격비교 경로 외 다른 소비처에서 의미 있는 문제를 만드는지만** 확인 ·
> `priceStatus` 자체를 **예쁘게 채우는 작업은 하지 않는다**」

---

# WU-111 STEP 2 보고

## 0. 🔴🔴 먼저 — **제가 CPO 에게 보고한 샵 이름이 틀렸습니다**

```
WU-110 보고서: 「S1 에 EUR 40(**stockmann.ee**)이 새로 들어왔다」
🔴 **틀렸다.** 실제로는 **`eraldo.com`** 이다(저장 데이터 `wu-109.json` 로 확인).
🔴 원인 — WU-108 에서 stockmann 이 EUR 40 이었던 것을 보고 **같은 금액이라 같은 샵이라
   추정** 했다. 🟢 추정이었고 **확인하지 않았다.**
🔴 그래서 **CEO 테스트 대상도 정정** 했다(§CEO).
```

## 1. 🟢 `priceStatus = undefined` 는 **운영 경로에서 사라진다**

```
factsFromProductUrl 반환 직후   priceStatus **undefined**
      ↓ withConfidence → **derivePriceStatus**(match.ts:568)가 **다시 정한다**
운영 값                         **UNVERIFIED_SEARCH** (WU-109 sink 실측)
🟢 UI 두 곳도 `?? "UNVERIFIED_SEARCH"` 폴백을 쓴다(ComparisonShopSearch:396·968)
⟹ 🟢 **CPO 가 물은 그 축은 닫혔다. `undefined` 는 문제를 만들지 않는다.**
```

## 2. 🔴🔴 그런데 **다른 결함이 드러났다 — 집계와 UI 가 서로 다른 기준을 쓴다**

| 축 | `priceStatus` 를 보는가 |
|---|---|
| 해외 **금액 집계**(`summarizeCandidateOverseasPrices`) | 🔴 **보지 않는다** — `EXCLUDED` 만 뺀다(WU-062) |
| **국내** 축 | 🟢 본다 — `VERIFIED_CURRENT && KRW` 요구 |
| **UI 숫자 표시**(`isPriceDisplayable` · price-truth.ts:14) | 🟢 본다 — **`VERIFIED_CURRENT` 만** |

### 실측 — 두 표본에서 **각각 1건**
```
S1  EUR 최저 **40**(eraldo.com) · priceStatus **UNVERIFIED_SEARCH**
    ⟹ 🔴 **집계는 그것을 「해외 최저가」로 쓰는데 후보 줄에는 「가격 확인 필요」가 뜬다**
    🔴 그 통화 축의 **유일한 근거** 라 셀러가 40 의 출처를 **화면에서 확인할 수 없다**
S2  USD 84(global.trenbe.com) · **UNVERIFIED_SEARCH**
    🟢 최저가가 아니라(58) **최저가 영향 0** · 🔴 그래도 같은 모순이다
🟢 나머지 최저가는 전부 VERIFIED_CURRENT (USD 53/58 · GBP 37/33 · CAD 64 · KRW 88,000)
```

## 3. 🔴 이것은 **WU-110 이 만든 결함이 아니다**

```
`UNVERIFIED_SEARCH` 가 금액 집계에 들어가는 것은 **원래 그랬다** —
WU-062 가 승인받아 뺀 것은 **`EXCLUDED` 하나** 이고 `priceStatus` 축은 **건드리지 않았다**.
🔴 WU-110 이 후보 가격을 늘려서 그 모순을 **드러낸** 것이다.
🟢 그래서 **WU-110 을 되돌릴 이유가 아니다** — 되돌리면 SAME/EXACT 누락이 돌아온다.
```

## 4. 🔴 수정하지 않았다 — **가격 정책이고 CPO 판정 사안이다**

```
⒜ `UNVERIFIED_SEARCH` 를 금액에서 제외  → 🔴 S1 의 **EUR 축이 사라진다**
⒝ UI 가 집계 숫자에 「검증 전」 표시     → 🔴 **UI 변경**(CPO §4 금지)
⒞ 현상 유지                            → 🔴 **모순이 남는다**
🔴 CPO 가 금지한 「`priceStatus` 를 예쁘게 채우는 작업」과도 **다른 축** 이다 —
   값을 채우는 게 아니라 **집계 «조건»** 을 정하는 문제다.
🔴 **CTO 가 고르지 않았다.** 운영 코드 변경 **0** · 배포 **0**.
```

## 5. 그 밖의 소비처 — 🟢 **영향 없음**

```
GeminiTransientCandidates:103  UNVERIFIED_SEARCH → 「판매처 표시가 · 상세 검증 전 ·
                               판매판정 미반영」 🟢 **금액을 보여주고 상태를 말한다**
ComparisonShopSearch:396·968   `?? "UNVERIFIED_SEARCH"` 폴백 🟢 안전
price-source-adapter:237       `PRICE_UNAVAILABLE` 일 때 price 를 안 건드린다 🟢 무관
국내 축 / price_alerts         🟢 `VERIFIED_CURRENT && KRW` 요구 ⟹ **진입 0**
```

---

## 🔴 Known Unknowns

```
① 🔴 **전수 영향 미측정** — 「집계 최저가가 UNVERIFIED 인 통화」가 전체에서 몇 건인지 모른다
   (이 표본에서는 **S1 EUR 1건**)
② 🔴 `eraldo.com` EUR 40 과 `trenbe` USD 84 가 **진짜 동일상품인지** Human GT 가 없다
③ 🔴 `priceStatus` 를 집계 조건에 넣었을 때의 **손실을 계산하지 않았다**
④ 🔴 §0 의 샵 이름 오류처럼 **추정을 확인 없이 적은 사례가 또 있을 수 있다** —
   이번 보고의 숫자는 전부 `wu-109.json` 저장값에서 **다시 읽었다**
```

## 결론 — 🟡 **STEP 2 완료 / 새 결함 1건은 CPO 판정 대기**

```
🟢 CPO 가 물은 것(`priceStatus = undefined`) → **문제 없음**(운영이 다시 정한다)
🔴 그 조사에서 **다른 결함이 드러났다** — 집계는 안 보고 UI 는 본다
   ⟹ 「해외 최저가」와 「그 근거 후보 줄」이 **갈릴 수 있다**(S1 EUR 실측 1건)
🔴 WU-110 의 결함이 **아니다**(원래 구조) · 수정은 **가격 정책** ⟹ **CPO 판정**
🟢 운영 변경 **0** · 배포 **0**
```

## CEO Action — 🟡 **WU-110 배포 결과 최종 화면 1회** (🔴 대상 정정)

```
URL  https://ttaejyo.vercel.app/pipeline

① B226AC009 (Hug Hairy Monster T-shirt)
   🇰🇷 Biskuit **₩88,000**
   🌎 **USD 58** · **USD 84**(trenbe) · **GBP 33**
   🔴 **USD 최저가가 58** 이어야 한다(84 가 최저가면 FAIL)
   🔴 「동일상품 아님」 금액이 섞이지 않았는지

② B226AC010 (Booty Ghosts T-shirt)
   🔴🔴 **새로 나타난 EUR 40 은 `stockmann.ee` 가 아니라 `eraldo.com` 입니다**
        (제 WU-110 보고서의 샵 이름이 틀렸습니다 — 정정합니다)
   🔴 **eraldo.com 의 그 상품이 실제 동일상품인지** 봐 주십시오
   🟡 그리고 그 후보 줄이 **「가격 확인 필요」**로 뜨면서도 **해외 최저가에는 EUR 40 이
      표시될 수 있습니다** — 🔴 그것이 이번에 찾은 결함입니다
      (**정상이 아니고**, 제가 고치지 않았습니다)
```
