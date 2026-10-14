# WU-010 STEP 1 — 화면 후보의 **실제 source 확정**

> 🔴 외부 AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 0 · Registry 변경 0 · schema 0 ·
> DB 쓰기 0 · 환산 0 · 임계값 0 · **Production 배포 0** · 비용 ₩0.
>
> 🟢 **결과: 후보를 화면에 넣는 경로는 «셋» 이고 전수로 셌다.** 그중 둘은 이 상품에서
> **표시 0 으로 측정** 됐고, 🔴🔴 **세 번째가 남았으며 그것이 실제로 살아 있다.**

---

## 1. 🟢 전수 — 후보가 화면에 도착하는 경로는 **셋**

```
① 저장된 링크 (DB)
   DomesticPriceIntelligencePanel.tsx:1842
   GET /api/domestic-price-sources/links?snapshotId=…
   → sortDomesticCandidatesByTrust → 패널 후보 목록

② transient 국내 라이브 검색  🔴 **DB 가 아니다**
   DomesticShopSearch.tsx:180 (렌더: CommerceWorkspace.tsx:3808)
   POST /api/domestic-price-sources/search
   → searchDomesticShops → excludeSelfReference → attachMatchTruth
   → route.ts:220 `NextResponse.json({ ok: true, results })`
   → 화면 게이트 `mayShowCandidate`

③ transient **해외** 라이브 검색  🔴 **DB 가 아니다**
   ComparisonShopSearch.tsx:218
   POST /api/comparison/search
   → listComparisonShops → searchComparisonShops → attachProductMatchTruth
   → 화면 게이트 `mayShowCandidate`(같은 문)
```
🟢 `candidates` 를 돌려주는 API 라우트 전수에서 **상품 상세 화면에 후보를 공급하는 것은
이 셋뿐** 이다(나머지는 카테고리 추천·소싱 후보 등 다른 화면이다).

---

## 2. 🟢 ①② 는 이 상품에서 **표시 0** — 측정했다

### ① 저장된 링크 = **0행**
WU-008 실측: `B226AC117` 의 13 스냅샷 전부 `domestic_product_links` **0건**.
🟢 이유도 코드로 확정됐다 — `judgeDomesticCandidate` 가 DROPPED/`NOT_MATCHED` 를 내면
`run-domestic-price-check.ts:1087·1106` 의 `continue` 가 **upsert 앞에서** 끊는다.
→ 🟢 패널 후보 목록에는 **아무것도 그려지지 않는다.**

### ② transient 국내 = 후보 5건 · **표시 0건** (운영 함수로 재현)
```
searchDomesticShops → excludeSelfReference(제외 0) → attachMatchTruth
후보 **5건** 전부 looxloo.com (BLUEDOG 레깅스/가디건/우주복 · 머플러 · 턱받이)
matchTruth 분포   **INSUFFICIENT_EVIDENCE 5/5**
displayTier 분포  **UNKNOWN 5/5**
🔴 화면 표시 대상 **0 / 5**  ← `mayShowCandidate` 가 전건 차단
```
🟢 그리고 **「더 보기」에도 없다** — `DomesticShopSearch.tsx:571-583` 주석이 명시한다:
> 「관련성이 낮아 목록에 설 수 없는 후보 → **아예 없다**(hiddenRows 를 쓰지 않는다).
>  관련성은 통과했는데 상위 3건 밖인 후보 → 「더 보기」에 남는다(g.overflow).」

🔴 즉 **②는 이 상품에서 화면에 한 건도 그리지 않는다.**

---

## 3. 🔴🔴 ③ 해외 경로가 **남았고, 이 상품에서 실제로 살아 있다**

운영 DB `comparison_shops` 전수(35행)에서 **읽기 전용** 확인:
```
bobochoses.com   access_status=null   **is_active = true**   scope ["KIDS_FASHION"]
(그 외 junioredition · smallable · designerkidswear · nickis … 전부 active)
```

🔴 **그래서 해외 비교 구역은 이 Bobo Choses 상품으로 `bobochoses.com` 을 검색한다.**
🔴 그리고 **브랜드가 빈 값** 이라(WU-009 §A) 질의가 상품명 기반으로 나간다 —
WU-007 에서 내가 `bobochoses.com/search/suggest.json` 에 그런 질의를 넣었을 때 받은 것이
**정확히 Gift Bag · Veja 운동화** 였다.

### 🟢🟢 측정 완료 — **③은 무관한 상품을 실제로 화면에 올린다**

운영 필터(`isActive && isCollectableAccess && sourceFitsScopes`)와 운영 함수
(`searchComparisonShops` → `attachProductMatchTruth` → `overseasMatchDisplay` →
`mayShowCandidate`)를 **그대로** 돌렸다.

```
대상 샵 **30** · 응답 30 · 🔴 오류 **20** · 후보 **31**
productMatchTruth  CONFLICT **18** · SIMILAR **7** · INSUFFICIENT_EVIDENCE **6**
🔴🔴 화면 표시 대상 **1 / 31**
   junioredition.com · 「Elovera Jacket in Washed Grey Denim by **ICHI**」 · **GBP 39**
   productMatchTruth **SIMILAR** · matchLevel low · confidence **0.33**(≥ 0.2) → 보인다
   🔴 원상품은 Bobo Choses `B226AC117` ¥26,400 — **브랜드도 상품도 다르다**
```

🟢 **게이트는 30/31 을 막았다** — CONFLICT 18 · UNKNOWN 6 은 기본 노출에서 빠지고,
SIMILAR 7 중 **6건은 confidence 0.14~0.17 로 하한(0.2) 미달** 이라 차단됐다.
🔴 통과한 1건의 confidence 0.33 은 제목에서 **`jacket` 한 단어** 가 겹친 결과로 보인다
(원상품 "B.C. Embossed tracksuit **jacket**" ↔ 후보 "Elovera **Jacket** in Washed Grey Denim").

🔴 **그래서 ②와 ③의 성질이 다르다**:
```
② 국내 transient — 5건 전부 INSUFFICIENT_EVIDENCE → **표시 0**
③ 해외 transient — 31건 중 **1건이 SIMILAR 로 표시된다**  ← CEO 가 본 것과 같은 성질
```

### 🔴 단정하지 않는 것 셋
```
① 「CEO 가 본 것이 바로 이 ICHI 재킷이다」로 **단정하지 않는다** — 로그인 뒤 DOM 을 읽을 수 없다.
   🟢 확정된 것은 「③이 무관한 상품을 표시 대상으로 만든다」는 **성질** 이다.
② 🔴 **샵 20/30 이 오류였다.** 그 샵들이 응답하면 표시 후보가 더 늘 수 있다 — 이 숫자는
   **하한** 이고 전수가 아니다.
③ 「브랜드가 있었으면 CONFLICT 가 됐을 것」이라고 **단정하지 않는다.** 이번 질의의
   `brand` 는 **null** 이었다(WU-009 §A). 🟡 그 반사실은 **같은 HTTP 로 1회 더 돌려
   측정 가능** 하다 — 브랜드만 주입해 ICHI 후보가 CONFLICT 로 바뀌는지 보는 것이고,
   그것이 WU-009-A 의 가치를 **추정 없이** 재는 방법이다(CPO 결정 입력).
```

---

## 4. 🔴 그리고 내가 정직하게 적어야 할 것 하나

「Gift Bag / Veja」라는 **이름은 내 WU-007 보고서에서 나왔다.** 그 표현이 CEO 테스트
시나리오(②)에 그대로 들어갔고, FAIL 보고도 그 어휘로 돌아왔다.
🔴 그래서 **CEO 가 실제로 그 두 품목을 봤는지, 아니면 다른 무관 상품을 봤는지는 구분되지
않는다.** 🔴 로그인 뒤 화면은 CTO 가 읽을 수 없다(메모 `production-payload-is-unreachable`).
🟢 다만 ③ 경로가 그 두 품목을 **실제로 돌려줄 수 있다**는 것은 WU-007 실측으로 확정이다.

---

## 5. 🟢 STEP 2 — 저장 게이트는 건드리지 않았다 · low 노출 정책의 현재 사실

```
🟢 요구「DROPPED/NOT_MATCHED → 저장 안 함」           **이미 그렇다**(§2-①)
🟢 요구「low 가격을 판정/최저가/대표가에 쓰지 않음」   **이미 그렇다**(저장 0 → tier 진입 불가)
🟢 요구「LOW/NOT_MATCHED → 동일상품 후보 UI 제거」     **이미 그렇다**(§2-② · 더 보기에도 없음)
🔴 요구「참고 후보로 다시 보여주지 않는다」            **그런 기능이 없다** — 만들지 않았다
```

🔴🔴 **그리고 「low 를 화면에서 빼라」를 `matchLevel` 로 구현하면 안 된다** — 하니스 ①-4 가
그것을 단언으로 잠갔다. 리포 기록(`DomesticShopSearch.tsx:60-67`, P-24 Sprint 2):
> 진짜 동일상품(포레포레 · `STRONG_IDENTIFIER` · SKU 일치)의 confidence 가 **0.42(= low)**
> 였고, 그때 걸려 있던 `matchLevel !== "low"` 필터가 그 후보를 숨겼다 → **의도적으로 제거** 됐다.

🟢 현재 축은 `matchTruth`(식별 증거) + `confidence >= MIN_DISPLAY_SIMILARITY(0.2)` 다.
🔴 `matchLevel` 은 표시 게이트의 **입력이 아니다.**

---

## 6. 🔴 STEP 3 — 「시장 부재」를 기록할 자리: **조사 결과 없다**

`price_observations` 칸 전수(읽기 전용 확인):
```
id · snapshot_id · source · source_label · source_product_url · currency ·
price_amount · shipping_cost_amount · tax_amount · exchange_rate · price_krw ·
checked_at · created_at · source_ref_id · sale_price_krw · original_price_krw ·
sold_out · market_code · market_country · shipping_policy_status · shipping_policy_note
```
🔴 **「probe 했고 404 였다」를 담을 칸이 없다.** 관측은 **행이 생기는 것** 으로만 표현되고,
시장이 없으면 **행이 없다** → 「미관측」과 「시장 부재」가 **같은 모양** 이다.

🟡 **기존 자리 후보 둘**(🔴 둘 다 CPO 승인 없이 쓰지 않았다):
```
⒜ `shipping_policy_status` 처럼 **상태 문자열 칸을 하나 더** 두는 방식
   🟢 선례가 같은 테이블에 있다(정책 상태를 행에 적는다)
   🔴 그러나 「가격이 없는 관측 행」을 만드는 것이 되어 **읽는 쪽 4곳이 모두 영향**
      받는다(헌장 §12 의 `overseas-observation-storage-impact` 교훈).
⒝ `domestic_price_sources.last_error_code` 처럼 **시도 기록을 샵/상품 축에 두는** 방식
   🔴 현재 그 축은 «샵» 단위이고 «상품×시장» 단위가 아니다.
```
🔴 그래서 **최소 상태 모델 제안은 CPO 결정 뒤에** 올린다. 🔴 새 테이블을 먼저 만들지 않았다.

---

## 7. 검증
```
WU-010 하니스  사전검증 **4 passed**(HTTP 0) + 실측 1 passed · AI 0 · 키 0 · 결제 0
🔴 실측에서 반환 모양을 한 번 추측해 깨졌다 — `excludeSelfReference` 는 배열이 아니라
   `{ results, excluded }` 다. 🟢 route.ts:215 와 **같은 분해** 로 고쳤다.
🔴 그리고 DB 칸을 또 추측해 깨졌다 — `comparison_shops.enabled` 는 없고 **`is_active`** 다
   (42703). 이 트랙 **열한 번째** 같은 실수다.
회귀/typecheck/build  (§본문 보고 참조)
```
