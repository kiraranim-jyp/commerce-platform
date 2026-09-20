# P0-C 조사 — 실구매원가 / 배송비 (코드 변경 없음)

- 일자: 2026-09-20
- 범위: **조사만.** 코드·스키마·Production 변경 0건.
- 기준 커밋: `1780222` (Production `df57a3f`)
- CEO 지시: 「배송비가 실제로 **어디서 결정되어야 하는지** + 현재 데이터에서
  **무엇을 알 수 있고 무엇을 모르는지** + **모를 때 어떻게 표시할지**」

---

## 0. 한 줄

**배송비 데이터가 비어 있는 것이 문제가 아니다.** 원가가 어떻게 계산됐는지를
적어 두는 칸이 **Production 에 아예 없어서, 76건의 등록 전부가 그 기록을 조용히
버렸다.** 배송비를 채우기 전에 이것부터 봐야 한다.

---

## 1. 🔴 `registration_attempts.price_breakdown` 칸이 Production 에 없다

마이그레이션 `010_registration_attempts_price_breakdown.sql` 이 **미적용**이다.
그 칸의 목적은 010 원문에 그대로 적혀 있다:

> 등록 시점에 실제로 어떤 **환율/배송비/수수료율/마진율**로 판매가격이
> 산출됐는지 등록 이력에서 재구성할 수 있게 jsonb 로 통째로 저장한다.

즉 **P0-C 가 필요로 하는 바로 그 기록**이고, **한 건도 저장된 적이 없다.**

```
information_schema  price_breakdown 칸 존재            0
payload 안의 priceBreakdown                            0 / 76
```

### 그리고 그 하나가 다른 감사 칸 둘을 같이 죽이고 있다

[register/route.ts:84](apps/admin/src/app/api/coupang/register/route.ts:84) 은 칸이
없으면 **하나씩 버리며 재시도**한다. 버리는 순서가 이렇다:

```ts
const optionalColumns = [
  "channel_price_record",   // ← 가장 먼저 버린다
  "brand_resolution",
  "price_breakdown",        // ← 실제로 «없는» 칸은 이것
  "category_resolver_kpi", "snapshot_id", "job_key",
];
```

`price_breakdown` 때문에 insert 가 실패하므로, 성공하기까지 **앞의 둘이 먼저
희생된다.** 실패는 `console.warn` 한 줄뿐이고 **등록은 성공으로 보고된다.**

### 실측 — 이것이 추론이 아니라는 증거

```
                       total  channel_price_record  brand_resolution  category_resolver_kpi
coupang                   40                     0                 2                     22
smartstore                36                     0                 0                      0
```

🔴 **결정적 증거는 2026-09-14 쿠팡 2건이다.** 그 시점에 048(=`channel_price_record`
칸)은 **이미 적용돼 있었고** 코드도 값을 넣는다. 그런데 null 이다. 연쇄 손실
말고는 설명이 없다. (`category_resolver_kpi` 22건이 살아 있는 것도 같은 표의
뒷면이다 — 그 칸은 `price_breakdown` **뒤** 순서라 버려지기 전에 성공한다.)

`brand_resolution` 2건은 2026-07-30 로, `price_breakdown` 이 insert 대상에 들어오기
전의 행이다. smartstore 는 애초에 이 셋을 쓰지 않고, 마지막 시도가 2026-08-24 라
048 보다 앞선다 — 두 값 모두 연쇄와 모순되지 않는다.

> ⚠️ 이것은 **Production 스키마 변경**이라 CTO 가 임의로 실행하지 않았다.
> 010 은 `add column if not exists` 한 줄이고 기존 행을 건드리지 않는다.

---

## 2. 배송비 데이터 — 무엇을 알고 무엇을 모르는가

### 실측 (price_observations 1,123건)

```
shipping_cost_amount     0 / 1,123
tax_amount               0 / 1,123
shipping_policy_status   2 / 1,123   ← 둘 다 UNREAD, 둘 다 같은 상품
```

**즉 「배송비를 모른다」가 아니라 「배송비를 보러 간 적이 거의 없다」가 맞다.**
1,121건은 `status` 자체가 null 이고, 그것은 054 가 정의한 대로 UNREAD 와 다른
사실이다 — 「읽었는데 못 찾음」이 아니라 「읽으러 가지 않음」이다.

### 🔴 그 2건이 이번 조사에서 가장 값진 것이다

```
포레포레 · status=UNREAD
note: "주문금액에 상관없이 배송비가 3,500원 청구됩니다.
       제주 및 도서산간 지역 4000원"
```

**답이 note 에 그대로 적혀 있는데 상태는 「못 찾음」이다.**
「주문금액에 **상관없이** 3,500원」은 정의상 `FLAT 3,500` 이다.

이것은 **결함이 아니다.** 분류기는 라벨 하나만 안다:

```ts
// foretforet.ts:171
status: fieldLabel.includes("(조건)") ? "CONDITIONAL_FREE" : "UNREAD",
```

그리고 그 위 주석이 이 상황을 **미리 적어 두었다**:

> 「(조건)」 말고 다른 라벨은 이번에 한 건도 실측하지 못했다. 그래서 그 밖의
> 모든 경우는 UNREAD 다 — 「(무료)는 FREE 겠지」 같은 추측으로 표를 만들지
> 않는다. **UNREAD 여도 읽어낸 원문은 note 에 그대로 남으므로, 다음 라벨을
> 실측하면 그 note 가 바로 근거가 된다.**

**지금이 그 「다음 라벨을 실측한」 순간이다.** 추측으로 표를 넓히는 것이 아니라,
실측된 원문 하나를 근거로 `FLAT` 한 칸을 여는 것이다.

⚠️ 다만 아직 모르는 것: 저 상품의 MakeShop **필드 라벨 문자열**이 무엇인지는
DB 에 남지 않는다(note 만 저장된다). 라벨로 분기할지, note 문장으로 분기할지는
페이지를 한 번 더 읽어야 정할 수 있다. **확인 전에는 규칙을 만들지 않는다.**

---

## 3. 19,800 / 12,000 의 의미 — 확정

| 숫자 | 실제 정체 | 원가에 들어가는가 |
|---|---|---|
| **12,000** | [breakdown.ts:166](packages/pricing/src/breakdown.ts:166) `DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw` — **출처 없는 기본값** | 🔴 **들어간다** (판매자가 안 고치면) |
| **19,800** | Settings 「배송비(원)」 **placeholder** = 구매자 청구 배송비 | ❌ 한 번도 들어간 적 없다 |

`12,000` 에 대한 코드의 자기 설명:

> 실제 배송비를 «모를 때» 쓰는 기본값이다. **어떤 실측의 결과도 아니고, 어떤
> 나라·어떤 배송수단의 요금표도 아니다.**

같은 자리의 `feePercent: 10` · `marginPercent: 20` 도 같은 성격(정책 기본값)이다.

🔴 **여기가 P0-C 의 진짜 질문이다.** 배송비를 모르는데 ₩12,000 이 원가에 들어가면,
화면의 마진·판정은 «모르는 값 위에 선 숫자»다. 지금은 그것을
`OverseasShippingBasis = "DEFAULT"` 와 「기본 해외물류비 적용 — 실제 배송비로
확인된 값이 아닙니다」라는 문구로만 구분한다. **막지는 않는다.**

---

## 4. 체인의 현재 모습 — CEO 가 그린 순서와 대조

```
해외표시가격      ✅ 상품별 실측(크롤러)
  ↓
현지통화/환율     ✅ 실시간 API · 실패 시 고정표(isEstimate=true)
                     🔴 등록 76건 중 25건이 priceIsEstimate=true 로 나갔다
  ↓
해외배송비        🟡 판매자 입력 > EMS 일본 요금표(골프/JP 한정) > ₩12,000 기본값
  ↓
배대지/직배송     ❌ 구분하는 코드가 «없다»
  ↓
국내배송          ❌ 계산에서 «제외됨»(MI-UX-FINAL-4). Settings 값은 읽히지 않는다
  ↓
예상 구매자 부담  ✅ 관세·부가세 → resolveBuyerImportCharge (별도 표시)
  ↓
판매자 원가       🟡 = 해외가격 + 해외배송비 «둘뿐»
  ↓
실구매원가        ❌ 이 이름의 단일 계산은 없다
  ↓
마진/판매 가능성  ✅ computeUnifiedPriceDecision
```

- 체인 전체를 도는 **단일 함수는 없다.** `computeGolfLandedCost` 가 앞 절반을,
  `computeUnifiedPriceDecision` 이 뒷 절반을 맡는다.
- 관세·부가세는 **의도적으로** 판매자 원가에서 빠져 있다(GOLF-01-TAX, CEO 결정).
- **배송비를 몰라도 등록은 막히지 않는다.** 막는 것은 «가격 미확정
  (`PRICE_UNRESOLVED`)» 하나뿐이고, 배송비 미확정은 `NEEDS_COST_INFO`(주의)까지다.

---

## 5. 다음에 정해야 할 것 (제안 — 실행하지 않았다)

| # | 질문 | 왜 지금인가 |
|---|---|---|
| ① | 마이그레이션 010 을 적용할 것인가 | 적용 전까지 **모든 등록이 원가 근거를 계속 버린다.** 한 줄, 기존 행 불변 |
| ② | `FLAT` 라벨을 열 것인가 | 실측 원문 1건 확보. 단 필드 라벨 재확인 «후에» |
| ③ | ₩12,000 이 원가에 조용히 들어가는 것을 유지할 것인가 | 「모르면 표시하고 막지 않는다」의 현재 답이 이것이다 |
| ④ | 배대지/직배송 축을 만들 것인가 | 지금은 축 자체가 없다 |

🔴 ①은 스키마, ②③④는 정책이다. **어느 것도 CEO 승인 없이 하지 않는다.**
