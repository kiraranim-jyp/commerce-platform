# P0-b — 원상품 추출 가능성 조사

> 🔴 **코드 미변경 · 대체 제안 0.** 대상 `24fda3b` · 2026-09-28
> 판정 등급: `SOURCE_EXISTS` · `SOURCE_PARTIAL` · `SOURCE_ABSENT` · `UNKNOWN`

---

## 0. 결론 표

| # | 필드 | 판정 | 한 줄 |
|---|---|---|---|
| ① | 사용연령 `recommendedAge` | **`SOURCE_PARTIAL`** | 설명문의 「2-3 years」 패턴만 읽는다 |
| ② | 품명 `itemName` | **`SOURCE_ABSENT`** | 🔴 추출 코드가 «없다» |
| ③ | 모델명 `modelName` | **`SOURCE_ABSENT`** | 🔴 추출 코드가 «없다» |
| ④⑤ | 원산지 `countryOfOrigin` | **B — 국가명만 존재** | 🔴 조사 초안의 「C」를 정정했다 |

---

## ① 사용연령 — `SOURCE_PARTIAL`

```
canonical-product.ts:186   const resolvedAge = extractAge(productData.description);
                           resolvedAge ? {source:"ORIGINAL", confidence:0.7}
                                       : {value:"", source:"REQUIRED", confidence:0}
description-facts.ts       /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(years?|months?|yrs?)\b/
```

```
읽는 곳   «설명문» 하나
안 읽는 곳 JSON-LD 구조화 속성 · 옵션값 · SKU 메타
값 없으면  source = REQUIRED · 지어내지 않는다
```

🔴 **아동의류가 주력인데 사이즈가 옵션(「4-5세」)으로 오는 경우를 설명문에서만
찾는다.** 이 상품도 옵션에는 `4-5`가 있는데 `recommendedAge` 는 비었을 수 있다.
**확대 여부는 CPO 결정 사항** — 나는 제안만 적고 구현하지 않았다.

## ② 품명 · ③ 모델명 — `SOURCE_ABSENT`

```
canonical-product.ts:252   itemName:  { value:"", source:"REQUIRED", confidence:0 }
canonical-product.ts:253   modelName: { value:"", source:"REQUIRED", confidence:0 }
```

```
crawler 전역 검색   itemName 0건 · modelName 0건
ExtractedProductData 에 «필드 자체가 없다»
AI 생성 경로        없다
```

그리고 그 이유가 코드에 적혀 있다(`canonical-product.ts:249`, 주석 근거):

> N-3.44 — Naver KIDS 고시정보 필수 4개(품명/모델명/중량/KC 인증유형).
> **원본 사이트에서 신뢰성 있게 뽑아낼 방법이 없어** 항상 사용자가 직접 입력한다.

🔴 **「모델명 ← SKU」 대체를 제안하지 않았다**(CPO 금지). 제조사가 붙인 이름과
판매 단위 식별자는 다른 축이다.

### 🔴 다만 — 롯데ON 에는 탈출구가 «없다»

```
packages/listing/src/notice/reference-eligibility.ts
  NOTICE_REFERENCE_ELIGIBLE_FIELDS   빈 값이면 「상세페이지 참조」로 대체
  → SmartStore 는 이 길로 등록된다
```

세 필드는 그 목록에 있다. **그런데 그 대체는 SmartStore 고시 경로의 것**이고,
롯데ON 의 `mdlNo`·고시 항목은 이 경로를 쓰지 않는다.

→ **같은 빈 값이 SmartStore 에서는 등록되고 롯데ON 에서는 막힌다.**
이것이 CEO 화면에서 롯데ON 만 도드라져 보인 이유 중 하나다.

---

## ④⑤ 원산지 — 🔴 **판정 B.** 조사 초안의 「C」를 정정한다

조사 초안이 **「C — 원산지 자체가 없다」** 로 적었는데 **자기 증거와 어긋난다.**
같은 보고서가 「크롤러가 Spain/스페인을 추출한다」고 적고 있다.

**CPO 께서 정의하신 B 가 맞다 — 「국가명만 존재한다(ISO 없음)」.**

### 확인한 것

```
description-facts.ts:14~30   COUNTRY_PATTERNS 다섯
  /made in ([a-z ]{1,20})/i
  /country of origin[:\s]+…/i
  /\borigin\s*[:：]\s*…/i
  /제조국\s*[:：]\s*([가-힣]{1,10})/
  /원산지\s*[:：]\s*([가-힣]{1,10})/

canonical-product.ts:100     extractCountryOfOrigin(productData.description)
canonical-product.ts:238     countryOfOrigin: resolvedCountryOfOrigin
  → 🔴 Common 에 «실제로 들어간다»
```

실측 근거도 파일 주석에 있다 — *junioredition.com 의 실제 설명문
「…Product code B126AH013 SS26 **Made in China**.」* 에서 확인한 패턴.

### 🔴 ISO 코드는 어디에도 없다

```
크롤러          국가 «이름» 만. ISO 추출 코드 0건
Common          ProvenanceField<string> — 텍스트 하나
shopify-market-probe · source-currency-policy
                🔴 «배송/통화» 국가다. 상품 원산지가 «아니다».
                (CPO 금지 대상 — 원산지로 쓰지 않는다)
```

### 채널별 처리

```
SmartStore  origin-match.ts  텍스트 → COUNTRY_NAME_KO 사전 → Naver «자체» 코드(02 계열)
            못 찾으면 04(직접입력) + 원문 보존. 🔴 지어내지 않는다.
Coupang     텍스트를 고시 칸에 그대로
LotteON     originCode 자리는 있는데 «채우는 코드가 없다» → 셀러가 239건에서 고른다
```

### 판정

```
B — 국가명만 존재한다 (ISO 없음)

근거   description-facts.ts:14~30 + canonical-product.ts:100,238   현재 코드
제약   추출원이 «설명문 하나» 다. 설명문에 「Made in …」이 없으면 비어 있다.
       → 원산지 자체가 «없는» 상품도 실제로 있다(그 경우는 C)
```

🔴 **CPO 께서 정하신 B 의 처리 — 「Common 에 ISO 를 임의 생성하지 않는다 ·
별도 mapping 필요 여부 조사」** 를 그대로 따른다. **Spain → ES 를 만들지 않았다.**

---

## 1. 🔴 이 조사가 바꾸는 것

```
P0-1 의 원인이 «크롤러» 라는 감사 결론은 유지된다. 그런데 한 겹 더 갈린다 —

  사용연령   추출 코드는 «있고» 범위가 좁다        → 넓히는 것은 결정 사항
  품명·모델명 추출 코드가 «없고» 없는 이유가 적혀 있다
             「원본에서 신뢰성 있게 뽑을 방법이 없다」(N-3.44)
             → 🔴 이것은 «버그가 아니라 이미 내려진 결정» 이다.
                뒤집으려면 그 판단을 다시 해야 한다.
  원산지     추출 코드가 있고 «국가명» 까지는 온다 → ISO 는 별개 문제
```

🔴 **그래서 「크롤러를 고치면 된다」가 아니다.** 셋의 성격이 다르다.

---

## 2. CPO 판단 요청 — 셋

```
① 사용연령 추출 범위를 넓힐까
   지금: 설명문의 「N-M years」만
   후보: 옵션값(「4-5세」) · JSON-LD 구조화 속성
   🔴 옵션은 «사이즈» 일 수도 있다 — 축이 섞일 위험이 있어 내가 정하지 않는다

② 품명·모델명 — N-3.44 결정을 뒤집을 것인가
   「원본에서 신뢰성 있게 뽑을 방법이 없다」는 판단이 이미 있다.
   🔴 뒤집는다면 «무엇을 근거로» 뽑을지가 먼저다. 지금은 근거가 없다.

③ 롯데ON 에 「상세페이지 참조」 탈출구를 열 것인가
   SmartStore 는 그 길로 등록된다. 롯데ON 고시는 그 길이 없다.
   🔴 롯데ON 이 그 표기를 받아들이는지 «확인한 적이 없다» — 문서/실응답 필요.
      확인 없이 열면 오등록이다.
```

---

## CTO SELF-VERIFICATION — 🟡 PARTIAL (조사)

코드 미변경 · tree clean · 대체 제안 0.
🔴 **조사 판정 하나를 정정했다** — 원산지는 「C(없다)」가 아니라 「B(국가명만)」다.
초안이 자기 증거와 어긋났고, `description-facts.ts` 와 `canonical-product.ts` 를
직접 읽어 확인했다.
🔴 **「모델명 ← SKU」 · 「Spain → ES」 를 만들지 않았다.**
