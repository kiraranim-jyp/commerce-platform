# COMMERCE-COMMON-KC-COUPANG-02 — 실측 «가능 범위» 를 먼저 확정한다

> CPO 작업지시(2026-09-28). 목적: 쿠팡 KC/고시 요구사항을 **실제 등록 기준**으로 확정.
> 금지: Common Confirmation 연결 ❌ · migration ❌ · payload 기본값 변경 ❌ ·
> KC UI ❌ · `certifications` 신규 구현 ❌ · KC 를 OPTIONAL/REQUIRED 로 임의 판정 ❌
>
> **이번에 한 것**: 조사 + 테스트(10건, 음성 대조 포함). **코드 변경 0**(빌더 무수정).
> **이번에 못 한 것**: 실제 쿠팡 API 호출 — 아래 §5 에 이유와 필요한 결정을 적었습니다.

---

## 0. 한 줄 결론

```
🔴 「기본 문구 있음 / 빈 값」 A/B 는 «지금 그대로는» 돌릴 수 없다.
🟢 그런데 돌리기 «전에» 답해야 할 것 세 개를 이번에 확정했고,
   그중 둘은 «쓰기 없이» 답할 수 있다는 것도 확인했다.
```

그리고 조사 중 **프로덕션 설정만으로 도달하는 빈 칸 경로**를 찾았습니다(§3).

---

## 1. 🔴 먼저 — 「빈 값」은 «한 번도 나간 적이 없습니다»

git 고고학으로 확인했습니다. 기본 문구 도입 커밋은 `4dbd5eb`(2026-08-03 13:56 KST).

```diff
  // 4dbd5eb 이전 — 사다리 끝
- value: NOTICE_DEFAULT_CONTENT,          // "전체 상품 상세페이지 참조"
- source: "PLACEHOLDER",
- critical: isComplianceCritical(...),

  // 4dbd5eb 이후 — KC 분기가 앞에 생김
+ value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT,
+ source: "DEFAULT_VALUE",
+ critical: false,
```

🔴 **핵심**: 이전에도 `content` 는 비어 있지 않았습니다. 달라진 것은
`source`·`critical` 인데 **그 둘은 쿠팡에 나가지 않습니다**(우리 내부 채점용).

| | `content` 값 | 쿠팡에 나가는가 |
|---|---|---|
| 4dbd5eb 이전 | `"전체 상품 상세페이지 참조"` | 🟢 |
| 4dbd5eb 이후 | `"KC마크 없이 구매대행 가능한 품목"` | 🟢 |
| **빈 값** | — | 🔴 **없음. 생성된 적 없음** |

### 🟢 그래서 «이미 돌아간 A/B» 가 하나 있습니다

두 개의 **서로 다른 문장**이 실제로 쿠팡에 나갔고, `registration_attempts` 가
**payload 와 response 를 둘 다** 저장합니다(migration 006 원문: 「그때 뭘 보냈고
쿠팡이 뭐라고 답했는지」). 경계는 2026-08-03 13:56 KST 이고 **양쪽에 시도가 있습니다.**

→ 이것이 **쓰기 0 · 리스크 0** 의 실측입니다. 쿼리는 §6.

---

## 2. 🔴 A/B 의 «전제» 가 아직 미지입니다 — 아동의류 고시 스키마

`DEFAULT_KC_EXEMPTION_TEXT` 는 **조건이 맞아야만** payload 에 들어갑니다.

```ts
// build-payload.ts:1309  MANDATORY 만 채운다
.filter((detail) => detail.required === "MANDATORY")
// :1348  그중 이름에 인증/허가가 있을 때만 KC 분기
if (isComplianceCritical(detail.noticeCategoryDetailName)) { … }
```

그런데 **실제 아동의류 카테고리의 고시 스키마가 이 저장소에 캡처된 적이 없습니다.**
비슷해 보이는 fixture 가 하나 있지만 **실측이 아니라 테스트용 스텁**입니다 —
주석이 직접 그렇게 말합니다(「상품 필드와 매칭되는 규칙이 없는 항목을 고른다」).

```
알고 있는 것   카테고리 70346 = 영유아동 신발/잡화/기타의류(0~17세) — 실패 이력에서
모르는 것     그 카테고리의 noticeCategories 실제 모양 · 인증 칸이 MANDATORY 인지
```

🔴 이것을 모르면 A/B 결과를 **읽을 수 없습니다** —
「문구가 상관없었다」와 「그 칸이 애초에 없었다」가 구별되지 않습니다.

🟢 그리고 이 조회는 **GET(읽기 전용)** 입니다. 상품을 만들지 않습니다.
```
/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{code}
```

### 🔴 부수 확인 — KC 회피는 아동의류에서 작동하지 않습니다

빌더는 KC 필수가 없는 고시 카테고리를 우선하지만(`:852`), **어린이 분기가
그보다 뒤에 와서 이깁니다**(`:865`). 주력 품목에서 회피가 안 됩니다.

---

## 3. 🔴 새로 찾은 것 — 「빈 칸」이 **설정만으로** 나갈 수 있습니다

```ts
// :1351 — truthy 검사다. "   " 는 truthy 라 기본값으로 «떨어지지 않는다»
value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT,
```
그리고 **고시에는 구매옵션에 있는 빈 값 필터가 없습니다** —
```ts
attributes: .filter((r) => r.value.trim().length > 0)   // 🟢 있다
notices   : noticeResults.map(...)                       // 🔴 없다
```

→ 판매자가 Settings 의 KC 문구 칸에 **공백을 넣으면**, 코드를 한 줄도 바꾸지
않고 **내용이 사실상 빈 고시 칸**이 실제 쿠팡으로 나갑니다.

🔴 **버그라고 «단정하지 않았습니다».** 쿠팡이 공백을 거부하는지 받아주는지를
재 본 적이 없고, 판정 없이 고치면 그것도 추측입니다. 다만 이 사실은
**B팔이 «빌더 수정 없이» 도달 가능하다**는 뜻이기도 합니다 — 즉 CPO 금지 항목
(`payload 기본값 변경 ❌`)을 어기지 않고 실험할 경로가 있습니다.

### 테스트로 고정했습니다 (음성 대조 포함)

`packages/listing/src/coupang/__tests__/kc-coupang02-notice-content.test.ts` — 10건 PASS.

| 절 | 무엇을 고정하는가 |
|---|---|
| ① | A팔은 두 경로(코드 기본값 / Settings 덮어쓰기)로 만들어진다 |
| ② | 설정이 없거나 빈 문자열이어도 `content` 는 **비지 않는다** |
| ③ | 🔴 **공백은 그대로 실린다** — 고시엔 빈 값 필터가 없다 |
| ④ | 두 팔의 차이는 `content` **한 칸뿐**이고 `attributes` 는 동일하다 |
| ⑤ | KC 칸이 없는 카테고리면 실험 자체가 성립하지 않는다 |

**음성 대조**: `|| ` 를 `.trim() ||` 로 바꿔 구멍을 막자 **정확히 2건이 FAIL**
(③·④). 되돌린 뒤 10/10 PASS. 🔴 빌더는 최종적으로 **한 글자도 바뀌지 않았습니다**
(`git diff` 비어 있음).

### 🔴 ④가 중요한 이유

COUPANG-REAL-OPTION-01 에서 **구매옵션이 함께 흔들려 고시를 범인으로 오진한**
전례가 있습니다(3차 실측이 뒤집음). 두 팔이 한 칸만 달라야 결과를 읽을 수 있습니다.

---

## 4. 🟢 리스크 재평가 — 실등록은 «소비자 노출» 이 아닙니다

```ts
// build-payload.ts:1729 (주석 원문 포함)
requested: false,
// 「true면 등록과 동시에 쿠팡 승인을 자동 요청한다. CartPilot은 항상 false로
//  보낸다 — "실제 상품 1개만, 사람이 Wing에서 최종 확인 후 승인 요청"」
```
공식 문서: 「임시저장 상태의 상품은 승인요청→승인완료 단계를 거처 상품 페이지에
노출됩니다」 · 「`requested` 파라메터를 `true` 로 입력할 경우 자동으로 판매
승인요청이 진행됩니다」.

→ 🟢 **우리 등록은 임시저장으로 들어가고, 사람이 Wing 에서 승인하기 전까지
소비자에게 노출되지 않습니다.** A/B 의 리스크는 제가 처음 가정한 것보다 낮습니다.

🔴 다만 **부작용 없는 검증(dry-run) 엔드포인트는 공식 문서에 없습니다** —
찾아봤고, 없습니다. 실측하려면 실제 POST 를 해야 합니다.

---

## 5. 🔴 그래서 지금 실측을 못 한 이유 (두 개, 서로 다름)

### ① 자격증명 — 저는 가질 수 없고, 가져서도 안 됩니다

```
$ npx vercel env ls production      ← «이름만» 조회
COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY / COUPANG_VENDOR_ID   Encrypted
SUPABASE_SERVICE_ROLE_KEY                                      Encrypted
DEBUG_COUPANG_PROBE_TOKEN                                      Encrypted
$ (로컬) .env.local — 쿠팡·Supabase 키 «없음»
```
→ 쿠팡 API 도, `registration_attempts` DB 도 **제가 직접 부를 수 없습니다.**

🟢 통로 자체는 있습니다 — `/api/debug` 는 proxy matcher 에서 **제외**돼 있고
(`proxy.ts:153`), `coupang-product-get-raw` 는 **GET 전용 · fail-closed** 입니다.
그러나 **카테고리 메타용 프로브는 없고**, 토큰 값도 제게 없습니다.

### ② B팔은 «판단» 이 필요합니다

| 경로 | 금지 항목 저촉 | 비고 |
|---|---|---|
| 빌더에서 KC 분기 제거 | 🔴 **`payload 기본값 변경 ❌`** | 불가 |
| Settings 에 공백 저장(§3) | 🟢 저촉 없음 | **실제 등록 1건 발생** |
| 직접 POST 스크립트 | 🟡 빌더 우회 | 실제 등록 1건 발생 |

→ 어느 쪽이든 **CEO 계정에 실제 등록(임시저장)이 남습니다.** 그리고 §2 를 모른 채
돌리면 결과를 읽을 수 없습니다. 그래서 **여기서 STOP** 합니다.

---

## 6. 🟢 쓰기 0 으로 지금 답할 수 있는 것 — 읽기 전용 SQL

`registration_attempts.payload` 는 **전체 `CoupangPayload`** 입니다
(`register/route.ts:75` — `payload: payload ?? null`, 타입 `CoupangPayload`).
구조를 추측하지 않고 실제 삽입부를 확인한 뒤 썼습니다.

### Q-1. KC 고시 칸이 «실제로» 나간 적이 있는가 · 무슨 문장이었나 · 쿠팡은 뭐라 했나

```sql
select
  (ra.created_at at time zone 'Asia/Seoul')       as kst,
  ra.status,
  ra.error_code,
  ra.payload ->> 'displayCategoryCode'            as category_code,
  n ->> 'noticeCategoryName'                      as notice_category,
  n ->> 'noticeCategoryDetailName'                as notice_field,
  n ->> 'content'                                 as notice_content,
  ra.response ->> 'message'                       as coupang_message
from registration_attempts ra
cross join lateral jsonb_array_elements(ra.payload -> 'items') as it
cross join lateral jsonb_array_elements(it -> 'notices')       as n
where ra.platform = 'coupang'
  and (n ->> 'noticeCategoryDetailName') ~ '인증|허가'
order by ra.created_at;
```
**읽는 법**
- 행이 **0건** → 🔴 우리 카테고리엔 KC 고시 칸이 아예 안 나갔다. A/B 는 **null 실험**이고, 그 순간 「기본 문구가 필요한가」의 답은 **「지금까지는 쓰인 적조차 없다」** 가 된다.
- `notice_content` 가 2026-08-03 13:56 전후로 **두 값**으로 갈리고 양쪽 다 `SUBMITTED` → 🟢 **문장은 상관없다. 칸만 채우면 된다.**
- 한쪽만 `FAILED` 이고 `coupang_message` 가 고시를 언급 → 🔴 문장이 영향을 준다.

### Q-2. 고시 칸이 «빈 값/공백» 으로 나간 적이 있는가 (§3 경로가 실제로 밟혔는지)

```sql
select
  (ra.created_at at time zone 'Asia/Seoul') as kst, ra.status, ra.error_code,
  n ->> 'noticeCategoryDetailName' as notice_field,
  ra.response ->> 'message'        as coupang_message
from registration_attempts ra
cross join lateral jsonb_array_elements(ra.payload -> 'items') as it
cross join lateral jsonb_array_elements(it -> 'notices')       as n
where ra.platform = 'coupang'
  and coalesce(btrim(n ->> 'content'), '') = ''
order by ra.created_at;
```

### Q-3. 고시/인증을 언급한 실패가 있었는가 (Q4 의 직접 증거)

```sql
select (ra.created_at at time zone 'Asia/Seoul') as kst,
       ra.error_code, ra.response ->> 'message' as coupang_message,
       ra.payload ->> 'displayCategoryCode'     as category_code
from registration_attempts ra
where ra.platform = 'coupang' and ra.status = 'FAILED'
  and (ra.response ->> 'message') ~ '고시|인증|허가'
order by ra.created_at;
```

### Q-4. `certifications` 를 보낸 적이 있는가 (KC-COUPANG-01 결론의 DB 확인)

```sql
select count(*) as attempts_with_certifications
from registration_attempts ra
cross join lateral jsonb_array_elements(ra.payload -> 'items') as it
where ra.platform = 'coupang' and it ? 'certifications';
```
→ 소스 참조는 0건이었습니다. **0 이 나와야 정상**이고, 0 이 아니면 제 §Q1 결론이 틀린 것입니다.

---

## 7. 지시 범위 대비 — 어디까지 왔는가

| CPO 조사 범위 | 상태 | 근거 |
|---|---|---|
| 기본 문구가 등록 성공에 필요한가 | 🟡 **부분** — 「고시 칸」은 필수(실측), 「그 문장」은 미측정 | §1 · KC-COUPANG-01 §Q3 |
| 문구 있음 / 빈 값 API 결과 차이 | 🔴 **미측정** — 빈 값은 생성된 적 없음. 단 §3 경로로 도달 «가능» | §1 · §3 |
| 아동의류 카테고리 `required` 관계 | 🔴 **미측정** — 스키마가 캡처된 적 없음. 🟢 **GET 하나면 답남** | §2 |
| `certifications` 가 요구되는가 | 🟢 **소스 0건 확정**, DB 확인은 Q-4 | §6 Q-4 |
| `AGENT_BUY`+`pccNeeded` 독립성 | 🟢 **재확인** — 배송/통관 축, 고시와 별개 | KC-COUPANG-01 §Q2 |
| 동일 상품 1건 A/B | 🔴 **STOP** — 설계는 §3 ④로 고정, 실행은 판단 필요 | §5 |

---

## 8. 🔴 CPO 결정이 필요한 지점 (여기서 STOP)

| # | 결정 | 내용 | 대가 |
|---|---|---|---|
| **①** | **읽기 전용 SQL 실행** | §6 네 쿼리. 제가 DB 에 닿지 못함 | 🟢 **쓰기 0 · 리스크 0. 가장 먼저 권함** |
| **②** | **카테고리 메타 프로브 라우트** | 아동의류 고시 스키마 GET 1회. `coupang-product-get-raw` 와 같은 패턴(GET 전용·토큰·fail-closed) | 🟡 조사용 라우트 신설 — 이전 지시의 「영구 API 로 남기지 않는다」 조건 필요 |
| ③ | **실등록 A/B 1쌍** | §3 경로로 B팔 생성. `requested: false` 라 미노출 | 🔴 CEO 계정에 임시저장 2건. **①②가 끝난 뒤에만 의미 있음** |

🔴 **권고 순서는 ① → ② → (필요하면) ③** 입니다.
①이 「KC 칸이 나간 적 없음」을 보이면 ②③은 **불필요해집니다.**
①이 「두 문장 모두 성공」을 보이면 ③도 **불필요합니다** — 이미 답이 나온 것입니다.

### 🔴 그리고 ③을 하더라도 답하지 «못하는» 것

「쿠팡이 받아줬다」는 **「법적으로 적법하다」가 아닙니다.** 공백 고시를 쿠팡이
통과시켜도 그것은 전자상거래법 판단이 아니고, 저는 그 판단을 하지 않습니다.
KC-01 이후 유지해 온 경계 그대로입니다.

---

## 9. 이번에 «하지 않은» 것

빌더 수정 **0**(`git diff` 비어 있음 — 음성 대조 주입 후 복원 확인).
Common Confirmation 연결 ❌ · migration ❌ · payload 기본값 변경 ❌ · KC UI ❌ ·
`certifications` 구현 ❌ · KC 요구도 임의 판정 ❌ · 실제 쿠팡 API 호출 ❌ ·
자격증명 값 조회 ❌(이름만) · 공백 구멍 «수정» ❌(판정 없이 고치지 않음).
