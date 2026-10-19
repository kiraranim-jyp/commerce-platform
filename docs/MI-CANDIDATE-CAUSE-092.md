# WU-092 — 후보 미탐색 원인 분리 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「먼저 **왜 못 찾는지** 를 확정한다. UI 를 또 고치지 않는다.
> **A(discovery) / B(extraction) / C(matching) 를 절대 한 문장으로 보고하지 않는다.**」
> 8축 ❌ · matchLevel ❌ · threshold ❌ · 가격 게이트 ❌ · AI ❌ · Registry ❌ ·
> 가격 계산 ❌ · 후보 판정 기준 ❌

---

# WU-092 FINAL

## 0. 결론 — 🔴🔴 **두 샘플은 «서로 다른» 문제다**

```
S1 biskuit B226AC009   → **C(matching)** — 동일상품 후보가 «실제로 왔는데» 축이 2/5 다
S2 bobochoses B226AC042 → **A(coverage)** — 등록부 샵이 그 상품을 «팔지 않는다»
```
🔴 **「동일상품을 못 찾음」이라는 한 문장으로 적으면 둘 다 틀린다.**

## 1. STEP 2 — 🟢 **URL 정규화 문제가 «아니다»** (CPO 가설 확인)

운영 `factsFromProductUrl` 로 **쿼리 있는 URL ↔ 쿼리 제거 URL** 을 각각 돌렸다.

| | status | shape | brand | code | price | path |
|---|---|---|---|---|---|---|
| S1 쿼리 O/X | OK / OK | PRODUCT_PAGE | **비스킷** | **null** | ₩88,000 | PLAIN_HTML |
| S2 쿼리 O/X | OK / OK | PRODUCT_PAGE | Bobo Choses | **B226AC042** | **null** | SHOPIFY_JSON |

🟢 **두 경로 결과가 완전히 동일** ⟹ `?pr_prod_strat=…` 는 **문제가 아니다**(CPO 판단 확인).
🔴 그리고 **CPO 가 옳았다** — 두 URL 모두 운영이 **정상 상품 페이지로 연다**.

🔴 **그런데 S2 의 `price` 가 null 이다** — CEO 는 페이지에서 ₩162,000 을 봤다.
원인은 `fetchPath = SHOPIFY_JSON` 이고, 그 경로는 **HTML 을 받지 않아 JSON-LD 가격을
영구히 못 본다**(WU-079 가 「보류 보관」으로 기록한 바로 그 자리).

## 2. 🔴🔴 하니스 결함을 하나 잡았다 — **그대로 보고했으면 거짓 결론이었다**

```
1차: SHOPS 를 {id,name,domain} 만으로 만들고 `as never` 로 타입을 **가렸다**
  → `DomesticSourceRef` 가 요구하는 `collectionStrategy` 가 없다
  → 운영이 요청을 **보내지 않고** `status:"unsupported"` 를 돌려준다(index.ts:251)
  → 🔴 **6/6 unsupported · 후보 0** ⟹ 「A_DISCOVERY 에서 끊긴다」로 보고할 뻔했다
🟢 운영 DB 에서 읽은 값(`currency`·`collectionStrategy`)을 넣고 `as never` 를 지우자
   후보가 **5건씩** 나왔다. 결론이 **A → C 로 뒤집혔다.**
```
🔴 헌장 §12 가 적어 둔 그 함정(「로컬에서 운영 함수를 부르면 조용히 `[]`」)의 변종이다.

## 3. 등록부 실측 (DB · 읽기만)

```
domestic_price_sources 전체 **34곳**
  biskuit.kr       🔴 **등록부에 없다**
  bobochoses.com   🟢 있다 — 🔴 **enabled = false**(WU-010 이 기록한 그 1곳)
AUTO_* + enabled   **7곳** — chocoel · deuxbebe · foretforet · littleluna · looxloo ·
                   rulii · skysport(TENNIS)
```
🔴 등록부를 **바꾸지 않았다**(CPO 금지). 운영이 지금 뒤지는 그대로 측정했다.

## 4. STEP 3 — A / B / C 전수

| | A 후보 | B facts | C 판정 | verdict | matchLevel |
|---|---:|---:|---:|---|---|
| **S1** | **5**(전부 looxloo) | **5/5** | **5/5** | SIMILAR 3 · CONFLICT 2 | 🔴 **very_high 5** |
| **S2** | **5**(전부 looxloo) | **5/5** | **5/5** | CONFLICT 1 · UNKNOWN 4 | low 5 |

🟢 **discovery 와 extraction 은 둘 다 정상이다.** 나머지 5곳은 오류 0 · 후보 0.

### 🔴 S2 는 표의 라벨과 실질이 다르다 — 정직하게 적는다
후보 5건은 **전혀 다른 상품** 이다(앞치마세트 · 턱받이 · mom&baby밴드 · 데님팬츠).
🔴 즉 **「후보가 5건 왔다」는 「동일상품 후보가 왔다」가 아니다.**
⟹ S2 의 실질은 **A(coverage)** — `looxloo` 가 B226AC042 를 **팔지 않는다**.
🔴 내 단계 판정식(`후보>0 ⟹ C`)이 거칠었고, 그 한계를 그대로 적는다.

## 5. 🔴🔴 S1 의 원인 — **counterfactual 로 내 가설이 «반증» 됐다**

1차 가설: 「원상품 brand 가 **「비스킷」**(판매처 이름)이라 `BRAND_MISMATCH` 가 막는다」
— WU-080 이 기록한 바로 그 사례이고, 이번엔 그것이 **원상품 쪽** 이라 영향이 크다.

🔴 **그래서 쟀고, 틀렸다**(운영 함수에 facts 의 brand 칸만 바꿔 입력):

| | verdict | blockers |
|---|---|---|
| 현재 (`비스킷`) | SIMILAR 3 · CONFLICT 2 | `BRAND_MISMATCH` ×5 |
| CF (`Bobo Choses`) | **완전히 동일** | **[]** |
| CF2 (`null`) | **완전히 동일** | `BRAND_UNCONFIRMED` ×3 |

```
🔴🔴 blocker 는 사라지는데 **verdict 가 하나도 안 바뀐다. SAME 0 → 0.**
⟹ **brand 는 구속 조건이 아니다.** 내 1차 설명을 폐기한다.
```

### 🟢 진짜 구속 — **축이 2/5 다**(운영 `crossSellerReasons` 를 그대로 읽음)

```
원상품(biskuit) code **null** · color **null**
후보(looxloo)   code **null** · color **null**   ← 샵 자체 SKU(76A7D-L30-05)
축 2개 = ["근거: 핵심 상품명 일부 보보쇼즈", "근거: 상품군 TOP↔TOP"]
SAME_MIN_AXES = 5  ⟹ 🔴 **3개 모자란다**
```

🔴🔴 **그리고 제목 축이 「보보쇼즈」 한 토큰뿐인 이유가 새 발견이다**:
```
원상품  「[보보쇼즈] **허그 헤어리 몬스터** 티셔츠 B226AC009 - 비스킷」
후보    「보보쇼즈 베이비 **허그헤어리몬스터**티셔츠」
🔴 사람 눈에는 같은 말인데 **띄어쓰기** 가 달라 토큰이 겹치지 않는다.
🟢 그래서 겹치는 것이 **브랜드명 하나** 다.
```
🔴 **고치지 않았다** — 한국어 띄어쓰기 정규화는 **새 매칭 규칙** 이고 CPO 가 금지한
「후보 판정 기준 변경」에 해당한다. **관측으로만** 남긴다.

### 🔴 부수 관측 — `matchLevel` 이 **very_high 5건** 이다
WU-017/088 은 「전건 low」였다. 🔴 **분모가 다르다** — 그쪽은 **AI URL 후보** 였고
이쪽은 **등록부 검색 후보** 다. 🔴🔴 즉 **WU-088 의 가격 자격 필터를 «통과하는»
모양이 실재한다.** 🔴 단 N=5 · 1상품이라 **일반화하지 않는다**.

## 6. STEP 5 — 시장조사 카테고리

WU-082 가 찾은 소비처 **셋이 전부 그대로 있다**(grep 재확인):
```
① check/route.ts:100   resolveMarketCategoryScopes → 국내 샵 scope
② comparison/search/route.ts:84                    → 해외 scope
③ market-intelligence.ts:30 resolveCategoryCostPolicy → 🔴 **가격 계산에 들어간다**
```
⟹ **A. 실제 분석 결과에 필수** — 🔴 **제거하지 않는다**. 남는 것은 **UX 개선**(자동 추정 +
수정 가능)이고 그것은 **제품 정책** 이라 CTO 가 고르지 않는다.

## 7. STEP 4 — UI 최소화 **설계안만**(구현 0)

🔴 CPO §4 대로 **설계만** 적는다. 코드 **0**.
```
🇰🇷 국내 가격 비교
🟡 동일상품 후보 없음            ← 먼저 «결과»
후보 5건 · 동일 0 · 유사 3       ← 숫자 한 줄
[후보 5건 보기 ▼]               ← 🔴 접힘 유지(WU-091 계약)

펼쳤을 때 행 = 판매처 · 상품명 · 가격 · 상품코드 · 판정 · 판정 이유 · [상품 보기]
🔴 WU-091 이 이미 이 모양이다 — 남은 것은 «위쪽 요약 한 줄» 과 **중복 제거** 다
🔴 긴 evidence 전문은 **상세 펼침에만** 남긴다(제거하지 않는다)
```

## 8~12. 검증

```
운영 코드 변경 **0** · 배포 **0** · DB **읽기만** · Registry 변경 0 · AI 0
typecheck **0**(🔴 한때 2 — `ProductFacts` 에 없는 칸을 읽으려 했고 **타입이 막았다**.
                이 트랙 19번째 같은 실수이고, 처음으로 **사전에** 잡혔다)
apps/admin **598 files / 8,354 passed** · failed **0**
HTTP 약 40 요청(read-only)
```

---

## 🔴 Known Unknowns

```
① 🔴 **「looxloo 후보가 동일상품인가」를 CTO 가 판정하지 않았다**(Human GT 는 CEO 몫).
   「보보쇼즈 허그몬스터티셔츠」는 사람 눈엔 같아 보이지만 **베이비 라인**(AB↔AC ·
   WU-069/070)일 수 있다. **라벨 없이 SAME 이라 적지 않는다**
② 🔴 S2 의 「looxloo 가 B226AC042 를 팔지 않는다」는 **검색 결과 기준** 이다 —
   샵 카탈로그를 전수로 세지 않았다(측정불가 · 0% 가 아니다)
③ 🔴 띄어쓰기 축은 **관측 1건** 이다. 전수 빈도는 **미측정**
④ 🔴 `matchLevel very_high 5` 는 **1상품 · N=5** 다. WU-017 의 3.8% 를 뒤집지 않는다
⑤ 🔴 S2 의 `price:null`(SHOPIFY_JSON 경로)은 **이 WU 에서 고치지 않았다** — WU-079 보류 항목
⑥ 🔴 나머지 5개 샵의 「후보 0」이 **미취급인지 검색 실패인지** 가르지 않았다
```

## 판정 — 🟢 **원인 확정 / 구현 0 · 다음 범위는 CPO 지정**

```
S1 → C(matching) · 구속은 **축 2/5** (품번 null × 2 · 색상 null × 2 · 제목 띄어쓰기)
S2 → A(coverage) · 등록부 샵이 그 상품을 **팔지 않는다**
🔴 둘 다 **이미 닫힌 축**(WU-063~080 · WU-017)으로 수렴한다.
🔴 단 **새 관측 둘** 이 있다 — ⒜ 한국어 **띄어쓰기** 로 제목 축이 죽는다
   ⒝ 등록부 검색 후보에는 **matchLevel very_high 가 실재한다**(AI URL 경로와 분모가 다르다)
```

## CEO Action — **없음**
