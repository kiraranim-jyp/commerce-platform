# CANDIDATE-UX-REFINE-04 — 후보 중복 UI 통합 + 재진입 복원

> 🔵 CPO 최종 지시서 수령(2026-11-01). **조사 끝 · 설계 끝 · 남은 것은 구현뿐이다.**
> 🔴 이 문서 하나만 읽고 착수한다. 추가 조사 WU · 비교표 WU · 국내/해외 별도 WU 로 **쪼개지 않는다**.

---

## 0. 왜 `-01`·`-02`·`-03` 이 세 번 UX FAIL 했나 (실측으로 확정)

```
mi-same-row        ← 🔴 접힘 «밖» · 항상 보인다 · 셀러가 «먼저» 보는 것
mi-candidate-list  ← 접힘 · 그 «안» 에 mi-candidate-row   ← -01·-02·-03 이 고친 곳
```

🔴🔴 **같은 후보가 두 번 선다**(실측): 국내 `beaumonde.co.kr` 이 양쪽에 · 해외 4건이 12건 안에.
두 표현의 **정보 계층이 다르다**:

| | `mi-same-row`(항상 보임) | `mi-candidate-row`(접힘 안) |
|---|---|---|
| 이미지 | **없음** | 🟢 |
| 판정 라벨 | 🔴 **없음**(WU-091 불변식 미준수) | 🟢 |
| 판매처 | 링크에 도메인 | 🟢 별 줄 + 링크 분리 |
| 경고 | **없음** | 🟢 `⚠ 확인 필요:` |

⟹ **접힘 안쪽을 아무리 고쳐도 첫 화면이 안 바뀐다.** 이것이 세 번의 원인이다.

---

## 1. 구현 A — 중복 표시 surface 제거

**자리**: `MarketPriceComparison.tsx` **L1516~1549**

```tsx
{selection.priced.length === 0 ? (
  <p data-testid="mi-same-empty">{MI_SAME_EMPTY}</p>   // 🟢 유지(결론 문장)
) : (
  <ul>{selection.priced.map(row => <li data-testid="mi-same-row">…</li>)}</ul>  // 🔴 이 <ul> 만 제거
)}
```

🟢 **집계는 안 죽는다** — 가격 집계 owner 는 `OverseasReferencePrice`(L1515) + `buildPriceGuide` 이고
`selection.priced` 는 **여기서 표시용** 일 뿐이다. `selectMiSameCandidates` **수정 0**.

🟢 **후보도 안 사라진다 — 부분집합 증명**:
`priced` = tier **SAME** + 판매중 + 가격확인 ⟹ `selectCandidateList` 의 `LIKELY_TIERS`(SAME ·
SAME_MODEL_OPTION_DIFF)에 **반드시 포함**된다. 기존 계약 `CAND-07`(「가격이 뜨는 후보는
여기서 사라질 수 없다」)이 이미 그것을 잠그고 있다.

🔴 **같이 유지할 것** — `mi-same-empty`(결론) · `mi-same-excluded`(제외 사유) · `OverseasReferencePrice`.

### 🔴 건드릴 계약 — **8파일 12줄**(전수)

```
api/price-history/_lib/__tests__/wu-132-mi-same-price-comparison.test.ts
pipeline/commerce/__tests__/cand-02-candidate-display.test.ts
pipeline/commerce/__tests__/core-e2e-close-04-candidate-select.test.ts
pipeline/commerce/__tests__/core-e2e-close-05-manual-recheck.test.ts
pipeline/commerce/__tests__/pp-01-possible-conflict.test.ts
pipeline/commerce/__tests__/wu-133-pending-note-render.test.ts
pipeline/commerce/__tests__/wu-136-market-judgement-render.test.ts
pipeline/commerce/__tests__/wu-136-market-judgement.test.ts
```
🔴 **느슨하게 하지 않는다** — 「`mi-same-row` 에 있다」는 단언은 **「`mi-candidate-row` 에 있다」로
옮긴다**(같은 후보가 여전히 화면에 있다는 뜻은 유지). 🔴 지우지 않는다.
🟢 그리고 **D1 계약을 새로 세운다** — 같은 `candidate_url` 이 두 surface 에 동시에 있으면 FAIL.

---

## 2. 구현 B — 재진입 복원

### B-1 migration `081_candidate_reviews_price_state.sql`

```sql
alter table candidate_reviews add column if not exists price_status text;
alter table candidate_reviews add column if not exists sold_out boolean;
```
🔴 **backfill 금지**(기존 행은 null 그대로) · nullable 이라 기존 데이터 호환.
🔴 `migrations_manual` 은 **사람이 손으로 적용** 한다 — 적용 전까지 writer 가 쓰면 실패한다.

### B-2 writer — `check/route.ts:443` `recordSeenCandidates` 인자에 두 칸 추가

```ts
priceStatus: e.priceStatus,
soldOut: e.soldOut,
```
🟢 `GeminiTransientEvidence` 에 이미 있는 칸이다(지어내지 않는다).

### B-3 reader — GET 복원

```
GET /api/price-history/[snapshotId]/route.ts:22
  computeMarketIntelligence(snapshotId, workspaceId)              ← 지금(인자 2)
  computeMarketIntelligence(snapshotId, workspaceId, restored)    ← 바꾼다(인자 3)
```
`restored` = `candidate_reviews` 에서 `snapshot_id` 로 읽어 `GeminiTransientEvidence` 로 변환.

**칸 매핑(전부 실재 · 지어내는 값 0)**
```
candidate_url    → discoveredUrl      candidate_domain → domain
candidate_title  → title              image_url        → imageUrl
price_amount     → priceAmount        price_currency   → priceCurrency
market           → market             system_verdict   → crossSellerVerdict
match_truth      → matchTruth         price_tier       → priceTier
blockers(jsonb)  → crossSellerBlockers / crossSellerConflicts
price_status     → priceStatus        sold_out         → soldOut
source           → source
```
🔴 `price_status` 가 **null 이면 그대로 null** ⟹ `priceState` 가 **UNVERIFIED(P2)** 를 낸다
(안전측 · `-02` 에서 그렇게 설계했다). **`VERIFIED_CURRENT` 로 추정하지 않는다.**
🔴 `matchReasons` 는 저장돼 있지 않다 ⟹ 복원 행은 **빈 배열**. 🟢 화면에 안 쓰므로 영향 0.
🔴🔴 그러나 **POSSIBLE 게이트(`isModelCodeOnlyReference`)가 `matchReasons.length > 0` 을 요구** 한다
⟹ **복원 행에서는 품번충돌 참고 후보가 POSSIBLE 로 서지 못한다.**
🟡 **이것이 이 WU 의 유일한 열린 설계 질문이다** — ⒜ `matchReasons` 도 저장 ⒝ 복원 경로에서만
`price_tier`/`system_verdict` 로 군을 정함 ⒞ 그 군만 재진입에서 빠지는 것을 수용.
🔴 **CTO 가 고르지 않는다 — CPO 판정.**

### B-4 🔴 자동 재분석 금지
GET 안에서 `POST /check`·Search·Crawl 을 부르지 않는다. **읽기만** 한다.

---

## 3. DoD (CPO §16) · 테스트 · 보고

D1 중복 0 · D2 모든 행에 판정 라벨 · D3 P1/P2/P3 · D4 KR/OVERSEAS DOM 동일 ·
D5 재진입 시 Search/Crawl/`/check` **0회** · D6 가격·통화·상태 복원 ·
D7 `price_status` 없는 기존 행 → **P2** · D8 선택 동작 · D9 링크 동작 · D10 집계 회귀 0.

🔴 **분모를 PASS 옆에 같이 적는다.** 분모 0 이면 **측정불가**(PASS 아님).
🔴 음성대조 최소 4 — ⒜ `mi-same-row` 복귀 ⒝ GET 복원 배선 제거 ⒞ `price_status` 를
`VERIFIED_CURRENT` 로 backfill ⒟ 중복 방지 제거.
🔴 「테스트 PASS = UX PASS」로 결론내지 않는다 — 최종 판정은 **CEO 실제 화면**.

---

## 4. 착수 전 좌표

```
직전 코드 커밋  1c42c646 (배포 완료) · PRODUCT UX HOLD
변경 예상       운영 3~4(컴포넌트 · check/route · GET route · 변환기) +
                migration 1 + 계약 8 갱신 + 신규 D1 계약
🔴 NO-TOUCH     Search · Crawl · Identity · matchTruth · priceTier · eligibility ·
                Market Classification · cap · selectCandidateList · WU-148 가격 의미 ·
                matchReasons «생산» · CandidateSelect · 접힘 정책
```
