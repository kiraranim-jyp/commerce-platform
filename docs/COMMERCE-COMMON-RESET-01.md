# COMMERCE-COMMON-RESET-01 — 현행 구조 조사

> CPO 작업지시(2026-09-28). **코드 수정 0.**
> 개별 문제를 고치지 않는다 — 「이 값은 어느 계층이 책임지는가」만 확정한다.
> LotteON 3차 결과물은 보존하고, LotteON 전용 확장은 STOP.

---

## 0. 🟢 가장 중요한 발견 — **표준은 이미 있습니다. 없는 것은 «채택» 입니다**

CPO 께서 이번에 요구하신 4-state 는 **이미 코드에 있습니다.**

```ts
// packages/shared/src/field-requirement.ts:34  (장기 스프린트 S-20/21/22)
export type FieldRequirementKind =
  "REQUIRED" | "CONDITIONAL_REQUIRED" | "USER_CONFIRMATION" | "OPTIONAL";
```

값의 출처 우선순위까지 정의돼 있습니다 —

```ts
// :47  FieldValueSource
USER_CONFIRMED → COMMON_PRODUCT → CATEGORY → SELLER_SETTINGS → DEFAULT → MISSING
```

파일 머리말이 목적까지 적어 두었습니다(원문):

> 「Commerce 를 20~30개로 늘리는 것이 목표다. 새 채널이 「필드 40개가 필요하다」고
>  할 때 입력칸 40개를 만들면 셀러의 관리 부담이 Commerce 수만큼 늘어난다」

`ReadinessTally`(auto / confirm / input) · `fieldBlocksRegistration()` ·
`tallyFields()` 같은 판정 함수도 함께 있습니다.

### 🔴 그런데 쓰는 곳이 없습니다

```
packages/shared/src/field-requirement.ts                     정의
packages/shared/src/index.ts                                 배럴 export
packages/shared/src/__tests__/s20-22-field-standard.test.ts  자기 테스트
apps/admin/src/app/pipeline/commerce/readiness.ts            ← 유일한 «소비» 후보
```

그 `readiness.ts` 조차 **이 표준을 import 하지 않습니다.** 자기 어휘를 씁니다 —

```ts
// apps/admin/src/app/pipeline/commerce/readiness.ts:12
export interface ReadinessItem {
  passed: boolean;     // ← 4-state 가 아니다
  required: boolean;   // ← boolean 이라 CONDITIONAL_REQUIRED 를 표현할 수 없다
  reasonCode?: "NO_VALUE" | "NO_RULE" | "ENUM_MISMATCH" | "CRITICAL";
  sourceStatus?: "AUTO" | "SETTINGS_DEFAULT" | "MANUAL_REQUIRED" | "DEFAULT_VALUE";
}
```

**표준을 만들어 두고 화면은 다른 어휘로 그리고 있습니다.**

---

## 1. Commerce Core 이름 실재 확인 (CPO 지목분)

| 이름 | 실재 | 위치 |
|---|---|---|
| `ChannelEditModel` | 🟢 | `apps/admin/src/app/pipeline/commerce/channel-edit-model.ts:82` |
| `EditBaseline` | 🟢 | 같은 파일 `:71` (OBSERVED / PARTIAL / UNREAD) |
| `EditGate` | 🟢 | 같은 파일 `:336` |
| `editorFieldSchema` | 🟢 | 같은 파일 `:284` |
| `ChangeSet` | 🟢 | `channel-lifecycle.ts:95` |
| `FieldRequirement` | 🟢 | `packages/shared/src/field-requirement.ts:34` |
| `PLATFORM_ADAPTERS` | 🟢 | `packages/marketplace/src/registry.ts:7` |

---

## 2. 네 계층의 현재 상태 — 한눈에

```
①  Master / Source        🟢 «완성돼 있다»
②  Common Resolver        🟡 표준은 있고 «쓰는 곳이 없다»
③  Commerce Mapping       🟡 배송만 표가 있다 · 어댑터 계약이 «둘로 갈라짐»
④  Commerce Readiness     🔴 채널마다 «어휘가 다르다»
```

### ① Master — 🟢 이미 타입으로 강제돼 있습니다

```ts
// packages/shared/src/master-product.ts:227
export type MasterProduct = MasterProductCore & MasterProductFacts &
  MasterProductVariants & MasterCategoryAttributes & MasterProductContent & MasterProductSource;
```

주석 원문: 「여기 «없는» 것이 이 타입의 존재 이유다 … `MasterProduct` 를 받는 함수는
롯데ON·쿠팡·스마트스토어를 알 방법이 **타입 수준에서** 없다」

분류 맵이 6라벨 / 9그룹으로 이미 있습니다(`MASTER_FIELD_GROUP`).
**→ CPO 그림의 「Master Product」 층은 새로 만들 것이 없습니다.**

### ③ Commerce Mapping — 🟡 배송은 «이미 이 모양» 입니다

🔴 **가장 중요한 발견입니다.** CPO 께서 그리신 「Common 의미 → Commerce 코드」
구조가 **배송 영역에 이미 구현돼 있습니다.**

```ts
// packages/listing/src/common/logistics.ts
export interface CommonLogisticsConcept {
  key: string;      // OUTBOUND_PLACE · RETURN_PLACE · CARRIER · RETURN_CARRIER
  label: string;    // DELIVERY_FEE · OUTBOUND_LEAD_DAYS · REMOTE_AREA · DISPATCH_CUTOFF
  meaning: "ROLE" | "NAMED_VALUE" | "AMOUNT" | "DAYS" | "POLICY";
  promotion: "PROMOTE" | "ROLE_ONLY" | "CHANNEL_ONLY";   // Common 이 값을 갖는가
  bindings: Record<"SMARTSTORE" | "COUPANG" | "LOTTEON", ChannelBinding>;
}
export type ChannelBindingStrategy =
  "CHANNEL_LIST" | "SELLER_TYPED" | "CONSTANT" | "NOT_APPLICABLE" | "UNKNOWN";
```

`ChannelBinding` 은 `payloadField`(실제 나가는 키) · `listSource` · `evidence`(근거)를
함께 답니다. **개념 8개 × 3채널 = 24칸이 근거와 함께 채워져 있습니다.**

**→ 새 아키텍처를 발명할 필요가 없습니다. 이 모양을 상품·고시·Compliance 로 «넓히면» 됩니다.**

#### 🔴 그런데 어댑터 계약이 둘입니다

```ts
packages/shared/src/product-types.ts:707
  export type PlatformId = "smartstore" | "coupang" | "elevenst";   // ← 롯데ON 없음
packages/marketplace/src/registry.ts:7
  PLATFORM_ADAPTERS: Record<PlatformId, PlatformAdapter>            // 3개
packages/listing/src/lotteon/adapter.ts:56
  lotteOnAdapter: NextGenMarketplaceAdapter                          // ← «별도 계약»
```

**롯데ON 은 공통 어댑터 레지스트리 밖에 있습니다.** 이유는 기록돼 있습니다
(「`PlatformId` 에 넣으면 소진 검사하는 12곳이 전부 컴파일 에러」). 당시 판단으로는
타당했지만, **Commerce 를 20~30개로 늘리는 구조에서는 이 분기 자체가 비용**입니다.
`elevenst` 는 레지스트리에 있고 롯데ON 은 없다는 비대칭도 여기서 나옵니다.

### ④ Readiness — 🔴 어휘가 갈라져 있습니다

| 채널 | 판정 위치 | 상태 어휘 |
|---|---|---|
| LotteON | `lotteon/validate-payload.ts:92` | `READY \| MISSING \| BLOCKED` + `LotteOnBlockCode` 9종 |
| SmartStore | `naver/validate-payload.ts:144` | `READY \| MISSING \| BLOCKED` + `NaverPayloadBlockCode` 3종 |
| Coupang | `coupang.adapter.ts` `FieldRule[]` | 🔴 **`PASS \| WARNING \| ERROR`** (`marketplace/types.ts:8`) |

🔴 `ReadinessItem.required` 가 boolean 이라 **`CONDITIONAL_REQUIRED` 를 표현할 수
없습니다.** 그래서 「어린이제품이면 KC 필수」 같은 조건부 규칙이 **채널 검증기 안에
박혀** 있습니다(`lotteon/validate-payload.ts:200`).

그리고 LotteON 만 `ReadinessSummary` 로 오지 않고 별도 타입을 씁니다
(`computeLotteOnRegistrationReadiness`) — **percent 계산이 채널마다 다릅니다.**

---

## 3. Common Field Matrix

`최종 Source` = 실제로 payload 를 채우는 곳.

| 영역 | Field | Master | Seller Settings | 채널 전용 | 최종 Source | 비고 |
|---|---|---|---|---|---|---|
| 상품 | 상품명 | 🟢 `title`/`titleKo` | — | — | Master | `content-field.ts` 3채널 공용 |
| 상품 | 브랜드 | 🟢 `brand` | — | LotteON `brdNo` | Master + 채널코드 | `brnd_id`↔`brdNo` 동일성 미확인 |
| 상품 | 제조자 | 🟢 `manufacturer` | 🔴 폐기됨(062) | — | `common/manufacturer.ts` 5단계 | 3채널 공용 resolver |
| 상품 | 제조국/원산지 | 🟢 `countryOfOrigin` | 🟡 `default_country_of_origin` | LotteON `oplcCd` · Naver `originAreaInfo.code` | Master → Seller → Brand | 🔴 3중 저장 |
| 상품 | 소재 | 🟢 `material` | — | 고시 매핑 | Master | |
| 상품 | 색상 | 🟢 `color` | — | 고시 매핑 | Master | |
| 상품 | 품명/모델명 | 🟢 `itemName`/`modelName` | — | — | Master(값 없음) | N-3.44 |
| 상품 | SKU | 🟢 `sku` | — | LotteON `epdNo` | Master | |
| 옵션 | 옵션 | 🟢 `optionGroups`/`variants` | — | 채널별 변환 | Master | |
| 재고 | 재고 | 🟢 `stockQuantity` | — | — | Master + `resolveSourceStock` | 3채널 공용 |
| 판매 | 가격 | 🟢 `SELLING` 4필드 | 마진/반올림 | — | `channel-price.ts` | 3채널 공용 |
| 배송 | 출고지 | — | 🟡 채널별 | 🟢 3채널 각자 | 채널 | `ROLE_ONLY`(확정) |
| 배송 | 반품지 | — | 🟡 채널별 | 🟢 3채널 각자 | 채널 | `ROLE_ONLY` |
| 배송 | 택배사 | — | 🔴 **채널별 3열** | 코드체계 상이 | 채널 | 근거 기록됨 |
| Compliance | KC | 🟢 `childCertification` | `kc_exemption_text` | Naver `kc-declaration` · LotteON `sftyAthnLst` | Master + 셀러 확인 | |
| Compliance | 원산지 코드 | — | — | 채널 코드표 | 채널 | Common 은 «이름» 만 |
| Notice | 고시 의미값 | 🟢 Master 속성들 | 🟡 품질보증·A/S | 채널 스키마 | Master + Seller | LotteON 만 구현됨 |
| Seller | A/S | — | 🟢 `as_contact_number` | — | Seller Settings | 🔴 «업체명» 칸 없음 |
| Seller | 품질보증 | — | 🟢 `quality_guarantee` | — | Seller Settings | 쿠팡이 이미 사용 |

---

## 4. 중복과 잘못된 위치

### 4-A. 🔴 원산지가 세 곳

```
product.countryOfOrigin                      (상품)
seller_settings.default_country_of_origin    (판매자 기본값)
coupang_brand_profiles.country_of_origin     (브랜드 기본값)
```

사다리는 있습니다(상품 → 판매자 → 브랜드). **문제는 그 사다리가 채널 빌더마다
따로 쓰여 있다는 것**입니다. 제조사는 이미 `common/manufacturer.ts` 하나로
모았는데(5단계) 원산지는 아직입니다. **→ 다음 통합 후보 1순위.**

### 4-B. Commerce Core 가 UI 앱 안에 있습니다

```
apps/admin/src/app/pipeline/commerce/
  channel-edit-model.ts   ChannelEditModel · EditBaseline · EditGate · editorFieldSchema
  channel-lifecycle.ts    ChangeSet
  readiness.ts            ReadinessItem · ReadinessSummary · computeNaverPayloadReadiness
  readiness-state.ts      RegistrationReadinessState
```

전부 **채널 중립 개념**인데 `packages/` 가 아니라 `apps/admin` 안에 있습니다.
그리고 `readiness.ts`(공통 파일) 안에 `computeNaverPayloadReadiness` 라는
**채널 이름이 박힌 함수**가 있습니다.

### 4-C. 채널 전용으로 «남아야» 하는 것 (확정)

```
pdArtlCd · pdItmsCd · OPLC_CD · TDF_DVS_CD · DV_CO_CD · owhpNo · rtrpNo · dvCstPolNo
```

채널이 발급하거나 채널만 아는 코드입니다. **Common 에 올리지 않습니다.**
`logistics.ts` 가 이미 `ROLE_ONLY`/`CHANNEL_ONLY` 로 그렇게 분류해 뒀습니다.

---

## 5. Field Requirement Matrix — 🔴 근거 있는 것만

| Field | Requirement | 근거 |
|---|---|---|
| 상품명 | `REQUIRED` | 3채널 검증기 모두 필수 |
| 대표이미지 | `REQUIRED` | 같음 |
| 가격 | `REQUIRED` | `priceValidity` 게이트가 3채널 공통 |
| 원산지 | `REQUIRED` | LotteON `oplcCd` MISSING 실측 · Naver `originAreaInfo` |
| KC 대상 여부 | `USER_CONFIRMATION` | 자동 확정 금지가 이미 코드 원칙 |
| KC 인증번호 | `CONDITIONAL_REQUIRED` | LotteON 품목 23 → 필수(`validate-payload.ts:200`) |
| A/S · 품질보증 | `REQUIRED`(고시) | 롯데ON 공식 품목표 13항목 전부 Y |
| 소재·색상 | `REQUIRED`(고시, 품목별) | 품목 23·01 표에서 확인 |
| 사용연령 | 🔴 **미확정** | 품목 23 에서는 Y. 다른 품목은 미확인 |
| 출시년월 | 🔴 미확정 | 담을 자리 자체가 없음 |
| 크기·체중 한계 | 🔴 미확정 | 조건부인데 조건 판정 기준을 모름 |

---

## 6. Common Architecture 제안 — **발명하지 말고 «잇는다»**

네 층 중 **①은 완성**, **③은 배송에서 이미 검증된 모양**이 있습니다.
그래서 제안은 「새 구조」가 아니라 **세 개의 연결**입니다.

### 연결 ① `field-requirement.ts` → `readiness.ts`

```
지금:  ReadinessItem { passed: boolean; required: boolean }
제안:  ResolvedField { kind; source; hasValue; conditionMet }
```

`required: boolean` 을 4-state 로 바꾸면 **조건부 필수를 채널 코드 «밖»에서**
표현할 수 있습니다. `tallyFields()`·`fieldBlocksRegistration()` 이 이미 그 계산을
갖고 있습니다.

### 연결 ② `logistics.ts` 의 개념표를 다른 영역으로 넓힘

```
CommonLogisticsConcept  →  CommonCommerceConcept
   key · label · meaning · promotion · bindings{3채널} · evidence
```

배송 8개념이 이미 이 모양입니다. 상품·고시·Compliance 를 같은 표로 적으면
**새 커머스를 붙일 때 「이 채널은 이 개념을 어떻게 받는가」만 채우면 됩니다.**

### 연결 ③ 세 채널 검증 결과를 한 어휘로

```
지금:  LotteON READY|MISSING|BLOCKED · Naver 같음 · Coupang PASS|WARNING|ERROR
제안:  공통 상태 어휘 + 공통 ReadinessBlockCode
```

LotteON 만 별도 타입을 쓰는 것도 여기서 합칩니다.

### 🔴 그리고 셀러 확인값의 저장 자리

`USER_CONFIRMED` 가 `FieldValueSource` 우선순위 **맨 위**인데,
**그 값을 저장하는 자리가 아직 없습니다.** 「셀러가 확인했다」를 담는
테이블/필드가 설계에 필요합니다 — 이번 조사에서 찾은 **가장 큰 구조적 빈칸**입니다.
DB 변경이 필요하므로 **STOP 조건**으로 올립니다.

---

## 7. 「고치지 않고 기록만」 한 것 (STEP 6 준수)

| 발견 | 계층 |
|---|---|
| 원산지 사다리가 채널마다 따로 쓰여 있음 | Common Resolver |
| 공통 파일 `readiness.ts` 안에 채널 이름이 박힌 함수 | Commerce Core 배치 |
| Commerce Core 가 `apps/admin` 안에 있음 | 패키지 경계 |
| `PlatformId` 에 롯데ON 없음 · 어댑터 계약 2종 | 어댑터 계약 |
| A/S 「업체명」 칸 부재 | Seller Settings 스키마(STOP) |
| 셀러 확인값 저장 자리 부재 | Common 스키마(STOP) |
| 쿠팡 payload 동일성 테스트 flake | 테스트 안정성(별건) |

---

## 8. 한 줄 결론

> **만들려던 Common 은 이미 절반 넘게 코드에 있습니다.
> 없는 것은 설계가 아니라 «채택과 연결» 입니다.**

Common v1 범위를 정하실 때 「새로 만들 것」보다 **「무엇을 무엇에 잇는가」** 로
좁히시면 구현 스프린트가 훨씬 짧아집니다.
