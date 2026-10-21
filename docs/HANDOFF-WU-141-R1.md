# 🟡 WU-141-R1 — **Market Decision Center 통합** (STEP 4 완료 · 1/2/3/5 설계 대기)

> 🟢 **STEP 4(후보 검토 저장 실패) 종료 · 배포** — 원인을 운영 DB 에서 실측해 고쳤다.
> 🟡 **STEP 1 · 2 조사는 끝났다**(아래 ①②). 🔴 다음 세션은 **설계부터** 들어간다.
> 🔴 **STEP 3 · 5 는 구현 0** 이다. CPO 지시 전문은 그 메시지(STEP 1~8).

---

## ⓞ 🟢🟢 STEP 4 **완료** — 「저장 실패」의 원인은 `ON CONFLICT` 였다

🔴🔴 **운영 DB 실측** (`packages/database/scripts/wu-141-review-save-probe.mjs` · **영구 쓰기 0**):
```
079 의 유니크는 **부분(partial) 인덱스 둘** 이다
   candidate_reviews_snapshot_url_key  (snapshot_id, candidate_url) WHERE snapshot_id is not null
   candidate_reviews_origin_url_key    (origin_code, candidate_url) WHERE snapshot_id is null …
그런데 코드가 `.upsert(…, { onConflict: "snapshot_id,candidate_url" })` 를 썼다.
PostgREST → `ON CONFLICT (snapshot_id, candidate_url) DO UPDATE`
🔴 Postgres 는 **부분 인덱스를 술어 없이 추론하지 못한다**:
   ⒜ 앱과 같은 문장                        → **42P10** (실측)
   ⒝ `… WHERE snapshot_id is not null` 추가 → 🟢 성공
   ⒞ 수정 후(조회 → insert / update)        → 🟢 성공 · 재삽입 **23505 로 계속 막힘**
```
🔴🔴 **쓰기 경로가 WU-131 이후 한 번도 성공하지 못했다** — 네 판단 전부 실패(CEO 가 본 것),
그리고 **`recordSeenCandidates` 도 같은 upsert** 라 📚 이력이 **조용히** 비어 있었다
(그 함수는 throw 하지 않는다 ⟹ 화면이 아무 말도 안 했다). 🟢 **둘 다 고쳤다.**

🟢 **schema 를 바꾸지 않았다** — 부분 유니크 둘은 WU-131 이 계약으로 잠근 설계다.
문장 모양만 바꿨고(`조회 → update(id) / insert` + `23505` 폴백) **무결성 방어는 유지**.
🔴 그리고 실패 사유를 **더 이상 삼키지 않는다**(warn 에 오류 **코드**).

🟡 **남은 확인 하나** — 실제 화면에서 네 버튼이 저장되는지는 **CEO 가 눌러야** 확정된다
(CTO 는 로그인 뒤 화면을 볼 수 없고, 로컬에는 service-role 키가 없다). 🟢 DB 축·문장 축·
계약 축은 전부 닫혔다(계약 15 · 음성대조 M11 2F · M12 2F · **M13 9F**).

---

## ① 🟢 STEP 1 **완료** — 데이터 소유권 (CTO 가 직접 확인한 좌표)

| 데이터 | Source of Truth | 코드 위치 |
|---|---|---|
| 후보 목록(위) | `/check` 응답의 네 transient 배열 | 패널 → `onMarketComparisonChange` → `marketComparison` state |
| 후보 목록(아래) | 🔴 **두 패널의 «자기» 검색** | `DomesticShopSearch.tsx:188` → `/api/domestic-price-sources/search` · `ComparisonShopSearch.tsx:224` → `/api/comparison/search` |
| MI SAME/DIFFERENT | `matchTruth` → `transientDisplayTier` | `mi-same-candidates.ts:48` |
| 판매중 여부 | `soldOut` → `saleState` 3상태 | `mi-same-candidates.ts:463` |
| 가격 | `priceStatus === VERIFIED_CURRENT` | `mi-same-candidates.ts:99` |
| 시장 기준가 | `buildPriceGuide` | `mi-same-candidates.ts:259` |
| Human review | `candidate_reviews` | `candidate-review.ts`(STEP 4 에서 고침) |
| 최종 셀러 판단 | **📊 시장 판매 판단** | `MarketPriceComparison.tsx` |

🔴 **정정** — 조사 보조에게 받은 답 중 해외 패널 endpoint 가 `/api/overseas-comparison-shops/search`
로 적혀 있었다. **틀렸다.** 실제는 **`/api/comparison/search`**(`ComparisonShopSearch.tsx:224`).
그대로 넘기면 다음 세션이 없는 경로를 grep 한다.

---

## ② 🟢🟢 STEP 2 **완료** — 위/아래가 다른 이유는 **게이트가 다르기 때문** 이다

아래 영역 제목: `"📊 시장 가격 비교"` — **`StageBody.tsx:242`**(접힘 제목 · 그 안에
`PRICE_COMPARISON_ANCHOR_ID` div → 두 패널).

```
아래 게이트  mayShowCandidate(match-display.ts:248)
  ① crossSellerVerdict === "CONFLICT" → 제외
  ② tier 가 DEFAULT_VISIBLE_TIERS 아니면 제외
  ③ tier SAME | SAME_MODEL_OPTION_DIFF → **점수 무시하고 통과**
  ④ crossSellerVerdict SAME | PRESUMED_SAME → **점수 무시하고 통과**
  ⑤ 그 밖에는 confidence >= 0.2
  🔴 품절 여부 **안 본다** · 가격 검증 **안 본다**

위 게이트  transientDisplayTier(row) === "SAME"  **그리고**
           isNotSoldOut(row)  **그리고**  isPriceConfirmed(row)
```

🔴 **그래서 아래에만 서는 후보가 구조적으로 존재한다** — 전부 코드 근거가 있다:
```
⒜ PRESUMED_SAME · SIMILAR · SAME_MODEL_OPTION_DIFF  → 아래 O / 위 X
⒝ 품절(soldOut === true)                            → 아래 O / 위 X
⒞ priceStatus !== VERIFIED_CURRENT                   → 아래 O / 위 X
⒟ 🔴🔴 **후보 집합 자체가 다르다** — 아래는 **자기 검색**(위 두 endpoint)이고
   위는 `/check` 의 MI 산출이다 ⟹ 같은 판매처가 한쪽에만 있을 수 있다
   (그것이 WU-132 가 찾은 그 구멍이고 **아직 남아 있다**)
⒠ 중복 URL — 위는 접는다(`seen` set) · 아래는 샵 단위로 나눠 그린다
```
🟢 **아래 패널은 금액을 자체 계산하지 않는다**(서버 응답의 `price` 를 그린다) ⟹
「계산이 둘」은 아니다. 🔴 **「집합과 게이트가 둘」** 이다 — 그것이 CEO 가 본 불일치다.

---

## ③ 🔴 STEP 3 — 아직 **구현 0**. 설계할 때 알아야 할 것

CPO 지시: 「**삭제가 아니라 최종 판단 영역의 데이터 소스로 승격**」.
🟡 그래서 열어야 하는 질문은 **「아래 패널의 남은 가치가 무엇인가」** 다. ②가 그 답을 준다 —
아래에만 서는 것은 **⒜⒝⒞**, 즉 **「판정이 보류·유사이거나, 품절이거나, 가격 미확인인 후보」** 다.
🔴 그건 **가격 비교 재료가 아니라 «사람이 검토할 재료»** 다 ⟹ **STEP 5 와 같은 묶음** 이다.

🔴 **제거를 막을 계약들(미리 읽어라 · 지우지 말고 갱신·강화)**:
```
wu-132 (영역은 하나 · 앵커/순서)   wu-130 F-3 (제목이 하나뿐)
mi-ux-final · price-display-layout · product-tab-mounted   ← 「📊 시장 가격 비교」 문자열을 본다
mi-010-candidate-display-provenance · wu-091-candidate-visibility
default-visible-tier · domestic-shop-search-tier           ← 두 패널의 표시 게이트를 본다
```
🔴 `PRICE_COMPARISON_ANCHOR_ID` 와 `scrollIntoView` 소비자(`CommerceWorkspace:837`)는 **살아 있다** —
접힘을 없애면 그 앵커의 주인이 사라진다. **같이 설계해야 한다.**

---

## ④ 🔴 STEP 5 — 후보 과다. **구현 0** · 분류 축은 이미 있다

🟢 분류에 필요한 값이 **전부 행에 있다**(새 판정 0): `transientDisplayTier` ·
`saleState` · `isPriceConfirmed` · `crossSellerBlockers` · `source` · `market` ·
그리고 이제 **`candidate_reviews` 의 `human_verdict`**(STEP 4 가 되살렸다).

🔴 **금지(CPO §6)** — threshold 완화 ❌ · SAME 판정 완화 ❌ · DIFFERENT 제거 ❌ ·
무조건 상위 N 자르기 ❌ · 가격 있으면 SAME 취급 ❌.
🟢 **접는 것은 UI 이고 판정이 아니다** — 그 둘을 섞지 않는다.

🟡 **설계 입력 하나(측정됨)** — 사람이 이미 판단한 후보는 이제 다시 꺼내 올 수 있다
(`listCandidateReviews`). 🔴 그래서 「이미 DIFFERENT 로 확정된 후보 접기」는 **새 판정이
아니라 저장된 사람 판단을 읽는 것** 으로 구현할 수 있다. 🔴 단 **MI verdict 를 덮지 않는다**.

---

## ⑤ 🔴 다음 세션 순서 (CPO 완료 기준 §7)

```
① STEP 3+5 를 **한 묶음** 으로 설계(②④ 가 근거다 — 재조사 금지)
② 구현 → 계약 갱신·강화 → 음성대조 → 회귀 → typecheck → build → 배포
③ 그 **뒤에** CEO 1회: 「믿을 영역이 하나인가 · 네 판단이 저장되는가 · 후보가 줄었는가」
🔴 그 전에 WU-142(국내 SAME)로 넘어가지 않는다 — CPO 가 순서를 고정했다.
```

🟡 **WU-142 는 그대로 대기** — `docs/HANDOFF-WU-141.md` 에 출발 표와 금지 레버가 있다
(그 문서의 내용은 **유효** 하고, 이름만 WU-142 로 읽으면 된다).
