# P0-C STEP 3 조사 — shipping basis / 실구매원가 계층 (코드 변경 없음)

- 일자: 2026-09-20
- 범위: **조사·설계만.** 코드·스키마·Production 변경 0건. **금액 확정 없음.**
- 기준: Production `e226a90`
- CEO 지시: 금액 확정 HOLD · 설계 조사 GO · `deliveryCharge 19,800 → 판매자 원가` 연결 **금지**

---

## 0. 한 줄

**근거(basis)를 «추적» 하지 않고 «숫자를 보고 추측» 하는 것이 문제의 뿌리다.**
그래서 판매자가 입력칸을 비우기만 해도 ₩0 이 「판매자가 확인한 배송비」가 된다 —
실제로 그런 행이 **14건** 있다.

---

## ① ₩12,000 의 모든 유입 경로

| 경로 | 진입점 | 근거 라벨 | 성격 |
|---|---|---|---|
| 화면 계산기 | [PriceCalculationDetail.tsx:142](apps/admin/src/app/pipeline/commerce/PriceCalculationDetail.tsx:142) `product.priceBreakdown ?? DEFAULT_…` | ✅ 있음 | **입력칸 초기값**(판매자가 고침) |
| 등록가 산출 | [listing-price.ts:69](packages/pricing/src/listing-price.ts:69) `...(input.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT)` | 🔴 **없음** | **최후 폴백**(사람이 안 봄) |
| 골프(중량제) | [golf-landed-cost.ts:160](packages/pricing/src/golf-landed-cost.ts:160) | — | 🟢 **쓰지 않는다** |

🟢 **골프는 ₩12,000 을 쓰지 않는다.** 요금표가 없으면 `null` 을 그대로 흘린다:

> 🔴 임의의 배송비를 붙이지 않는다. null 이 그대로 «비용 확인 필요» 로 흐른다.

(실행 확인: `golf04-shipping-origin-gate` 7건 · `shipping-policy-01` 13건 전부 PASS)

🔴 **두 역할이 섞여 있다.** 화면 경로의 ₩12,000 은 「판매자가 고칠 출발값」이고,
`listing-price` 경로의 ₩12,000 은 **아무도 안 본 채 등록가에 들어가는 최후 폴백**이다.
후자에는 근거 라벨이 아예 없다 — `ListingPriceResolution` 은 `SYSTEM_SUGGESTED`
라고만 말하고 그 안의 배송비가 기본값이었다는 사실을 들고 다니지 않는다.

---

## ② `deliveryCharge` ↔ `domesticShippingCostKrw` — 분리는 지켜지고 있다

| | 뜻 | 계산 유입 |
|---|---|---|
| `deliveryCharge` | **구매자에게 청구**하는 배송비 | 🟢 원가에 **닿지 않는다**. 쿠팡 payload + 참고표시(`customerChargedShippingKrw`) 뿐 |
| `domesticShippingCostKrw` | 판매자가 실제로 부담하는 국내 배송원가 | 🔴 **읽는 곳이 한 줄도 없다**(MI-UX-FINAL-4 로 원가에서 제외, `@deprecated`) |
| `product.shippingFee` | 상품별 **구매자 청구** 배송비 | `deliveryCharge` 계열 |

> MI-UX-FINAL-4(대표님 결정, 2026-09-13) — **원가 합산에 참여하지 않는다.**
> … Settings 에 저장된 값은 건드리지 않는다 — **읽는 코드가 한 줄도 없을 뿐이다.**

**두 값이 한 변수에서 읽히거나 서로의 기본값이 되는 자리는 없다.**
즉 CEO 가 금지한 `deliveryCharge → 판매자 원가` 연결은 **지금도 없고**, 이번에
만들지 않았다.

🔴 다만 기억해 둘 것: **판매자 국내 배송원가는 저장은 되는데 아무도 읽지 않는다.**
「실구매원가」를 말하려면 이 값이 언젠가 살아나야 한다 — STEP 5 의 과제다.

---

## ③ `CATEGORY_DEFAULT` 가 들어갈 자리 — **이미 있다. 새 표가 필요 없다**

```
CostPolicyId     DEFAULT · KIDS_FASHION · WOMEN_FASHION · FASHION_ACCESSORIES · HOME_LIFESTYLE · GOLF
해석 함수         resolveCategoryCostPolicy(categoryProfileId)        ← 이미 있다
값의 출처         snapshot.workspace.marketCategoryProfileId          ← 셀러가 «상품 검색» 에서 고른 값
```

`CategoryCostPolicy` 에 칸 하나를 더하면 된다(`weightBasedShipping` 과 나란히).
**새 테이블도, 새 추정도 필요 없다.** 카테고리를 여기서 다시 판정하지 않는
기존 원칙도 그대로다.

### 🔴 그런데 오늘 이 층은 «거의 비어 있다»

```
스냅샷 328건 중   미선택 319 (97%)   ·   GOLF 5   ·   KIDS_FASHION 4
```

**CATEGORY_DEFAULT 를 넣어도 오늘 적용되는 상품은 4건이다.** 나머지 319건은
그대로 LEGACY_FALLBACK 으로 떨어진다. 즉 이 층만으로는 ₩12,000 문제가 97%
에서 그대로 남는다 — 층을 만드는 것과 별개로 **카테고리 선택률 자체가 과제**다.

---

## ④ `shippingBasis` — 왜 지금 구조로는 안 되는가

현재 근거는 **저장되지 않고, 숫자를 보고 추측된다.**

```ts
// breakdown.ts:198
export function resolveOverseasShippingBasis(shippingKrw: number) {
  return shippingKrw === DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw
    ? { basis: "DEFAULT",      label: "기본 해외물류비 적용 — 실제 배송비로 확인된 값이 아닙니다" }
    : { basis: "SELLER_INPUT", label: "판매자가 입력한 해외물류비" };
}
```

코드가 스스로 한계를 적어 두었다:

> DEFAULT — 판매자가 손대지 않았거나, 손댔는데 마침 같은 값을 넣었거나 —
> 🔴 **이 둘은 지금 구조로 구분되지 않는다.** 구분하려면 «판매자가 입력했다»는
> 사실 자체를 저장해야 하고, **그건 데이터 모델 변경이다.**

### 🔴 실제 데이터가 그 한계를 그대로 보여준다 (239건)

| 저장된 `shippingKrw` | 건수 | 화면이 말하는 근거 | 실제 |
|---:|---:|---|---|
| 12,000 | 210 | 「기본값 — 확인된 값 아님」 | 맞을 수도, 판매자가 그 값을 «확정» 했을 수도 |
| **0** | **14** | 🔴 **「판매자가 입력한 해외물류비」** | **배송비 0원을 확인했다고 말한다** |
| 20,000 | 10 | 「판매자가 입력」 | 아마 맞다 |
| **19,800** | **5** | 「판매자가 입력」 | 🔴 **이 숫자가 이미 원가에 들어가 있다** |

**₩19,800 에 대한 정정**: 「19,800 은 이 자리에 온 적이 없다」는 코드 주석은
**`DEFAULT_PRICE_BREAKDOWN_INPUT` 상수에 대해서만** 참이다. 실제 데이터에서는
**5건이 해외물류비로 19,800 을 들고 있다.** 다만 그것은 «카테고리 기본값» 이
아니라 «누군가 손으로 넣은 값» 이다 — 그래서 CEO 의 HOLD 판단이 맞다.

### 🔴 ₩0 이 들어가는 기전 — 확정했다

```ts
// PriceCalculationDetail.tsx  LiveNumberField
const n = Number(e.target.value);          // Number("") === 0   ← NaN 이 아니다
if (!Number.isNaN(n)) onLiveChange(clamp(n));
function clamp(n) { let v = Number.isFinite(n) ? n : 0; … }   // NaN → 0
```

**입력칸을 비우면 그 즉시 ₩0 이 값이 되고, 저장되고, 화면은 「판매자가 입력한
해외물류비」라고 말한다.** 「모른다」를 표현할 방법이 입력칸에 없다.

이것이 CEO 가 금지한 **「UNKNOWN 을 ₩0 으로 취급」** 의 실제 발생 지점이고,
계산 코드가 아니라 **입력 계층**에 있다.

---

## ⑤ UNKNOWN 이 0 으로 변하는가 — **두 답이 다르다**

🟢 **계산 코드에는 `?? 0` 누수가 없다.** `domestic-shipping-02.test.ts:330` 이
`(amount|shippingCostAmount|shipping_cost_amount) ?? (0|12000|19800)` 패턴을
소스에서 금지한다. 단 **스캔 대상은 `shipping-policy.ts` 하나뿐**이고
breakdown/unified-price-decision/golf-landed-cost 는 범위 밖이다.

🔴 **그러나 마진 숫자는 «0 으로 취급한 것과 산술적으로 같다».**

```ts
// unified-price-decision.ts:216
if (component == null || component.status === "unknown" || component.value == null) {
  hasUnknownCost = true; missingComponents.push(part.label); continue;   // ← 합계에서 «빠진다»
}
landedCostValue += component.value;
…
estimatedProfitValue = sellingPriceValue - landedCostValue - platformFeeValue;
marginPercentValue   = (estimatedProfitValue / sellingPriceValue) * 100;
```

항을 빼는 것은 0 을 더하는 것과 **수치적으로 동일하다.** 원가가 실제보다 작게
나오고, 따라서 **마진은 실제보다 «높게» 나온다.** 보호장치는 숫자가 아니라
라벨뿐이다 — `dataCompleteness = INCOMPLETE` → 🟠 「비용 확인 필요」.

코드의 자기 설명은 「0원 취급이 아니라 "최소 확인 가능한" 값」이다. 그 의도는
옳지만, **판매자가 보는 마진 %는 낙관적인 값**이라는 사실은 남는다.

---

## ⑥ 판매자 override 우선순위

```
① 판매자 입력 (knownInternationalShippingKrw)     최우선 — golf-landed-cost.ts:153
② EMS 요금표 (일본 출발 + 중량 확인)               golf-landed-cost.ts:167
③ ₩12,000                                        골프는 «쓰지 않는다» / 일반 경로만
```

- 저장: 🟢 `workspace.canonicalProduct.priceBreakdown` 에 **저장된다**(239/328).
- 🔴 **「판매자가 확정했다」는 사실은 저장되지 않는다.** 값만 저장된다.
  그래서 ④의 표처럼 ₩0 과 ₩19,800 이 같은 자격(「판매자가 입력」)을 얻는다.

---

## ⑦ MI 실측 배송비 — **저장되지만 «읽는 곳이 0» 이다**

STEP 2 로 `(고정)` 배송비를 실측해 `price_observations.shipping_cost_amount` 에
적을 수 있게 됐다. 그런데 **그 값을 읽는 계산이 하나도 없다.**

```
읽는 곳:  price-observations.ts(저장/로드) · run-domestic-price-check.ts(전달)
계산 유입: computeUnifiedPriceDecision 0 · computePriceBreakdown 0 · computeGolfLandedCost 0
```

> price-history.ts:83 — 🔴 이 두 필드는 아직 **어떤 가격 판정에도 참여하지 않는다.**

그리고 그 값은 **국내 판매처의 배송비**(구매자가 국내에서 내는 돈)이지 판매자의
해외물류비가 아니다. 🔴 **「MI_MEASURED」를 해외물류비 층의 최상단에 그대로
놓으면 ②에서 지킨 구매자/판매자 분리가 다시 깨진다.** 두 축을 분리해야 한다.

---

## ⑧ 영향 범위 / 회귀

- `shippingKrw` · basis 를 건드리는 테스트 파일 **45개**.
- basis 라벨을 직접 단언: `shipping-policy-01.test.ts` · `shipping-policy-01-ui.test.ts`.
- 🔴 회귀 기준선(아동의류): `€75 → 상품가 ₩111,000 · 원가 ₩123,000 · 권장가 ₩175,714`.
  **금액을 바꾸지 않으면 이 셋은 움직이지 않는다** — 이번 설계는 근거만 추가하므로
  숫자 회귀 0을 목표로 할 수 있다.
- 참고(범위 밖): 저장된 `marginPercent` 는 **12% × 228건**인데 기본값은 20% 다.
  기본값과 실제 사용값이 다르다는 뜻 — 이번 스프린트에서 건드리지 않았다.

---

## 제안 설계 (금액 없음 · 구현하지 않았다)

```ts
type ShippingBasis =
  | "MI_MEASURED"       // 실측. 🔴 판매자 해외물류비 축에 한해서만
  | "SELLER_OVERRIDE"   // 판매자가 «명시적으로» 확정 — 값이 아니라 «행위» 를 저장한다
  | "CATEGORY_DEFAULT"  // 카테고리 기본값. 🔴 금액 미정(HOLD)
  | "LEGACY_FALLBACK"   // ₩12,000. 의미는 STEP 3 에서 «재정의하지 않는다»
  | "UNKNOWN";          // 🔴 0 이 아니다. 숫자가 없다는 뜻이다
```

핵심 셋:

1. **basis 는 «계산되지 않고 실려 다닌다».** `resolveOverseasShippingBasis(number)`
   처럼 숫자로 역추론하지 않는다. 값과 근거가 한 쌍으로 이동한다.
2. **입력칸이 「모른다」를 표현할 수 있어야 한다.** 비우면 `UNKNOWN` 이지 ₩0 이
   아니다. 이것이 ₩0 14건을 만든 자리다.
3. **`UNKNOWN` 이면 마진 숫자를 «만들지 않는 것»도 선택지다.** 지금은 낙관적
   마진을 보여주고 라벨로만 경고한다 — 그 정책을 유지할지가 CEO 결정 사항이다.

## 🔴 CEO 결정이 필요한 것 (구현 전)

| # | 결정 |
|---|---|
| ㉠ | 아동의류 **판매자 원가** 해외물류비 기본값 — 금액 (HOLD 유지 중) |
| ㉡ | `UNKNOWN` 일 때 마진 %를 **보여줄 것인가, 감출 것인가** (현재: 낙관적 값 + 🟠라벨) |
| ㉢ | 기존 **₩0 14건**을 어떻게 볼 것인가 — 판매자 확정인가, 잘못 들어간 값인가 (소급 변경은 기본 금지) |
| ㉣ | `LEGACY_FALLBACK` ₩12,000 의 의미를 확정할 것인가, 그대로 둘 것인가 |
