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

### 🟢 실제로 «제거해 보고» 받은 FAIL 전수 — 이 목록대로 옮기면 된다

🔴 `<ul>` 을 지우고 `tsc`(**0**) + 8파일을 돌린 결과다. 🟢 **되돌려서 작업트리는 clean** 이고,
다음 세션은 **이 목록만 고치면 된다**(어디가 깨지는지 다시 찾을 필요 없다).

```
wu-132  「E-8 기존 블록이 «삭제되지 않았다» — 두 참고가격과 SAME 행이 그대로 있다」
        🔴 소스 문자열 단언 `toContain('data-testid="mi-same-row"')`
        ⟹ 그 단언의 «뜻» 은 「블록이 통째로 사라지지 않았다」다. 지금은 **의도된 제거** 이므로
           `mi-candidate-row` + `mi-same-empty` + `mi-same-excluded` 존재로 **옮긴다**
wu-133  「SAME 후보가 있으면 그 행이 서고, 보류 줄은 그 행을 중복해서 세지 않는다」
        length 1 → 0 ⟹ 같은 뜻을 `mi-candidate-row` 로
close-05 「R-6 rows 가 오면 후보·가격·선택이 선다」            +0 → 1 기대
close-04 「S-1 SAME 후보에 선택 UI 가 선다」                   null not to be null
close-04 「S-6 저장 상태가 화면에 선다」
wu-136  「R-7 기술/참고 정보는 «접혀» 있다 — 그래도 DOM 에 남아 있다(삭제 0)」
        🔴 이 단언이 가장 조심스럽다 — 「접힘 안에 **남아 있다**」가 그 계약의 목적이고,
           제거 후에도 `mi-candidate-row` 가 접힘 «안» 에 있으므로 **뜻은 유지된다**
🟢 pp-01 · cand-02 는 **통과했다**(그 둘은 이미 `mi-candidate-row` 를 본다)
```

🔴 **공통 원칙** — 다섯 전부 「SAME 후보가 화면에 **있다**」를 보는 단언이다. 후보는 여전히
있고 **자리만 접힘 안으로 하나가 됐다** ⟹ **좌표만 옮기고 단언의 뜻은 그대로 둔다.**

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

### 🟢 B-1 · B-2 — **완료·배포**(`41aaf43a`)

```
migration 081  price_status · sold_out · match_reasons — 🟢 운영 DB 적용·실측 완료
               (3칸 nullable · 기존 124행 backfill 0)
writer         recordSeenCandidates 입력 3칸 + check/route 3줄 + toRow 매퍼 3칸
⟹ 🟢 **지금부터의 모든 분석은 세 칸까지 저장된다.** 남은 것은 reader 하나다.
```

### 🔵🔵🔵 B-3 reader — **⒝ 확정: 집계에 닿지 않는 «네 번째 배열»**(CPO 2026-11-01)

🔴 **왜 ⒝ 인가** — 이 BLOCK 은 새 정책이 필요해서 생긴 것이 아니라,
`geminiEvidence` 가 **「가격 집계 입력」과 「화면 후보 데이터」 두 역할** 을 겸해서 생긴
**구조 충돌** 이다. 그래서 역할을 가른다.

```
candidate_reviews
   ├─ 가격 집계용 기존 경로 ─→ geminiEvidence        🔴 한 글자도 안 바꾼다
   └─ 재진입 표시 복원용   ─→ **savedCandidateRows**  🔴 집계 금지
```

🔴 **반드시 지킬 9**(CPO 고정) — ① 기존 `geminiEvidence` 가격 집계 로직 변경 0
② `priceTier` 를 **nullable 로 바꾸지 않는다** ③ 기존 124행 backfill 0
④ **18행을 버리지 않는다**(⒞ 기각 — 「좋은 후보를 최대한 많이 보여준다」와 반대)
⑤ 재진입 시 Search/Crawl/`/check` **0회** ⑥ 최초 분석 ↔ 재진입 **표시 결과 동일**
⑦ P1/P2/P3 는 저장된 `price_status` 로 복원 ⑧ `matchReasons` 도 저장값 그대로
⑨ 🔴 **`savedCandidateRows` 가 가격 aggregation 에 들어가면 FAIL 하는 계약을 «신설»**

🟢 **복원할 칸은 전부 저장돼 있다** — url · domain · title · image · price · currency ·
market · verdict · matchTruth · priceTier · blockers · matchReasons · priceStatus ·
soldOut · source.

🔴 **`blockers` 는 저장 시 `[...blockers, ...conflicts]` 로 «합쳐져» 있다.**
🟢 복원은 그 배열을 **`crossSellerConflicts` 로 넣고 `crossSellerBlockers: []`** 로 둔다 —
`isModelCodeOnlyReference` 의 결과가 **모든 경우에 동일** 하다(검증: 원래 blocker 가
있었으면 합친 길이가 2 이상이거나 단일 비-MODEL_CODE 라 어느 쪽이든 false). 🟢 경고
문구(`candidateWarningLines`)도 둘을 합쳐 쓰므로 **글자가 같다**.

### 🔵🔵🔵 **CPO 최종 지시서 LOCK**(2026-11-01) — 이 절이 B-3 의 기준이다

🔴 아래 **전략 게이트** 를 먼저 읽는다. 이것이 「왜 복원인가」의 전부다.

> 우리는 **100% 동일상품을 증명하는 시스템을 만드는 것이 아니다.**
> AI Search + Evidence 로 **좋은 후보를 최대한 많이 찾고 실제 가격을 붙여
> 셀러가 선택하게 하는 «의사결정 지원»** 시스템이다.
> ⟹ B-3 은 그 흐름을 **다시 실행하는 것이 아니라** 이미 확보한 것을 **이어 붙이는** 일이다.
> **저장 → 복원 → 표시만 한다.**

```
🔴 금지 — Search 재실행 · Crawl 재실행 · /check 재실행 ·
   「다시 분석」을 눌러야 결과가 나오는 구조 · 저장 후보를 **다시 Identity 판단** ·
   가격 정책 변경 · Identity 정책 변경 ·
   🔴 **client localStorage/sessionStorage 저장**(WU-059 금지축과 같은 자리) ·
   priceTier nullable 변경 · priceTier 임의 생성 · priceTier=null 18행 버리기 ·
   savedCandidateRows 를 geminiEvidence/가격집계에 합류 ·
   **UI 텍스트를 늘려 문제를 해결**
```

#### 🔴 계약 번호는 **이 목록이 최종** 이다(앞선 목록과 섞지 않는다)

```
B3-01 저장 3칸(price_status·sold_out·match_reasons)이 조회 결과에 실제 포함
B3-02 저장 후보 전수 보존 — savedCandidateRows.length === 저장 후보 수
      🔴 priceTier=null 이라고 버리지 않는다(18행)
B3-03 `GeminiTransientEvidence.priceTier` **required 계약 불변**
B3-04 aggregation isolation — 복원이 가격 집계 결과를 바꾸지 않는다
B3-05 surface 단일화 — mi-same-row 0 · mi-candidate-row = 표시 후보 수 · 중복 0
B3-06 P1/P2/P3 보존 — 특히 VERIFIED_CURRENT 는 반드시 P1
B3-07 match_reasons 보존(복원 과정에서 사라지지 않는다)
B3-08 최초 분석 ↔ resume 후보 집합 동일(🔴 아래 한계 참조)
B3-09 resume 진입 시 Search=0 · Crawl=0 · /check=0   ← **핵심 DoD**
B3-10 실제 마운트 DOM — mi-candidate-row · mi-candidate-price ·
      mi-candidate-price-unverified
```

#### 🔴🔴 **검토에서 나온 BLOCK 후보 — 착수하면 바로 만난다**

```
🔴 ① `source` 두 enum 이 «다르다»  — §4 의 「source 그대로 복원」이 글자대로 불가능
   저장측 ReviewSource        OVERSEAS_AUTO · DOMESTIC_REGISTRY · SELLER_URL ·
                             GEMINI · GT_IMPORT
   화면측 GeminiTransientRow  GEMINI_DISCOVERY · SELLER_URL · OVERSEAS_AUTO ·
                             REVIEWED_SAME · DOMESTIC_LISTING · WEB_SEARCH
   겹치는 것 = **SELLER_URL · OVERSEAS_AUTO 둘뿐**
   🔴 화면은 `SOURCE_LABEL[row.source]` 를 쓴다 ⟹ 매핑 없는 값은 **빈 배지** 가 된다
      (그 파일 주석이 「이 둘이 유니온에 없어서 배지가 빈칸으로 나갈 상태였다」고
       같은 사고를 이미 기록해 뒀다 · E2E-04)
   🟡 선택지(🔴 CTO 가 고르지 않는다) — ⒜ 매핑표 신설(GEMINI→GEMINI_DISCOVERY ·
      DOMESTIC_REGISTRY→DOMESTIC_LISTING · 🔴 GT_IMPORT 는 **대응이 없다**)
      ⒝ 복원 행은 source 를 비운다(배지 사라짐) ⒞ 「복원됨」 값을 양쪽에 추가
   🔴 ⒜ 를 고르면 **GT_IMPORT 를 어디로 보낼지**가 남는다 — 그것은 제품 정책이다

🔴 ② B3-08 은 **CTO 가 절반만 잴 수 있다**
   「최초 분석」을 돌리려면 live HTTP + service-role 키가 필요하고 CTO 에겐 **없다**.
   🟢 CTO 가 낼 수 있는 것 — 「**저장된 N 행이 복원에서 N 행으로 나온다**」(누락 0).
   🔴 「최초 화면 ↔ resume 화면이 같다」는 **CEO 축** 이다. 분모를 갈라 적는다.
```

---

### 📏 B-3 Blast Radius — **착수 전 실측**(2026-11-01 · 설계 재검토 아님 · 숫자만)

```
① computeMarketIntelligence 를 부르거나 단언하는 곳   운영 5 · 계약 12
② marketComparison / rows 배선                        운영 2 · 계약 13
③ candidate-review(list/record) 소비처                운영 3 · 계약  6
중복 제거 후 — 운영 **약 10** · 계약 **약 27**
🔴 A 는 계약 8 이었다. **B-3 은 그 3배가 넘는다.**
🟢 단 대부분은 «추가» 다(GET 인자 3번째 · 응답 필드 1개) ⟹ **실제 깨지는 수는
   돌려 봐야 안다.** 「27 이 전부 깨진다」로 읽지 않는다.
```

### 🔴🔴 착수 전 중단 조건 — **코드를 쓰기 «전» 에 본다**

아래 중 하나라도 해당하면 **착수하지 않고 그 사실만 보고한다.**

```
[C-1 용량]  한 세션에 **전체 회귀 2회(각 ~7분) + build 2회 + 계약 ~27 확인** 을
            끝낼 여유가 없다 ⟹ 착수 금지.
            🔴 이 트랙에서 세 번 중단했고 한 번은 **착수 후 revert** 였다.
            🟢 판단은 «착수 전» 에 한다 — 커밋 경계가 있어도 배선 절반은 위험하다.

[C-2 전제]  아래 셋을 **먼저 확인** 한다. 하나라도 거짓이면 STOP(설계가 틀린 것이다):
            ① `listCandidateReviews` 가 신규 3칸을 **실제로** 돌려준다
               (`select("*")` 전제가 참인가 — 한 번 조회해 눈으로 본다)
            ② GET 응답에 필드를 **더해도** 기존 소비자가 안 깨진다(추가 전용인가)
            ③ `savedCandidateRows` 를 **가격 집계에 닿지 않게** 실어 보낼 자리가
               실제로 있다 — 없으면 ⒝ 자체가 성립하지 않는다

[C-3 범위]  좌표 이동이 아니라 **「뜻을 바꿔야」 하는 계약** 이 나오면 STOP.
            🔴 A 에서는 전부 좌표 이동이라 통과했다. 뜻을 바꿔야 한다면 그것은
               **정책 변경** 이고 CTO 가 하지 않는다.

[C-4 금지]  §22 NO-TOUCH 중 하나라도 손대야 구현이 되면 STOP.
```

### 🔴🔴 책임 분리 — **B-3(CTO) ↔ B-4(CEO) 는 다른 증거다**

```
┌─ B-3  CTO 가 «혼자» 낼 수 있는 증거 ─────────────────────────────────────┐
│ B3-01 복원 매핑        B3-02 priceTier 미생성     B3-03 P1/P2/P3 보존      │
│ B3-04 matchReasons     B3-05 blockers 동일        B3-06 집계 격리          │
│ B3-07 중복 없음        B3-09 mi-candidate-row DOM B3-10 DOM 가격상태       │
│ B3-08 **코드 경로가** Search/Crawl/check 를 부르지 않는다(spy = 0)         │
│ 축: 순수 함수 + 마운트 DOM + 호출 spy · 로그인 불필요                      │
└───────────────────────────────────────────────────────────────────────────┘
┌─ B-4  **CEO 만** 낼 수 있는 증거 ────────────────────────────────────────┐
│ 실제 `/pipeline?resume=…` 에서 — 가격비교 즉시 · 후보 즉시 · 가격 상태 유지 │
│ · 중복 없음 · **[다시 분석] 안 눌러도 됨** · 실제 호출 0회                 │
│ 🔴 로그인 뒤라 **CTO 가 볼 수 없다**                                       │
└───────────────────────────────────────────────────────────────────────────┘

🔴🔴 **B-3 전부 PASS ≠ B 완료.** CTO 가 증명하는 것은 「**코드가 그렇게 돼 있다**」이고
   CEO 가 증명하는 것은 「**화면이 실제로 그렇다**」다. 이 트랙에서 `-01`·`-02`·`-03`
   이 **세 번 다** 전자는 PASS, 후자는 FAIL 이었다.
🔴 그래서 CTO 보고의 최종 판정 칸은 **`B-3 PASS / B-4 미확인`** 까지만 쓴다 —
   「Production UX PASS」로 적지 않는다.
```

### 🔴 B-4 — CTO 가 할 수 없는 부분을 미리 적는다

CPO §B-4 의 「실제 `resume=` 화면」 검증은 **로그인 뒤라 CTO 가 볼 수 없다.**
🟢 CTO 가 낼 수 있는 것은 ⒜ 마운트 DOM 에서 「복원 배열만으로 후보가 선다」
⒝ 네트워크 호출 **0회** 단언(Search/Crawl/`/check` 를 spy 로 센다) 둘이다.
🔴 **「Production UX PASS」로 적지 않는다** — 최종 판정은 CEO 실제 화면이다.

### [참고] 원래 B-3 설계(⒝ 이전)

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
