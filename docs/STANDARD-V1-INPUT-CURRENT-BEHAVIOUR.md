# 📋 표준안 v1 입력 — **현재 코드가 실제로 하는 일**(CTO 제출 · 2026-11-04)

> 🔴🔴 **이 문서는 표준안이 아니다.** CPO 가
> 「새 이상적 설계를 먼저 만들고 기존 시스템을 억지로 끼워 맞추지 않는다」고 했으므로,
> **표준안의 입력**으로 «지금 코드가 그렇게 동작한다는 사실»만 적는다.
> 🔴 **정책 제안 0 · 구현 0 · 권고 0.** 판단은 CPO 가 한다.
>
> 🔴 모든 줄은 **운영 코드 또는 이 트랙의 실측**에서 왔고 좌표를 같이 적었다.
> 🔴 분모가 다른 숫자를 섞지 않았다 — 라이브 25쌍(SAME 17·DIFF 8) ↔ 저장 GT 33쌍(SAME 18·DIFF 9).
> 🔴 **어느 숫자도 Identity 시스템 전체 성능이 아니다.**

---

## 0. 🔴🔴🔴 먼저 — **축 어휘가 «둘» 이고 서로 다른 집합이다**

표준안이 가장 먼저 닫아야 할 것이 이것이다. 같은 이름이 두 층에서 다른 뜻으로 쓰인다.

```
① Evidence 층(관측 · product-facts.ts:682·697)
   IDENTITY_EVIDENCE_AXES = BRAND · MODEL_CODE · PRODUCT_NAME · FORM · COLOR · MATERIAL
   PROBE_EVIDENCE_AXES    = FIT · COMPOSITION · SET · OPTION_SKU · IMAGE
   🔴 PROBE 는 「추출 가능성만 재고 **판정에 넣지 않는다**」가 계약이다

② Matcher 층(판정 · cross-seller.ts:642 CrossSellerAxis)
   TITLE · MODEL_CODE · CATEGORY · COLOR · MATERIAL · FIT · AUDIENCE · SIZE · IMAGE
```

🔴🔴 **그래서 `FIT` 과 `IMAGE` 는 한 층에서 「판정 금지」이고 다른 층에서 「판정 축」이다.**
🟢 코드상 모순은 **아니다** — 두 층의 입력이 다른 칸이다(`evidence.FIT` ↔ `facts.fitText`).
🔴 그러나 **같은 이름이 반대 의미**라서, 표준안이 그 둘을 다른 말로 부르지 않으면
   다음 사람이 「FIT 은 판정에 안 쓴다」를 읽고 matcher 의 FIT blocker 를 보지 못한다.
🔴 `PRODUCT_NAME`·`FORM` 은 Evidence 층에만 있고 matcher 에는 `TITLE`·`GARMENT_FORM` 으로 있다.

---

## 1. Evidence 속성별 — CPO 의 **여섯 질문**을 코드로 채운 표

🔴 「Identity 사용」은 **matcher 층** 기준이다(Evidence 층 분류가 아니다).

| 속성 | 출처(운영 코드) | 원본/정규화 보존 | Identity 사용 | 단독 판단 | 누락 ↔ 불일치 | 사람 판단 정합(실측) |
|---|---|---|---|---|---|---|
| **BRAND** | Shopify `by절 ∩ vendor` → 검증된 `vendor` → 공식몰 도메인 표(**1항목**) → `siteBrandName`(7-5) · HTML `og:brand`/`product:brand`/JSON-LD `brand.name` · 제목 등록부 alias · 설명문 `brand:` 라벨 | 🟢 원본 보존 · 정규화는 `resolveBrandName` | 🟢 O (`brandOk` 게이트) | 🔴 X — 점수 축이 아니라 **게이트** | 🟢 **분리됨** `BRAND_UNCONFIRMED`(모름) ↔ `BRAND_MISMATCH`(읽었고 달랐다) | 🔴 **누락 4건이 human SAME**(C11·C14·C37·C48) · 7-5 가 2건 회수 |
| **MODEL_CODE** | 설명문 라벨 → URL slug → 제목 → 상세 복구(`recoverModelCodeFromDetail`) | 🟢 원본 보존 | 🟢 O (**3점** · 최대) | 🔴 X — `crossSellerReserved` 가 막는다 | 🟡 `MODEL_CODE_AGE_LINE`(읽었고 달랐다 · AC↔AB) ↔ 공백은 축 부재 | 🟢 **반증 방향 2/2 정확** · 🔴 **긍정 방향 2/4**(같은 품번 다른 색상 · n=6) |
| **TITLE** (=PRODUCT_NAME) | `coreTitleTokens`(브랜드·색상·소재 토큰 제거 후) | 🟢 원본 보존 | 🟢 O (2점/1점 · **1점은 SAME 정원에서 제외**) | 🔴 X | 🟢 `NO_TITLE_OVERLAP` = **관측된 차이** | 🔴 한국어·에스토니아어·독일어 제목에서 **축이 죽는다**(C27·S2-1·S3-1) · 🟢 그 축 단독은 A군 18/18 DIFFERENT |
| **COLOR** | 설명문 선두 색상구 → 라벨형 → **제목 화이트리스트** | 🟢 원본 보존(`colorText`) | 🟢 O (1점 + `COLOR_VARIANT` **보류**) | 🔴 X | 🟡 `COLOR_VARIANT` 는 **관측된 차이 집합에 없다**(cross-seller:153) | 🟢🟢 **사람이 그 축으로 4/4 일관하게 갈랐다**(Grey Melange SAME · Graystone/Conker Stripe DIFFERENT) · 🔴 **패턴이 이 칸으로 섞여 들어온다**(`Conker Stripe` → C19 미발화) |
| **MATERIAL** | **설명문 전용**(`parseMaterialComposition` 통과 시) | 🟢 원본 보존 | 🟢 O (1점 + `MATERIAL` blocker) | 🔴 X | 🟢 blocker = 관측된 차이 | 🔴 **같은 브랜드·같은 제목 후보를 떨어뜨린 실례**(B226AC033 junioredition GBP 58 · 보류 `[MATERIAL]` 하나) · TITLE 유래 **0%** |
| **FIT** | 설명문 `FIT_PHRASES` **8개**(true to size/oversize(d)/loose/relaxed/regular/slim) | 🟢 원본 보존 · 🟢 비교에서만 canonical(`oversize→oversized`) · 🔵 7-6 이 **기록 문장** 추가 | 🟡 **Evidence 층 PROBE(판정 금지)인데 matcher 는 축+blocker 로 쓴다** | 🔴 X | 🟢 blocker = 관측된 차이 | 🔴 `relaxed ↔ loose` 가 human SAME 1건을 막는다(S1-4) · 🔴 무조건 정규화는 **R1 가드 2건 + 기준선 13파일**을 연다(측정됨) |
| **GARMENT_FORM** (=FORM) | 제목·설명문 형태 어휘 | 🟢 | 🟢 O (blocker) | 🔴 X | 🟢 blocker = 관측된 차이 | 🔴 **양쪽 전건 `SHIRT`** ⟹ 식별력 **0** · 소매 길이를 **보지 않는다** |
| **AUDIENCE / SIZE** | Shopify tags·type · 사이즈 라벨 | 🟢 | 🟢 O (각 1점 · `AUDIENCE_LINE`·`SIZE_SYSTEM`) | 🔴 X | 🟢 | 🟡 미측정 |
| **IMAGE** | `imageUrls` · dHash(`classifyImageEvidence`) | 🟢 | 🔴 **SAME 정원에서 제외**(corePoints 필터) | 🔴 X | 🟡 | 🟡 미측정 |
| **COMPOSITION / SET / OPTION_SKU** | 설명문 | 🟢 | 🔴 **PROBE — 판정 입력 0**(계약) | — | — | 🟡 미측정 |
| **PATTERN / DESIGN / 캐릭터명** | 🔴 **칸이 없다** | — | — | — | — | 🔴 **측정불가**(0% 아님) · 값은 COLOR 칸으로 섞여 들어온다 |
| **Style Code / Manufacturer Code / 컬렉션 / 시즌** | 🔴 **칸이 없다** | — | — | — | — | 🔴 **측정불가** |

### 🔴 Evidence 층의 불변식(계약으로 잠겨 있다)
```
EvidenceItem   { value, source }  — 🔴 「추정해서 채우지 않는다 · 없으면 항목 자체가 없다」
source 구분     TITLE / DESCRIPTION / … — 🔴 같은 값이라도 출처를 뭉개지 않는다
P2             attachProductEvidence 는 **관측 전용** — verdict·tier·가격 **불변**
               🟢 7-5 는 이 경계를 지나지 않았다(추출 시점에서 `siteBrandName` 공급)
```

---

## 2. Identity 표준 — 현재 **판정식 그대로**

```
verdict = (cross-seller.ts:1335~)
  !blocked && brandOk && corePoints >= SAME_MIN_AXES(5)        → SAME
  totalPoints >= PRESUMED_SAME_MIN_AXES(3) && !sameSellerWithoutIdentity → PRESUMED_SAME
  totalPoints >= 1                                             → SIMILAR
  else                                                          → UNKNOWN

corePoints = totalPoints − IMAGE − (TITLE 1점)      (cross-seller.ts:1281)
🟢 blockers 가 비면 brandOk 는 참이다 — `!brandKnown → BRAND_UNCONFIRMED` ·
   `brandKnown && !brandOk → BRAND_MISMATCH` 가 **둘 다 blocker** 다(:844)
⟹ 🔴 SAME 을 막는 것은 **①blocker ②corePoints<5** 둘뿐이다
```

**관측된 차이 ↔ 모름의 분류표**(`OBSERVED_DIFFERENCE_BLOCKERS` · cross-seller.ts:153)
```
관측된 차이 9  MATERIAL · FIT · SIZE_SYSTEM · GARMENT_FORM · BRAND_MISMATCH ·
               AUDIENCE_LINE · NO_TITLE_OVERLAP · SAME_SELLER_DISTINCT_LISTING ·
               MODEL_CODE_AGE_LINE
🔴 집합 밖     BRAND_UNCONFIRMED(모름) · **COLOR_VARIANT**(색조 일치 + 색상명 불일치)
```

**tier 매핑**(`priceTierFromLink`)
```
EXACT_IDENTIFIER | STRONG_IDENTIFIER → EXACT
TEXT_CONFIRMED                       → COMPARISON
SIMILAR                              → REFERENCE
CONFLICT | INSUFFICIENT_EVIDENCE     → EXCLUDED
🔴 crossSellerReserved(= PRESUMED_SAME)가 식별자 경로를 막는다 ⟹ PRESUMED_SAME 은
   **COMPARISON 상한** 이다 — 그것이 「추정은 확정 가격이 못 된다」의 구현이다
```

**현재 표본의 두 축 성능**(🔴 라이브 25쌍 · 시스템 전체 아님)
```
                verdict 축(SAME 확정)   금액 자격 축(EXACT|COMPARISON)
사람 SAME 17          8/17 (7-5 뒤)            13/17
사람 DIFFERENT 8      0/8                      🔴 4/8 → **7-2 뒤 2/8**
```
🔴 FN(사람 SAME · SAME 미확정)을 막는 것 넷 — 브랜드 공백 4 · 증거 부족 5(corePoints 0~2) ·
   FIT 어휘 2 · AC↔AB 2. 🟢 그중 **브랜드 공백 2건은 7-5 가 회수** 했다.

---

## 3. Price 표준 — 현재 **자격 사슬 그대로**

```
금액 집계(byCurrency) 진입 조건 — 넷을 «전부» 통과해야 한다
 ① tier ≠ EXCLUDED                                   (WU-062)
 ② verdict ∈ {SAME, PRESUMED_SAME}                   (SPRINT 3 P1)
 ③ 금액이 있고 유한하다
 ④ priceStatus 가 **UNVERIFIED_SEARCH 가 아니다**     (STAGE 7-1 · 🔴 `null` 은 통과)
 ⑤ blockers 에 **PRICE_DISQUALIFYING 셋이 없다**      (STAGE 7-2)
    BRAND_MISMATCH · NO_TITLE_OVERLAP · SAME_SELLER_DISTINCT_LISTING
🟢 관측은 지우지 않는다 — count · byMarket · byPriceTier 는 **전건을 센다**
🟢 빠진 수를 화면이 말한다 — unverifiedCount · observedDifferenceCount
```
```
시장 귀속   classifyCandidateMarket — **증거 둘의 교차**(도메인 × 통화) · 충돌·부족은 UNKNOWN
환산        🔴 **금지** — 통화별로만 집계 · 합계 칸이 **없다**
국내 축     market==="KR" && priceKrw && tier ∈ {EXACT, COMPARISON}  ⟹ **판정 입력이다**
해외 축     push 뒤 continue ⟹ 판정에 닿지 않는다
권장 판매가격 🔴 **계산하지 않는다**(원가·수수료 축 · §00-B 보류) — 화면 문구도 0
```

---

## 4. Seller UX 표준 — 현재 **문구 owner 그대로**

```
가격 블록이 서지 않는 조건  lines.length === 0 → null  🟢 CPO 가 **유지로 확정**
그때의 문구                MARKET_EMPTY_NO_COMPARABLE_PRICE (STAGE 7-3 · 글자 고정)
빠진 이유 두 줄            「N곳은 **가격을 확인하지 못해** …」(7-1)
                           「N곳은 **상품 차이가 확인돼** …」(7-2)
후보 노출                  🟢 축소 0 — 개별 줄이 「가격 확인 필요」/「가격 미확인」을 말한다
어휘 owner                 TIER_LABEL — EXACT/CONFIRMED 「동일상품」 · COMPARISON 「동일상품 추정」 ·
                           REFERENCE 「유사상품 · 참고」 · EXCLUDED 「동일상품 아님」
🔴 금지 어휘               「시장 평균」(부정문만) · 「₩」 환산 · 내부 토큰 노출
```

---

## 5. 🔵 표준안이 **닫아야 할 미확정** — 전부 측정은 끝났고 판단만 남았다

| # | 미확정 | 측정된 사실 | 여는 비용 |
|---|---|---|---|
| ① | 축 어휘 둘(`FIT`·`IMAGE` 가 층마다 반대 의미) | 코드 좌표 §0 | 🟢 이름 정리(동작 0) |
| ② | `COLOR_VARIANT` 가 「관측된 차이」가 아니다 | 사람이 그 축으로 **4/4 일관** 하게 갈랐다 · C25 는 그래서 금액에 남는다 | 🔴 Identity 분류표 변경 |
| ③ | PATTERN 이 COLOR 칸으로 들어온다 | `Conker Stripe` → C19 에서 `COLOR_VARIANT` **미발화** | 🟡 추출 칸 신설(판정 0 이면 안전) |
| ④ | `relaxed ↔ loose` 무조건 정규화 | SAME **6/18 → 7/18** · FP 1 유지 · 누출 0 · 🔴 **R1 가드 2건 + 기준선 13파일** | 🔴 CEO 승인 가드 개방 |
| ⑤ | `MATERIAL` 이 같은 브랜드·제목을 떨어뜨린다 | B226AC033 GBP 58(보류 `[MATERIAL]` 하나) | 🔴 소재 정규화 = 새 규칙 |
| ⑥ | AC↔AB 라인 | CEO 라벨 **SAME 4/4** ↔ WU-069/070 「품번 보호 해체」 | 🔴 CPO 현행 유지 결정됨 |
| ⑦ | 소매 길이 | 원문 정합 **5/6** · 🔴 반증 1(kids21 Short sleeves → human SAME) · **얻는 것 0** | 🔴 CPO 보류 결정됨 |
| ⑧ | 칸이 없어 **측정불가** | Style/Manufacturer Code · 컬렉션 · 시즌 · 캐릭터명 · 패턴명 · 디자인명 | 🟡 추출 칸 신설 |
| ⑨ | 원상품측 브랜드 공백 | C48·C14 — 🔴 **측정불가**(하니스 origin facts 에 evidence 가 없다) | 🟡 라이브 원상품 재추출 측정 |

🔴 **「0 으로 세지 않는다」가 적용되는 칸** — ⑧ ⑨ 는 **측정불가** 이고 실패 0 이 아니다.

---

## 6. 🔴 이 문서의 한계

```
⒜ 숫자의 분모는 **표본** 이다 — 라이브 25쌍 · 저장 GT 33쌍 · 운영 스냅샷 4상품.
   🔴 Identity 시스템 전체 성능이 아니고 전수도 아니다.
⒝ `AUDIENCE`·`SIZE`·`IMAGE`·`COMPOSITION`·`SET`·`OPTION_SKU` 의 **사람 판단 정합은 미측정** 이다.
⒞ Search 표준(①)은 이 문서에 **없다** — 국내 공급·AI 경로는 별 트랙이고 그 좌표는
   `docs/START-HERE.md` 와 §12 에 있다.
⒟ 🔴 **실제 화면은 CTO 가 볼 수 없다** ⟹ §4 는 **문구 owner** 이고 렌더 확인이 아니다.
```
