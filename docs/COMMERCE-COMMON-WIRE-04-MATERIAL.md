# COMMERCE-COMMON-WIRE-04 — 소재

> CPO 작업지시(2026-09-28). 색상과 **같은 순서**로 진행.
> 원칙: **공통화할 사다리가 없으면 공통 함수를 만들지 않는다.**

---

## 0. 결론

**Resolver 를 만들지 않았습니다.** 고시 쪽은 색상과 똑같이 사다리가 없습니다.
다만 소재에는 **색상에 없던 것이 둘** 있어서, 그 경계를 추가로 고정했습니다.

```
원산지  사다리가 두 곳에 따로 있었다   → 합쳤다      (WIRE-01)
제조사  공통 함수를 한 채널만 안 썼다  → 이었다      (WIRE-02)
색상    사다리가 없다                 → 경계 고정    (WIRE-03)
소재    사다리가 없다 + «두 갈래» 가 있다 → 경계 고정  (WIRE-04)
```

---

## 1. STEP 1~3 — 3채널 실제 경로

| 채널 | 코드 | 폴백 |
|---|---|---|
| 쿠팡 | `coupang/build-payload.ts:1421` `material: product.material.value \|\| undefined` | 없음 |
| 롯데ON | `lotteon/_lib/build-context.ts:214` `material: product.material.value` | 없음 |
| 스마트스토어 | `naver/build-payload.ts:692·738` `resolveNoticeFieldValue("material", …)` | 없음 |

**Commerce 계층에 폴백 사다리가 없습니다.** → `resolveCommonMaterial()` 을 만들면
`product.material.value` 를 그대로 돌려주는 껍데기가 됩니다.

## 2. STEP 2 — 기존 공통 함수

`resolveNoticeFieldValue` 가 이미 공통이고 `material` 도 화이트리스트에 있습니다.
**새 함수 불필요.**

---

## 3. 🔴 소재에만 있는 것 ① — Master 생성 단계의 사다리

```ts
// apps/admin/src/app/api/pipeline/canonical-product.ts:176
productData.material || extractMaterial(productData.description) || ""
```

사다리가 **있긴 합니다.** 그런데 이것은 **「상품 사실을 만드는」 단계**이지
Commerce 매핑이 아닙니다. 크롤러가 소재를 못 찾으면 설명문에서 뽑는 것이고,
그 결과가 `product.material` 이 됩니다.

🔴 **Commerce 계층으로 끌어올리지 않습니다.** 올리면 채널이 크롤러 일을
하게 되고, 채널마다 「설명문에서 뽑기」가 갈라집니다.

CPO 기준으로 자르면 — **상품의 사실 → Master.** 여기서 끝입니다.

---

## 4. 🔴 소재에만 있는 것 ② — 네이버 전용 속성 매핑

```ts
// naver/attribute-resolver.ts:190  resolveMaterialAttribute()
MATERIAL_KEYWORD_MAP   /cotton/i → "면"  ·  /polyester/i → "폴리에스테르"  …
const found = valueByName(attr, value);   // ← 채널이 준 속성 목록에서만 찾는다
if (found && …) matched.push(found);      // ← 없으면 건너뛴다. 값을 만들지 않는다
```

「주요소재」라는 **네이버 카테고리 속성**을 채우는 경로입니다. 원문을 채널의
속성값 이름으로 옮기되, **목록에 없으면 아무것도 넣지 않습니다.**

🔴 **이것은 Commerce 에 남아야 합니다.** Common 으로 올리면 우리가 소재 사전을
갖게 되고, 그 순간 채널마다 다른 속성 체계를 우리가 대신 판단하게 됩니다.
CPO 기준 그대로 — **Commerce 코드/형식 → Commerce Mapping.**

---

## 5. 🔴 그래서 같은 값이 네이버에서 «두 갈래» 로 나갑니다

```
고시(상품정보제공고시)   원문 그대로        "17% Recycled Cotton"
속성(주요소재)          매핑된 채널 값      "면"
```

둘을 섞으면 **고시에 「면」이 나가거나 속성에 원문이 나갑니다.**
이 경계를 계약으로 고정했습니다(§6 ④).

---

## 6. STEP 7~8 — 무엇을 했는가 · 음성 테스트

`packages/listing/src/common/__tests__/wire04-material-boundary.test.ts` (12건)

| 고정한 것 | 음성 대조 | 결과 |
|---|---|---|
| ① 고시 소재 단일 출처 | — | |
| ② 참조 대체는 네이버만 (CPO 보류 보호) | 롯데ON 에 참조 경로 개방 | 🔴 **2건 FAIL** |
| ③ 소재 사전은 Commerce 에 남는다 | 사전을 `common/` 으로 승격 | 🔴 **1건 FAIL** |
| ④ 고시와 속성이 섞이지 않는다 | 고시 줄에 속성 매핑 주입 | 🔴 **1건 FAIL** |
| ⑤ Master 추출 함수를 채널이 부르지 않는다 | — | |

셋 다 복원 후 12/12 통과. **`git status` 로 소스가 원상태임을 확인**했습니다
(되돌리는 중 `naver/build-payload.ts` 에 줄바꿈 표시만 남아 `git checkout` 으로
깨끗이 되돌렸습니다 — 내용 차이는 0 이었습니다).

> 「fallback 순서를 바꾸면 실패」는 **해당 없음** — 순서가 없습니다.
> 「단일 출처가 깨지면 실패」로 같은 목적을 지켰습니다.

---

## 7. 이번 변경

**소스 변경 0.** 테스트 1 · 문서 1.
`resolveNoticeFieldValue`·`attribute-resolver`·세 채널 payload 모두 그대로입니다.

---

## 8. 정리 — 네 필드에서 배운 것

```
사다리가 «여러 곳에» 있다        → 합친다        (원산지)
공통 함수가 있는데 «안 쓴다»     → 잇는다        (제조사)
사다리가 «없다»                  → 만들지 않는다  (색상 · 소재)
채널만의 표현 방식이 있다        → 거기 둔다      (네이버 속성 매핑)
```

🔴 네 번 중 **두 번은 「만들지 않는 것」이 정답**이었습니다.
Common 의 크기가 아니라 **경계가 맞는지**가 기준입니다.
