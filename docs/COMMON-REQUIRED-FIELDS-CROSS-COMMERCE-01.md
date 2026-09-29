# COMMON-REQUIRED-FIELDS-CROSS-COMMERCE-01 — 승격 기준으로 셋을 다시 본다

> 조사만. **코드 변경 0 · migration 0 · UI 0 · payload 0.**
> 판정 기준(CPO): 「다른 Commerce 에서 이 정보가 실제로 필요한 사례가 있는가 →
> 공통 의미가 성립하는가 → 실제 source 가 있는가 → 그 다음 저장 위치」

---

## 0. 결론 먼저

```
0220 출시년월     SOURCE-ABSENT 유지 — 그러나 「빈 필드를 만든다」가 오답인 이유가
                  하나 더 나왔다: 같은 요구를 네이버가 «이미» 참조 문구로 충족 중이다
1830 크기·체중 한계 COMMERCE-SPECIFIC — 다른 채널의 «요구» 가 확인되지 않는다
KC 0200           🔴 이미 결정돼 있다 — 이 조사는 여섯 번째 중복이었다
```

🔴 **셋 중 어느 것도 「Common 에 새 칸을 만든다」로 끝나지 않는다.**

---

## 1. 🔴 KC — 조사하지 않았다. 이미 끝나 있었다

`safetyCertification|sftyAthn` 로 훑자 **기존 조사 문서 다섯 개**가 나왔다:

```
docs/COMMERCE-COMMON-KC-01.md      -02.md      -03.md
docs/COMMERCE-COMMON-KC-READINESS-01.md        -COUPANG-01.md
```

CPO 가 이번에 물은 것(「`seller_compliance_confirmations` 를 활용할 수 있는지」
「3채널 KC 를 Common Compliance 로 대조」)이 **그 문서들의 주제 그대로다.**
여섯 번째 조사를 하지 않고 기존 결론을 확인했다.

### 이미 확정된 것 — 「선언」은 채널 것이다

`packages/shared/src/product-types.ts:424` (타입 주석, CPO 확정):

> 🔴 Master 가 아니라 **COMMERCE_BINDING** 이다. enum 어휘가 네이버 전용이고
> (TRUE/FALSE/KC_EXEMPTION_OBJECT), 「대상 아님」은 상품의 «사실» 이 아니라
> 이 채널에 «어떻게 신고하는가» 이기 때문이다. 쿠팡은 고시 텍스트 한 칸,
> 롯데ON 은 sftyAthnLst 로 표현이 전부 다르다.

이번 교차조사가 독립적으로 같은 결론에 도달했다(아래 §1-1). **재확인이지 새 발견이
아니다.**

### 이미 확정된 것 — 「확인 행위」는 공통이고, 저장소는 새로 만들지 않는다

`COMMERCE-COMMON-KC-03.md §0`:

```
🟢 계약은 성립한다     {confirmed · policyVersion · categoryCode}
🔴 범위를 함께 들고 다녀야 한다   categoryCode 는 platform 없이는 뜻이 없다
🔴 기존 «테이블» 을 그대로 쓸 수 없다  kc_status 가 NOT NULL + CHECK 로 네이버 어휘에 묶여 있다
🟢 그래서 «읽기 어댑터» 로 푼다 (migration 0)
```

`migration 024` 주석이 이를 뒷받침한다 — `kc_status` 4단계는 N-3.53 에서 고정됐고,
**그 migration 은 아직 실행 전이다**(주석이 직접 적는다). 즉 이 표는 지금 **비어
있고 아무도 읽지 않는다**(코드 참조 0건).

### 🔴 그리고 CPO 결정이 «미결로 대기 중» 이다

`COMMERCE-COMMON-KC-READINESS-01.md §6~§7`:

> **§6 결론 — Common KC Readiness 를 «지금» 만들면 안 되는 이유**
> 공통으로 쓸 수 있는 것: 확인 «읽기 계약» · 확인 «화면»(이미 3채널 공용)
> 공통으로 만들 수 없는 것: 「언제 REQUIRED 인가」 — 채널마다 근거가 다르고
> 하나는 아예 없다
> 🔴 지금 만들면 **쿠팡·롯데ON 에 없던 요구를 우리가 만드는** 셈이다 —
> 쿠팡 쪽은 「없다」가 아니라 **「재지 않았다」** 다.

| 안 | 내용 | 대가 |
|---|---|---|
| ① | **스마트스토어에만** Common 계약 적용, 현 동작 그대로 재현 | 🟢 위험 0 · **CTO 권고(당시·현재 동일)** |
| ② | 쿠팡 readiness 에 compliance 를 넣어 «측정부터» | 실시간 카테고리 조회 필요(성능) |
| ③ | 3채널 Common KC Readiness 도입 | 🔴 권하지 않음 — 없던 요구를 만든다 |

**이 표가 이번 지시의 ③에 대한 답이다.** 새로 조사할 것이 아니라 **①/②/③ 중
하나를 고르는 일**이 남아 있다.

### 1-1. 교차조사 결과 (재확인용 · 9축)

| 축 | 네이버 | 쿠팡 | 롯데ON |
|---|---|---|---|
| 인증 대상 여부 «선언» | `kcCertifiedProductExclusionYn` | — | — |
| 어린이제품 대상 «선언» | `childCertifiedProductExclusionYn` | — | (품목코드 23 으로 자동) |
| 면제 «사유» | `kcExemptionType` (3 enum) | — | 부분(`impDvsCd`/`impPrxCd`) |
| 인증 «유형» | 타입만 있고 미사용 | — | `sftyAthnTypCd` |
| 인증 «번호» | 필드 있음 · 값 없으면 BLOCKED | 🔴 쓸 수 없다 | `sftyAthnNo` |
| 인증 «기관» | 필드 있음 · 미사용 | — | `sftyAthnOrgnNm` |
| 고시용 «문자열» | `certificationType` | 고시 필드에 주입 | — |
| 면제 «문구» | 미사용 | `kcExemptionText`(공통 설정) | — |
| 구매대행 «표시» | `kcExemptionType="OVERSEAS"` | — | `impPrxCd`+`impCoNm`+`impDvsCd` |

🔴 **쿠팡은 KC 공급원이 될 수 없다** — 구조적으로 막혀 있고 그 막음이 의도된 것이다:

```
packages/listing/src/coupang/update-preflight.ts:140
  certifications — «채우는 것» 이 사고다
  실측: 우리 상품 5개 옵션 전부 certifications: []
  코드에서 한 번도 쓴 적 없다(참조 0건)
  늘어나면 FABRICATED 로 잡는다   ← 「12313ㄹㅇ」 사건의 가드
registered-baseline.ts:18
  certifications 는 쿠팡이 관리하는 27칸 중 하나다. 빌더는 그 칸을 만들지 못한다.
```

법적 해석은 하지 않았다.

---

## 2. 0220 동일모델의 출시년월

### ① 다른 Commerce 의 요구 — 🟡 네이버에 «있다»

| 채널 | 필드 | 필수 | 현재 무엇이 들어가는가 |
|---|---|---|---|
| 네이버 | `kids.releaseDate`(구조화 YearMonth) | 선택 | **아무것도** — 채우지 않는다 |
| 네이버 | `kids.releaseDateText`(자유텍스트) | 선택 | 🔴 **`"상품 상세페이지 참조"` 무조건** |
| 쿠팡 | — | — | 개념 없음(고시는 카테고리 메타가 정한다) |
| 롯데ON | `0220` | **필수** | BLOCKED |

`packages/listing/src/naver/build-payload.ts:726-732` 주석이 사정을 적는다 —
구조화 `releaseDate` 는 「크롤러가 추출하지 않음, 임의 날짜를 지어내지 않는다는 원칙
유지」라서 비우고, 공식 스펙의 자유텍스트 대체 필드에 관용구를 넣는다.

### ② 실제 source — 🔴 «없다» (전수)

```
CanonicalProduct / master-product.ts   releaseDate · seasonCode 없음
crawler                                시즌코드 패턴은 «있다» — 그러나 brand-resolver.ts:52
                                       에서 «브랜드명에서 제거할 쓰레기» 로 쓰고 버린다
migrations_manual/*.sql                출시·제조 날짜 컬럼 없음
seller_settings                        없음
```

🔴 시즌코드가 「존재한다」는 사실만 적는다. 출시년월로 «바꿀 수 있는가» 는 판단하지
않았다(금지된 추론).

### ③ 🔴 그런데 이미 Common 모듈이 있다 — 그리고 `releaseDate` 는 그 밖이다

`packages/listing/src/notice/reference-eligibility.ts` 는 CPO 지시 N-3.45
「상품정보제공고시 공통 관리」로 만들어진 **Common 레이어**다. 파일이 목적을 적는다:

> 여러 어댑터가 각자 다른 기준을 만들면 다시 플랫폼별로 판단이 갈라지는 문제가 재발한다

화이트리스트 9개 — `itemName modelName weight material color manufacturer
careInstructions recommendedAge importer`.

```
🔴 releaseDate 는 이 목록에 «없다».
   그래서 네이버의 releaseDateText 는 Common 경로를 타지 않는 «채널 로컬 하드코딩» 이다.
```

### ④ 그리고 롯데ON 쪽 문은 «테스트로» 잠겨 있다

`packages/listing/src/common/__tests__/wire03-color-boundary.test.ts:74`

> 🔴 롯데ON 이 참조 경로를 «쓰지 않는다» — 열려면 CPO 결정이 먼저다
> (`:80` 쿠팡도 아직 그 길을 쓰지 않는다 — 결정 기록이 없다)

### 판정

```
분류: SOURCE-ABSENT  (유지)
🔴 Common 에 releaseDate 칸을 만드는 것은 오답이다 — 채울 값이 어디에도 없고,
   네이버는 «칸» 이 아니라 «관용구» 로 이 요구를 이미 넘고 있다.
실제 결정 사안: 「상세페이지 참조 관용구를 롯데ON 고시에 허용할 것인가」
                = 기존 Common 모듈의 «적용 범위» 결정 (새 필드 아님)
```

---

## 3. 1830 크기ㆍ체중의 한계

### 🔴 먼저 — 물리 치수와 다른 축이다. 롯데ON «자신이» 갈라 놨다

`packages/listing/src/lotteon/notice-schema.ts` 품목 23 에 **둘이 따로** 있다:

```
0780  「크기, 중량」            required  "섬유제품 등의 경우 치수 정보로 대체 가능해요"
1830  「크기ㆍ체중의 한계」      required  "착용 또는 탑승용 어린이제품과 같이
                                          크기ㆍ체중에 «제한» 이 있는 품목의 경우"
```

그리고 `notice-resolve.ts` 에서 운명이 갈린다:

```
:158  0780 → 🟢 source 있음   사이즈 옵션(facts.sizeValues) → 없으면 중량(facts.weight)
:216  1830 → 🔴 BLOCKED       「해당하지 않는 상품에 무엇을 적어야 하는지 기준을 확인하지 못했습니다」
```

→ **배송용 치수/무게로 1830 을 채울 수 없다.** 1830 은 「이 제품을 쓸 수 있는
아이의 상한」, 즉 **안전 사용 제한**이다.

### ① 다른 Commerce 의 요구 — 🔴 «확인되지 않는다»

| 채널 | 필드 | 필수 | 채우는 코드 |
|---|---|---|---|
| 네이버 | `kids.numberLimit` | 선택 | 🔴 **없다** — `types.ts:78` 에 «선언만» 있고 대입 0건 |
| 쿠팡 | — | — | 개념 없음(치수/무게는 배송·규격 축) |
| 롯데ON | `1830` | **필수(조건부)** | BLOCKED |

CPO 기준은 「실제 다른 Commerce 의 **요구** 가 확인된 경우에만 Common 후보」다.
네이버는 **선택 + 미사용** 이므로 요구가 확인되지 않는다.

### ② 조건부 항목을 다루는 선례 — 롯데ON 뿐이다

```
LotteOnNoticeFill  FILLED · NEEDS_INPUT · BLOCKED · INVALID
```
네이버/쿠팡은 「필드가 있거나 없거나」만 다루고 같은 카테고리 안의 조건부는 다루지
않는다.

### 판정

```
분류: COMMERCE-SPECIFIC  (Common 후보 아님 · Category Attribute 도 아님)
근거: 다른 채널의 요구 미확인 · 공통 의미는 성립하지만 요구가 한 채널에만 있다
🔴 물리 치수(0780/weight/size)로 대체 금지 — 롯데ON 이 별개 필수 항목으로 둔다
남은 것: 0220 과 «같은 질문» 이다 — 「해당 없을 때 무엇을 기재하는가」
         → 하나의 공식 문의로 합칠 수 있다
```

---

## 4. 분류표 (최종)

| 항목 | COMMON | MASTER | CATEGORY | COMMERCE-SPECIFIC | SOURCE-ABSENT |
|---|---|---|---|---|---|
| `0220` 출시년월 | | | | | 🔴 **여기** |
| `1830` 크기·체중 한계 | | | | 🔴 **여기** | |
| KC — 선언/표현 | | | | 🔴 **여기**(기결정) | |
| KC — 「확인했다」 기록 | 🟢 **여기**(기결정 · 읽기 어댑터) | | | | |
| KC — 인증 유형/번호/기관 | | | | | 🔴 **여기** |

🔴 **KC 를 「상세페이지 참조」로 우회하는 길은 영구히 닫혀 있다** —
`reference-eligibility.ts:15` (CPO 지시 N-3.45 STEP10):

> KC 인증정보는 절대 이 목록에 넣지 않는다 — 실제 인증 취득 여부를 알 수 없어서
> 「상세페이지 참조」로 얼버무리면 **규제 위반 위험**이 있다

→ 그래서 `0220`/`1830` 과 KC 는 **같은 해법을 쓸 수 없다.** 문의도 갈라야 한다.

---

## 5. 부수 발견 — 낡은 주석 하나

`packages/listing/src/lotteon/notice-resolve.ts:52`

```ts
/** 🔴 아직 우리 어디에도 없는 값. 자리만 둔다(DB 변경은 CPO STOP 중). */
sellerAsCompanyName?: string | null;
```

**틀렸다.** migration 068 이 실행됐고 `6f0651a` 에서 Production 으로 값이 나갔다.
이 저장소가 낡은 주석에 속은 것이 이번이 두 번째다(첫 번째: `pdArtlCd` 「얻을 길이
없다」). **이번 스프린트는 코드 변경 0 이라 고치지 않았다** — 다음 구현 턴의 첫 줄로
남긴다.

---

## 6. 이번에 «하지 않은» 것

코드 0 · migration 0 · UI 0 · payload 0 · 새 Common 필드 0 ·
임의값 0 · `N/A`·「해당없음」 자동생성 0 · 시즌→출시년월 변환 0 ·
법적 해석 0 · 롯데ON 참조경로 개방 0 · KC 여섯 번째 조사 0.
