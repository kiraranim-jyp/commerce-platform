# 국내 후보 `facts` 생성 경로 원인 규명 WU

> 🟢 **종료.** 판정 — **E. 정상** · **코드 수정 필요: NO**.
> 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · 검색어 0 · Registry 0 · DB 0.
> 🔴🔴 **A/B/C/D 전부 해당 없음.** 후보 facts 는 **17/17 · 6/6 전부 생성·주입되고**
> `crossSellerVerdict` 도 **전건 생성된다.** 열두째 WU 의 「판정에 도달조차 못 했다」가
> 틀렸음이 **실측으로 확정됐다.**

---

## 1. 🟢 CPO 지시대로 「타입 → 생성 owner → 운영 호출부」 순서로 먼저 확인했다

```
① 타입  ComparisonCandidate (types.ts:4)
          facts?: ProductFacts                                    :81
          crossSellerVerdict?: SAME|PRESUMED_SAME|SIMILAR|UNKNOWN|CONFLICT  :85
          crossSellerReasons?: string[]                            :87
          crossSellerBlockers?: {blocker}[]                        :95
          crossSellerConflicts?: {conflict}[]                      :109
        🔴 `match` 칸은 **없다**(열셋째 WU 에서 확정)
② 생성  각 샵 **어댑터가 직접** 만든다 — productFactsFromListing(...)
          looxloo:181 · foretforet:369 · deuxbebe:192 · rulii:210 ·
          littleluna:112 · chocoel:133 · childrensalon:77
③ 주입  withConfidence(match.ts:509-518)가 facts: candidateFacts 로 다시 싣고
        :524-538 이 cross 를 네 칸으로 펼친다
```

---

## 2. 종료 조건 표 (CPO §형식 · 실상품 2건 · 실제 운영 검색)

| 단계 | candidate | facts | 핵심 필드 | 상태 |
|---|---|---|---|---|
| ① 검색 결과 | 🟢 6 / 17 | — | — | 정상 |
| ② candidate 생성 | 🟢 6 / 17 | — | — | 정상(어댑터) |
| ③ **facts 생성** | 🟢 6 / 17 | 🟢 **6/6 · 17/17** | `facts` 15칸 · `brand` 🟢 · `coreTitleTokens` 🟢 | **정상** |
| ④ **facts 주입** | 🟢 6 / 17 | 🟢 **6/6 · 17/17** | 유지됨 | **정상** |
| ⑤ **crossSellerVerdict** | 🟢 6 / 17 | — | 🟢 **6/6 · 17/17 생성** | **정상** |

### verdict 실측 분포

```
Boo Bo Choses T-shirt (후보 6)   SIMILAR 1 · UNKNOWN 4 · CONFLICT 1
Astrid Organic Jacket (후보 17)  SIMILAR 3 · CONFLICT 3 · UNKNOWN 11
🟢 전건 verdict 가 «있다» — SAME/PRESUMED_SAME 이 없을 뿐이다
```

---

## 3. 🔴🔴 열두째 WU 보고를 정정한다 (두 번째 정정)

```
❌ 열두째 WU: 「axes 전건 비어 있다 → Cross-Seller 판정에 도달조차 못 했다」
🟢 실측: crossSellerVerdict 가 **6/6 · 17/17 전건 생성된다.**
   판정은 **처음부터 정상으로 돌고 있었다.**
🔴 원인: 내가 `c.match` 를 읽었다. 그 칸은 **없다.**
```

🔴 **그리고 열셋째 WU 의 추론도 틀렸다** — 「운영에서 판정이 안 도는 이유는 국내
후보 쪽 facts 가 비어서다」라고 적었는데, 후보 facts 는 **전건 있었다**(15칸).
🟢 이 WU 가 그 추론을 **반증했다.**

---

## 4. 🟢 그러면 `SAME` 이 안 나오는 실제 이유 — 축이 모자란다

후보 facts 의 상태(실측):

```
facts 15칸 · brand 🟢 ("BOBO CHOSES" · "Misha & Puff" · "BLUEDOG baby")
🔴 brandModelCode  **null** (전건) — 주입 후에도 null
🔴 colorText       **null** (전건)
🟢 coreTitleTokens [4~5] 있음
```

🔴 `brandModelCode` 가 null 인 이유는 **설명이 있다**(match.ts:493-508 주석) —
`confirmBrandCodeInTitle` 은 「원본 품번 문자열이 후보 제목에 **토큰으로 그대로**
있을 때만」 채운다. 🟢 **값을 지어내지 않는다.**
→ 국내 샵 제목이 `76A7D-320-01`(자체 품번)이라 `B226AC002` 가 없다 → null 이 **맞다.**

🟢 `cross-seller.ts` 의 `SAME_MIN_AXES = 5` 를 채우려면 품번·색상 축이 필요하고,
국내 샵 목록 페이지에는 **그 정보가 없다.** → `UNKNOWN`/`SIMILAR` 가 **정상 산출**이다.

🟢 선행 메모 `domestic-discovery-dies-at-low-not-at-search`(「품번 축이 양쪽 다
null · littleluna 만 상품명에 품번을 적는다」)와 **정확히 정합한다.**

🟢 그리고 열둘째 WU 의 **「후보가 정말 다른 상품이다」 결론은 유효하다** —
CONFLICT 4건 · UNKNOWN 15건이 그것을 뒷받침한다.

---

## 5. 결론 — **E. 정상**

```
A 후보 facts 생성 실패    🟢 **해당 없음** — 6/6 · 17/17 생성됨
B 후보 facts 주입 실패    🟢 **해당 없음** — 전건 유지됨
C 전달 중 소실            🟢 **해당 없음**
D withConfidence 조건 문제 🟢 **해당 없음** — 조건을 통과해 verdict 가 전건 나온다
E 정상 — 다른 원인        🟢 **이것이다**
```

### 🟢 다른 원인 = **국내 샵 «목록 페이지» 에 품번·색상이 없다**

🔴 그래서 축이 `SAME_MIN_AXES=5` 에 닿지 못한다. 🟢 이것은 **설계된 동작**이다 —
값을 지어내지 않고, 모르면 `UNKNOWN` 을 낸다.

### 코드 수정 필요 여부 — **NO**

```
🟢 facts 생성·주입·판정 네 단계 전부 정상이다. 고칠 owner 가 없다.
🔴 남는 선택지는 「국내 후보의 상세 페이지를 열어 품번·색상을 더 읽을 것인가」이고
   그것은 **비용(요청 수) × 정확도** 교환이라 CPO 정책 결정이다.
   🟢 참고: `fetchDomesticModelCode` / `MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2` 라는
      기존 장치가 이미 있다(선행 WU 확정) — 신규 개발이 아니다.
```

---

## 6. Known Unknowns

```
🔴 sample N=2 상품 / 후보 23개. 🔴 후보를 낸 샵은 LOOXLOO·포레포레 둘뿐. 일반화 금지
🔴 CONFLICT 4건의 blocker 내용을 이 WU 에서 펼쳐 보지 않았다(개수만 셌다)
🔴 BRAND_MISMATCH detail 「AW26 ↔ AW26」 의 원인은 여전히 미조사
🔴 `fetchDomesticModelCode` 를 이 경로에서 돌리면 품번이 채워지는지 **미측정**
   (운영 저장경로에는 그 단계가 있다 — 이 하니스는 거기까지 가지 않았다)
🔴 `matchTruth` 가 undefined 다 — 그 칸은 저장경로(judgeDomesticCandidate)에서
   채워진다. 이 하니스 범위가 아니다
🔴 colorText 가 null 인 것이 「목록에 색상이 없다」인지 「파서가 안 읽는다」인지
   구분하지 않았다 — 어댑터별 확인이 필요하다
```
