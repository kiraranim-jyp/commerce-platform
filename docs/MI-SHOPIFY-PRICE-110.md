# WU-110 — Shopify JSON 의 `price` + `price_currency` 읽기 (구현 / 배포)

> 🔴 CPO 승인 2026-10-19. 「보고서의 **최소 수정안 그대로** 고정. 이미 받은 Shopify JSON
> 에서 `variants[0].price` **AND** `variants[0].price_currency` 가 **둘 다** 있을 때만
> 가격 생성 · 하나라도 없으면 **기존처럼 null** · **추가 HTTP 0회**」

---

# WU-110 FINAL

## 0. 결론 — 🟢 **GO. 누락 1건이 해소됐고 회귀 0 이다**

```
global.trenbe.com  price **null → USD 84** · market **UNKNOWN → OVERSEAS**
                   tier **EXACT 유지** · httpCalls **1**(추가 HTTP 0)
🟢 국내 ₩88,000 불변 · EXCLUDED 금액 제외 유지 · DIFFERENT 오포함 0 · 통화 분리 유지
```

## 1. 구현 — 운영 **1 파일 · +44/-2줄**(대부분 주석)

`packages/crawler/src/comparison-search/product-url-facts.ts`
```ts
function shopifyVariantPrice(body): { amount; currency } | null {
  const v = body.variants?.[0];
  const raw = v?.price;
  const cur = v?.price_currency?.trim().toUpperCase();
  if (!raw || !cur) return null;          // 🔴 둘 다 있어야 한다
  if (!/^[A-Z]{3}$/.test(cur)) return null; // 🔴 통화 «모양» 이 아니면 믿지 않는다
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null; // 🔴 0 으로 만들지 않는다
  return { amount, currency: cur };
}
```
🟢 `SHOPIFY_JSON` 분기의 `price: null` → `price: shopifyVariantPrice(body)` **한 줄**.
🟢 타입에 `variants?: { price?; price_currency? }[]` 추가(🔴 `price_currency` 는
`shopify-product-json.ts:61` 에 **이미 선언돼 있었다** — 새 어휘가 아니다).

🔴 **파일 머리 주석의 「통화를 모르므로 가격을 만들지 않는다」는 그대로 유효하다** —
바뀐 것은 **그 JSON 이 통화를 명시한다는 사실을 우리가 읽는다**는 것뿐이다.

## 2. 금지 대조 — **전부 0**

```
WU-079 재개방 0 · Beaumonde parser 0 · 신규 사이트 전용 parser 0 ·
fallback 다단계 확대 0 · AI discovery 0 · Registry 0 · 8축 0 · threshold 0 ·
국내 가격 로직 0 · UI 구조 0 · **추가 HTTP 0**
🔴 `variants[0]` 고정 — 「구매 가능한 variant 우선」 같은 선택 규칙은
   `fetchShopifyProductJson` 소관이고 **이 WU 에서 가져오지 않았다**
```

## 3. 계약 테스트 — **11건 · 네트워크 0**

```
① PASS      "84.00"+"USD" → 84 USD · 소문자/공백 통화 정규화
② FAIL-SAFE 통화 없음 → null · price 없음 → null · variants 없음 → null ·
            통화 모양 아님(US$ · "" · USDD · US) → null · 숫자 아님/0 이하 → null
③ 범위      variants[0] 고정 · 첫 variant 불완전하면 **둘째로 넘어가지 않는다**
④ 소스 앵커 배선(`price: shopifyVariantPrice(body),`) · 안전조건(`!raw || !cur`)
```

### 🔴 음성 대조가 **두 구멍을 찾았고 고쳤다**
```
1차: M1(안전조건 절반 제거) **0 failed** · M5(**배선 제거**) **0 failed**
🔴 원인 — 단언이 판정 함수를 «직접» 부르므로 **배선이 끊겨도 통과** 했다
🟢 소스 앵커 2건을 더해 **M1~M5 전부 1 failed** 로 잠갔다 → 복구 **11 passed**
```

### 🔴 그 과정에서 내가 두 번 더 틀렸고 둘 다 적는다
```
⒜ **정규식을 스크립트로 편집하다 백슬래시가 또 소실됐다**(WU-078 교훈 재발) —
   `/\/\*…/` 가 `//*…/` 로 깨져 파일이 **구문 오류** 가 됐다.
   🟢 **정규식을 아예 쓰지 않는** 앵커로 바꿨다(주석에 등장하지 않는 문자열을 골랐다).
⒝ **단언 좌표가 틀렸다** — `fetchPath: "SHOPIFY_JSON"` 의 **첫 등장이 타입 선언** 이라
   엉뚱한 구간을 slice 했다. 🟢 **쉼표가 붙은** 실제 반환 리터럴로 고쳤다.
   🔴 헌장이 경고한 그 함정이고(「3번 이상」) 🟢 이번엔 **FAIL 로 드러났다**.
```

## 4. Trenbe E2E (LIVE · 실제 production 경로)

```
운영 owner — status **OK** · fetchPath **SHOPIFY_JSON** · httpCalls **1**
             price **{ amount: 84, currency: "USD" }**
집계 진입  — tier **EXACT** · market **OVERSEAS** · 해외 USD count 2 → **3**
🟢 **추가 HTTP 0** — 호출 수가 1 그대로다
🔴 `priceStatus` 는 **undefined 그대로** 다 — 그 칸은 **건드리지 않았다**(범위 밖).
   ⟹ 🟢 그래서 **국내 축에는 들어가지 않는다**(국내는 `VERIFIED_CURRENT && KRW` 요구)
```

## 5. 핵심 회귀 — WU-108 표본 (S1 B226AC010 · S2 B226AC009)

| | 전 | 후 | 판정 |
|---|---|---|---|
| **국내** S2 | KRW 1 · ₩88,000 · COMPARISON | **동일** | 🟢 **회귀 0** |
| `EXCLUDED` 금액 제외 | 유지 | **유지**(S1 count 6 ↔ byCurrency 4 · S2 7 ↔ 4) | 🟢 |
| 통화별 분리 | 유지 | **유지** | 🟢 |
| DIFFERENT 오포함 | 0 | **0** | 🟢 |
| 해외 S2 | USD{2, 58} · GBP{1,33} | **USD{3, 58}** · GBP{1,33} | 🟢 **최저가 불변** |
| 해외 S1 | count 5 · USD/GBP/CAD | **count 6** · **EUR{1,40}** 추가 | 🟡 **아래** |

🔴🔴 **S1 에서 `EUR 40`(stockmann.ee)이 «새로» 들어왔다** — 예상한 영향 범위다
(「모든 Shopify 후보에 가격이 생긴다」). 🔴 **그것이 그 통화의 최저가** 다.
🟢 다만 **다른 통화의 최저가는 하나도 바뀌지 않았다**(USD 53 · GBP 37 · CAD 64 불변).
🔴 `stockmann.ee` 후보가 **진짜 동일상품인지는 사람이 확인하지 않았다** — CEO 테스트 대상.

## 6. 회귀 / typecheck / build / 배포

```
typecheck **0** · apps/admin **601 files / 8,378 passed** · failed **0**(skipped 123)
build **exit 0** · 🟢 기존 계약이 **하나도 안 깨졌다**
```

---

## 🔴 Known Unknowns

```
① 🔴 **영향 범위가 Trenbe 1건이 아니다** — 모든 `SHOPIFY_JSON` 후보에 가격이 생길 수 있고,
   이 표본에서 **2건**(trenbe USD 84 · stockmann EUR 40)이 새로 들어왔다.
   🔴 전수 영향은 **미측정** 이다
② 🔴 `priceStatus` 가 `undefined` 다 — 해외 금액 축은 그것을 안 보지만,
   🔴 **다른 소비처가 그 칸을 보는지** 전수로 확인하지 않았다
③ 🔴 `stockmann.ee`·`trenbe` 가 **진짜 동일상품인지** Human GT 가 없다
④ 🔴 `price_currency` 가 **항상 채워지는지** 모른다 — 없으면 **null 로 떨어진다**(안전 방향)
⑤ 🔴 `compare_at_price`(정가)는 **건드리지 않았다** — `regularPrice` 는 여전히 null
```

## 완료 기준 대조 (CPO §6)

```
🟢 SAME/EXACT Trenbe → USD 84 정상 추출 → 해외 가격비교 **정상 반영**
🟢 price_currency 없는 Shopify → **기존처럼 null**(계약 11건 + 변이 5건으로 잠김)
🟢 국내 가격 → **회귀 없음**
🟢 DIFFERENT/EXCLUDED → **회귀 없음**
⟹ 🟢 **GO**
```
