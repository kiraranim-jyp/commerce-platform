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
🔴🔴🔴 **정정 — 「금액 계산은 하나다」는 틀렸다. 집계 owner 가 «셋» 이다.**
처음 보고에서 「아래 패널은 서버 `price` 를 그릴 뿐」이라고 적었는데, **직접 읽어 보니
아래 경로가 금액을 «계산» 한다.** 그 계산이 **MI 패널 요약으로 들어간다**:

| # | 집계 owner | 입력 | 화면 | 게이트 |
|---|---|---|---|---|
| ① | `buildMarketJudgement` · `buildPriceGuide`<br/>`mi-same-candidates.ts:259·528` | `/check` MI | **📊 시장 판매 판단** | tier **SAME** + 품절 아님 + **VERIFIED_CURRENT** |
| ② | 서버 참고가격(`summarizeCandidateOverseasPrices` 등) | `/check` | 상세 근거의 🇰🇷/🧾 참고가격 | tier `EXACT\|COMPARISON`(**유사 포함**) |
| ③ | 🔴 `buildOverseasMarketEvidence`<br/>`market-evidence.ts:243` | 🔴 **아래 패널의 «자기» 검색**<br/>(`ComparisonShopSearch.tsx:405`) | 🔴 **MI 패널의 🌎 해외 시장 요약**<br/>(`…Panel.tsx:3240`) | `tier === "SAME" && price != null`<br/>🔴 **품절 안 봄 · priceStatus 안 봄** |

```
🔴🔴 ③ 이 «세 번째 답» 이다 — min~max 가격대 · 판매처 수 · 국가 수를 **직접 만들고**,
   다중통화면 집계를 거부하는 **자기 규칙** 까지 있다. 그리고 그 산출이
   `onEvidenceChange` → `overseasMarketEvidence` 로 **MI 패널에 들어간다**.
🔴 비대칭도 여기서 나온다 — 🇰🇷 요약(`buildDomesticMarketEvidence`:181)은
   **`/check` 의 seller count** 로 만들고, 🌎 요약은 **아래 패널 검색** 으로 만든다.
🔴 그리고 ③ 의 입력은 `mi-verdict-copy.ts:58` 을 통해 **MI 판정 문구** 에도 닿는다
   ⟹ 그냥 끊으면 **판정 문구가 바뀐다**(정책 영역 · 그래서 설계에 넣었다).
```

🟢 그래서 CEO 가 본 불일치의 정체는 **「집합 둘 + 게이트 셋 + 집계 셋」** 이다.

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

## ④-B 🟢🟢 **설계 산출물** (CPO §7 ①~⑥ · 구현 전 필수) — 2026-10-21

### ⑤ 중복되는 계산 — **세 벌이고, 둘은 없앨 수 있다**
```
① /check MI 집계            🟢 **남긴다** — 최종 결론의 유일한 owner
② 서버 참고가격(유사 포함)    🟡 **상세 근거에 남긴다** — 분모가 다르다는 것을 화면이 이미 말한다
                              (`MI_SAME_AREA_SCOPE` 마지막 문장 · WU-132)
③ buildOverseasMarketEvidence 🔴 **제거 대상** — 아래 패널의 자기 검색으로 만든 «세 번째 답»
```
🔴🔴 **그리고 ③ 의 입력 자체가 중복이다** — `/check` 는 **이미** 같은 해외 검색을 돈다
(WU-130 의 `__overseas_auto__` 가 `searchComparisonShops` 를 부른다). 헌장이 그 대가를
적어 뒀다: 「지금 해외 검색이 **두 번** 돈다 … 한쪽 제거는 **owner 를 하나로 만들 때** 의 일이다」.
🟢 **이번 WU 가 그 «때» 다.**

### ⑥ 최종적으로 남길 source — **하나의 데이터 흐름**
```
원상품 → POST /check
          ├─ 국내 등록부 검색 + 해외 자동 풀 + AI URL 풀 + 재투입   (후보 생산자 넷)
          ├─ MI 판정(tier · 판매상태 · 가격검증)
          └─ 응답: rows[] + 참고가격 집계 + seller counts
                      │
      ┌───────────────┴───────────────────────────────┐
      ▼                                               ▼
📊 시장 판매 판단 (유일한 결론)                  ▸ 상세 근거 (검토 재료)
  🇰🇷 국내 / 🌎 해외                               ├─ MI 상세 · 참고가격(②)
  SAME + 판매상태 + 확인가격 + 🔗                   ├─ 후보 목록 ← **같은 rows[]**
  ← 집계 ①                                          ├─ 이미지
                                                     └─ Human review / 이력 (candidate_reviews)
🔴 아래 두 패널은 **자기 검색을 돌리지 않는다** — 같은 `rows[]` 를 받아 «검토 재료» 로만 그린다
🔴 집계 ③ 은 사라진다 ⟹ 🌎 요약도 ①/② 에서 나온다(🇰🇷 와 **같은 축** 이 된다)
```

### 🟢🟢 정책 결정 **접수 완료** (CPO 2026-10-21) — 다시 묻지 않는다
```
① = **결론의 source of truth**      ② = **상세 근거**      ③ = **제거**
⒜ `mi-verdict-copy` 를 ① **strict** 기준으로 전환한다(CPO 확정).
⒝ `PRICE_COMPARISON_ANCHOR_ID` 의 주인은 **📊 시장 판매 판단** · `scrollIntoView` 유지.
🔴 참고 데이터가 **최종 시장 판단을 승격시키지 않는다**(CPO 문장).
```

🔴 **문구 축 — CPO 표 그대로.** 「없다」와 「우리 기준에서 쓸 수 없다」를 섞지 않는다:
```
SAME + VERIFIED_CURRENT     → 가격 확인
SAME 인데 가격 없음          → **가격 확인 필요**        ← 🔴 「없다」로 적지 않는다
SAME 아님 + 참고가격 존재     → 최종 가격판단에 **미포함**(상세 근거에는 남는다)
후보만 존재                  → 후보 상세에서 확인
```

### 🔴 바꿀 문자열 — **코드 좌표를 미리 특정했다**(다음 세션이 찾지 않게)
```
mi-verdict-copy.ts:104-106   hasOverseasRange
   현재  O → 「🌎 해외에서도 유사한 가격대가 확인됩니다.」
         X → 「🌎 해외 판매처 가격대는 확인되지 않았습니다.」
   🟡 「확인되지 않았습니다」는 이미 «미발견» 어휘라 거짓은 아니다. 🔴 그러나 CPO 표의
      **「가격 확인 필요」** 축으로 바꿔야 셀러가 할 **행동** 이 보인다.
mi-verdict-copy.ts:91        hasComparable
   현재  X → 「🇰🇷 국내 동일상품 가격을 확인하지 못했습니다.」
   🟢 어휘는 이미 올바르다(부재 단정 아님).
mi-verdict-copy.ts:53·62     두 입력의 **주석이 ②③ 를 지명** 한다 ⟹ 같이 갱신(안 하면 거짓말)
```

### 🔴🔴 **예상되는 «눈에 보이는» 결과 하나 — 배포 전에 알고 있어야 한다**
```
`hasComparable` 의 현재 생산자는 `buildDomesticMarketEvidence`(② · **COMPARISON 포함**)다.
① strict 로 갈면 국내는 **tier SAME + 검증가격** 을 요구한다 — 그런데 🔴 **국내 tier
SAME 은 현재 0 이다**(WU-138 확정 · 완화 REJECT).
⟹ 🔴 거의 모든 상품의 🇰🇷 줄이 **「국내 동일상품 가격을 확인하지 못했습니다」** 로 바뀐다.
🟢 그것은 **정직한 결과** 이고 전략과 맞다(「SAME 으로 확인된 것만 판단에 쓴다」).
🔴 단 **CEO 가 보면 「기능이 퇴화했다」로 읽힐 수 있는 변화** 다 ⟹ 배포 후 CEO 확인 때
   이 문장을 **미리** 같이 전달한다(「정상인데 FAIL 로 보이기 쉬운 것」 목록에 넣는다).
```

### 🔴🔴🔴 **경계 하나 — 「② = 상세 근거」를 «서버 판정» 까지로 읽지 않는다**
```
② 는 UI 참고가격만이 아니다 — 서버에서 **국내 축 적재 → `marketCase` → `computeMarketAlert`
→ `price_alerts` 영속 행** 의 입력이기도 하다(`market-intelligence.ts` · WU-039/059 계약).
🔴 그래서 「② 를 상세 근거로 내린다」를 **그 서버 경로를 끊는 것** 으로 구현하면
   **가격 판정과 알림이 바뀐다** ⟹ §00-B 가격 보류 + CPO 의 「가격 판정 로직 개선 금지」 위반.
🟢 **이번 WU 의 범위는 «UI/문구 owner 전환» 까지다** — `marketCase` 계산과 알림 경로는
   **한 글자도 건드리지 않는다**. 🔴 `mi-verdict-copy` 의 `marketCase` 입력도 그대로 쓴다.
```

### 🟡 후보 분류(STEP 5) — **새 판정 0 · 전부 기존 값**
```
A SAME 확정        transientDisplayTier === "SAME"
B SAME 보류        PRESUMED_SAME · UNKNOWN
C SIMILAR          SIMILAR · SAME_MODEL_OPTION_DIFF
D DIFFERENT 확정   CONFLICT  **또는** human_verdict === "DIFFERENT"  ← 🟢 STEP 4 가 되살린 값
E 가격 확인 가능    isPriceConfirmed === true
F 가격 확인 필요    isPriceConfirmed === false
G 판매상태 UNKNOWN  saleState === "UNKNOWN"
🟢 기본 노출 = **판단할 가치가 있는 것**(A·B·C) · D 는 접는다(**삭제 0** · 근거 보존)
🔴 상위 N 절단 ❌ · threshold/SAME 완화 ❌ · D 를 SAME 으로 승격 ❌
```

---

## ⑤ 🟢 구현 순서 — **CPO 가 13단계로 고정했다**(설계 끝 · 다시 설계하지 않는다)

🔴 **선행 게이트: CEO 저장 테스트 PASS.** 그 전에는 1번도 시작하지 않는다.

```
 1. ③ buildOverseasMarketEvidence 제거
 2. /check rows[] 를 **단일 생산 source** 로 확정
 3. ComparisonShopSearch **자체 검색 제거**(해외 검색이 두 번 도는 것도 같이 사라진다)
 4. MarketPriceComparison 을 **유일한 결론 owner** 로 확정
 5. mi-verdict-copy 를 ① strict 기준으로 전환  ← 🔴 위 「문구 축」 표와 좌표를 그대로 쓴다
 6. ② 참고가격은 **상세 근거로 유지**         ← 🔴 서버 판정 경로는 **건드리지 않는다**(경계)
 7. PRICE_COMPARISON_ANCHOR_ID → MarketPriceComparison (scroll 유지)
 8. A/B/C 기본 노출 · **D 접힘**(삭제 0 · human DIFFERENT 도 보존)
 9. 기존 contract 강화     10. mutation
11. **2상품 E2E**(B226AC009 · B226AC010)
12. regression / typecheck / build     13. deploy → CEO 1회
```

🔴 **이번에도 0 변경** — MI threshold · SAME 기준 · `NO_TITLE_OVERLAP` · 상위 N 절단 ·
DIFFERENT 승격 · 가격 있으면 SAME 취급.
🔴 그리고 **WU-142(국내 SAME)로 넘어가지 않는다** — CPO 가 순서를 고정했다.

🟡 **13 번에서 CEO 에게 같이 전달할 것**(위 「예상되는 결과」):
> 🇰🇷 줄이 「국내 동일상품 가격을 확인하지 못했습니다」로 바뀌는 것은 **정상** 이다 —
> 국내 tier SAME 이 0 이기 때문이고(WU-138 확정), 그것을 **완화해서 만들지 않는다**.

🟡 **WU-142 는 그대로 대기** — `docs/HANDOFF-WU-141.md` 에 출발 표와 금지 레버가 있다
(그 문서의 내용은 **유효** 하고, 이름만 WU-142 로 읽으면 된다).
