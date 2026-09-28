# COMMON → COMMERCE AUTO-MAPPING P0

> 🔴 **코드 미변경.** 대상 `e636173` · 2026-09-28
> 질문: **「왜 Common 에 값이 있는데 롯데ON 이 다시 묻는가」** 의 원인 분해.

증거 등급 `실응답(원문)` · `실응답(요약)` · `코드` · `문서` · `UNKNOWN`

---

## 0. 🔴 다섯을 다 보고 나서 드러난 «하나의» 사실

셋은 **검증기가 필수로 보지 않는다.** 그런데 셋 다 셀러가 채널 코드를 적는 칸이다.

| 칸 | payload | 검증기 | 지금 셀러가 |
|---|---|---|---|
| `brdNo` 브랜드 | `...(channel.brandNo ? {brdNo} : {})` — **조건부** | 🔴 **검사 0줄** | 번호를 **적는다** |
| `epdNo` 업체상품코드 | `...(channel.externalProductNo ? {epdNo} : {})` — **조건부** | 🔴 **검사 0줄** | 코드를 **적는다** |
| `tdfDvsCd` 과세 | `tdfDvsCd: channel.taxTypeCode` — **무조건** | 🔴 **검사 0줄** | 코드를 **적는다** |

🔴 **`brdNo` · `epdNo` 는 「없어도 등록된다」.** 그런데 셀러에게 번호를 적으라고
한다. **얻는 것이 없고 잃을 것은 있다** — 첫 LIVE 등록이 정확히 그렇게 깨졌다
(`note="공통코드 OPLC_CD"` 를 답으로 옮겨 적어 `returnCode 9999`).

따라서 이 둘의 **가장 안전한 최소 조치는 자동화가 아니라 「묻지 않는 것」** 이다.
자동화는 계약(유일성·목록)이 확인된 뒤에 한다.

🔴 `tdfDvsCd` 는 다르다 — **무조건 실린다.** 숨길 수 없고 «올바른 값» 이 필요하다.

---

## ① 브랜드 `brdNo`

### Common 브랜드명의 출처 — 확인됨

```
크롤러가 추출         JSON-LD Product.brand · Shopify 는 vendor        코드
정제                 brand-resolver.ts — 시즌코드·마케팅 문구 제거
                     "Bobo Choses SS26 Baby 50% Off Sale" → "Bobo Choses"
보관                 brand.value(정제) · brand.raw(원본) · brandResolution(규칙+신뢰도 HIGH/LOW)
분류                 MASTER_CORE (master-product.ts:103)
브랜드 프로필          coupang_brand_profiles — findBrandProfileByName 은 «완전 일치» 만
```

🔴 **완전 일치 원칙이 브랜드 프로필에 이미 적용돼 있다** — 택배사에 쓰려는 규칙과
같다. 새로 만드는 개념이 아니다.

### 204 속성모듈 — 🔴 **부르는 코드가 없다**

```
확인 범위   api/lotteon/ 전체 · packages/listing/src/lotteon/ 전체
            LOTTEON_READ_PATHS · LOTTEON_WRITE_PATHS · 커머스 탭 · 테스트
결과        205 ✅ · 206 ✅ · 207 ✅ · 93/94 ✅ · 🔴 204 «없음»
categoryAttributes  → payload `scatAttrLst` 로 가지만 «화면 입력» 에서만 온다
매핑 근거   하드코딩 표 0 · fixture 0 · git log 0
```

그런데 화면 도움말은 **「속성모듈(204) 조회 결과」** 라고 적혀 있다.
🔴 **조회하지 않는 것을 조회 결과라고 말한다.**

### payload 경로 · 필수 여부

```
form.codes.brandNo → build-context:206 → build-payload:384  ...(brandNo ? {brdNo} : {})
검증기              🔴 brdNo 검사 «0줄» → 비워도 등록된다
저장 단위           상품마다 (lotteOnChannelInfo.codes.brandNo) — 1회 설정 구조가 아니다
```

### 판정 — **`UNKNOWN`** (자동화 근거 없음) · 🔴 단 즉시 조치 후보 하나

```
자동화     ❌ 204 없이는 brdNo ↔ 브랜드명 매핑 근거가 «전무» 하다
1회 매핑   ❌ 상품마다 브랜드가 다르다 — 성립하지 않는다
즉시 조치  🟠 «필수가 아니므로» 셀러에게 번호를 적게 하지 않는다
           (자동화가 아니라 «묻지 않기». 204 가 열리면 그때 자동으로 채운다)
```

---

## ② 과세 `tdfDvsCd` — 🔴 결함 둘

### 값의 경로

```
진짜 출처   205 카테고리 응답의 tdf_cd   (lotteon-category.ts:198)
우리 기본값  "01" ×3곳 (폼 초기값 · BLANK 설정 · build-context fallback)
payload     tdfDvsCd: channel.taxTypeCode   ← 🔴 «무조건» 실린다
검증기      🔴 tdfDvsCd 검사 «0줄»
```

### 🔴 결함 (1) — 화면 도움말이 «틀리다»

```
note="… 표준카테고리를 고르면 그 카테고리 값으로 채워집니다."

추천 후보를 «고르면»   applyLotteOnRecommendedCategory
                       taxTypeCode: category.taxTypeCode ?? form.codes.taxTypeCode   ✅ 맞다
번호를 «직접 넣으면»   setLotteOnStandardCategoryNo
                       🔴 과세를 «건드리지 않는다» → "01" 이 그대로 남는다
```

`01` 이 실제로 나가는 경우가 둘이다 — ⓐ 205 에 `tdf_cd` 없음 ⓑ 셀러가 번호 직접 입력.
**면세 상품이면 오등록이고, 우리 검증기는 막지 않는다.**

### 🔴 결함 (2) — 방어적 읽기가 «과세에만» 빠져 있다

```ts
// lotteon-category.ts — 바로 붙어 있는 두 줄
noticeItemCodes: readArray(source, "pd_Itms_list", "pd_itms_list")   ← 두 표기를 다 읽는다
   주석: 「문서 표는 pd_Itms_list, 응답 샘플은 pd_itms_list — 어느 쪽이 실제인지
          확인하지 못했으므로 둘 다 읽는다」
taxTypeCode: readString(source, "tdf_cd")                            ← 🔴 한 표기만
```

**같은 응답인데** 한 줄 아래는 한 표기만 본다. 205 가 `tdfCd`/`tdf_Cd` 로 준다면
조용히 `null` → `"01"`. 케이싱 불일치가 **이미 그 응답에서 확인된 문제**다.

### 판정 — **`COMMON_AUTO`** (출처는 채널) · 🔴 `01` fallback 제거 대상

```
자동 결정 가능?  🟡 「추천으로 고른 경우」에는 이미 된다.
                 «번호 직접 입력» 경로와 «tdf_cd 결측» 두 구멍이 남는다.
다음 단계        205 응답의 실제 키 표기 확인 + 결측 시 «01 대신 무엇을 할지»
                 🔴 값을 지어내지 말고 「확인 필요」로 막는 쪽이 원칙에 맞다
```

---

## ③ 수입대행코드 `impPrxCd`

```
출처      LotteOnChannelForm.certification.importProxyCode — «롯데ON 탭 입력만»
          build-context:204 → build-payload:397  impPrxCd
세 값     PUR_PRX 구매대행 · PRL_IMP 병행수입 · NONE 해당없음
          근거: 우리 코드 주석(lotteon-channel-form.ts:856). 🔴 공식 문서 원문 «미확보»
필수 조건  KC 계열 안전인증 16종에서만 필수 (validate-payload:53-69, 188-200)
          🔴 어린이제품 확인(CHL_CFM)은 «요구하지 않는다» — 이 저장소 주력 카테고리
다른 채널  SmartStore · Coupang 에 같은 개념 «없음» → 롯데ON 전용
```

### 🔴 조사 결론 하나를 정정한다 — Common 에 «관련 값이 있다»

조사 초안이 *「배송방법 구매대행을 찾을 수 없음 / Common 에 없음」* 이라고 적었다.
**있다.**

```
packages/database/.../012_coupang_seller_profiles_business_defaults.sql:12
  add column if not exists delivery_method text
apps/admin/.../coupang/_lib/seller-profile.ts:134   deliveryMethod: row.delivery_method ?? ""
```

CEO 배송 프로필의 「배송방법 = 구매대행」이 저장되는 자리다.
🔴 표 이름이 `coupang_` 이지만 마이그레이션 주석이 말하듯 **판매자 사업 기본값**
(배송비·반품비·교환비·출고소요일·제조자)을 담는 사실상의 «공통» 프로필이다
— `naver_delivery_company_code` 도 여기 있다.

### 🔴 그래도 자동 도출하지 않는다

```
「배송방법」   물건이 어떻게 오는가            자유 텍스트(text 컬럼 · enum 아님)
「수입 형태」   수입/병행/해당없음 — 통관·표시 책임의 구분
→ 이 판매자에게 상관관계가 있을 뿐 «같은 개념이 아니다».
  자유 텍스트를 규제 코드로 바꾸는 것은 축 혼동이다(이 스프린트에서 두 번 걸린 함정).
```

### 판정 — **`SELLER_CONFIRMATION`**

🔴 **단, 셋 중 «가장 쉬운 즉시 조치» 다.** 값이 딱 셋인 닫힌 집합이라
목록 선택기로 바꾸는 데 외부 증거가 필요 없다. 지금은 도움말에
`PUR_PRX / PRL_IMP / NONE` 이 적혀 있고 셀러가 그것을 옮겨 적는다 — `oplcCd` 와
같은 모양이다.

---

## ④ 업체 상품코드 `epdNo`

```
의미      업체상품번호 — «우리 쪽» 식별자. 87 응답의 spdNo 와 짝 (types.ts:155, 문서)
층        상품(product). 단품 층은 eitmNo 로 «이미 자동» 이다
쓰임      93 상품상태 조회의 질의 키 (product-status:42,72 · 최대 100개)
필수      ❌ 타입 epdNo? · 검증기 검사 0줄 · payload 조건부
생성 규칙  🔴 주석은 「jobKey/sku 등에서 만든다」(build-payload:118) — «만드는 코드가 없다»
```

### 🔴 축 확인 결과 — 비교 대상은 SmartStore 하나뿐

| 층 | SmartStore | Coupang | LotteON |
|---|---|---|---|
| 상품 | `sellerManagementCode` ← `sku` **자동** | 🔴 **필드 없음** | `epdNo` ← **셀러 입력** |
| 단품 | `sellerManagerCode` ← `variant.sku` 자동 | `externalVendorSku` 자동 | `eitmNo` 자동 |

### 🔴 자동화 전에 남은 것 둘

```
① 유일성  같은 SKU 로 두 번 등록하면? — 모른다(문서 미확보)
② 겹침    단품 상품에서 eitmNo 가 «이미 product.sku» 다(build-payload:248)
          → epdNo = sku 로 하면 두 필드가 같은 문자열이 된다.
            층이 달라 문제없을 «가능성이 높지만» 확인 전에 넣지 않는다.
```

### 판정 — **`COMMON_AUTO 후보`** · 🔴 즉시 조치는 「묻지 않기」

필수가 아니므로 셀러에게 적게 할 이유가 없다. 자동 생성은 ①② 확인 후.

---

## ⑤ 원산지 `oplcCd`

```
Common        countryOfOrigin 「스페인」 (상품마다 다르다)
현재 화면      originCode 기본값 "" · 🔴 Common 값으로 «미리 채우지 않는다»
              89 OPLC_CD 목록에서 셀러가 고른다 (선택기 «있다»)
채널 목록      api/lotteon/common-codes?group=OPLC_CD   GET · 화이트리스트에 있다
```

### 판정 — **`COMMON_AUTO 후보`** · 🔴 **코드 없이 닫을 수 있다**

`cdNm` 이 「스페인」 같은 국가명이면 **택배사와 같은 모양**(완전 일치 자동)이다.
그 라우트는 **GET 이고 이미 존재한다** — 주소 하나로 확인된다.

🔴 1회 매핑이 «아니다». 상품마다 원산지가 다르므로 셀러가 한 번 고정하면 틀린다.

---

## 최종 분류표

| 항목 | 분류 | 자동/1회/확인 | 근거 | 막는 것 |
|---|---|---|---|---|
| **브랜드** `brdNo` | **UNKNOWN** | 미정 | 코드 · 204 부재 | 매핑 근거 전무 |
| **과세** `tdfDvsCd` | **COMMON_AUTO** | 자동 | 코드(205 `tdf_cd`) | 직접입력 경로 · 단일 표기 읽기 |
| **수입대행** `impPrxCd` | **SELLER_CONFIRMATION** | 확인 | 코드(주석) | 문서 원문 · 선택기 부재 |
| **업체상품코드** `epdNo` | **COMMON_AUTO 후보** | 미정 | 코드 | 유일성 · `eitmNo` 겹침 |
| **원산지** `oplcCd` | **COMMON_AUTO 후보** | 미정 | 코드 | `OPLC_CD` cdNm 미확인 |

---

## 🔴 CPO 판단 요청 — 셋

### 1. 「묻지 않기」를 즉시 조치로 허용하십니까

```
brdNo · epdNo   검증기가 «필수로 보지 않는다». 비워도 등록된다.
                셀러에게 채널 코드를 적게 해서 얻는 것이 «없다».
                첫 LIVE 등록이 그 방식으로 깨졌다.
→ 자동화 «전에» 입력칸을 내리는 것이 가장 안전한 최소 조치라고 봅니다.
🔴 다만 brdNo 를 내리면 「브랜드 없이 등록」이 되는데 그것이 사업적으로
   괜찮은지는 제 판단이 아닙니다.
```

### 2. 수입대행코드를 목록 선택기로 바꾸는 것 — 외부 증거 없이 가능합니다

값이 `PUR_PRX / PRL_IMP / NONE` 셋뿐입니다. 🔴 다만 **세 값의 «한국어 의미»가
우리 주석뿐**이라, 그 문구를 셀러에게 보여주려면 근거가 필요합니다.

### 3. 주소 하나 더 — ⑤를 닫습니다 (코드 변경 0)

```
https://ttaejyo.vercel.app/api/lotteon/common-codes?group=OPLC_CD
https://ttaejyo.vercel.app/api/lotteon/common-codes?group=PD_ITMS_CD   (40건 재확인)
```

---

## CTO SELF-VERIFICATION — 🟡 PARTIAL (조사)

코드 미변경 · tree clean.
🔴 **조사 결론 하나를 정정했다** — 「배송방법 구매대행이 Common 에 없다」는 틀렸다.
`coupang_seller_profiles.delivery_method` 에 있다. 표 이름이 `coupang_` 이지만
판매자 공통 기본값을 담는 자리다. **그래도 자유 텍스트를 규제 코드로 바꾸지
않는다** — 축이 다르다.
