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

---

# WU-111 STEP 3 — 두 후보 육안 GT (🔴 판정은 CEO · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「`eraldo.com EUR 40` 의 실제 동일상품 여부를 **Human GT** 로
> 확정하고, WU-110 의 신규 가격 후보가 MI 정확도를 훼손하지 않았는지만 확인한다. **코드 수정 0.**」

🔴 **CTO 는 SAME/DIFFERENT 를 적지 않았다**(§12-00 ③ · WU-093 선례). 아래는 **판정 근거가 되는
관측값** 이고 판정 칸은 CEO 대기다.

```
GT 페이지  https://claude.ai/code/artifact/f8060423-ea80-4e02-8ba8-705194f93509
파일       docs/wu-111-gt-review.html (자립형 721KB) · 생성기 scripts/wu-111-build-gt.mjs
🟢 이미지 **4/4** 를 data: URI 로 임베드 — 원격 이미지 0(로그인·네트워크 없이 사진이 뜬다)
🔴 운영 추출기 변경 0 — 검증 화면용으로 og:image/og:title 만 **읽었다**
```

## A. B226AC010 — `eraldo.com` EUR 40

| | 원상품 | 후보 |
|---|---|---|
| 제목 | Booty Ghosts T-shirt | Bobo Choses Booty Ghost-print **Long-sleeve** T-shirt |
| 가격(페이지) | EUR 40 | 🔴 **og:price `67,077 KRW`** |
| 우리 판정 | — | tier **COMPARISON** · `TEXT_CONFIRMED` · UNVERIFIED_SEARCH |

```
🔴 **갈릴 수 있는 관측 축 하나** — 후보 제목에 **「Long-sleeve」** 가 있고 원상품 제목에는 없다.
   🔴 그것이 「다른 상품」인지 「같은 상품의 다른 표기」인지는 **CTO 가 판정하지 않았다**.
🔴 **WU-099/100 의 CEO 라벨을 끌어오지 않는다** — 그 평가의 원상품은 **B226AC112(Pop T-shirt)**
   였다(WU-102 가 확정). 같은 샵·같은 제목이라도 **분모가 다르다**.
🟢 품번 축은 **증거 0** — 후보 URL/제목에 `B226AC010` 이 **없다**(`sameByUrl: false`).
   그래서 tier 도 EXACT 가 아니라 **COMPARISON** 이다.
```

### 🔴🔴 그리고 STEP 3 에서 **새 관측 1건** — 같은 URL 이 **두 통화** 를 낸다

```
Shopify JSON  variants[0].price **40.00** + price_currency **EUR**  ← 우리 집계가 쓰는 값
HTML og:price **67,077 KRW**                                        ← 사람이 그 페이지에서 보는 값
🟢 WU-110 의 안전조건은 **지켜졌다** — 통화가 **명시된** 값만 썼다(지어내지 않았다)
🔴 그러나 「해외 동일상품 참고가격 EUR 40」과 **셀러가 그 링크를 눌러서 보는 금액이 다를 수 있다**
🟢 **우리 버그가 아니다** — Smallable 과 같은 성질(방문자에 따라 통화를 바꾼다 ·
   메모 `smallable-market-is-shipping-destination` · WU-090 에서 같은 모양을 기록했다)
🔴 **고치지 않았다** — 통화/표시 정책이고 이 WU 의 범위가 아니다. 🔴 전수 빈도 **미측정**
```

## B. B226AC009 — `global.trenbe.com` USD 84

| | 원상품 | 후보 |
|---|---|---|
| 제목 | Hug Hairy Monster T-shirt | Bobo Choses Kids Hug Hairy Monster **Long Sleeve** T-Shirt (Light Blue) **B226AC009** … |
| 가격 | EUR 40 | USD 84 (og:price 84.00 USD · JSON 과 일치) |
| 우리 판정 | — | tier **EXACT** · `STRONG_IDENTIFIER` · UNVERIFIED_SEARCH |

```
🟢 품번 축 **증거 있음** — 후보 제목·URL 에 **B226AC009 가 그대로** 있다(`sameByUrl: true`)
   ⟹ `confirmBrandCodeInEvidence`(WU-004)가 그것을 읽어 EXACT 에 닿았다
🟢 **집계 최저가는 이 판정과 무관하다** — USD 최저가는 **58**(tinyapple.net · VERIFIED_CURRENT)
   이고 84 는 최저가가 아니다 ⟹ 🔴 **GT 결과가 어느 쪽이든 USD 최저가는 58 이어야 한다**
🔴 색상 축은 미확인 — 후보는 「Light Blue」를 적고 원상품 `colorText` 는 이 표본에서 확인하지 않았다
```

## 📋 CEO 보고 양식 (채워 주실 칸)

```
B226AC010
- eraldo.com EUR40: SAME / DIFFERENT / UNCERTAIN
- 근거:

B226AC009
- trenbe USD84: SAME / DIFFERENT / UNCERTAIN
- 근거:
```

## `priceStatus` 정책 변경 필요 여부

```
현재 즉시 수정: **NO**
이유:
 ① 🔴 **판정 입력이 아직 없다** — 두 후보의 Human GT 가 들어오기 전에 집계 조건을 바꾸면
    「맞는 가격을 뺐는지 틀린 가격을 뺐는지」를 알 수 없다
 ② 🔴 **영향 분모가 미측정** 이다 — 「집계 최저가가 UNVERIFIED 인 통화」가 전체에서 몇 건인지
    모른다(이 표본에선 **S1 EUR 1건** · S2 는 최저가 영향 0)
 ③ 🔴 어느 선택지에도 **비용이 있다** — 제외하면 S1 의 EUR 축이 **사라지고**,
    UI 표시는 **UI 변경**(CPO 금지)이다
 ④ 🟢 **지금 당장 잘못된 금액이 판매판정에 들어가지는 않는다** — 해외 축은
    `push` 뒤 `continue` 라 판정에 닿지 않고(WU-059), 국내 축은 `VERIFIED_CURRENT && KRW`
    를 요구해 진입 0 이다 ⟹ **급하게 고쳐야 하는 안전 결함이 아니다**
🔴 단 **모순은 남아 있다** — 「해외 최저가」와 그 근거 줄의 표시가 갈린다. **CPO 판정 대기.**
```

## STEP 3 실행 비용 / 회귀

```
HTTP **9**(read-only · 페이지 4 + 이미지 4 + Shopify JSON 1) · AI 0 · 운영 변경 **0** ·
배포 0 · 테스트 추가 0(측정 전용) · typecheck/build 영향 0
```

