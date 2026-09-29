# CHILDREN-FASHION-COMMERCE-FINAL-CHECK-01 — ①②⑤⑥ (외부 WRITE 0)

> 🔴 **실행한 외부 호출 0.** CREATE ❌ · `/api/lotteon/register` ❌ · PUT ❌.
> 기준선: `listing 758/758` · `admin 5166/5166` (둘 다 PASS · 고정)

---

## 0. 🟢 먼저 — 실제 payload 3개는 «WRITE 없이» 얻을 수 있습니다

보고 항목 3·4·5(SmartStore payload · Coupang payload · LotteON payload-preview)를
위해 실등록이 필요하다고 보았는데, **세 채널 모두 읽기 전용 미리보기 경로가 있습니다.**

| 채널 | 미리보기 경로 | 외부 write |
|---|---|---|
| SmartStore | `NaverPayloadPreview.tsx` ← `/api/naver/resolve` | 없음 |
| Coupang | `/api/coupang/payload-preview` | 없음 |
| LotteON | `/api/lotteon/payload-preview` | 없음 — **87 미호출**(207 Identity·205·89 읽기만) |

→ **CREATE 와 payload 확보가 분리됩니다.** ③④는 그대로 CEO 단계로 두고, 3·4·5 는
CEO 가 Production 에서 **미리보기만** 눌러 캡처하면 됩니다(§5 체크리스트).

---

## 1. ① 동일 테스트 상품 — 🔴 정직하게 적습니다

로컬에 3채널 공용 fixture 는 **없습니다.** 각 테스트가 자기 `makeProduct()` 를
따로 가집니다. 가장 완전한 것은
`packages/listing/src/naver/__tests__/phase-b3-master-binding-boundary.test.ts`
이지만 **합성 데이터**입니다(`"Test Item"` / `"TestBrand"` / `"아동용 반바지"`).

🔴 **합성 fixture 로 만든 payload 를 「최종 검증」이라고 부르지 않습니다** — 이
저장소의 「Render PASS ≠ 소스 PASS」와 같은 종류의 거짓이 됩니다. 실제 아동의류
상품의 값은 Production DB 에 있고 CTO 는 그것을 읽을 수 없습니다.

실제 상품의 흔적은 테스트 fixture 에 남아 있습니다 — `Bobo Choses S.L.` ·
`asContactNumber: "+821046458306"` · `qualityGuarantee: "소비자분쟁해결기준에 따름"`
(`apps/admin/src/app/api/lotteon/__tests__/registration01-payload-evidence.test.ts`),
쿠팡 실등록분은 `Bubble Sweatshirt` / `147900` / `sellerProductItemId 38554512389`.

→ **실제 상품 확정은 §5 에서 CEO 가 고른 하나로 고정합니다.**

---

## 2. ⑦ Common 값이 Commerce 별로 어떻게 매핑되는가 (실제 코드 기준)

`seller_settings` 7칸의 **실제 목적지**. 근거는 전부 소스 위치다.

| Common 칸 | SmartStore | Coupang | LotteON |
|---|---|---|---|
| `manufacturer` | 🔴 **제외** — 판매 사업자는 제조자 후보가 아니다(`naver/_lib/resolve-context.ts:233`) | ⚠️ 컨텍스트로 넘기지만 **빌더가 읽지 않는다**(`register/route.ts:601`) | 🔴 **금지**(가드 `STILL_FORBIDDEN`) |
| `asContactNumber`(안내문) | `afterServiceDirector` 고시 「A/S 책임자」 (`resolve-context.ts:220`) | A/S 연락처 (`register/route.ts:602`) | ⚠️ facts 로 넘기지만 **읽히지 않는다** |
| `asCompanyName` | — | — | 🟢 고시 `0090` |
| `asPhoneNumber` | — | — | 🟢 고시 `0090` |
| `qualityGuarantee` | `warrantyPolicy` (`:219`) | (`:603`) | 🟢 고시 `0080` |
| `kcExemptionText` | — | 🟢 고시 KC 필드 (`:609`) | 🔴 **금지**(가드) |
| `defaultCountryOfOrigin` | 원산지 폴백 3단계 `SELLER_DEFAULT` (`:214`) | (`:604`) | `sellerDefault` (`build-context.ts:223`) |

### 🟢 제조자는 이미 «3커머스 공통 규칙» 이다

```
packages/listing/src/common/manufacturer.ts  ← 공용 resolver
우선순위: 실제 제조사 → 브랜드명 → 확인 필요
🔴 판매 사업자는 후보가 아니다 (CPO 확정 2026-09-23, coupang/build-payload.ts:1682)
```
세 채널이 같은 함수를 쓴다. **이 축은 이미 Common 이고 더 할 일이 없다.**

### 🔴 A/S 전화번호는 같은 개념인데 출처가 채널마다 다르다 (기지의 HOLD)

```
SmartStore  afterServiceTelephoneNumber ← sellerProfile.companyContactNumber (반품지 연락처)
LotteON     고시 0090                   ← seller_settings.asPhoneNumber
Coupang     A/S 연락처                  ← seller_settings.asContactNumber (안내문!)
```
CPO 지시로 **기존 배선은 건드리지 않았다.** 통합은 별건 HOLD 유지.

---

## 3. ⑧ 누락 / 중복 / 이중계산

### 🟡 발견 1 — 죽은 배선 둘 (등록을 막지는 않는다)

```
seller_settings.manufacturer   → 쿠팡 컨텍스트에 실려 가지만 빌더가 «한 번도» 읽지 않는다
                                 register/route.ts:601 · payload-preview/route.ts:112
seller_settings.asContactNumber → 롯데ON facts 로 넘어가지만 소비하는 고시 항목이 «없다»
                                 build-context.ts:247 (0090 은 명시적으로 «쓰지 않는다»)
```
`facts.sellerAsContactNumber` 참조는 `lotteon/` 전체에서 **0건**이다.

### 🔴 발견 2 — 설정 화면이 요구하는데 쓰이지 않는 칸

`apps/admin/src/app/api/coupang/_lib/settings-status.ts:35`

```ts
const RECOMMENDED_SELLER_SETTING_FIELDS = [
  { key: "manufacturer", label: "제조자(수입자)" },   ← 🔴 빌더가 읽지 않는다
  ...
];
```

같은 파일의 주석이 이 위험을 **미리 적어 두었다**:

> 이 판정이 어긋나면 조용히 틀린다 — 체크리스트는 「제조자 미입력」이라는데
> 등록에는 값이 나가거나 그 반대가 된다. 등록 화면의 게이트가 이 함수를 쓴다.

**지금 그 상태다.** 셀러가 「제조자(수입자)」를 채워도 쿠팡 payload 의 제조사는
공용 resolver(실제 제조사 → 브랜드명)가 정한다.

🔴 다만 `recommended` 목록이라 **등록을 막지는 않는다**(`missing` 아님). 즉
「등록 불가」를 만들지는 않고 **셀러에게 쓸모없는 입력을 요구**하는 문제다.

→ **`COMMON 후보` 아님 · 등록 차단 요인 아님 · 정리 대상.** CPO 지시대로 이번에
구현하지 않고 기록만 한다. 고칠 자리는 세 곳(라벨 제거 또는 실제 배선) 중 택1이고
그것이 결정 사안이다.

### 🟢 이중계산 — 발견되지 않음

가격/수수료 축은 `computeVariantFinalPriceKrw` 하나를 세 채널이 공유한다.
`priceBreakdown`(배송·수수료·마진)이 Master 한 곳에만 있다.

---

## 4. ⑥ 롯데ON blocker — 정확한 목록

### 고시 항목 축 (`resolveLotteOnNotice`, 품목 23 · 13항목)

| 코드 | 항목 | 상태 | 왜 |
|---|---|---|---|
| `0220` | 동일모델의 출시년월 | 🔴 **BLOCKED** | 담을 자리 없음 · `SOURCE_ABSENT` → 문의 대기 |
| `1830` | 크기ㆍ체중의 한계 | 🔴 **BLOCKED** | 해당 없을 때 기재 기준 미확인 → 문의 대기 |
| `0200` | (KC) | 🔴 **BLOCKED** | `kcCertificationNumber` 는 실제 인증서 값 — 만들 수 없다 |

나머지 10항목은 값이 있으면 자동으로 찬다(`NEEDS_INPUT` 이고 BLOCKED 아님).
`0090` 은 `6f0651a` 로 🟢 해결(Production 확인).

### 채널 설정 축 (`validateLotteOnPayload`)

```
SAFETY_CERTIFICATION_REQUIRED   sftyAthnLst — 어린이제품 조건부 필수
IMPORT_PROXY_REQUIRED           impPrxCd — 안전인증 유형에 따라 동반 필수
```

### 판정

```
외부 답변 때문에 막힌 축 = 2개
  ① 고시 기재방법   0220 · 1830          → LOTTEON-PRODUCT-NOTICE-INQUIRY-01
  ② KC              0200 · sftyAthnLst · impPrxCd → LOTTEON-KC-INQUIRY-01
```

🔴 `validateLotteOnPayload` 는 고시 13항목을 **`pdItmsArtlLst` 한 칸으로** 묶어
보고한다. 즉 화면에는 「고시 항목」 하나로 보이고 **어느 항목이 막혔는지는
`resolveLotteOnNotice` 쪽에만 있다.** 지시하신 「막힌 2~3개만 표시」가 실제로 그렇게
보이는지는 **Production DOM 으로 확인해야 한다**(§5-4) — 소스만으로 선언하지 않는다.

---

## 5. ⑨ CEO Production 체크리스트

### 🔴 이 단계에서 «누르지 않는» 것

```
❌ SmartStore 등록 버튼      ❌ Coupang 등록 버튼      ❌ LotteON 등록 버튼
❌ 쿠팡 승인요청             ❌ 네이버 전시 ON 전환
```
미리보기는 외부에 아무것도 쓰지 않는다. **CREATE 는 CPO PRE-CHECK 뒤 별도 단계다.**

### 5-1 상품 하나를 고른다
아동의류 하나. 쿠팡에 이미 등록된 `Bubble Sweatshirt` 계열이면 3채널 대조가 가장
깨끗하다(쿠팡 baseline 이 이미 실측돼 있다). **상품명/스냅샷 ID 를 알려주십시오.**

### 5-2 세 탭에서 «미리보기» 만 캡처
```
SmartStore 탭  → payload 미리보기 펼치기 → 캡처
Coupang 탭     → payload 미리보기 → 캡처
LotteON 탭     → payload 미리보기 → 캡처   (🔴 등록 버튼 금지)
```

### 5-3 설정 화면 현재값 확인
`/settings` 판매자 정보 탭 — 7칸 중 채워진 것과 빈 것. 특히
`A/S 안내문` · `A/S 업체명` · `A/S 전화번호` **셋이 각각** 무엇인지.

### 5-4 LotteON readiness 화면 캡처
막힌 항목이 **몇 개로, 어떤 이름으로** 보이는지. §4 의 「한 칸으로 묶여 보이는가」를
DOM 으로 확인하는 자리다.

### 5-5 돌려주실 것
```
① 고른 상품명 + 스냅샷 ID
② 3개 payload 미리보기 캡처(또는 JSON)
③ 설정 7칸 현재값
④ LotteON readiness 캡처
```
받으면 CTO 가 §2 매핑표와 대조해 **누락/중복을 실제 값으로** 확정하고, 그 뒤
CPO PRE-CHECK → CEO CREATE 로 넘어갑니다.

---

## 6. ⑩ Regression

```
listing  758/758 PASS  (54 files)
admin   5166/5166 PASS (379 files)
```
코드 변경 0 이므로 기준선과 동일. 이후 변경은 이 숫자와 대조한다.

---

## 7. 이번에 «하지 않은» 것

외부 호출 0 · CREATE 0 · `/api/lotteon/register` 0 · 코드 0 · migration 0 ·
UI 0 · 새 Common 필드 0 · 합성 fixture 를 「최종 검증」으로 선언 0 ·
죽은 배선 임의 제거 0 · `settings-status` 임의 수정 0.
