# COMMERCE-COMMON-KC-03 — 「확인 행위」의 공통 계약이 성립하는가

> CPO 작업지시(2026-09-28). **구현하지 않는다. 코드 변경 0.**
> KC UI ❌ · payload ❌ · `certifications` 연결 ❌ · 기본 문구 변경 ❌ ·
> `OVERSEAS` 차단 ❌ · migration ❌ · 롯데ON 고시 변경 ❌ · 인증번호 생성 ❌.

---

## 0. 결론

```
🟢 계약은 성립한다     {confirmed · policyVersion · categoryCode} 는 «게이트» 가 실제로 쓰는 것이고
                       모양이 채널 중립이다

🔴 그런데 «범위» 를 함께 들고 다녀야 한다   categoryCode 는 채널 카테고리 번호라
                                            platform 없이는 뜻이 없다

🔴 그리고 기존 «테이블» 을 그대로 쓸 수 없다  kc_status 가 NOT NULL + CHECK 로
                                              네이버 어휘에 묶여 있다

🟢 그래서 저장소를 새로 만들지 않는다 — «읽기 어댑터» 로 푼다 (migration 0)
```

---

## 1. `seller_compliance_confirmations` — 필드별 판정

```sql
-- migration 024
snapshot_id · platform · category_code · kc_status · confirmed · policy_version · confirmed_at
```

| 컬럼 | 판정 | 근거 |
|---|---|---|
| `confirmed` | 🟢 **승격 가능** | 게이트가 실제로 읽는다 |
| `policy_version` | 🟢 **승격 가능**(단 §3) | 게이트가 실제로 읽는다 |
| `category_code` | 🟡 **범위와 함께만** | 게이트가 읽지만 «채널 카테고리 번호» 다 |
| `confirmed_at` | 🟢 승격 가능 | 감사 기록 |
| `platform` | 🔴 **반드시 남는다** — §2 | |
| `kc_status` | 🔴 **스마트스토어 전용** | CHECK 제약이 네이버 어휘다 |
| `snapshot_id` | 🟢 승격 가능 | 상품 식별 |

### 🔴 `kc_status` 가 승격을 막습니다

```sql
kc_status text not null
  check (kc_status in ('NOT_APPLICABLE','CERTIFIED_REFERENCE','SELLER_REVIEW_REQUIRED','BLOCKED'))
```

네 값은 `naver/compliance.ts:32` 의 `KcStatus` **그대로**입니다.
`NOT NULL` 이므로 **롯데ON 확인 기록을 쓰려면 네이버 상태값을 «지어내야»** 합니다.
CHECK 를 넓히는 것은 **migration** 이고 이번에 금지된 작업입니다.

### 🟢 다행히 — 게이트는 `kc_status` 를 쓰지 않습니다

```ts
// register/route.ts:421
const sellerConfirmationValid =
  row?.confirmed === true && row.policyVersion === … && row.categoryCode === leafCategoryId;
```

`kcStatus` 가 나오는 곳은 **로그 문장**(`:430`)과 **결과 메타**(`:580`) 뿐입니다.
→ **감사용 payload 이지 판정 입력이 아닙니다.**

---

## 2. 🔴 `platform` 을 남겨야 하는 이유 — `categoryCode` 때문입니다

`categoryCode` 에 들어가는 값은 **그 채널의 카테고리 번호**입니다.

```
스마트스토어   leafCategoryId       (네이버 카테고리)
롯데ON         표준카테고리번호      (scatNo)
쿠팡           displayCategoryCode
```

세 체계는 **서로 비교할 수 없습니다.** 같은 숫자가 다른 채널에서 다른 상품군을
뜻할 수 있습니다.

🔴 즉 의미를 갖는 것은 `categoryCode` 하나가 아니라 **`(platform, categoryCode)` 쌍**
입니다. `platform` 을 빼면 「어느 카테고리에 대한 확인인가」가 사라집니다.

→ **`platform` 은 승격 대상이 아니라 «범위(scope)» 입니다.**

---

## 3. 🔴 `policyVersion` 은 «채널별» 이어야 합니다

```ts
// packages/listing/src/naver/compliance.ts:37   ← 네이버 폴더 안에 있다
export const COMPLIANCE_POLICY_VERSION = "2026-08-19";
```

쓰는 곳도 `naver/validate-payload.ts` 하나입니다. **채널 스코프 상수**입니다.

🔴 이것을 «전역 하나» 로 만들면 — **네이버 정책이 바뀔 때 쿠팡·롯데ON 의
확인까지 전부 무효**가 됩니다. 아무 관계도 없는데 셀러가 다시 확인해야 합니다.

→ 계약은 `policyVersion: string` 으로 두되, **값의 주인은 채널**입니다.
`(platform, policyVersion)` 로 읽어야 합니다.

---

## 4. `smartStoreKcDeclaration` 과 confirmation 의 관계

```
smartStoreKcDeclaration          판매자가 «고른 값»   (대상/비대상/면제 + 사유)
seller_compliance_confirmations  판매자가 «확인한 행위» (언제 · 어떤 정책 · 어떤 카테고리)
```

**둘은 함께 있어야 합니다.** 확인만 있고 선언이 없으면 「무엇을 확인했는가」가
없고, 선언만 있고 확인이 없으면 「책임을 졌는가」가 없습니다.

실제로 그 상태가 등록을 막습니다 — **선언은 했는데 확인은 안 함** →
`sellerConfirmationValid = false` → FAILED.

### 읽기 호환

`smartStoreKcDeclaration` 은 `CanonicalProduct` 의 **선택 키**이고
`backfillCanonicalProduct` 가 **건드리지 않습니다**(부재가 의미를 가지므로).
→ 🟢 **이름을 바꾸지 않는 한 호환은 저절로 유지됩니다.** 이번에 바꾸지 않았습니다.

---

## 5. 세 채널에서 「판매자가 확인했다」만 공통화되는가 — 🟢 검증

| 채널 | 「확인했다」에 해당하는 것 | 게이트 |
|---|---|---|
| 스마트스토어 | `seller_compliance_confirmations` 행 | 🟢 **있다**(등록을 막는다) |
| 쿠팡 | P0-KC-03 모달 — 「지금 등록될 문구가 무엇인지 확인했다」 | 🟡 화면 게이트만, 서버 재검증 없음 |
| 롯데ON | **없다** | 🔴 없다 |

🔴 **세 채널에 「확인 행위」가 «이미 있는» 것이 아닙니다.** 스마트스토어에만
서버 게이트가 있고, 쿠팡은 화면에만, 롯데ON 은 아예 없습니다.

→ 공통화의 뜻은 **「세 개를 합친다」가 아니라 「하나를 다른 둘이 쓸 수 있는
모양으로 둔다」** 입니다. 쿠팡·롯데ON 에 확인을 «도입할지» 는 별개 결정입니다.

---

## 6. 🟢 그래서 구현 형태 — **새 저장소가 아니라 «읽기 어댑터»**

`migration 0` 제약 안에서 성립하는 유일한 형태입니다. 그리고 그 어댑터는
**이미 있습니다**(`COMMON-IMPLEMENT-01` 에서 만든 것).

```ts
// packages/shared/src/common-confirmation.ts
toCommonConfirmation(stored, currentPolicyVersion) → CommonConfirmation | null
// confirmed=false 는 확인이 아니다 · 정책 버전이 다르면 과거 확인을 신뢰하지 않는다
```

- 저장은 **채널이 계속 자기 방식으로** 합니다(스마트스토어는 지금 테이블 그대로).
- Common 은 **읽을 때만** 한 모양으로 봅니다.
- 🔴 `CommonConfirmation` 은 지금 `{confirmedAt, policyVersion}` 뿐입니다.
  §2·§3 에 따르면 **`platform` 과 `categoryCode` 를 «범위» 로 함께 들고 다녀야**
  합니다 — 값이 아니라 «어느 것에 대한 확인인가» 이기 때문입니다.
  **이번에 바꾸지 않았습니다**(구현 금지). CPO 결정 사항으로 올립니다.

---

## 7. STEP 5 — `KIDS + OVERSEAS` : 증거만 추가

🔴 **차단 구현하지 않았습니다.** 증거를 한자리에 모읍니다.

| 출처 | 내용 | 성격 |
|---|---|---|
| 스마트스토어 실측 | 어린이제품 인증 3종(1040/1041/1042)의 `kindTypes` 가 `[ETC, CHILD_CERTIFICATION, KC_CERTIFICATION]` 뿐 — `OVERSEAS` 는 생활용품/전기용품류에만 | 🟢 구조적 사실(N-3.66, CEO 승인) |
| 롯데ON 공식 | 품목 `23 0200`: 「구매대행/병행수입을 선택할 수 없습니다」 | 🟢 작성 가이드라인 |
| 우리 검증기 | `validateKcDeclaration` 은 **조합 완결성만** 본다 — 이 조합을 막지 않는다 | 🔴 빈틈 |
| 우리 화면 | 어린이제품이어도 「구매대행」 라디오를 고를 수 있다 | 🔴 경로가 열려 있다 |

**법적 판단은 하지 않았습니다.** 두 채널의 근거는 「그 API 가 선택지를 주지
않는다」와 「가이드라인 문장」이지, 「법적으로 불가」와 같은 문장이 아닙니다.

---

## 8. STEP 6 — 롯데ON 1:1 문의 추가분 (발송하지 않음)

기존 문의문(`PD-ARTL-02.md` §4 · `PD-ARTL-05.md` §4)에 **이어서** 붙입니다.

> **[추가] 고시 `0200` 과 `sftyAthnLst` 의 관계**
>
> 15. 상품정보제공고시 항목 `0200`(KC 인증정보)와 상품등록 API 의
>     `sftyAthnLst`(안전인증목록)는 **어떤 관계입니까?**
> 16. 품목코드 `23`(어린이제품)에서 **둘 다 필요합니까?**
> 17. 한쪽이 다른 한쪽을 **대체할 수 있습니까?**
>     (예: `sftyAthnLst` 를 보내면 `0200` 을 생략할 수 있는지)
>
> 문서에는 두 필드가 독립적으로 정의돼 있고, 동일 정보를 양쪽에 입력해야
> 한다는 안내를 찾지 못해 문의드립니다.

---

## 9. CPO 결정 요청

1. **`CommonConfirmation` 에 범위를 추가할지** — 지금은 `{confirmedAt, policyVersion}`
   뿐이라 「어느 채널·어느 카테고리에 대한 확인인가」를 표현하지 못합니다.
   §2·§3 근거로 **`platform`·`categoryCode` 를 범위로 추가**하는 것을 권고합니다.
   (구현 금지라 바꾸지 않았습니다.)
2. **`policyVersion` 을 채널별로 둘지** — §3 대로 전역 하나로 두면 네이버 정책
   변경이 다른 채널의 확인을 무효화합니다. **채널별 권고.**
3. **쿠팡·롯데ON 에 확인 행위를 «도입할지»** — §5 대로 지금은 없습니다.
   Common 계약을 만든다고 저절로 생기지 않습니다. 별도 결정이 필요합니다.
4. **§8 문의 추가** 승인 — 문안은 준비돼 있습니다(발송은 CTO 가 하지 않습니다).

---

## 10. 이번에 «하지 않은» 것

코드 변경 **0**. KC UI ❌ · payload ❌ · `certifications` ❌ ·
`DEFAULT_KC_EXEMPTION_TEXT` ❌ · `OVERSEAS` 차단 ❌ · migration ❌ ·
롯데ON 고시 ❌ · 인증번호 생성/추정 ❌ · `CommonConfirmation` 변경 ❌.
