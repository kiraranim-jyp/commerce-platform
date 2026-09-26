# Commerce-6 F-4 — Common → 3 Commerce 최종 매핑 (확정판)

> CTO(2026-09-26). **코드 0 · DB 0 · migration 0 · push 0.**
> F-1/F-2 문서에는 `[CORRECTION]` 을 얹었고(삭제하지 않았다), 이 문서가 최종 판정표다.

---

## 0. 판정 기준 — 🔴 이것 하나만 쓴다

```text
❌ 파일/테이블 이름에 채널명이 있다      → 소유의 근거가 «아니다»
❌ 타입에 필드가 있다                   → 사용의 근거가 «아니다»
❌ 함수가 import 돼 있다                → 호출의 근거가 «아니다»
❌ DB 조회 함수를 부른다                → 값이 payload 에 간다는 뜻이 «아니다»

✅ 최종 payload 조립까지 «값이 실제로 흐르는가»
```

이번 Phase 의 정정 대부분이 위 네 줄 중 하나를 어긴 데서 나왔다.

### 판정 어휘

| | 뜻 |
|---|---|
**확정** | 값이 payload 까지 도달하는 것을 코드로 확인 |
**연결 후보** | Common 에 값이 있고 채널에 자리도 있는데 «지금은» 도달하지 않음 |
**별도 개념** | 이름은 같으나 의미가 달라 통합 불가 |
**채널 binding** | 채널이 발급한 식별자 — Canonical 개념 1 + binding N |
**미사용** | Common 에 있으나 어느 채널도 쓰지 않음 |
**미확인** | 코드로 판정 불가 — Production/런타임 필요 |

---

## 1. 🔴 지시받은 표를 «두 줄» 정정한다

작업지시서의 표 중 둘이 실측과 다르다. 근거를 함께 적는다.

| 행 | 지시서 | 🔴 실측 | 근거 |
|---|---|---|---|
**수입자** | 3채널 실제 소비 | **네이버 ✅ · 롯데ON ✅ · 쿠팡 🔴 없음** | 쿠팡은 `product.importer` 를 읽지 않는다. 대신 `MANUFACTURER_SYNONYMS = ["제조자","제조사","수입자","manufacturer"]`(`:701`)로 **제조자 칸이 수입자 표기를 흡수**한다 — 쿠팡에서는 두 개념이 «한 칸» 이다 |
**A/S** | 3채널 실제 소비 | **네이버 ✅ · 쿠팡 ✅ · 롯데ON 🔴 없음** | `asContactNumber`/`afterServiceDirector` 를 읽는 파일이 `naver/` · `coupang/` 뿐(전수 grep). 87 payload 에 대응 자리가 없다 |

그리고 한 줄은 **뜻을 나눠야** 한다.

| 행 | 지시서 | 🔴 실측 |
|---|---|---|
**브랜드** | 3채널 실제 소비 | 네이버 `naverShoppingSearchInfo.brandName` ✅ · 쿠팡 `brand` ✅ · 🔴 **롯데ON `brdNo` 는 «브랜드명» 이 아니라 속성모듈(204)이 발급한 «번호»** — 채널 binding 이다 |

---

## 2. 최종 매핑표

### 2-1. 상품의 사실 (PRODUCT)

| Common 정보 | SmartStore | Coupang | LotteON | 판정 |
|---|---|---|---|---|
상품명 | ✅ `originProduct.name` | ✅ `sellerProductName` | ✅ `spdNm` | **확정** |
판매가 | ✅ `salePrice` | ✅ `items[].salePrice` | ✅ `slPrc` | **확정** |
재고 | ✅ `stockQuantity` | ✅ `maximumBuyCount` | ✅ 단품 | **확정** |
대표이미지·갤러리 | ✅ | ✅ | ✅ `itmImgLst` | **확정** |
상세설명 | ✅ `detailContent` | ✅ `contents` | ✅ `epnLst` | **확정** |
옵션/단품 | ✅ | ✅ `attributes` | ✅ `itmLst` | **확정** |
소재·색상·사용연령·취급방법 | ✅ 고시 | ✅ notice/attr | ✅ 고시항목 | **확정** |
품명·모델명·중량 | ✅ KIDS 고시 `:701-703` | 🔴 미사용 | 🟡 `modelNo` 일부 | **확정(채널 차이)** |
**제조사** | ✅ | ✅ | ✅ `mfcrNm` | **확정** — 사다리: 상품 원문 → 브랜드 프로필 → 브랜드명 |
**수입자** | ✅ `originAreaInfo.importer` | 🔴 **없음**(제조자 칸이 흡수) | ✅ `impCoNm` | **확정(2채널)** |
**원산지** | ✅ 텍스트→코드 변환(535개) | ✅ 텍스트 그대로 | 🟡 **셀러가 목록에서 선택** | **연결 후보** §3 |
**브랜드** | ✅ `brandName` | ✅ `brand` | 🔴 `brdNo`(발급번호) | **확정 + 채널 binding** |
**KC/인증** | ✅ `productCertificationInfos` 외 | ✅ notice KC | ✅ `sftyAthnLst` | **확정** |

### 2-2. 판매자 공통 (SELLER_SETTINGS)

| Common 정보 | SmartStore | Coupang | LotteON | 판정 |
|---|---|---|---|---|
**A/S 연락처** | ✅ | ✅ | 🔴 **자리 없음** | **확정(2채널)** |
**품질보증기준** | ✅ `warrantyPolicy` | ✅ notice | 🔴 자리 없음 | **확정(2채널)** |
KC 면제문구 | 🟡 | ✅ `DEFAULT_VALUE` | 🔴 자리 없음 | **확정(채널 차이)** |
원산지 기본값 | ✅ 폴백 | ✅ 폴백 | 🔴 미사용 | **연결 후보** §3 |
`manufacturer` 칸 | 🔴 | 🔴 | 🔴 | 🔴 **사다리에서 제외됨** §4 |

### 2-3. 브랜드 프로필 (`coupang_brand_profiles` — 이름과 달리 Common)

| Common 정보 | SmartStore | Coupang | LotteON | 판정 |
|---|---|---|---|---|
`name` | ✅ 조회 키 | ✅ | ✅ | **확정** |
`manufacturer` | ✅ | ✅ | ✅ | **확정** |
`country_of_origin` | ✅ | ✅ | 🔴 | **연결 후보** |
**`brand_intro`** | 🔴 | 🔴 | 🔴 | 🔴 **연결 후보** — 배선 ✅ · **블록 미생성** §5 |
`representative_image_url` | 🔴 | 🔴 | 🔴 | 🔴 **미사용 · 연결 금지** §5 |
`common_description` | 🔴 | 🔴 | 🔴 | 🔴 **미사용 · 연결 금지** §5 |

### 2-4. 가격 · 배송

| Common 정보 | SmartStore | Coupang | LotteON | 판정 |
|---|---|---|---|---|
가격정책(마진·반올림) | ✅ 간접 | ✅ 간접 | ✅ 간접 | **확정** — `packages/pricing` 층에서 소비(build-payload 아님) |
`include_shipping_in_price` | 🔴 | 🔴 | 🔴 | **미사용** |
`domestic_shipping_cost_krw` | 🔴 | 🔴 | 🔴 | **미사용(CEO 결정 · MI-UX-FINAL-4)** |
**배송비** | ✅ `baseFee`(금액) | ✅ `deliveryCharge`(금액) | 🔴 `dvCstPolNo`(정책 참조) | **별도 개념** — 통합 금지 |
반품/교환 배송비 | ✅/✅ | ✅/🔴 자리 없음 | 🔴 | **확정(채널 차이)** |
출고소요일 | 🔴 | ✅ | ✅ | 🟡 네이버 대응 필드 **미확인** |
상세페이지 공통이미지·기본블록 | ✅ | ✅ | ✅ | **확정** |

### 2-5. 채널 발급 식별자 (CHANNEL BINDING — Common 아님)

| 개념 | SmartStore | Coupang | LotteON | 판정 |
|---|---|---|---|---|
출고지 | 주소록번호(**매번 조회**) | `outboundShippingPlaceCode` | `owhpNo` | **채널 binding** · Canonical 후보 |
반품지 | 주소록번호(**매번 조회**) | `returnCenterCode`+주소 5값 | `rtrpNo` | **채널 binding** · Canonical 후보 |
택배사 | 자유문자열 | 정적코드 11종 | `DV_CO_CD`(**실시간 조회**) | **채널 binding** · 🔴 값 매핑 불가 |
배송비정책·배송가능지역 | — | — | `dvCstPolNo`·`dvRgsprGrpCd` | **채널 전용** |
거래처·계정 | `sellerId` | `vendorId`/`vendorUserId` | `trGrpCd`/`trNo` | **계정 식별자**(사업자 정보 아님) |

---

## 3. 연결 후보 — 원산지 (최우선)

```text
Common      원산지 텍스트(상품 → 브랜드 → 판매자 기본값)
   ├ 쿠팡   ✅ 텍스트 그대로 notice 로
   ├ 네이버 ✅ 535개 코드로 «변환한다»(origin-match.ts)
   └ 롯데ON 🔴 변환 없음 — 셀러가 89 목록에서 직접 고른다
```

🔴 **자동 변환은 구현하지 않았다.** 89 공통코드 `OPLC_CD` 의 `cdNm` 형식이
저장소 실측 0건이기 때문이다. 같은 라우트가 `PD_ITMS_CD` 는 「실제 40건 응답을
보고 인정했다」고 적어 두었는데 이 그룹에는 그 기록이 없다.

`e5aec1a` 가 한 것은 **사용자 보조 문구**뿐이다 — Common 원산지 텍스트를 그 칸
도움말에 실어 상품정보 탭 왕복을 없앴다. 데이터 계약을 만들지 않았다.

```text
확인된 사실만 근거로 유지  89 응답 구조 = { cd, cdNm }  (route.ts:63-70)
🔴 하지 않은 것            OPLC_CD 추정 매핑 · 국가코드 하드코딩 ·
                          네이버 매처 재사용 · 픽스처 기반 실측 주장 · DB 필드 추가
```

**해제 조건**: 89 `OPLC_CD` 실제 응답 **1회**. `cdNm` 이 한국어 국가명이면
`COUNTRY_NAME_KO`(현재 `naver/origin-match.ts:37-110`, 채널 중립 자산)를
공통으로 올려 재사용할 수 있다. 그 전에는 **연결 후보**로 둔다.

---

## 4. Seller Common — 미구현 확정 + 다음 단계 자료

### 4-1. 사실 (변경 없음)

```text
사업자등록번호 · 상호 · 대표자명  →  Common 에 칸이 «없다»
3채널 payload · 고시 전수         →  요구하는 필드가 «없다»
vendorId · trNo · sellerId        →  계정 식별자이지 사업자 정보가 아니다
```

🔴 **DB migration 하지 않았다.** 소비처가 0인 채로 스키마를 만들지 않는다
(PIVOT-02 §10 ④).

### 4-2. 넣는다면 `seller_settings` 가 자연스러운가 — ✅ 그렇다

| 질문 | 답 | 근거 |
|---|---|---|
기존 Common 구조와 자연스러운가 | ✅ | 059 가 「여러 개여야 하는 것(배송)」과 「하나여야 하는 것(판매자 정보)」을 이미 갈라 두었다. 사업자 정보는 후자다 |
workspace 단위 관리가 되는가 | 🟡 **구조는 있고 동작은 아직** | 테이블에 `workspace_id` + `scope_key` 가 있다. 그러나 reader 는 `.is("workspace_id", null)` 로 **레거시 행 하나만** 읽는다(`seller-settings.ts:132·295`) |
축이 늘면 스키마를 바꿔야 하나 | ✅ 아니다 | 059: 「`scope_key` 를 두면 축이 늘어도 **행만 늘고 스키마는 그대로**」 |

🔴 059 가 직접 적어 둔 경고를 그대로 옮긴다:

> **NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다.**
> 이 NULL 행을 읽는 것은 migration compatibility 이지 정상 동작이 아니다.

즉 **판매자 정보를 워크스페이스 단위로 «관리» 하려면 Beta Security 의 workspace
격리가 선행되어야 한다.** 지금 칸만 늘리면 15개 워크스페이스가 한 행을 공유한다.

### 4-3. 향후 어느 Commerce 가 요구할 가능성이 있는가 — 🔴 **미확인**

현재 3채널 API 계약에는 없다. 그 밖의 채널(11번가·ESM 등)은 등록 API 자체가
미구현이라 **판단 근거가 없다**. 추정하지 않는다.

### 4-4. 🔴 금지선 (코드로 고정됨)

```text
제조사 필드에 seller 값을 대입하는 fallback 을 «만들지 않는다».
   resolveManufacturer() 입력에 판매자 값이 없다(common/manufacturer.ts)
   3채널 전부 PIVOT NEXT-04c-2 주석으로 그 단계를 제거했다
   롯데ON 은 테스트가 계약으로 고정한다(pivot03-lotteon-seller-source.test.ts)
```

---

## 5. 브랜드 3칸 — 판정 유지

| 칸 | 판정 | 근거 |
|---|---|---|
`brand_intro` | **연결 후보** | 🔴 배선 ✅ / 블록 🔴. `defaultDetailBlocks()` 에 `BRAND_INTRO` 가 없고 만드는 코드가 0건. 기본 목록에 넣으면 **모든 상품의 상세페이지가 바뀐다** |
`representative_image_url` | **미사용 · 연결 금지** | 3채널 모두 대표이미지를 «상품 이미지» 에서만 고른다. 브랜드 이미지를 거기 넣으면 상품 대표가 바뀐다 — 의미가 다르다 |
`common_description` | **미사용 · 연결 금지** | 「안 쓰고 있다」는 연결 이유가 못 된다. 셀러 재입력 부담도 아니다. `brand_intro` 와의 의미 차이가 코드에 정의돼 있지 않다 |

---

## 6. F-4 에서 구현한 것 — **없다**

§5 의 5조건(의미 동일 · Common 값 존재 · 채널이 받을 수 있음 · 계약 불파괴 ·
매핑 근거 확인)을 **모두** 만족하는 항목이 하나도 없다.

```text
원산지        매핑 근거 미확인          → 연결 후보
brand_intro   기본 블록 변경 = 전 상품 영향 → 연결 후보(제품 결정 필요)
브랜드 2칸     의미가 다르다              → 연결 금지
Seller        소비처 0                   → 미구현
A/S·품질보증   롯데ON 자리 없음            → 채널 부재(할 일 없음)
```

🔴 F-3 의 `e5aec1a`(원산지 보조 문구)가 이번 사이클의 **유일한 코드 변경**이고,
그 형태를 그대로 유지한다.

---

## 7. Production 검증이 필요한 항목

```text
🔴 PROD  89 OPLC_CD 실제 응답 1회        → §3 해제 조건
🔴 PROD  lotteon_seller_settings 행/값    → C-1 (env 값 조회 불가로 미해결)
🔴 PROD  coupang_seller_profiles is_default 행의 실제 값
🔴 PROD  seller_settings 다섯 칸의 실제 값 (manufacturer 는 NULL 로 «기록» 됨)
🔴 PROD  쿠팡 출고지 ↔ 롯데ON 출고지가 같은 장소인가 (주소 저장이 0이라 코드로 불가)
🔴 PROD  166 배송비정책 응답의 내부 필드(금액 포함 여부)
🔴 PROD  DV_CO_CD 값 목록
```

## 8. 미확인 (코드로 판정 불가)

```text
네이버에 출고소요일 대응 필드가 있는가        naver/types.ts 에는 releaseDate 뿐
AGENT_BUY ↔ DMST 가 같은 축인가              공식 문서 미확보
include_shipping_in_price 가 한 번도 쓰인 적 없는지 · 제거된 것인지
롯데ON 87 payload 에 A/S·품질보증 자리가 정말 없는지(grep 근거만)
향후 채널이 사업자 정보를 요구할지            11번가·ESM 등록 API 미구현
```

## 9. 🔴 하지 않은 것

```text
❌ DB migration · 스키마 추가 · 테이블 이름 변경
❌ OPLC_CD 추정 매핑 · 국가코드 하드코딩 · 네이버 매처 재사용
❌ 제조사 fallback 에 seller 대입
❌ BRAND_INTRO 를 기본 블록에 추가
❌ 브랜드 이미지·설명 연결
❌ 제조사/수입사/A/S/KC/원산지 «의미» 재논의
❌ push
```
