# COMMERCE-COMMON-WIRE-05 — A/S · 품질보증

> CPO 작업지시(2026-09-28). **두 필드를 한꺼번에 구현하지 말고 먼저 전수 조사.**
> DB migration ❌ · A/S 업체명 임의 채움 ❌ · 품질보증 문구 채널별 변환 ❌.

---

## 0. 결론 — **두 필드의 답이 다릅니다**

```
품질보증  3채널 모두 seller_settings.quality_guarantee 단일 출처 · 사다리 없음
          → 만들지 않는다 (색상 · 소재와 같은 결론)

A/S      사다리가 «있다». 그런데 쿠팡에만 있고, «다른 개념» 으로 넘어간다.
          → 🔴 합치면 안 된다. 갈라 둔 것을 지킨다.
```

---

## 1. STEP 1~6 — 실제 Production 경로 (전수)

### 품질보증

| 채널 | 코드 | 폴백 |
|---|---|---|
| 쿠팡 | `coupang/build-payload.ts:1451` `sellerConfig.qualityGuarantee \|\| undefined` | 없음 |
| 스마트스토어 | `naver/_lib/resolve-context.ts:219` `warrantyPolicy: sellerSettings.qualityGuarantee \|\| null` | 없음 |
| 롯데ON | `lotteon/_lib/build-context.ts` `sellerQualityGuarantee: commonSellerSettings.qualityGuarantee` | 없음 |

**셋 다 `seller_settings.quality_guarantee` 한 칸입니다.** Seller → Commerce 는
이미 «한 번만 정의된» 상태이고, 그 위에 얹을 사다리가 없습니다.

### A/S 연락처

| 채널 | 코드 | 폴백 |
|---|---|---|
| 스마트스토어 | `resolve-context.ts:220` `afterServiceDirector: sellerSettings.asContactNumber \|\| null` | 없음 |
| 롯데ON | `build-context.ts` `sellerAsContactNumber: commonSellerSettings.asContactNumber` | 없음 |
| 쿠팡 | `coupang/build-payload.ts:1419` `sellerConfig.asContactNumber \|\| sellerConfig.companyContactNumber` | 🔴 **있음** |

---

## 2. 🔴 STEP 7 — A/S 는 «한 개념이 아닙니다»

쿠팡의 폴백이 넘어가는 `companyContactNumber` 는 **반품지 연락처**(배송 프로필)
이고 A/S 연락처가 아닙니다. 기존 가드가 이미 경고하고 있었습니다 —

> 「반품지 연락처는 **A/S 연락처가 아니다** … 두 값이 섞이면 고객에게 다른
>  번호가 나간다」(`pivot03-smartstore-seller-source.test.ts`)

그리고 **네이버가 실측으로 그 경계를 그었습니다**(N-3.51, 5차 실등록) —

```
afterServiceDirector         자유 텍스트 고시 항목
                             「해외 구매대행으로 A/S 불가」 같은 문구가 실제로 통과
afterServiceTelephoneNumber  숫자 / - / + 만 허용하는 «엄격한 전화번호»
→ 원문: 「같은 소스를 재사용할 수 없다」
```

**「A/S 책임자」와 「A/S 전화번호」는 다른 필드입니다.**

→ Common 으로 올려 하나로 만들면 쿠팡의 폴백이 세 채널로 퍼지고,
**고객에게 A/S 번호로 반품지 번호가 나갑니다.**

---

## 3. STEP 8 — 롯데ON `0090` 과 현재 Common 데이터의 관계

```
고시 0090 요구   「AS책임자(업체명)와 전화번호를 «모두» 입력해주세요」
우리가 가진 것   as_contact_number (번호)만
빠진 것          업체명
```

→ `0090` 은 **BLOCKED 로 남습니다.** 🔴 CPO 금지대로 판매자명·제조사로
채우지 않았고, **DB 컬럼도 추가하지 않았습니다.** 업체명 칸이 생기면 그때
채워진다는 것만 테스트로 고정했습니다.

## 4. STEP 9 — 품질보증 `0080` 채널별 형식 차이

세 채널 모두 **자유 텍스트**로 같은 값을 그대로 씁니다. 변환·가공이 없습니다.
→ 형식 차이 없음. 그래서 더더욱 Resolver 가 필요 없습니다.

---

## 5. STEP 10~11 — 무엇을 했는가

**Resolver 를 만들지 않았습니다.** 대신 경계를 고정했습니다
(`wire05-seller-facts-boundary.test.ts`, 12건).

| 고정한 것 |
|---|
| ① 품질보증 단일 출처(3채널) · 문구를 채널별로 가공하지 않음 |
| ② A/S 두 축이 섞이지 않음(고시 자유텍스트 ↔ 엄격한 전화번호) |
| ③ 🔴 쿠팡의 폴백이 **Common 으로 올라오지 않음** |
| ④ A/S 업체명을 지어내지 않음 — `0090` BLOCKED 유지 |

---

## 6. 🔴 이번에 제가 만든 «공허한 가드» — 그리고 그것을 잡은 경위

음성 대조에서 **가드가 통과해 버렸습니다.** 쿠팡의 폴백을 공통 폴더에
올렸는데도 잡히지 않았습니다.

원인이 아이러니합니다 —

```
주입한 코드   export const resolveCommonAsContact = (a, b) => a || b || null;
                                              // asContactNumber || companyContactNumber
내 가드       식별자 이름(asContactNumber …)을 «주석을 벗긴 뒤» 찾는다
결과          식별자가 주석에만 있었다 → 벗겨져 사라짐 → 통과
```

🔴 **주석 제거는 거짓 «양성» 을 막지만, 이번에는 거짓 «음성» 을 만들었습니다.**
그리고 이름만 보는 가드는 **함수명을 바꾸면 무력**합니다.

→ 이름이 아니라 **export 자체**를 보도록 고쳤습니다
(`/as_?contact|afterservice/i` 에 걸리는 export 가 하나도 없어야 함).
다시 음성 대조 → **1건 FAIL**. 복원 후 12/12.

---

## 7. 이번 변경

**소스 변경 0.** 테스트 1 · 문서 1.
`seller_settings`·세 채널 payload·`0090` 상태 모두 그대로입니다.

---

## 8. 정리 — 여섯 필드

```
원산지    사다리가 여러 곳에 있다        → 합친다
제조사    공통 함수를 한 채널만 안 쓴다   → 잇는다
색상      사다리가 없다                  → 만들지 않는다
소재      사다리가 없다 + 두 갈래가 있다  → 만들지 않는다 · 갈라 둔다
품질보증  사다리가 없다                  → 만들지 않는다
A/S      사다리가 «있지만 다른 개념» 이다 → 🔴 만들지 않는다 · 갈라 둔다
```

여섯 중 **넷이 「만들지 않는 것」**이 정답이었습니다.
Common 의 크기가 아니라 **경계가 맞는지**가 기준이라는 것이 다시 확인됐습니다.
