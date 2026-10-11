# 국내 SAME Coverage 사업가치 검증 WU — 실행 상태 (진행 중)

> 🔴 **이 WU 는 끝나지 않았다.** CPO 가 정한 종료조건 ①~⑧ 중 일부만 완료됐다.
> 🔴 다음 실행은 **새 WU 를 만들지 않고 이 문서의 「다음 단계」부터 이어간다.**
> 🔴 중간 보고 금지. ①~⑧ 전부 끝난 뒤 최종 보고 하나만 올린다.

---

## 0. 종료조건 진행표 (CPO 지시 §0)

| | 항목 | 상태 |
|---|---|---|
| ① | Existing Source Recovery 원인 규명 | 🟢 **원인 특정됨** (아래 §3) |
| ② | Independent Ground Truth 구축 | 🔴 미완 |
| ③ | AUTO 7 전수 funnel | 🟡 브랜드 교집합까지만 |
| ④ | coconjennie 최종 판정 | 🔴 `NO_PRODUCT_PATH_OBSERVED` |
| ⑤ | SAME Yield 측정 | 🔴 미착수 |
| ⑥ | SAME → Price Decision 영향 | 🔴 미착수 |
| ⑦ | 비용/자동화 가치 | 🟡 부분 |
| ⑧ | GO/HOLD/CHANGE 최종 판정 | 🔴 **확정 금지** (①~⑦ 미완) |

---

## 1. 🔴 확정 사실 — 다시 측정하지 않는다

### 접근 정책 (FULL POPULATION 34, `checkRobots` owner)

```
AUTO_SCRAPE 7 · MANUAL 13 · NOT_AVAILABLE 13 · DISABLED 1
robots  NOT_DISALLOWED 19 · DISALLOWED 12 · UNKNOWN 3
구조적 제외 15 — musinsa·wconcept·lotteon·ssg·11st·gsshop·hmall·kidikidi·
  shopping.naver·smartstore.naver·shoppinghow.kakao·ssfshop
  UNKNOWN: coupang(403)·cjonstyle(302)·ocokorea(네트워크)
🔴 NOT_AVAILABLE 중 조사 가능 4개는 전부 중개(auction·enuri·gmarket·kream)
```

### 브랜드 교집합 — 우리 상품 커버 / 운영 링크

```
looxloo      94 / 🔴 0      foretforet  59 / 🟢 32
rulii        46 / 🔴 0      deuxbebe    19 / 🟢 32
littleluna   14 / 🟢 1      chocoel      2 / 🔴 0 (교집합 MYMY 하나 — 설명됨)
skysport      0 / 🟢 0      (테니스 전문 — 🟢 0 이 «맞다»)
🔴 「0 links = 0 coverage」는 거짓임이 확정됐다.
```

### looxloo 는 실제로 «판다» (상품 페이지 기준, sample N=3×2브랜드)

```
Bobo Choses  3/3  「보보쇼즈 아동 데님캡_블랙」·「팝조깅팬츠_블루」·「팝레깅스_핑크」
TAO          3/3  「타오 아동 올오버스웨트셔츠_아이보리」 등
🔴 해외 품번 표기 없음 · 🟢 색상·소재·사이즈옵션·ld+json 은 있음
```

### chouchouenfant — 🟢 전수 확정, source 제외

```
Bobo Choses 품번 50건(p3=0 으로 카탈로그 종료)
시즌 123→28 · 222→2 · 223→20   🔴 현행 226 = 0건
접두 영문 탈락 50/50 일관 (B223AC074 → 223AC074)
→ 현행 SAME Coverage source 아님. 🔴 confirmBrandCodeInTitle 완화도 하지 않는다.
```

---

## 2. 🔴 Known Unknowns (확정 금지 항목)

```
rulii 검색 링크 0건   「미취급 ↔ 검색 실패」를 가르지 못했다
coconjennie          상세 URL 규약 미관찰 → NO_PRODUCT_PATH_OBSERVED (접근 실패, 품번 없음 아님)
                     🔴 교집합 4종 매치는 menu/footer false positive 였다
Recall               ground truth 부족 → 측정불가 (0% 로 적지 않는다)
KNOWN_NOT_SAME       0건 — 거부된 후보가 DB 에 저장되지 않는다
```

---

## 3. 🟢🟢 ① 원인 특정 — `brand-alias.ts` 에 두 브랜드가 없다

`packages/crawler/src/comparison-search/brand-alias.ts` 가 **이미 owner** 다.
한글 alias 가 **3개만** 등록돼 있다:

```
Pèpè Shoes             → 페페
Emile et Ida           → 에밀에이다
Konges Slojd Clothing  → 콩제슬래드
```

🔴 그 파일 머리 주석이 등록 근거를 적어 뒀다 —
> 「3개 브랜드 모두 **원문 영문 검색 0건** → 브랜드 한글 alias 검색 4~5건,
>   오탐 0건 확인」 · 「새 alias 추론/자동 번역/유사발음 생성 금지 —
>   이 목록에 없는 브랜드는 폴백을 시도하지 않는다」

🔴🔴 **`Bobo Choses` 와 `The Animals Observatory` 는 목록에 없다.**
그 둘이 looxloo 커버 94 의 전부다(Bobo 84 + TAO 10).

→ looxloo 링크 0 의 원인은 「샵 부재」도 「Identity 결함」도 아니라
  **alias 등록부에 두 줄이 없어서 영문 쿼리가 0건을 받는 것** 이다.

🟢 그리고 Phase 7 이 등록 조건을 이미 충족했다 — 「보보쇼즈」 3/3 · 「타오」 3/3,
   오탐 0. 🔴 **그래도 지금 등록하지 않는다** — §18 Gate 의 SAME/가격/의사결정이
   아직 미측정이다. alias 추가는 「query expansion」이 아니지만, 가치 입증 전에는
   Production 을 바꾸지 않는다.

---

## 4. 다음 실행이 «즉시» 할 것

```
STEP 1  looxloo Recovery Funnel (§4) — 하니스에서만 alias 를 주입해 측정한다
        arm A  현재 Production query (영문, 변경 없음)
        arm B  한글 alias 주입 (보보쇼즈 / 타오)  🔴 Production 미변경
        arm C  canonical field 조합 (brand+color+material)
        각 arm → candidates → product pages → readable → relevant → SAME → tier
        🔴 CONTROL: foretforet known SAME 을 같이 돌린다. 깨지면 숫자 폐기.

STEP 2  rulii 동일 (§7) — 검색 실행/결과/URL추출/상품명/미취급을 분리

STEP 3  Independent Ground Truth (§10·§11)
        strata A~G · KNOWN_SAME / KNOWN_NOT_SAME / UNKNOWN
        🔴 품번 없는 strata 필수 포함 — 확보된 distinct 6:
           the new society「Robe Fleckers | Bleu」· Emile et Ida「Jupe Iris | Ecru」·
           Louise Misha「Dalila Reversible Fur Coat」·「Astrid Organic Cotton Jacket」·
           Misha & Puff「Voyage Dress …」· Louise Misha「Tender coat | Cream」
           (전부 sku=AAA… = Smallable 자체번호, 해외 품번 없음)
        🔴 핵심 사례: Louise Misha「Tender coat | Cream」 ↔ deuxbebe
           「[LOUISE MISHA] COAT TENDER - CREAM CARNATION VALE」(현재 COMPARISON)
           → 「품번 없이도 SAME 인가」의 검증 대상

STEP 4  SAME Yield + False Positive (§13·§14) — TP / FP / UNKNOWN 분리
STEP 5  Price Decision Impact (§15) — tier BEFORE/AFTER · Seller Decision 변화
STEP 6  Automation Cost (§17) — 단일 source 만
STEP 7  §18 Gate 8개 점검 → 통과 시에만 최소 구현 + §19 Before/After 재측정
STEP 8  최종 보고 1회 (17항)
```

---

## 5. 측정 하니스 (전부 `MI_P0_02_LIVE=1`, 기본 SKIP)

```
dom-value-01-source-universe      접근 정책 전수 (checkRobots)
dom-value-02-code-availability    해외 품번 자리별 스캔
dom-value-03-shop-catalog         sixshop 구조 + 카탈로그
dom-value-04-shop-depth           시즌 분포
dom-value-05-brand-overlap        🟢 브랜드 교집합 — «이 순서가 먼저다»
dom-value-06-final                coconjennie 상세 + AUTO 7 교집합
dom-value-07-looxloo-rulii        상품 페이지 기준 취급/품번
mi-coverage-domestic-funnel       운영 경로 퍼널(judgeDomesticCandidate 포함)
```

선행 덤프(scratchpad): `cov-sources` · `cov-shopsettings` · `cov-nolink` ·
`cov-withlink` · `gt-targets` · `domval-*`

---

## 6. 🔴 이 WU 의 금지사항 (CPO §21)

```
X 중간 보고 · CEO 질문 · 짧은 측정 후 종료 · 다음 조사 추천으로 종료
X context 부족을 «작업 종료» 사유로 사용 (→ 이 문서로 상태를 보존하고 이어간다)
X 0건을 부재로 해석 · 측정불가를 0으로 해석 · sample→population 일반화
X query expansion 선행 · SAME threshold 변경 · no-code SAME 승격
X confirmBrandCodeInTitle 선제 완화 · brand resolver/material parser 변경
X robots/약관 우회 · URL 추측 · mass source addition · Registry UI 변경
X Cafe24 공통 리팩터링 선행 · 여러 source 동시 구현
```

## 7. 🔴 CTO 가 이 WU 에서 스스로 잡은 측정 결함

```
① 정규식 `\b` 가 실제 backspace(0x08)로 들어가 매치가 구조적으로 불가능
② 상품 링크 정규식이 `/product/search.html` 을 잡아 상품 페이지를 한 번도 못 받음
   → 그 0건을 「품번 없음」으로 읽을 뻔함
③ 측정 «순서» 오류 — 품번보다 «브랜드 교집합» 이 먼저다
④ 「페이지에 브랜드명 있음」 false positive 를 경고했는데 coconjennie 에서 실제 발생
⑤ `searchDomesticShops + withConfidence` 만 불러 `judgeDomesticCandidate` 누락
   → CONTROL 이 사전에 잡았다(§5-B 의 효용 실증)
⑥ 월별 집계를 LEFT JOIN 으로 세서 합이 846(>497)
```
