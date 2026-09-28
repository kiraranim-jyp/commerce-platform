# COMMERCE-COMMON-WIRE-03 — 색상

> CPO 작업지시(2026-09-28). 원산지·제조사와 **같은 순서**로 진행.
> 결론: **Common Resolver 를 만들지 않았습니다.** 만들 것이 없었습니다.

---

## 0. 결론

```
원산지  사다리 3단계가 «두 곳에 따로» 있었다        → 합쳤다 (WIRE-01)
제조사  공통 함수가 있는데 «한 채널만 안 썼다»      → 이었다 (WIRE-02)
색상    사다리가 «없다». 단일 출처다               → 🔴 합칠 것이 없다
```

대신 **경계를 계약으로 고정**했습니다. 이유는 §3 입니다.

---

## 1. STEP 1 — 3채널 기존 색상 결정 로직 (전수)

| 채널 | 코드 | 폴백 |
|---|---|---|
| 쿠팡 | `coupang/build-payload.ts:1436` `color: product.color.value \|\| undefined` | 없음 |
| 롯데ON | `lotteon/_lib/build-context.ts:213` `color: product.color.value` | 없음 |
| 스마트스토어 | `naver/build-payload.ts:693·739` `resolveNoticeFieldValue("color", product.color)` | 없음 (§3 참조) |

**셋 다 `product.color` 하나만 봅니다.** 브랜드 기본값도, 판매자 기본값도,
카테고리 값도 없습니다 — 색상은 상품마다 다른 사실이라 기본값이라는 개념이
성립하지 않습니다.

## 2. STEP 2 — 기존 Common 타입/함수 중복 확인

`resolveNoticeFieldValue` 가 **이미 공통 폴더에** 있습니다
(`packages/listing/src/notice/reference-eligibility.ts`).
색상은 그 화이트리스트(`NOTICE_REFERENCE_ELIGIBLE_FIELDS`)에 포함돼 있습니다.

→ **새 함수를 만들 이유가 없습니다.**

---

## 3. 🔴 그런데 «하나» 가 다릅니다 — 그리고 그것은 사고가 아니라 결정입니다

네이버만 「상세페이지 참조」 대체를 씁니다.

```ts
// notice/reference-eligibility.ts:49
export function resolveNoticeFieldValue(fieldKey, field) {
  if (field?.value) return field.value;                       // ← 값이 있으면 셋 다 같다
  if (field?.source === "DETAIL_PAGE_REFERENCE" && isNoticeReferenceEligible(fieldKey))
    return "상품 상세페이지 참조";                              // ← 네이버만 이 길
  return undefined;
}
```

즉 **값이 있을 때는 세 채널이 완전히 같고**, 갈리는 경우는 하나뿐입니다 —
**값이 없고 판매자가 「상세페이지 참조」를 골랐을 때.**

### 🔴 그 차이를 없애면 안 됩니다

이미 CPO 결정이 있습니다.

> ③ 롯데ON 에 「상세페이지 참조」 탈출구를 열 것인가
>   「롯데ON 이 그 표기를 받아들이는지 **확인한 적이 없다** — 확인 없이 열면
>    오등록이다」 (`P0-B-SOURCE-EVIDENCE.md`)
>
> CPO 판정: 「오등록 가능성이 있는 우회로를 Readiness 해제 수단으로 쓰지 않습니다」

**쿠팡은 결정 기록 자체가 없습니다.** 확인 없이 여는 것은 같은 위험입니다.

→ 그래서 「통합」이라는 이름으로 셋을 같게 만들면 **보류된 우회로가 조용히
열립니다.** 이것이 색상에서 Resolver 를 만들지 않은 진짜 이유입니다.

---

## 4. STEP 3~4 — 무엇을 했는가

Resolver 대신 **경계 가드**를 붙였습니다
(`packages/listing/src/common/__tests__/wire03-color-boundary.test.ts`, 12건).

| 고정한 것 | 왜 |
|---|---|
| 세 채널이 `product.color` 단일 출처 | 나중에 누가 기본값을 끼워 넣으면 잡힌다 |
| 값이 있으면 셋이 같다 | 「다르다」가 과장이 아님을 명시 |
| 네이버만 참조 대체를 쓴다 | 차이가 «결정» 임을 코드로 남긴다 |
| 🔴 롯데ON 이 참조 경로를 쓰지 않는다 | **CPO 보류 보호** |
| 🔴 쿠팡도 아직 쓰지 않는다 | 결정 기록이 없다 |
| 색상 이름→코드 표가 없다 | 임의 정규화 금지 |

🔴 `resolveNoticeFieldValue` 는 **손대지 않았습니다.** 세 채널 payload 도
한 글자도 바뀌지 않았습니다 — 이번 변경은 **테스트 파일 하나뿐**입니다.

---

## 5. STEP 8 — 음성 테스트 (요구하신 두 가지)

| 대조 | 결과 |
|---|---|
| 쿠팡에 색상 변환표(`Lavender → 라벤더`) 한 줄 주입 | 🔴 **2건 FAIL** |
| 롯데ON 에 참조 경로(`resolveNoticeFieldValue`) 개방 | 🔴 **2건 FAIL** |

둘 다 복원 후 12/12 통과. `git diff` 로 소스가 원상태임을 확인했습니다.

> 「fallback 순서를 바꾸면 실패」는 **해당 사항이 없습니다** — 순서가 없습니다.
> 대신 「단일 출처가 깨지면 실패」로 같은 목적을 지켰습니다.

---

## 6. 🔴 CPO 판단이 필요한 것 하나

**쿠팡의 「상세페이지 참조」는 결정 기록이 없습니다.**

```
스마트스토어  쓴다        (기존 · 검증됨)
롯데ON       안 쓴다     (CPO 보류 — 오등록 우려)
쿠팡         안 쓴다     🔴 결정 기록 «없음» — 안 쓰는 것이 결정인지 누락인지 불명
```

지금 동작은 「안 씀」이고 제가 바꾸지 않았습니다. 다만 **이것이 의도인지
확인이 필요**합니다. 쿠팡이 그 표기를 받아들이는지도 확인된 바 없습니다.

---

## 7. 다음 (WIRE-04 소재)

소재도 같은 모양일 가능성이 높습니다 — `material` 역시
`NOTICE_REFERENCE_ELIGIBLE_FIELDS` 에 있고, 쿠팡은 `MATERIAL_SYNONYMS` 로
상품 값만 씁니다. **먼저 조사하고, 합칠 것이 없으면 그렇게 보고하겠습니다.**
