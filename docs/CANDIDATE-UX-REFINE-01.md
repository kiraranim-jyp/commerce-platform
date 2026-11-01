# CANDIDATE-UX-REFINE-01 — 해외 소싱 후보군 UI/UX (CPO GO · 범위 LOCK)

> 🔴 **순수 UI 7건만 한다.** 🔴 조사를 다시 하지 않는다 — owner·칸 이름이 아래에 전부 있다.
> 🔴 착수 전 상태: `2c16152c` · clean · 배포 완료.

## 0. 🔴 동결 목록 (CPO 확정)

```
Identity 전 축 · threshold · SAME_MIN_AXES · matchTruth · priceTier ·
가격 eligibility · 가격 집계 · 가격 owner 배치 · Market Classification ·
AI Search · Search query/provider · Crawl · Registry · transient · snapshot ·
자동 분석 · [다시 분석] · **접힘(mi-022 / WU-136)** · SIMILAR 판정 · candidate cap ·
sellerSku · materialText · P1 AB↔AC · DB schema
```

🟢 `SIMILAR` 미노출은 **`2c16152c` 에서 이미 배포됐다** — 또 건드리지 않는다.

---

## 1. 필수 변경 7건 — owner 와 칸

| # | 변경 | owner (정확한 자리) |
|---|---|---|
| **U1** | 섹션 제목 → **「{시장} 소싱 후보 N곳」** + 보조 1줄 | `mi-same-candidates.ts` `CANDIDATE_LIST_HEADING` → **`Record<"KR"\|"OVERSEAS", string>`** · 소비 `MarketPriceComparison.tsx:1555` |
| **U2** | 그룹 3개에 **보조 설명 1줄** | `CANDIDATE_GROUP_LABEL` 옆에 **신규 `CANDIDATE_GROUP_NOTE`**(같은 파일) |
| **U3** | 그룹별 제목 + 후보 수 + 여백 | `MarketPriceComparison.tsx` 후보 리스트 블록(`data-testid="mi-candidate-list"` 내부) |
| **U4** | 카드 순서 — **이미지 → 등급 → 가격 → 상품명 → 판매처 → 판단 근거 → 링크** | 같은 블록 |
| **U5** | 가격 **3상태**(확인됨 / 미검증 / 없음) | 같은 블록 — 🔴 **§2-A 가 유일한 기준이다** |
| **U6** | 그룹 라벨 옆 **tooltip 3종** | `title={CANDIDATE_GROUP_NOTE[group]}` — 🔴 U2 와 **같은 상수** |
| **U7** | 빈 상태 문구 | `CANDIDATE_LIST_EMPTY` → **`Record<"KR"\|"OVERSEAS", string>`** |

🔴🔴 **`MarketColumn`(`MarketPriceComparison.tsx:1434`)은 국내·해외가 «공유» 한다** — props 에
`market` 이 없고 `domesticList`/`overseasList`(:277·278)가 같은 컴포넌트를 탄다. ⟹ U1·U7 글자를
한 줄로 두면 **🇰🇷 국내 칸에 「해외」가 뜬다**(화면이 거짓말한다).
🟢 처방은 이 파일의 **기존 선례** 뿐이다 — `PRICE_GUIDE_TITLE: Record<"KR"|"OVERSEAS", string>`(:738).

```diff
 function MarketColumn({
   testId,
   heading,
+  market,                       // 🔴 "KR" | "OVERSEAS" — selectCandidateList 와 **같은 union**
   selection,
 ...
-  {CANDIDATE_LIST_HEADING} {list.length}곳
+  {CANDIDATE_LIST_HEADING[market]} {list.length}곳
```
```diff
-  <MarketColumn testId="mi-same-domestic" heading={MI_SAME_DOMESTIC_HEADING}   // :1005
+  <MarketColumn testId="mi-same-domestic" heading={MI_SAME_DOMESTIC_HEADING} market="KR"
-  <MarketColumn testId="mi-same-overseas" heading={MI_SAME_OVERSEAS_HEADING}   // :1034
+  <MarketColumn testId="mi-same-overseas" heading={MI_SAME_OVERSEAS_HEADING} market="OVERSEAS"
```
🔴 `testId.includes("domestic")` 류로 **market 을 추론하지 않는다**(testid 가 바뀌면 시장이 조용히 뒤집힌다).
🔴 「N곳」을 상수에 넣지 않는다 — **`list.length` 에서 파생** 한다.

🟢 **그룹 순서(🟢 → 🟡 → 품번충돌)는 이미 그 순서다** — `selectCandidateList` 가 그 순으로 push 한다. 변경 불필요.

### 확정된 글자

```
U1  제목   CANDIDATE_LIST_HEADING = { KR: "국내 소싱 후보", OVERSEAS: "해외 소싱 후보" }
           화면은 「{제목} {list.length}곳」
    보조   CANDIDATE_LIST_NOTE = "원상품과 같거나 같을 가능성이 높은 판매처입니다."
           🔴 **시장명을 넣지 않는다** — 국내·해외가 같은 문장을 쓴다(CPO: 「일부러 다르게 만들지 않는다」)
U2  CANDIDATE_GROUP_NOTE
    🟢 동일상품 가능성 높음  — 「상품 정보가 강하게 일치하는 후보입니다.」
    🟡 동일상품 추정         — 「핵심 정보는 상당히 일치하지만 일부 정보가 확인되지 않아
                               동일상품으로 추정한 후보입니다.」
    🟡 품번 충돌 · 참고      — 「상품 정보는 참고할 가치가 있지만 품번이 달라 별도로 확인해야 하는 후보입니다.」
    🔴 CANDIDATE_GROUP_LABEL 세 글자는 **한 글자도 바꾸지 않는다**(`ccl-01` 이 잠금)
U6  title={CANDIDATE_GROUP_NOTE[group]} — 🔴 **U2 와 같은 상수를 재사용**(두 벌 금지)
U7  CANDIDATE_LIST_EMPTY = { KR: "국내 소싱 후보가 없습니다", OVERSEAS: "해외 소싱 후보가 없습니다" }
    보조   CANDIDATE_LIST_EMPTY_NOTE =
           "현재 확인된 정보만으로는 같은 상품으로 판단할 수 있는 판매처를 찾지 못했습니다."
```

🔴 「유사상품」·`SIMILAR`·`PRESUMED_SAME`·`POSSIBLE` 같은 **내부 enum 을 글자로 쓰지 않는다**.
🔴 「동일상품」을 **품번 충돌 군에 쓰지 않는다**(`ccl-01` 이 잠근 금지 · 유지).

---

## 2-A. 🔴🔴 U5 가격 — **3상태다**(CPO ⒜ 확정 2026-11-01)

> **「가격을 최대한 보여주되, 그 가격이 얼마나 믿을 만한지를 셀러가 카드 하나만 보고 바로 알 수 있게 한다.」**

🔴 **2분법(있다/없다)으로 두면 한 상태가 새어 나가고, 그것이 셀러에게 가장 해롭다** —
금액은 있는데 **검증 전**인 행이 확정가와 **똑같이** 보이면 셀러가 그 숫자로 판매가를 정한다.
🔴 그 모순은 이 트랙이 이미 기록했다(`CLAUDE.md` WU-111) — 지금 그 칸이 **후보 카드**다.

#### 술어가 셋이고, 카드가 쓰는 것은 **가장 약한 것** 이었다 (실측)

```
① priceText(row)        GeminiTransientCandidates.tsx:94  priceAmount/priceCurrency 만 본다
                        🔴 priceStatus 를 **보지 않는다** ⟹ 미검증 금액도 숫자로 그대로 찍는다  ← 카드가 이것
② isPriceConfirmed(row) mi-same-candidates.ts:378  VERIFIED_CURRENT && amount && currency
③ isPriceDisplayable()  lib/price-truth.ts:13      VERIFIED_CURRENT && price != null
                        🟢 CandidateComparison:209 · ComparisonShopSearch:969 가 이것을 쓴다
⟹ 🔴 **다른 두 화면은 미검증 금액을 숨기는데 후보 카드만 보여준다**(같은 화면이 서로 다른 말)
```

#### 고정된 3상태 — 상호배타 · 전수

```
P1 CONFIRMED   isPriceConfirmed(row)                                  → priceText(row) 만 · 시각 강조
P2 UNVERIFIED  !isPriceConfirmed(row) && priceAmount != null && !!priceCurrency
               (UNVERIFIED_SEARCH · PRICE_UNAVAILABLE 인데 금액이 있는 모순 ·
                🔴 priceStatus 가 null/undefined 인 구버전 행도 **여기**)
                                                                      → priceText(row) + 상태 한 줄
P3 NONE        priceAmount == null || !priceCurrency                   → 「가격 확인 필요」
```

```ts
/** 🔴 **새 가격 판정이 아니다** — 기존 isPriceConfirmed 를 UI 상태로 바꾸는 «어댑터» 다. */
export function priceState(row: GeminiTransientRow): "CONFIRMED" | "UNVERIFIED" | "NONE" {
  if (row.priceAmount == null || !row.priceCurrency) return "NONE";
  return isPriceConfirmed(row) ? "CONFIRMED" : "UNVERIFIED";
}
export const CANDIDATE_PRICE_UNKNOWN = "가격 확인 필요";
/** 🟢 글자를 지어내지 않았다 — `priceStatusText`(GeminiTransientCandidates:137)의 기존 어휘다. */
export const CANDIDATE_PRICE_UNVERIFIED = "판매처 표시가 · 상세 검증 전";
```

🔴 `priceState` 안에서 `priceStatus` 를 **직접 비교하지 않는다** — 그러면 `isPriceConfirmed` 와
같은 규칙이 **두 벌** 이 되어 갈라진다. 🟢 owner 는 `isPriceConfirmed` **하나** 다.

#### U5 계약 — 산술로 잠근다

```
① P1 + P2 + P3 == querySelectorAll('mi-candidate-row').length   ← 🔴 어느 행도 사라지지 않는다
② data-price-state 가 셋 중 하나 · 빈 값 0건
③ P3 가격 칸 textContent === "가격 확인 필요"
④ P1 행에 mi-candidate-price-unverified 가 **없다**
⑤ P2 행에 mi-candidate-price-unverified 가 **있다**   ← 🔴 P2 를 P1 처럼 취급하지 않는다
⑥ 카드 안에 ₩ · 약 · ≈ **0건**(`wu-056r1` 환산 금지)
⑦ 🔴 후보 카드 DOM 에 "가격 미확인" **0건** — 그 글자는 다른 화면의 것이고
   `mi-022:167` · `wu-028:195` 가 잠근다(그 둘은 이번 WU 의 5개 계약 **밖** 이다)
```

🟢 **「가격 없는 행 제거 금지」는 구조적으로 이미 보장된다** — `selectCandidateList`(:263~307)가
거르는 축은 `market` · 중복 URL · `tier` **셋뿐이고 가격을 한 번도 보지 않는다.** ⟹ 선택기를
건드릴 이유가 **0** 이다.

🔴 변경 금지 — `priceText()` · `PRICE_UNKNOWN_TEXT` · 가격 집계 · price eligibility · 환산 · 가격 정렬.
🔴 **P2 를 숨기는 안(⒞)은 CPO 가 제외했다** — WU-111 실측으로 반증됐다(숨기면 Human SAME 인
`EUR 40` 이 사라져 **그 통화 축이 통째로 없어진다** · 순손실).

---

## 2. 🔴 판단 근거 — **새 문장을 만들지 않는다**(CPO 승인된 정정안)

```
✓ 줄  `row.matchReasons` 를 **그대로** 쓴다(운영이 만든 문장 · 현재 slice(0,3))
△ 줄  **blocker 가 실재할 때만** `blocker-text.ts` 의 사람 문장을 쓴다(WU-133 이 만든 owner)
🔴 없는 evidence 로 줄을 만들지 않는다 · 🔴 corePoints·threshold·score·enum 노출 0
```

🔴 이유 — 「무엇이 충족이고 무엇이 미확인인가」를 CTO 가 가르면 그것이 **판정 어휘 생성** 이고
계약 `wu-130 F-4`(그 영역에 판정/집계 어휘 금지)에 걸린다.

---

## 3. 🔴 이번 WU 에서 **빼기로 확정된 것 5건**

```
① 판단 근거 ✓/△ 재작성      → §2 로 축소(기존 문장만 쓴다)
② 국가 표시                  → 🔴 `market` 은 KR/OVERSEAS/UNKNOWN 이고 국가가 아니다
                               ⟹ **통화만**(`priceCurrency`)
③ 국내가격↓후보 영역 «연결»  → 🔴 영역 순서/위치는 WU-140·141-R3 가 확정한 가격 owner
                               배치다 ⟹ **후보 섹션 «안» 의 계층만** 고친다
④ [다시 분석] 우선순위 낮추기 → 🔴 자동 로드가 없는 지금 그 버튼이 **후보로 가는 유일한
                               입구** 다. 낮추면 셀러가 후보를 영영 못 본다 ⟹ 건드리지 않는다
⑤ 「후보 6곳」 단일 숫자      → 🔴 후보 수는 **시장별(🇰🇷/🌎)** 로 센다. 합치면 집계 변경이다
                               ⟹ 현재 구조 유지, 그 블록 «안» 에서 또렷하게
```

---

## 4. 🔴 상품별 분모 — **합계 사용 금지**

```
AW26MS185 (PRODUCT-05)   고유 6 · 공급 6 · **도달 3**
B226AC009 (PRODUCT-02)   고유 21 · 공급 21 · **도달 14**   ← CEO 검증은 이쪽
🔴 **33 은 8상품 합계** 다 — 개별 상품 화면에 절대 쓰지 않는다
```

---

## 5. 테스트 — 갱신될 계약

🔴🔴 **계약은 «5개» 다**(2026-11-01 정정) — 4개로 두면 `CANDIDATE_LIST_HEADING` 을 `Record` 로
바꾸는 순간 **하나가 조용히 무력화된다.** 🔴 이름이 겹치는 파일이 둘 있으니 **경로로** 고른다.

```
① apps/admin/src/app/pipeline/commerce/__tests__/ccl-01-cap-and-label.test.ts
     라벨 3종 글자 + 부정 단언(POSSIBLE 에 「동일상품」·「유사상품」 금지) — 🔴 라벨은 안 바뀐다
② apps/admin/src/app/pipeline/commerce/__tests__/pp-01-possible-conflict.test.ts
     PP-09 가 화면 글자를 단언한다
     🔴 pp-01-conditional-price.test.ts(api/price-history/_lib)는 **다른 계약** 이다 — 건드리지 않는다
③ apps/admin/src/app/pipeline/commerce/__tests__/cand-01-evidence-visibility.test.ts
     군 분류(글자 무관 · 손댈 필요 낮음)
④ apps/admin/src/app/api/price-history/_lib/__tests__/wu-132-mi-same-price-comparison.test.ts
     마운트 DOM 축
     🔴 wu-132-probe.test.ts 는 **다른 계약** 이다 — 건드리지 않는다
⑤ apps/admin/src/app/pipeline/commerce/__tests__/cand-02-candidate-display.test.ts  ← 🔴 **반드시 추가**
mi-022 · wu-028                 🔴 **접힘 · "가격 미확인"** — 바꾸지 않으므로 그대로 통과해야 한다
```

#### 🔴 F1 — `cand-02` 를 빼면 가드가 «동어반복» 이 된다

`cand-02:13·346` 이 **값을 import** 해서 쓴다 — `not.toContain(CANDIDATE_LIST_HEADING)`.
🔴 `Record` 로 바꾸면 `not.toContain(객체)` 가 되어 **항상 통과** 한다(보호가 죽는다 · typecheck 가 먼저 막는다).

```diff
-    expect(doc.body.textContent ?? "").not.toContain(CANDIDATE_LIST_HEADING);
+    expect(doc.body.textContent ?? "").not.toContain(CANDIDATE_LIST_HEADING.KR);
+    expect(doc.body.textContent ?? "").not.toContain(CANDIDATE_LIST_HEADING.OVERSEAS);
```
🟢 목적은 약화가 아니라 **두 시장 글자를 각각 보호하는 강화** 다.
🟡 `MI_PRESUMED_HEADING`(:483)이 현재 `CANDIDATE_LIST_HEADING` 과 **글자가 같다** ⟹ U1 이 값을
바꾸면 이 단언의 의미가 달라진다. **여전히 의도한 것을 재는지 확인** 하고, 🔴 그 상수 자체는 건드리지 않는다.

#### 🔴 F2 — `CANDIDATE_LIST_EMPTY` 는 «소스 텍스트 앵커» 다

`core-e2e-close-03-presumed-area.test.ts:232` 가 `SRC.indexOf("CANDIDATE_LIST_EMPTY", i)` 로
구간을 자른다. 🟢 **식별자 이름을 유지하면**(`CANDIDATE_LIST_EMPTY[market]`) 앵커가 산다.
🔴 이름을 바꾸거나 그 줄을 리스트 블록 **앞으로 옮기면** `expected +0 to be 1` 같은 모호한 FAIL 이
난다 — 구역이 사라진 것이 아니라 **slice 경계가 깨진 것** 이다.

🔴 **기존 보호 계약을 이유 없이 완화하지 않는다.** 글자가 바뀌면 **계약의 기대 글자를 갱신**
하되, 금지(「동일상품」·「유사상품」·내부 enum)는 **유지하거나 강화** 한다.

### 반드시 확인할 축

```
SAME → 🟢 · PRESUMED_SAME → 🟡 · 품번충돌 → 🟡 품번 충돌 · 참고 · SIMILAR → **미노출**
이미지 있음/없음 · 🔴 **가격 3상태(P1/P2/P3 · §2-A)** · 판단 근거 · 상품별 denominator ·
🔴 국내 칸에 「해외」가 뜨지 않는다 · 🔴 CandidateSelect 보존 ·
🔴 다른 상품 후보가 섞이지 않는다 · 🔴 접힘 정책 불변
```

🔴 **FAIL 기준 넷** — ⒜ 국내 칸에 「해외 소싱 후보」 ⒝ 후보 수 ≠ `mi-candidate-row` 개수
⒞ `CandidateSelect` 소실 ⒟ P2 가 P1 과 **똑같이** 보인다(상태 줄 없음).

---

## 6. 실행 순서 (다음 세션 · 조사 0)

```
① mi-same-candidates.ts  — U1·U2·U6·U7 상수 + `priceState` 어댑터(§2-A)
② MarketPriceComparison.tsx — `market` prop + U3·U4·U5 (후보 리스트 블록 내부만)
③ 계약 **5개** 갱신(위 §5 · 🔴 `cand-02` 포함) → ④ 전체 회귀 → ⑤ typecheck → ⑥ build
⑦ commit/push(=배포) → ⑧ 실제 DOM 2상품 — B226AC009(후보 많음) · AW26MS185(후보 적음)
🔴 ⑧ 은 **국내 칸·해외 칸을 둘 다** 본다(market prop 이 이번에 생겼기 때문이다).
🔴 그 밖으로 확장하지 않는다. Identity 로 되돌아가지 않는다.
🔴 어느 단계든 FAIL 이면 **성공 보고하지 않는다.** 테스트를 약화해 PASS 시키지 않는다.
```

🔴 **CEO 확인 경로** — 상품 열기 → 「🔄 다시 분석」 → 📊 시장 판매 판단 →
**「▸ 해외 소싱 후보 N곳」 줄 클릭**(🔴 접힘은 이번에도 유지된다).

---

## 7. 착수 전 좌표

```
직전 코드 커밋  2c16152c · clean · 0/0 · 배포 완료
          🔴 이 자리에 HEAD 해시를 적지 않는다 — docs 커밋마다 낡는다(두 번 났다)
CPO 확정   U1/U7 **시장별 Record** · U5 **3상태 ⒜**(§2-A) · 계약 **5개**(cand-02 포함)
직전 WU   IDENTITY-CANDIDATE-VISUAL-REVIEW-01 — SIMILAR 후보군 제외 + 「🟡 품번 충돌 · 참고」
이번 WU   순수 UI 7건 · 운영 파일 **2개 예상**(상수 + 컴포넌트)
다음 WU   자동 분석 + 결과 재사용 + [다시 분석] 제거
          🔴 그것은 **후보 보관 정책**(§12-0 「외부 URL 영구 저장 ❌」 · WU-119 STOP)을
             CPO 가 먼저 풀어야 열린다 — UI WU 가 아니다
```
