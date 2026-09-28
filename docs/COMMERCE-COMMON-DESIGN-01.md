# COMMERCE-COMMON-DESIGN-01 — Common v1 구현 설계

> CPO 작업지시(2026-09-28). **코드 변경 0. 문서만.**
> 새 아키텍처를 만들지 않는다 — 이미 있는 것을 «채택하고 연결» 한다.
> DB migration 은 **마지막 수단**(CPO 보정).

---

## 0. 🔴 먼저 — 제 지난 보고를 정정합니다

`RESET-01` 에서 「`USER_CONFIRMED` 저장 자리가 없으므로 DB 변경 필요」라고 했습니다.
**틀렸습니다.** CPO 보정대로 기존 저장 경로를 먼저 봤더니 **이미 있습니다.**

```sql
-- packages/database/prisma/migrations_manual/024_seller_compliance_confirmations.sql
create table seller_compliance_confirmations (
  id uuid primary key,
  snapshot_id uuid references product_snapshots(id),
  platform text not null default 'smartstore',
  category_code text not null,
  kc_status text not null check (kc_status in
    ('NOT_APPLICABLE','CERTIFIED_REFERENCE','SELLER_REVIEW_REQUIRED','BLOCKED')),
  confirmed boolean not null default false,
  policy_version text not null,
  confirmed_at timestamptz not null default now()
);
```

주석 원문: 「판매자가 상품 등록 직전에 KC/판매 가능 여부를 **실제로 확인했다는
기록**을 남긴다 … 「언제 어떤 기준으로 판매자가 확인했는지」 추적 가능해야 한다」

그리고 `policy_version` 까지 있습니다 — 「정책이 바뀌면 기존 확인 기록을 영구히
신뢰하지 않는다」(`naver/compliance.ts:34`). **우리가 설계하려던 것이 이미 한 번
설계돼 있었습니다.**

---

## 1. 현재 구조

```
MASTER / SOURCE            🟢 MasterProduct (타입으로 채널 무지 강제)
      ↓
COMMON VALUE / RESOLVER    🟡 공통 resolver 가 일부만 있다 (manufacturer 만)
      ↓
COMMON REQUIREMENT         🟢 field-requirement.ts (쓰는 곳 없음)
      ↓
COMMON READINESS           🔴 채널마다 어휘가 다름
      ↓
COMMERCE MAPPING           🟡 배송만 표가 있음 (logistics.ts)
      ↓
COMMERCE PAYLOAD           🟢 3채널 각자 구현 (동작 중)
```

---

## 2. 재사용할 기존 타입 — **새로 만들지 않습니다**

| 쓸 것 | 위치 | 역할 |
|---|---|---|
| `FieldRequirementKind` | `shared/field-requirement.ts:34` | 4-state 요구도 |
| `FieldValueSource` + `FIELD_SOURCE_PRIORITY` | 같은 파일 `:47`·`:62` | 값의 출처 사다리 |
| `ResolvedField` | 같은 파일 `:70` | 요구도 + 출처 + hasValue + conditionMet |
| `ReadinessTally` · `tallyFields()` · `fieldBlocksRegistration()` | 같은 파일 `:86`~ | 집계·차단 판정 |
| `ProvenanceField` / `FieldSource` / `InputMode` | `shared/product-types.ts:26`~ | 상품값의 출처(별개 축) |
| `MasterProduct` / `MASTER_FIELD_GROUP` | `shared/master-product.ts` | 채널 무지 경계 |
| `CommonLogisticsConcept` / `ChannelBindingStrategy` | `listing/common/logistics.ts` | Common 의미 → 채널 바인딩 |
| `resolveManufacturer()` | `listing/common/manufacturer.ts` | 사다리 resolver 선례 |
| `seller_compliance_confirmations` | migration 024 | 셀러 확인 기록 |
| `ReadinessItem` / `ReadinessSummary` | `apps/admin/.../readiness.ts` | 화면 집계(개편 대상) |

🔴 **중복 타입 금지.** 아래 설계는 전부 위 목록의 «조합» 입니다.

---

## 3. Common Field Contract

```
CommonField
 ├ concept        Common 의미 (원산지 · 색상 · KC …)  ← Field 이름이 아니라 «의미»
 ├ requirement    FieldRequirementKind               (기존 타입)
 ├ value          실제 값 (없으면 없음)
 ├ valueState     VALUE | MISSING | UNKNOWN | INVALID | CONFIRMED
 ├ source         FieldValueSource                   (기존 타입)
 ├ provenance     ProvenanceField 의 source/inputMode (상품에서 온 값일 때만)
 └ confirmation   { confirmed, confirmedAt, policyVersion } | null
```

🔴 `source` 와 `provenance` 를 **합치지 않습니다.** 서로 다른 질문입니다 —

```
FieldValueSource   어느 «계층» 이 줬는가   USER_CONFIRMED · COMMON_PRODUCT · CATEGORY · SELLER_SETTINGS · DEFAULT
FieldSource        그 값이 «어떻게 생겼는가» ORIGINAL · AI_GENERATED · USER_EDITED · DEFAULT · REQUIRED · DETAIL_PAGE_REFERENCE
```

이 저장소는 축을 섞지 않는 규칙을 여러 번 지켜 왔습니다. 여기서도 지킵니다.

---

## 4. Requirement 4-state — 기존 표준 **그대로 채택**

```ts
REQUIRED | CONDITIONAL_REQUIRED | USER_CONFIRMATION | OPTIONAL   // 새 enum 만들지 않음
```

`CONDITIONAL_REQUIRED` 는 `conditionMet` 과 짝입니다. **조건 판정을 채널 코드
밖으로 꺼내는 것**이 이 채택의 실익입니다(지금은 `lotteon/validate-payload.ts:200`
안에 「품목 23이면 KC 필수」가 박혀 있습니다).

---

## 5. Value State

CPO 제안 5종을 그대로 씁니다. 🔴 다만 **`CONFIRMED` 는 값 상태가 아니라 «확인
여부»** 라, 값 상태와 확인을 한 칸에 넣으면 「값은 있는데 확인은 안 된」 경우를
표현할 수 없습니다. 그래서 —

```
valueState    VALUE | MISSING | UNKNOWN | INVALID      ← 값에 대한 사실
confirmation  null | { confirmed: boolean, … }         ← 판매자의 행위
```

로 나눕니다. 「확인됨」은 `valueState=VALUE && confirmation.confirmed` 입니다.
🔴 이 분리가 없으면 KC 에서 곧바로 사고가 납니다 — 값이 있다는 이유로 확인된
것처럼 읽히는 자리입니다([[kc-value-is-not-verification]] 로 이미 한 번 겪었습니다).

---

## 6. Source / Provenance

`FIELD_SOURCE_PRIORITY` 를 그대로 씁니다.

```
USER_CONFIRMED → COMMON_PRODUCT → CATEGORY → SELLER_SETTINGS → DEFAULT
```

🔴 CPO 지적대로 **`DEFAULT` 는 필드마다 허용 여부가 다릅니다.** 그래서 개념마다
«허용 출처 집합» 을 갖습니다.

| 개념 | 허용 출처 | 🔴 금지 |
|---|---|---|
| 배송 기본값 | `SELLER_SETTINGS` · `DEFAULT` | — |
| 제조국 | `USER_CONFIRMED` · `COMMON_PRODUCT` · `SELLER_SETTINGS` | **`DEFAULT` 금지** |
| KC | `USER_CONFIRMED` · `COMMON_PRODUCT` | **`DEFAULT`·`SELLER_SETTINGS` 금지** |
| 품질보증·A/S | `SELLER_SETTINGS` | — |

---

## 7. `USER_CONFIRMED` 저장 방식 — **판정**

### 판정: `EXISTING_STORAGE_REUSE` + `EXISTING_SCHEMA_EXTENSION`
### 🔴 `DB_MIGRATION_REQUIRED` **아님**

| 무엇 | 어디에 | 근거 |
|---|---|---|
| KC 확인 | **`seller_compliance_confirmations`** 재사용 | migration 024 에 이미 있음. `platform` 이 컬럼이라 채널 확장 가능 |
| 그 밖의 필드 확인 | `product_snapshots.workspace` jsonb 에 **선택 키 추가** | `smartStoreKcDeclaration`·`lotteOnChannelInfo` 와 같은 방식 |

**전례가 둘 다 있습니다.**

```ts
// shared/product-types.ts:437
smartStoreKcDeclaration?: SmartStoreKcDeclaration;
// 주석: 🔴 「키가 없다 = 아직 고른 적이 없다.」 빈 객체로 초기화하지 않는다 —
//       「고른 적 없음」과 「전부 비워서 골랐음」은 다른 문장이다.
// 주석: ProvenanceField 로 감싸지 «않는다» — 크롤러가 채우는 값이 아니라
//       판매자만 고를 수 있는 «선언» 이라 source/confidence 가 의미를 갖지 않는다.
```

`backfillCanonicalProduct` 는 이 키들을 **건드리지 않습니다**(부재가 의미를 가지므로).
jsonb 이므로 **migration 0**입니다.

### 🔴 다만 이름이 채널에 묶여 있습니다

`smartStoreKcDeclaration` 은 **같은 KC 사실을 채널마다 다시 선언**하게 만드는
구조입니다. Common v1 에서는 **채널 중립 이름**으로 새 키를 두고, 기존 키는
**읽기 호환으로 남깁니다**(지우지 않습니다 — 이미 저장된 선언이 있습니다).

---

## 8. Common Resolver

```
resolveCommonField(concept, { master, sellerSettings, category, confirmation })
  → CommonField   (§3)
```

규칙 — 전부 기존 선례를 따릅니다.

1. 개념의 **허용 출처** 안에서만 사다리를 탑니다(§6).
2. 사다리는 `FIELD_SOURCE_PRIORITY` 순서.
3. 값이 없으면 **만들지 않습니다** — `MISSING`.
4. 판단할 수 없으면 `UNKNOWN`. 🔴 `MISSING` 과 섞지 않습니다.
5. 형식이 틀리면 `INVALID`(있는데 못 씀).
6. `USER_CONFIRMATION` 개념은 값이 있어도 확인 전이면 **`confirm`** 입니다
   (`tallyOf()` 가 이미 그렇게 계산합니다 — `field-requirement.ts:117`).

선례: `resolveManufacturer()` 가 5단계 사다리 + 출처 라벨을 이미 돌려줍니다.
**같은 모양으로 씁니다.**

---

## 9. Common Readiness

### 어휘

```
READY | NEEDS_CONFIRMATION | BLOCKED
```

### 🔴 기존 채널 검증기를 «제거하지 않습니다» — 감쌉니다

```
LotteOn validateLotteOnPayload   READY|MISSING|BLOCKED
Naver  validateNaverPayload      READY|MISSING|BLOCKED     ──┐
Coupang FieldRule[]              PASS|WARNING|ERROR        ──┤
                                                            ▼
                                         toCommonReadiness(채널 결과, CommonField[])
                                                            ▼
                                            READY | NEEDS_CONFIRMATION | BLOCKED
```

매핑 규칙(설계):

| 채널 결과 | Common |
|---|---|
| LotteON/Naver `READY` · Coupang `PASS` | `READY` |
| Coupang `WARNING` | `READY`(권장) — 🔴 등록을 막지 않음 |
| LotteON/Naver `MISSING` · Coupang `ERROR` | `BLOCKED` |
| 요구도가 `USER_CONFIRMATION` 인데 확인 안 됨 | **`NEEDS_CONFIRMATION`** |
| `CONDITIONAL_REQUIRED` 인데 `conditionMet=false` | `READY`(해당 없음) |

🔴 **요구도와 결과 상태를 섞지 않습니다**(CPO 지시). 같은 필드가
`USER_CONFIRMATION` + `UNKNOWN` → `NEEDS_CONFIRMATION`,
`CONDITIONAL_REQUIRED` + 조건 성립 + `MISSING` → `BLOCKED` 입니다.

### 채널별 필수는 «사라지지 않습니다»

```
CommonField (값·상태)  ×  Commerce Requirement Schema (채널이 요구하는가)
                        ↓
                  채널별 Readiness  →  공통 어휘로 표현
```

원산지처럼 3채널 모두 요구하는 것은 셋 다 `BLOCKED`,
`pdArtlCd` 처럼 롯데ON 만 요구하는 것은 **롯데ON 만** `BLOCKED` 입니다.

---

## 10. Commerce Mapping Contract

CPO 지시대로 **`PlatformAdapter` 와 `NextGenMarketplaceAdapter` 를 합치지
않습니다.** 그 위에 얇은 계약 하나만 둡니다.

```
CommonField  →  CommerceFieldMapping  →  payload 값
                  ├ concept          어떤 Common 의미인가
                  ├ payloadField     실제 나가는 키 (지어낸 이름 아님)
                  ├ strategy         CHANNEL_LIST | SELLER_TYPED | CONSTANT | NOT_APPLICABLE | UNKNOWN
                  ├ requirement      이 채널에서의 요구도
                  └ evidence         근거
```

🔴 `strategy`·`payloadField`·`evidence` 는 **`logistics.ts` 의 `ChannelBinding` 과
같은 필드명** 입니다. 새 어휘를 만들지 않습니다.

**CREATE/UPDATE/RECREATE lifecycle 은 이번 범위 밖입니다.**

---

## 11. Logistics Reference Pattern — 무엇이 잘 돼 있나

| 잘 된 점 | 그대로 가져갈 것 |
|---|---|
| 「의미」와 「채널 코드」를 분리 | `meaning` + `bindings` |
| 승격 여부를 **사업적 의미**로 판단 | `promotion: PROMOTE / ROLE_ONLY / CHANNEL_ONLY` |
| 코드를 저장할지 말지를 명시 | `CHANNEL_LIST` = 저장하지 않는다 |
| 「모른다」를 남김 | `UNKNOWN` — 추정하지 않음 |
| 근거를 칸으로 강제 | `evidence` 필수 |

| 🔴 부족한 점 | Common v1 에서 보완 |
|---|---|
| 요구도(`FieldRequirementKind`)가 없음 | 개념마다 채널별 요구도 추가 |
| 값 상태·확인 개념이 없음 | `CommonField` 가 맡음 |
| 배송 8개념에만 있음 | 상품·고시·Compliance 로 확장 |

---

## 12. Origin Reference Design (원산지)

Common 구조를 검증할 **두 번째 레퍼런스**입니다. 한 필드가 모든 층을 지납니다.

```
Master           product.countryOfOrigin = "Spain"        (ORIGINAL)
Seller Settings  default_country_of_origin                (폴백)
Brand Profile    coupang_brand_profiles.country_of_origin (폴백)
        ↓  resolveCommonField("ORIGIN")
CommonField { value:"Spain", valueState:VALUE, source:COMMON_PRODUCT, requirement:REQUIRED }
        ↓  Commerce Mapping
SmartStore  originAreaInfo.code   ← 채널 코드
Coupang     텍스트 그대로
LotteON     oplcCd                ← 채널 코드
```

🔴 **`Spain → ES` 변환은 Common 이 하지 않습니다.** 그것은 Commerce Mapping 이고,
롯데ON 쪽은 아직 **미확정(HOLD)** 입니다. Common 이 갖는 것은 **이름** 뿐입니다.

🔴 그리고 이 설계가 지금의 중복을 바로 드러냅니다 — 폴백 사다리가 채널 빌더마다
따로 쓰여 있습니다. `resolveManufacturer()` 처럼 **한 곳으로 모으는 것**이
이 레퍼런스의 실제 작업입니다.

---

## 13. Master / Common / Seller / Commerce 경계

CPO 께서 주신 질문 하나로 자릅니다 —
**「이 데이터는 상품의 사실인가, 판매자의 공통 사실인가, Commerce 의 표현 방식인가」**

```
상품의 사실                → Master        색상 · 소재 · 원산지 이름 · 제조자
판매자의 공통 사실          → Seller        A/S · 품질보증 · 배송 프로필
판매자가 «확인» 해야 하는 것 → Common + 확인  KC 대상 여부 · 수입 형태
Commerce 코드/형식          → Mapping       oplcCd · pdArtlCd · tdfDvsCd · DV_CO_CD
Commerce 별 필수조건        → Requirement Schema
등록 가능 여부              → Common Readiness 어휘
```

---

## 14. DB 변경 필요 여부 — **v1 에서는 없음**

| 대상 | 판정 |
|---|---|
| KC 확인 기록 | 🟢 `seller_compliance_confirmations` **재사용** |
| 그 밖의 필드 확인 | 🟢 snapshot jsonb **선택 키 추가**(migration 0) |
| Common 값 캐시 | 🟢 저장하지 않음 — **계산해서 씁니다**(값을 두 곳에 두지 않습니다) |
| A/S 「업체명」 | 🟡 **유일한 후보** — 그러나 §15 |

---

## 15. Migration 최소안 (필요해질 때만)

A/S 업체명 한 칸뿐입니다.

```sql
alter table seller_settings add column if not exists as_company_name text;
```

🔴 **지금 하지 않습니다.** 롯데ON 1:1 문의 B-11(「업체명과 전화번호를 하나의
문자열로 보내는가, 별도 항목인가」)의 답에 따라 필요 없을 수도 있습니다.
답을 받은 뒤 CPO 가 결정합니다.

---

## 16. Implementation 순서

```
1  Field Contract            타입만 (기존 타입 조합)
2  Common Resolver           원산지 하나로 시작
3  USER_CONFIRMATION 영속화   기존 테이블/jsonb 재사용
4  Common Readiness          채널 결과를 «감싸는» 어댑터
5  Origin Reference          한 필드를 끝까지 통과
6  Commerce Mapping          3채널 바인딩 표
7  SmartStore → Coupang → LotteON  차례로 연결
8  아동의류 3채널 E2E
```

🔴 **1~5 까지는 기존 채널 코드를 한 줄도 바꾸지 않습니다.** 새 층을 «옆에» 세우고,
채널 연결(6~7)에서 비로소 기존 코드를 봅니다.

---

## 17. 회귀 위험

| 위험 | 크기 | 완화 |
|---|---|---|
| SmartStore Production | 🔴 가장 큼 | 마지막에 연결. `preserve-registered-values`·`update-preflight` 가드가 이미 있음 |
| Coupang | 🟡 | `PASS/WARNING/ERROR` → 공통 어휘 매핑에서 **WARNING 을 BLOCKED 로 잘못 올리면** 등록이 막힘 |
| LotteON | 🟢 | 아직 등록 0건 — 깨질 Production 이 없음 |
| 계약 가드들 | 🟢 유리 | `rework14-field-parity` · `commerce-tab-alignment` · `three-layer-realign` 이 갈라짐을 잡아 줌 |

🔴 실제로 이번 스프린트에서 그 가드들이 제 실수를 **세 번** 잡았습니다.
Common 전환에서도 같은 역할을 합니다.

---

## 18. 구현 범위 / 구현하지 않는 범위

### 하는 것
Field Contract · Common Resolver(원산지) · 확인 영속화 · Common Readiness 어댑터 ·
Commerce Mapping 계약 · 3채널 바인딩 표

### 🔴 하지 않는 것
- `PlatformAdapter` ↔ `NextGenMarketplaceAdapter` 통합
- CREATE/UPDATE/RECREATE lifecycle
- 배송 재구현 (`logistics.ts` 는 레퍼런스로 보존)
- LotteON 고시 UI 확대 (3차 결과물 **동결**)
- `Spain → ES` 같은 Commerce 코드 변환 규칙 확정
- DB migration
- Production 등록 테스트

---

## 19. CPO 결정 요청 2건

1. **§5 의 축 분리**(`valueState` 와 `confirmation` 을 나눔)를 승인하시겠습니까?
   CPO 제안은 `CONFIRMED` 를 값 상태에 포함했는데, 그러면 「값은 있으나 미확인」을
   표현할 수 없습니다. KC 에서 바로 문제가 됩니다.
2. **§9 의 `WARNING → READY` 매핑**을 승인하시겠습니까? 쿠팡의 `WARNING` 은 지금
   등록을 막지 않습니다. 공통 어휘로 올리면서 `BLOCKED` 로 바꾸면 **지금 등록되는
   상품이 막힙니다.** 기존 동작 보존 쪽을 권고합니다.
