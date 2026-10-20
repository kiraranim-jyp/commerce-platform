# 🟢🟢 WU-136 — **셀러의 1순위를 판매여부로** (📊 시장 판매 판단)

> 🔴 CPO 지시(2026-10-20): 「셀러가 원상품 URL 을 넣는 이유는 **이 상품을 팔아도 되는가** 다.
> `SAME` 은 목적이 아니라 **중간 판정** 이다. 영역을 새로 만들지 말고 기존 가격비교 영역을
> **최종 시장판단 영역으로 재구성** 하라. 판매여부를 가격보다 먼저 계산하라.
> **가짜 데이터/추정값 금지.** 회귀 → typecheck → build → deploy → 실제 화면 검증까지 한 번에.」
>
> 🟢 **MI 판정 로직 · threshold · Registry · 8축 · 등록 로직 · AI · DB 변경 0.**
> 🔴 **기술 데이터 삭제 0** — 전부 **접었다**(testid 전건 보존).

---

## 1. 🔴🔴 STEP ① — 실측이 설계를 «뒤집었다» (추측 전에 쟀다)

CPO 규칙 §B/§G 는 「판매여부 미확인은 판매중으로 간주하지 않는다」다. 그런데 WU-132 는
`soldOut !== true`(품절만 제외)였고 그 자리에 **측정된 이유**가 적혀 있었다(국내 `sold_out`
은 true 0행 · null 113행). ⟹ 🔴 **먼저 「판매여부 신호가 실재하는가」를 쟀다.**

```
🔴 후보 생산자(product-url-facts.ts)는 판매여부 칸을 **아예 세우지 않았다** ⟹ 전건 null
   (실측 근거: WU-133/134 E2E 가 모든 행에 stock=null 을 찍었다)
🟢 그런데 Shopify 는 그 판정을 **이미 들고 있다** — `isVariantAvailable`
   (shopify-product-json.ts:91 · 재고추적 / backorder / 실재고)

Shopify 공개 `/products/{handle}.json` · human SAME 호스트 9 (2026-10-20)
  inventory_management  **9/9 가 "shopify"**
  inventory_quantity    🔴 **2곳만** 돌려준다 — thefrontshop(1) · junioredition(2)
  나머지 7곳            tinyapple · cissywears · trenbe · kids21 · bobochoses ·
                        eraldo · kolkid  ⟹ **qty 칸이 없다**
  rboutique             HTTP 404
```

🔴🔴 **그래서 운영 공식을 그대로 쓰면 거짓 결론이 난다** — `inventory_quantity ?? 0` 이
칸이 없을 때 **0 으로 떨어져 7곳이 「품절」** 이 된다. 🟢 그 파일 주석 자체가
「**『모른다』를 『0이다』로 취급하지 않는다**」고 적어 뒀는데, 제3자 공개 JSON 에서는 그
전제가 깨진다. ⟹ 🔴 **운영 owner 를 고치지 않고**(원상품 경로 불변) 후보 경로에
**「모른다」 축을 가진 술어**를 따로 뒀다.

---

## 2. 🟢 구현 — 신규 함수 **둘** · 운영 파일 **4**

```
packages/crawler/.../product-url-facts.ts
  🟢 shopifyVariantAvailability(body): boolean | **null**
     축은 운영 owner 와 **같은 Shopify 공식** 이다. 다른 것은 하나 —
     실재고 칸이 **없으면 null** 이고 0 으로 떨어지지 않는다.
  🟢 후보에 `soldOut` 배선 — 🔴 **추가 HTTP 0**(가격과 같은 응답을 다시 읽는다)

apps/admin/.../mi-same-candidates.ts
  🟢 saleState(row) → ON_SALE | SOLD_OUT | **UNKNOWN**   (셋을 둘로 접지 않는다)
  🟢 buildMarketJudgement(rows) — **판매여부를 가격보다 먼저** 계산한다
     sellers(SAME 만 · URL 중복 접음 · 판매중→미확인→품절 정렬) · onSale/soldOut/unknown ·
     국내/해외 판매중 · pricedSellers · byCurrency(**환산 0**) · verdict 넷

apps/admin/.../MarketPriceComparison.tsx   영역 **재구성**(추가 0)
apps/admin/.../GeminiTransientCandidates.tsx  `collapsed` prop + `Fold`
apps/admin/.../DomesticPriceIntelligencePanel.tsx  후보 구역 넷에 `collapsed`
```

### 🔴 verdict 를 **넷으로 가른다**(CPO §G — 「없다」로 뭉치지 않는다)
```
NO_SAME                동일상품으로 판정된 판매처가 아직 없습니다.
SAME_BUT_NONE_ON_SALE  동일상품은 확인됐지만 현재 판매중인 판매처를 확인하지 못했습니다 …
ON_SALE_NO_PRICE       동일상품이 판매중인 것은 확인됐지만 현재 가격을 확인할 수 없습니다.
ON_SALE                동일상품이 현재 판매중입니다.
```

### 🟢 화면 순서가 뒤집혔다 — **영역은 여전히 하나다**
```
📊 시장 판매 판단            ← 제목이 바뀌었다(영역 추가 0)
  [결론 한 줄]
  판매중 확인 N곳 · 판매여부 확인불가 M곳 · 품절 K곳   ← 🔴 분모를 숨기지 않는다
  🇰🇷 국내 N곳 · 🌎 해외 M곳
  💰 USD 53 ~ 58 (2곳 · 그중 판매중 확인 1곳)          ← 🔴 통화별 · 환산 0
  [판매처 표]  시장 | 판매처 | 판매상태 | 현재가격      ← CPO §C 네 칸
  [보류 한 줄]                                         ← WU-133 그대로
  ▸ MI 상세 분석  (기본 접힘)                          ← 🔴 삭제 0
      └ 🇰🇷/🌎 참고가격 집계 · SAME 행 · 제외 사유 **전부 그대로**
▸ 후보 구역 넷 (기본 접힘)                              ← CPO §D
      └ 행·판정 라벨·네 버튼·저장 경로 **한 글자도 안 바뀜**
```

🔴 **`open` 을 붙이지 않았다** — 펼친 채로 두면 후보가 「유력」으로 읽히고 그것이
**2026-09-19 사고의 기전** 이다(WU-091 ① 계약과 같은 축).

---

## 3. 🟢🟢 STEP ③ — 실제 경로 E2E (Positive + Negative)

🔴 **새 하니스를 만들지 않았다** — WU-134 의 실제 경로 E2E 에 술어를 하나 더 걸었다.

```
원상품 B226AC009 (bobochoses.com/ko-kr) · GT 17건(SAME 13 · DIFFERENT 4) · pool 17/17
판정 12 · displaySAME 5 · **trueSAME 3 · falseSAME 0** · 실제 DIFFERENT 방어 **3/3**

🟢🟢 🛒 시장 판매 판단 — verdict **ON_SALE**
   판매중 확인 **3곳** · 판매여부 확인불가 **2곳** · 🇰🇷 0 · 🌎 **3**
   💰 GBP 37 (2곳 · **전부 판매중 확인**)
   💰 USD 58 (2곳 · **그중 판매중 확인 1곳**)
   · thefrontshop.com    ON_SALE  USD 58  human=SAME
   · junioredition.com   ON_SALE  GBP 37  human=(라벨없음)
   · scoutandcokids.com  ON_SALE  GBP 37  human=(라벨없음)
   · tinyapple.net       UNKNOWN  USD 58  human=SAME
   · global.trenbe.com   UNKNOWN  가격 확인 필요  human=SAME
```

🟢🟢 **배선이 실제로 발화했다** — 전까지 **전건 `stock=null`** 이던 것이 3곳에서
**판매중으로 확정** 됐다. 🔴 그리고 `trenbe` 는 UNKNOWN + 가격 미확인이라 **표에는 서지만
판매처 수에 들어가지 않는다** — CPO §G 가 요구한 그 동작이다.

### 🔴 Negative (같은 실행에서 같이 단언했다)
```
🟢 판매여부 미확인이 「판매중」에 **들어가지 않는다**(onSaleCount == soldOut===false 개수)
🟢 SAME 아닌 후보가 판매처 표에 **한 건도 없다**(SIMILAR/보류/충돌 0)
🟢 품절이 가격 축에 **들어가지 않는다**
🟢 세 상태의 합이 판매처 수와 같다(어디로도 사라지지 않는다)
```

---

## 4. 🟢 검증

```
계약 신규 **43** — 순수/소스 33(wu-136-market-judgement) + **마운트 DOM 10**(…-render)
🔴 마운트 DOM 으로 증명한 것 — 제목·결론·네 칸 표·확인불가 표기·품절 제외·
   가격 미확인 문구·**접힘이 닫혀 있고 기존 블록이 DOM 에 남아 있음**·내부 토큰 0 노출
음성대조 **M1~M9 전부 FAIL → 복구 58 passed** (🟢 적용 확인 포함 — 「적용 실패」를
   「통과」로 읽지 않는다)
   M1 모른다→품절 2F · M2 배선제거 1F · M3 미확인→판매중 **6F** · M4 판매처수에 포함 3F ·
   M6 SAME 게이트 제거 2F · M7 접힘 펼침 2F · M8 후보접힘 제거 2F · M9 분모 은닉 2F
회귀 **8,567 passed · failed 0** (skipped 140) · typecheck **0** · build **exit 0**
배포 `56104d2e` → Production
```

🔴 **기존 계약 3건이 FAIL 했고 의도된 변경이라 앵커를 갱신·«강화» 했다**:
```
mi-022  배선 앵커 → 🔴 「그 구역이 **접혀 있다**」까지 단언(접힘을 떼면 FAIL)
wu-130 F-3  제목 owner → 🔴 「제목이 **하나뿐** 이다」까지 단언(두 제목이면 FAIL)
wu-132 B-2  제목 → 🔴 「**판매 결론이 제목 바로 뒤에 선다**」까지 단언
            (가격을 먼저 보여주는 배치로 되돌리면 FAIL)
```

---

## 5. 🔴 측정불가 / 한계 (숨기지 않는다)

```
⒜ 🔴🔴 **판매여부는 Shopify 후보에서만 확정된다.** 비-Shopify(PLAIN_HTML) 경로에는
   판매여부 신호가 **없다** ⟹ 전건 **미확인** 이고, 그 자리는 「판매중」으로 세지 않는다.
   🔴 국내 후보는 대부분 그 경로라 **🇰🇷 판매중은 구조적으로 0 에 가깝다**(실측 0).
⒝ 🔴 Shopify 안에서도 **qty 칸을 주는 곳이 실측 2/9** 다 ⟹ 「판매여부 확인불가」가
   정상 상태다. 🔴 그것을 「품절」이나 「판매중」으로 **접지 않았다**.
⒞ 표본 **원상품 1개(B226AC009)** · 판매처 5곳. 🔴 WU-134 의 한계 그대로 —
   AC010 은 스냅샷이 DB 에 없고 AC042 는 human SAME GT 가 0 이다(교차검증 상품 없음).
⒟ 🔴 기존 스냅샷 543건은 brand 가 빈 채로 저장돼 있다(WU-134 ⒜ 그대로) ⟹
   **「새 상품 분석」을 다시 해야** 이 화면이 제대로 선다.
⒠ 🔴 실제 따져 화면은 **CTO 가 볼 수 없다**(로그인 뒤) — 위 검증은 **운영 함수 +
   마운트 DOM** 이다. 「CTO 검토 화면 PASS 를 제품 PASS 로 쓰지 않는다」(§12).
⒡ 🔴 「④ 팔 가치가 있는가」는 **원가·수수료 축** 이고 §00-B 가격 보류에 걸린다 —
   이번에 만들지 않았다(판매여부·판매처·가격까지가 이번 범위다).
```

---

## 6. 🟡 CEO Action — **배포된 화면 1회**

```
https://ttaejyo.vercel.app/pipeline
  → 원상품 URL: https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt
  → 🔴 **반드시 「새 상품 분석」**(저장된 스냅샷은 브랜드가 비어 있다)
  → ② 시장 판단 → **📊 시장 판매 판단**

🟢 보여야 하는 것
   · 맨 위에 「동일상품이 현재 판매중입니다.」
   · 「판매중 확인 3곳 · 판매여부 확인불가 2곳」
   · 🌎 해외 3곳 (🇰🇷 국내 0곳)
   · GBP 37 · USD 58 (각 줄에 「그중 판매중 확인 N곳」)
   · 판매처 표 — 시장 / 판매처 / 판매상태 / 현재가격
```

🔴 **정상인데 FAIL 로 보이기 쉬운 것 셋**
```
⒜ 「🇰🇷 국내 0곳」은 **정상** 이다 — 국내 후보에는 판매여부 신호가 없고(⒜) 국내
   동일상품 축은 8축 CLOSED 다. 이번 범위가 아니다.
⒝ 「판매여부 확인불가」가 **섞여 있는 것이 정상** 이다 — 사이트가 재고를 공개하지
   않으면 우리가 그것을 **지어내지 않는다**(실측 7/9 가 그 모양).
⒞ 「▸ MI 상세 분석」과 후보 구역이 **접혀 있는 것이 정상** 이다 — 정보는 **지우지
   않았다**. 펼치면 전과 똑같은 참고가격·후보 행·검토 버튼이 그대로 있다.
```

---

## 7. 🟡 다음 (CPO 가 지정한다)

```
① 🔴 **비-Shopify 판매여부** — 국내 후보에 신호가 없다. 그 복구는 「가격/재고 추출」
   축이고 §00-B 보류에 걸린다(CTO 가 열지 않았다).
② 🔴 「④ 팔 가치가 있는가」 — 원가·수수료·마진 축. **가격 단계** 다.
③ 🔴 기존 스냅샷 543건 재추출 정책(WU-134 ⒜ · WU-135 ⒜ 와 같은 사안).
④ 🟡 WU-135 가 특정한 **셀러 설정 7칸** 과 실등록 승인 — 그 둘은 그대로 열려 있다.
```

🔴 **CEO 액션은 위 §6 화면 1회뿐이다.** 코드 작업은 없다.
