# 기술부채 등록부

> CEO 지시(2026-09-20, P0-B 종료 보고): 「**칩으로 묻어두면 안 된다.**
> 별도 기술부채 작업으로 **반드시 등록**해야 한다.」
>
> 이 문서는 **스프린트 범위에 끌어오지 않기로 결정했지만 잊으면 안 되는 것**만
> 적는다. 「나중에 하면 좋겠다」는 여기 적지 않는다 — 여기 적는 것은
> **이미 깨져 있거나, 이미 틀린 모양으로 굳어 있는 것**뿐이다.

---

## TD-1 🔴 `pnpm -r typecheck` 가 깨져 있다 — 저장소 전체 게이트를 믿을 수 없다

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 종료 보고) |
| 원인 커밋 | `327b54d` — fix(P0-A.29-F) **CTO 본인이 만든 것** |
| 상태 | 🔴 미해결 |
| 배포 영향 | **없음** — `next build` 는 `pnpm -r typecheck` 를 부르지 않는다 |

### 무엇이 깨졌나

`packages/crawler/src/comparison-search/__tests__/match-truth-priority.test.ts:10` 이
패키지 경계를 넘어 `apps/admin` 을 import 한다.

```
../../apps/admin/.../domestic-product-link.ts(1,34):
  error TS2307: Cannot find module '@/lib/supabase-admin'
src/comparison-search/__tests__/match-truth-priority.test.ts(10,35):
  error TS6059: File '.../apps/admin/.../domestic-product-link.ts'
  is not under 'rootDir' '.../packages/crawler/src'
```

### 🔴 그 import 는 «실수가 아니다» — 없애는 방향으로 고치면 안 된다

그 줄 위에 이유가 적혀 있고, 그 이유는 여전히 유효하다:

> 가격 티어 규칙을 여기에 다시 적지 않는다. 이 저장소가 반복해서 다친 곳이
> 「같은 질문에 답하는 두 번째 기준」이라, 돈이 움직이는 칸은 운영 함수를
> 그대로 부른다.

런타임에서는 성립한다 — vitest 러너 하나(`apps/admin/vitest.config.ts`)가 두
워크스페이스를 함께 돌리므로 `@` 별칭이 그 파일에서도 산다. **`tsc` 의 프로젝트
경계만 이것을 거부한다.**

### 고칠 때의 조건

테스트가 **실제 `priceTierFromLink` 를 계속 부르는 것**이 조건이다(티어 규칙을
테스트에 복사하는 «해결»은 이 부채가 막으려던 사고 그 자체다). 선택지:

- `priceTierFromLink` 를 공용 패키지로 옮기고 `apps/admin` 이 재수출
- 이 테스트 파일을 `apps/admin` 테스트 트리로 이동
- `packages/crawler/tsconfig.json` 이 `__tests__` 를 컴파일 대상에서 제외
  (🔴 다른 패키지가 실제로 그렇게 돼 있는지 **먼저 확인** — 가정하지 말 것)

검증: `pnpm -r typecheck` = 0 · `cd apps/admin && npx vitest run` 무회귀
(2026-09-20 기준 199 파일 2,515 테스트).

### 🔴 그때까지 보고 규칙 (CEO 지시)

「전체 회귀 통과」라고 뭉뚱그려 쓰지 않는다. **범위를 갈라서** 적는다.

```text
apps/admin typecheck = PASS
pnpm -r typecheck    = FAIL (기존 known issue, TD-1)
```

---

## TD-2 🟡 해외 경로는 「모르는 가격」을 «지운다» — 이번에 정한 원칙과 다르다

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 종료 보고) |
| 상태 | 🟡 설계 이슈 — 다음 스프린트(P0-C)에서 다룬다 |
| 범위 판단 | CEO: 「이번 `df57a3f` 에서 건드리지 않은 판단은 맞다」 |

### 두 경로가 서로 다르게 답한다

```text
국내 (df57a3f 이후)         해외 (SELLER_ORIGIN, 현재)
  price_amount  보존          ← 행 자체를 저장하지 않는다
  currency      보존          ←
  exchange_rate null          ←
  price_krw     null          ←
  → UNRESOLVED                → 관측이 «없었던 것» 이 된다
```

`run-price-check.ts` 는 환율을 모르면 `convertToKrwStrict` 가 null 을 주고
**그 시장 행을 통째로 건너뛴다**(에러 메시지만 남는다).

### 왜 지금의 모양이 틀렸나 (CEO 판단)

> **「가격을 모르면 없애지 말고, 모른다고 표시한다」** 가 더 올바른 데이터
> 모델이다.

행을 지우면 「그 시장을 확인했는데 환율을 몰랐다」와 「그 시장을 확인하지
않았다」가 같은 모양이 된다 — 이 저장소가 반복해서 거절해 온 바로 그 혼동이다.
원본가가 `product_snapshots` 에 남아 «완전 소실» 은 아니지만, **가격 관측
시계열에서는 사라진다.**

### 고칠 때의 조건

P0-B 에서 승인된 원칙을 그대로 쓴다 — 새 상태를 만들지 않는다.
기존 행은 소급 수정하지 않는다.

---

## TD-3 🟢 배송비 `shipping_cost_amount` 1,123/1,123 null — **부분 해소**

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 조사) |
| 갱신 | 2026-09-20 (P0-C STEP 2 종료) |
| 상태 | 🟢 **읽는 길이 열렸다.** 기존 1,123건은 그대로(backfill 금지) |

P0-C STEP 2 에서 MakeShop `배송조건 : (고정)` 을 `FLAT` 으로 승격해, 금액이
파서 → 어댑터 → observation 까지 흐르는 배선이 생겼다(`e226a90`). 다음 국내
가격 갱신부터 채워진다. **과거 1,123건은 소급 채우지 않는다.**

남은 것은 「다른 판매처의 배송정책을 읽는 코드가 아직 없다」이고, 그건 아래
TD-4 계열과 같은 성격이다(데이터 확보 과제).

🔴 **버그라고 무작정 채우면 안 된다**(CEO). 배송비는 상품·국가·배송방법에 따라
달라진다. P0-C 가 그 세 질문에 답했고, 답은 코드에 들어갔다:

```
어디서 결정되는가   → shippingBasis 4종(SELLER_OVERRIDE/CATEGORY_DEFAULT/
                      LEGACY_FALLBACK/UNKNOWN) 이 값과 «함께» 이동한다
무엇을 아는가       → 저장된 판매자 값 239건 · 기본값 적용 89건
모를 때 어떻게 하나 → 원가·마진·판정·등록가를 «만들지 않는다»(null/UNRESOLVED)
```

---

# P0-C 종료 시 남긴 것 (CPO 판정, 2026-09-20)

> **P0-C 기술 구현 = GO / 종료.  사업 데이터 완성 = HOLD.**
>
> 두 질문을 구분한다:
> 「실구매원가 엔진이 완성됐는가?」 → **YES**
> 「모든 상품의 실구매원가를 실제 해외 배송 데이터로 계산할 수 있는가?」 → **NO**
>
> 아래 넷은 **구현 결함이 아니다.** 데이터가 없거나 정책이 안 정해진 것이고,
> 시스템은 그 사실을 «정확히» 표현하고 있다. 숫자를 채우려고 추측을 넣는 순간
> P0-C 가 막으려던 것으로 되돌아간다.

## TD-4 🟡 `shippingMethod` 가 328건 전부 UNKNOWN — 채울 «관측» 이 없다

실측: `shippingMethod` 저장 0/328 · `originCountry` 저장 0/328 · 배대지 필드 없음.
국가에 대한 유일한 신호는 `inferSourceCountry` 의 **URL 호스트 TLD 추정**이다.

🔴 **이것은 P0-C 의 실패가 아니다.** 배송방법 데이터가 없는데 DIRECT/FORWARDING
을 «만들어내지 않은» 것이 옳다(CEO 판정).

앞으로 필요한 길:
```
UNKNOWN → 판매자 입력 또는 실제 배송정책 관측 → DIRECT / FORWARDING
```
🔴 국가·통화·판매처로 «추론하는» 경로를 만들면 안 된다 — CEO 명시 금지.
구조(`ShippingMethod` 타입 · `landedCostKrw.shippingMethod`)는 이미 있다.

## TD-5 🟡 카테고리 선택률 4/328 — `CATEGORY_DEFAULT` 가 거의 닿지 않는다

`overseasShippingDefaultKrw` 금액이 정해져도 **97%는 여전히 LEGACY_FALLBACK** 이다
(스냅샷 328건 중 카테고리 미선택 319 · GOLF 5 · KIDS_FASHION 4).

🔴 **카테고리를 임의로 backfill 해서 적용률을 높이는 것은 금지**(CEO 명시).
과제는 「시장조사 카테고리 선택률 / 상품-카테고리 연결」이지 데이터 채우기가 아니다.

## TD-6 🟡 `domesticShippingCostKrw` — 저장되지만 읽는 곳이 0

MI-UX-FINAL-4 로 원가에서 빠진 뒤 `@deprecated` 상태다. 「실구매원가」를
완성하려면 언젠가 살아나야 하지만, **그 값의 의미·출처가 아직 확정되지 않았다.**

CEO 판정: **지금 계산식에 넣지 않는 것이 맞다.** 의미/데이터 출처 확정 후 연결.

## TD-7 🔵 레거시 `shippingKrw = 0` 14건 — **보존한다**

DB 만으로는 「실제 무료배송」과 「사용자가 입력칸을 비움」을 구별할 수 없다.
그래서 **UNKNOWN 으로 바꾸지도, SELLER_OVERRIDE 로 확정하지도 않는다.**

🟢 **새 입력부터는 이미 해결됐다**(P0-C STEP 3b, `b55a820`):
```
0 입력  → SELLER_OVERRIDE   (무료라고 «확인했다»)
삭제    → UNKNOWN           (모른다)
```
이 항목은 「할 일」이 아니라 **「건드리지 말 것」** 으로 등록한다.

## MI-REAL-05-B 🟡 Vision observation 단계의 self-reference 노출 여부

MI-REAL-05 는 **후보 선택 경로**에서 자기참조를 차단했다
(`run-domestic-price-check.ts`, `isSelfReferenceCandidate`). 그런데 Vision 관측
블록(`visionGateMode === "E1_TEST"`)은 그 필터보다 **앞**에 서 있고
`result.candidates` 를 그대로 쓴다 — 켜져 있으면 자기참조도 관측 대상이 된다.

🟢 **지금 영향 없음:** 기본값이 꺼짐이고, Vision 결과는 가격/매칭 판정에
쓰이지 않는다(그 블록은 링크도 만들지 않는다).

CEO 판정(2026-09-20): **이번 작업에서 건드리지 않는다.** 요구사항은 후보 선택
경로의 차단이고, Vision 블록을 같이 손대면 범위가 다시 넓어진다.
**MI-REAL-05 배포를 막을 사유가 아니다.**

관련: 같은 시점의 P1 두 건 — ㉡ `extractSlug` 가 쿼리스트링을 버려 slug 가
상수로 붕괴하는 문제(`shopdetail` 21건 · `detail` 18건) · ㉢ source 별
acquisition/fallback 관리(`source_role` 18곳 중 16곳 null).

## MI-REAL-06-B 🟡 URL slug identity collision — **P1 · HOLD**

### 발견

`extractSlug()` 가 URL pathname 의 **마지막 세그먼트만** 사용하고
**query parameter 를 버린다.** (`match.ts:80` · `product-identity.ts:60` 에 복제,
`shared/product-facts.ts:684 extractUrlSlug` 도 같은 로직)

### 실측 — Foretforet 실제 상품 3건

실제 페이지를 열어 확인한 값이다(가정 아님).

| branduid | 상품 |
|---|---|
| `10278273` | 마이마이 캐너피슈즈 |
| `10226592` | 페페슈즈 T-스트랩 |
| `10277972` | 알파베베 유령빕 |

세 상품 모두 → pathname `/shop/shopdetail.html` → slug **`"shopdetail"`**

### 판정 영향

```text
match.ts:401            동일 slug → score = Math.max(score, 0.95)
                        → matchLevel very_high → EXACT (autoVerified=true)
product-identity.ts:158 동일 slug → return "EXACT_PRODUCT"   ← 즉시 확정
```

🔴 「보조 evidence」가 아니다. 서로 다른 상품이 동일 slug 를 갖는 경우
**false-positive 로 승격될 수 있는 실제 경로가 존재한다.**

실행 증거: Production URL 로 `deriveProductMatchTruth()` 를 최소 입력
(원본 URL · 후보 URL 만)으로 호출 → **`EXACT_PRODUCT` 반환**. 코드 읽기가 아니라
실제 실행으로 확인했다.

### 현재 Production (ACTIVE 71건 전수)

```text
실제 잘못된 후보 선택 : 0건
실제 후보 누락        : 0건
slug 충돌 사례        : 존재 (foretforet 상품 2종이 slug 1종을 공유)
self-reference 1건    : MI-REAL-05 가 별도 차단
```

판매처별: `bobochoses.com` 32행/상품 7종/slug 7종(정상) ·
`deuxbebe.com` 18행/상품 1종(충돌 재료 없음) ·
🔴 `foretforet.com` 21행/**상품 2종/slug 1종**

### 분류

**MI 정확도 FAIL 아님.** 실제 오판은 아직 확인되지 않았다.
그러나 **「영향 없음」도 아니다** — 다른 Foretforet 상품이 후보로 선택되는 경우
slug 동일성만으로 `EXACT_PRODUCT` 가 발생할 수 있는 **잠재 경로가 확인됐다.**

### 원인

`extractSlug` 가 pathname 만 사용하며 **사이트별 상품 식별 query 를 고려하지 않음.**

### 🔴 주의 (고칠 때 하면 안 되는 것)

- 모든 query parameter 를 identity 에 포함하지 않는다 — tracking 이 identity 가 된다.
- `branduid` 를 전역 하드코딩하지 않는다 — 판매처 하나가 코드에 박힌다.
- slug evidence 를 전부 없애지 않는다 — 지금 «맞게» 동작하는 매칭이 약해진다.
- **MI-REAL-05(self-reference)와 별도 문제다.** MI-REAL-05 는 «같은 listing» 만
  제외하므로, branduid 가 다르면 그 필터를 통과한 뒤 이 규칙에 걸린다.

### 후속 설계 후보

> 「해당 source 에서 slug 가 상품을 구분하지 못한다고 **증명되는** 경우
> slug evidence 를 승격 신호로 사용하지 않는 정책」 검토.

실제 설계해야 하는 질문은 「query 를 넣을까」가 아니라
**「어떤 source 에서 URL slug 가 상품 identity 로 신뢰 가능한가」** 다.
그래서 지금 구현으로 넘어가지 않는다.

### 대상 / 현재 상태

```text
대상   match.ts · product-identity.ts   (같은 규칙의 복제 — 한쪽만 고치면 안 된다)
현재   코드 변경 0 · DB 변경 0 · fixture 변경 0
상태   HOLD
```

## DANAWA 🟢 보조 Evidence GO / 🔴 Primary Source HOLD

전체 기록: [danawa-poc-findings.md](./danawa-poc-findings.md)

```text
검색 엔진 · 모델코드 매칭 · pcode 검증 · 가격 추출        GO
이름 fallback · 개별 리스팅 집계                          NO (폐기)
Primary Source · 추가 국내 소스 조사 · Bobo 전용 Adapter   HOLD
```

**판정 근거:** `A→B`(품번 → 다나와 검색)는 여러 브랜드에서 반복되지만,
`B→C`(검색 → 가격비교 상품 `pcode`)가 **Bobo Choses 에 집중**된다 — 타 브랜드 **0/5**.

🔴 **숫자를 섞지 않는다.**

```text
POC 전체 C 성공률   4/11 = 36%     Bobo Choses 한정   4/5 = 80%
둘 다 «TTAEJYO 전체 상품의 Danawa coverage» 가 «아니다» — 그건 미측정이다.
모집단 72 중 Smallable 20 은 원천 접근 불가로 «미측정»(NO_RESULT 아님).
실측 가능 52 · 실제 실행 51 · 미실행 1.
```

**실측으로 얻은 안전 규칙 3개**(구현 시 필수):
① 이름 기반 검색 금지 — 「PePe Lulu T-Bar」가 성인용 로션을 물어왔다
② `min()` 금지, `og:description` 최저가만 — 페이지의 더 낮은 값은 롯데ON 멤버십가다
③ 코드는 **단어 경계** 일치 + pcode 는 **그 행에서만** — `F26100` 이 랑방 `F047P26100` 에
   부분 문자열로 걸려 **다른 브랜드 가격을 붙일 뻔했다**(「오매칭 0건」이 깨진 지점)

**부수 확인:** 기존 국내가(브랜드 공식몰 정가)가 실측 4건 «전부» 과대평가였다
(₩11,930~₩52,500). 이건 판매판정을 직접 왜곡한다.

**다음 관문:** 다나와 최저가는 «여러 판매처 집계값» 이라 `DOMESTIC_SHOP`(한 판매처의
실제 판매가)과 의미가 다르다. **그 매핑을 정하기 전에는 판매판정에 연결하지 않는다.**

### DANAWA-06 — Evidence 설계 완료 / 정책 «미확정»

설계 전문: [danawa-evidence-design.md](./danawa-evidence-design.md)

🔴 **기존 유니온을 확장하면 «조용히» 틀린 결과가 나간다** — 이번 조사의 핵심 발견.

```ts
DomesticPriceTier  = "EXACT" | "COMPARISON" | "EXCLUDED"
DomesticPriceBasis = "EXACT" | "COMPARISON" | "NONE"
```

소비처가 전부 `===` 비교이고 `never` 소진 검사가 **하나도 없다.** 값을 추가해도
**컴파일 에러가 나지 않고** 다음 두 곳에서 틀린 라벨/문장이 그대로 화면에 나간다.

```text
price-hierarchy.ts:1054   새 값 → "비교상품 참고가 기준"          (잘못된 라벨)
market-signals.ts:655-666 새 값 → "국내에서 동일상품을 찾지 못했습니다" (잘못된 문장)
```

→ **[REC]** `DANAWA_PRICE_COMPARISON` 은 `domesticBasis` 와 «무관한 병렬 축» 으로 둔다.
그러면 EXACT/COMPARISON/NONE·UNKNOWN 의미가 한 글자도 바뀌지 않는다.

**실측 추가 확인**

```text
표시 최저가 = data-base-price ≠ 최종 결제금액
배송비는 data-delivery-price 로 «별도» — purchasablePrice = base + delivery 계산 가능
B226AC009 ₩60,450 + ₩3,000 = ₩63,450 · B226AC070 ₩162,320 + ₩3,000 = ₩165,320
페이지 스스로 경고: "※ 배송비가 부정확한 업체의 경우 배송비 미포함 가격으로 안내됩니다."
```

**[UNVERIFIED]** 병행수입/해외구매대행 표기 0회 · 품절 표기 0회 →
**판매처 성격과 판매 가능 여부를 페이지로 판별할 수 없다.** 그래서 `EXACT` 승격 불가.
(실측 1/4 에서 최저가 판매처가 **머스트잇** 이었다.)

**용어** — 「다나와 가격비교 최저가」만 사용. ❌ 국내 최저가 ❌ 한국 최저가.
다나와 10곳에 포레포레·LOOXLOO 같은 편집샵이 없다 — 국내 전체를 대표하지 않는다.

**상태** 구현 착수 🔴 HOLD. 판매판정 사용 여부는 **CPO 결정 사항**이며 미확정이다.
지금 아무것도 구현하지 않아도 나중에 추가 가능하다(기존 타입 미변경 설계).

#### 🔴 [POLICY] DANAWA_PRICE_COMPARISON (CEO 확정, 2026-09-21)

> **현재 판매판정에 직접 사용하지 않는다.** 기존 EXACT-only 국내가격 정책을 유지하며,
> Danawa 가격비교 결과는 별도 Evidence 로 보존·표시할 수 있는 참고 가격정보로 취급한다.
> 향후 판매판정 사용 여부는 판매처 성격·구매가능성·가격조건·coverage 에 대한
> 추가 근거가 확보된 후 별도 결정한다.

후속 원칙: 다나와가 낮은 가격을 보여준다고 해서 「국내 실제 경쟁가격도 낮다」고
**자동 판단하지 않는다.** 출처와 의미를 그대로 표시하고 판단은 셀러가 한다.

```text
DANAWA-06  정책 ✅ 확정 · 문서 ✅ · 코드 0 · DB 0 · migration 0 · Production 0
HOLD: adapter · PRICE_COMPARISON 구현 · 판매판정 연결 · 신규 국내소스 조사
유지: 기존 국내소스 데이터
```

## P1-COST-01 🟡 `targetPrice` 의 Gross/Net 불일치 — **동결(2026-09-21)**

같은 「목표마진 20%」가 두 곳에서 **서로 다른 경제적 의미**를 갖는다.

```text
computePriceBreakdown.suggestedPriceKrw = landedCost / (1 − (fee+margin)/100)
   232,424 / 0.70 = ₩332,034  →  Net 마진 20.0%    수수료 «포함»

price-recommendation.targetPrice        = landedCost / (1 − margin/100)
   232,424 / 0.80 = ₩290,530  →  Net 마진 10.0%    수수료 «미포함»
```

🔴 **MI-P0-COST-02 가 만든 문제가 아니다.** 기존부터 있던 불일치이고, 이번 변경은
**손익 경계만** Net 으로 옮겼다(CEO 지시 §5 「Gross 는 별도 정보로 보존」,
§18 「손익 ≠ 목표마진 충족」 그대로).

**수정하지 않는 이유**: `targetPrice` 를 건드리면 **CASE A/B 경계가 이동**한다.
그건 「필요 없으면 건드리지 않는다」(§12)를 위반하고, 「목표마진도 Net 으로 볼
것인가」는 또 하나의 **정책 결정**이라 CTO 권한 밖이다.

**상태**: 이번 배포에서 동결. 실제 3건 재검증 결과를 본 뒤 판단.

---

### MI-P0-COST-02 배포 기록 (2026-09-21)

```text
commit      a378d73
Production  ttaejyo-cyq0r9el9 · Ready · origin/main 일치
변경        코드 3 + 테스트 1 · DB 0 · migration 0 · UI 0
테스트      신규 17/17 · pricing+price-history+comparison-search 790/790 (65파일)
            apps/admin typecheck PASS
```

**§4 UNKNOWN 실제 사례 — 🔴 NOT_AVAILABLE**
`priceBreakdown` 보유 행이 **0건**이라 「입력칸을 비운(null)」 상품이 존재할 수 없다.
모든 상품이 사다리 끝 `LEGACY_FALLBACK`(₩12,000)으로 떨어진다.
**fixture 로 만들지 않았다.** UNKNOWN 불변식은 단위 테스트로만 고정돼 있다
(`amountKrw: null` 과 `≠ 12,000` 을 «함께» assert).

**§5 COMPARISON 회귀 — 구조적 차단**
ACTIVE 링크 EXACT 52 · COMPARISON 25. `computePriceRecommendation` 은
`domesticBasis !== "EXACT"` 면 CASE D 로 빠져 `recommendedPrice`·`estimatedMargin`·
`netProfit`·`netMargin` 이 **전부 null** 이다. Net 계산이 COMPARISON 을 끌어 쓰는
경로는 없다.

🔴 **실제 Production 재검증(Vernice·Tobacco·MyMy)은 아직 «미수행» 이다.**
790/790 테스트 PASS 를 Production PASS 로 승격하지 않는다.
