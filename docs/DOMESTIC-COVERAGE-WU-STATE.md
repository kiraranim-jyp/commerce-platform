# 국내 SAME Coverage 사업가치 검증 WU — 실행 상태 (진행 중)

> 🔴 **이 WU 는 끝나지 않았다.** CPO 가 정한 종료조건 ①~⑧ 중 일부만 완료됐다.
> 🔴 다음 실행은 **새 WU 를 만들지 않고 이 문서의 「다음 단계」부터 이어간다.**
> 🔴 중간 보고 금지. ①~⑧ 전부 끝난 뒤 최종 보고 하나만 올린다.

---

## 0. 종료조건 진행표 (CPO 지시 §0)

| | 항목 | 상태 |
|---|---|---|
| ① | Existing Source Recovery 원인 규명 | 🟡 2차 원인 특정 + 🟢 **CONTROL 통과**(§3-5) |
| ② | Independent Ground Truth 구축 | 🟢 **완료** — 분모 6 (§3-13) |
| ③ | AUTO 7 전수 funnel | 🟡 브랜드 교집합까지만 |
| ④ | coconjennie 최종 판정 | 🔴 `NO_PRODUCT_PATH_OBSERVED` |
| ⑤ | SAME Yield 측정 | 🟢 **Recall 4/6 = 67%** · FP 2/34 = 6% (§3-13) |
| ⑥ | SAME → Price Decision 영향 | 🔴 미착수 — FP 0 이라 «오염 손실» 경로가 없다 |
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

## 3. ① Recovery 원인 — 🔴 1차 가설은 **반증됐다**

### 3-1. 1차 가설과 그 근거 (기록용)

`packages/crawler/src/comparison-search/brand-alias.ts` 가 owner 이고 한글 alias 가
**3개만** 등록돼 있다 — `Pèpè Shoes→페페` · `Emile et Ida→에밀에이다` ·
`Konges Slojd Clothing→콩제슬래드`. 그 파일 주석이 등록 근거를 적어 뒀다:
> 「3개 브랜드 모두 **원문 영문 검색 0건** → 한글 alias 검색 4~5건, 오탐 0건 확인」
> 「새 alias 추론/자동 번역 금지 — 목록에 없는 브랜드는 폴백을 시도하지 않는다」

🔴 `Bobo Choses`·`The Animals Observatory` 는 목록에 없고 그 둘이 looxloo 커버
94 의 전부다(84+10). → 「alias 두 줄이 없어서 회수가 안 된다」가 1차 가설이었다.

### 3-2. 🔴🔴 실측이 그 가설을 깼다 (STEP 1 · sample N=4 상품)

하니스에서만 alias 를 주입해 세 arm 을 돌렸다(Production 미변경):

```
             looxloo  rulii  foretforet      SAME   tier
arm A 영문      27      10       10            0     none
arm B 한글      13       3       10            0     none
arm C canonical 25      13       15            0     none
```

🔴 **한글 alias 를 넣으면 후보는 늘지만 SAME 은 0 그대로다.**

### 3-3. 🟢 2차 원인 — 브랜드 교집합 ≠ **상품** 교집합

arm B 가 회수한 후보가 전부 「그 브랜드의 **다른** 상품」이었다:

```
우리 상품   Bobo Choses 「Stamp Bloom All Over Denim Pants」 (B226AC070)
looxloo     「보보쇼즈 보보쇼즈팝조깅팬츠 (76A7D-415-02)」·「팝레깅스」
foretforet  「SS26LW[보보쇼즈]Reading Crocodile 롱삭스」        ← 양말
rulii       「[Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈」     ← 콜라보
```

→ 브랜드 검색은 **브랜드의 아무 상품**을 돌려준다. 그 샵이 그 «특정 상품» 을
  취급하지 않으면 SAME 이 될 수 없다. 그리고 `looxloo` 가 전부
  `DROPPED(EVIDENCE_NOT_WORTHWHILE)` 인 것은 **게이트가 올바르게 버린 것** 이다.

🔴 **그래서 「커버 94」는 「브랜드 교집합」이고 「SAME 가능 상품 수」가 아니다.**
   이 구분을 다음 실행이 혼동하지 않아야 한다.

### 3-4. 🔴🔴 STEP 1 의 「SAME 0」은 **무효다** (STEP 1b 가 밝혔다)

`controlGate.passed=true` 는 「후보를 냈다」만 봤다. STEP 1b 에서 운영이 실제로
tier 를 만든 (상품 × 샵) 을 DB 에서 꺼내 보니 **내 표본이 틀렸다:**

```
운영 정답                                                        내가 STEP 1 에서 쓴 것
Stamp Bloom Denim Pants → bobochoses.com  tier=EXACT            같은 상품인데
  🔴 bobochoses 는 현재 등록부 disabled → **내 refs 에 애초에 없었다**
PèPè Lulu T Bar «Vernice Nero» → foretforet tier=EXACT          🔴 PèPè «Nevada Tobacco»
  (C: AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER)      (01195-NEVADA-TOBACCO)
  verified=true · vision 98~100                                     = **다른 색상**
Main Story Bubble Sweatshirt «Grey Melange» → littleluna EXACT
  (C: [메인스토리] AW26MS185 - Bubble Sweatshirt - Grey Melange) verified=true · vision=100
PèPè 같은 상품 → deuxbebe tier=REFERENCE (C: 「페페 VERNICE NERO」) verified=false
```

🔴 **즉 「정답이 없는 (상품, 샵) 조합」을 골라서 SAME 0 이 나온 것이다.
   제품 결함이 아니라 내 표본 선택 결함이다.**
🔴 **다음 실행은 STEP 1 의 arm A/B/C 숫자를 SAME 판정 근거로 쓰지 않는다.**
   (후보 회수량 비교에는 쓸 수 있다 — arm B 가 후보를 «줄였다»는 사실은 유효하다.)

🟢 CONTROL 대상은 확보됐다 — scratchpad `ctrl-targets.json` **13건**
   (bobochoses 4 · foretforet 4 · littleluna 1 · deuxbebe 4, 각 `expectedTier` 포함).

### 3-5. 🟢🟢 STEP 1b CONTROL — **EXACT 축 8/8 재현. 하니스가 유효하다.**

운영이 실제로 tier 를 만든 (상품×샵) 12건에 arm A 를 돌렸다. 🔴 게이트 조건은
「후보가 나왔다」가 아니라 **`tier === expectedTier`** 다.

```
bobochoses.com   exp=EXACT     → got=EXACT       🟢 3/4   (측정 전용 refs override)
foretforet.com   exp=EXACT     → got=EXACT       🟢 4/4
littleluna.co.kr exp=EXACT     → got=EXACT       🟢 1/1
deuxbebe.com     exp=REFERENCE → got=null        🔴 0/4
                 🔴 후보(「페페 VERNICE NERO」)는 «회수했다» —
                    DROPPED(EVIDENCE_NOT_WORTHWHILE) 로 떨어진다
합계 재현 8/12 · **EXACT 축은 8/8**
```

🟢 **→ 하니스가 운영 EXACT 경로를 재현한다. looxloo/rulii 의 tier/SAME 숫자를
   «EXACT 축에 한해» 유효로 승격한다.**
🔴 **REFERENCE 축은 재현되지 않았다** — 그 축 숫자는 승격하지 않는다.

### 🔴🔴 STEP 2 결과 — 내 추정이 틀렸고, **회귀 가능성** 이 나왔다

「운영 링크가 가드보다 먼저 만들어졌다」고 추정했는데 **시점 대조가 그것을 깼다:**

```
가드 도입    2026-08-27 (`domain === "foretforet.com"` 줄)
             2026-08-28 (`matchLevel !== "low"` 줄 · 함수 최초 도입)
             2026-10-07 (P5.2 — confirmBrandCodeInTitle 조건 «추가». 완화 방향)
deuxbebe 링크 2026-08-29 ~ 2026-10-08   🔴 **가드 이후다**
샵별 생성 범위 bobochoses 08-23~09-10 · foretforet 08-27~09-22 · littleluna 10-07
```

🟢 그러면 왜 과거엔 통과했나 — 가드의 **두 번째 조건이 열렸다:**
   `if (candidates[0].matchLevel !== "low") return true;`
   과거 링크는 `conf=0.72 · type=REVIEW_REQUIRED` 였고 **low 가 아니다.**
   reasons: `["모델명 유사도 33%","색상 일치(제목 내 확인)","브랜드 일치"]`

🔴🔴 **그런데 지금 같은 후보를 회수해도 `DROPPED(EVIDENCE_NOT_WORTHWHILE)` 다.**
   → 원인은 가드가 아니라 **`matchLevel`/confidence 가 떨어진 것** 이다.
   → 그게 사실이면 **deuxbebe `SIMILAR` 17건은 지금 생성되지 않는다** =
     **Coverage 회귀 가능성** 이고, 이 WU 가 찾던 것과 «다른» 종류의 손실이다.

🔴 **아직 확정 아니다.** 내 하니스가 `confidence`/`matchLevel` 을 기록하지 않았다.
   STEP 2b 에서 그 두 칸을 찍어 과거 0.72 와 대조해야 한다.

### 3-6. 🔴 그래서 looxloo 에는 CONTROL 이 «없다»

운영 링크가 0 이므로 looxloo 에는 「정답이 있는 (상품×샵)」 조합이 **존재하지 않는다.**
→ looxloo 의 SAME 가능성은 **GT 를 새로 만들어야** 판정된다(STEP 3). STEP 1 의
  「SAME 0」은 여전히 「정답 없는 조합」일 수 있으므로 단독 근거가 아니다.

---

### 3-7. 🟢🟢 STEP 2b — **회귀는 실재한다. 단 사업 영향은 0 이다.**

`withConfidence` 의 `confidence`/`matchLevel` 을 찍어 과거값과 대조했다:

```
deuxbebe 「페페 VERNICE NERO」
  과거 링크  conf=0.72 · REVIEW_REQUIRED   (2026-08-29 ~ 2026-10-08)
  지금       conf=0.58 · matchLevel=low · xs=SIMILAR
  reasons 는 «동일» ["모델명 유사도 33%","색상 일치(제목 내 확인)","브랜드 일치"]
→ 🔴 **같은 증거에 더 낮은 점수** = confidence 계산이 바뀌었다.
  matchLevel=low → 가드 둘째 조건이 닫힘 → DROPPED(EVIDENCE_NOT_WORTHWHILE)
  → **deuxbebe SIMILAR 17건은 지금 생성되지 않는다 = Coverage 회귀 확정**
```

🔴🔴 **그런데 그것이 «손실» 인지는 별개다 — 그리고 손실이 아니다.**
그 tier 는 `REFERENCE` 이고, MI-P0-12 가 확인한 대로
`market-intelligence.ts:118-119` 에 **`REFERENCE` 분기가 없다**
(`if EXACT … else if COMPARISON …` 뿐). 즉 REFERENCE 링크는 생기든 안 생기든
`domesticLowestPriceKrw` 에 **도달하지 않는다.**

```
Coverage Value  🟡 REFERENCE 17건이 안 생긴다
Decision Value  🔴 **0** — REFERENCE 는 가격 결정에서 버려진다
Economic Value  🔴 따라서 이 회귀를 고칠 사업 가치가 없다
```

### 3-8. 🟢 나머지 CONTROL 이 통과한 «이유» 도 갈렸다

```
foretforet   conf=0.38 · low · xs=SIMILAR  → 🟢 tier=EXACT
             이유: 가드 넷째 조건 `domain === "foretforet.com"` 이 열리고
                   fetchDomesticModelCode 가 품번을 뽑아 STRONG_IDENTIFIER 가 된다
             → 🔴 **confidence 가 낮아도 품번 추출기가 구제한다**
littleluna   conf=0.69 · low · xs=PRESUMED_SAME → 🟢 tier=EXACT
             이유: 가드 «첫째» 조건(PRESUMED_SAME 존재)이 열린다 + 제목에 AW26MS185
bobochoses   3/4 재현. 불일치 1건은 「Bobo Choses denim cap」(conf=0.4 · xs=CONFLICT)
             → 다른 상품을 1위로 잡은 **검색 순위** 문제
```

🟢 **즉 「회수 성공」의 실제 메커니즘은 confidence 가 아니라 «품번 경로» 다** —
   foretforet(HTTP 추출기) · littleluna(제목 품번) · bobochoses(URL handle).
   이것은 선행 WU 의 결론(「품번을 읽을 수 있는 샵에서만 생긴다」)과 **일치한다.**

---

### 3-9. 🔴🔴 STEP 3 Ground Truth — KNOWN_SAME 0건, 그리고 **EXACT FP 를 찾았다**

독립 라벨러는 `observeVision`(판정에 입력되지 않는 관측기, MI-P0-10 에서 CEO 라벨
7/7 재현). 🔴 임계값은 PROMPT 구간을 사전등록(≥80 same · ≤50 diff).

```
sample N=9 상품 × 5 샵 = 45쌍 (strata A 링크있음 3 · B 링크없음 6, 브랜드 층화)
라벨 가능 11 · 🔴 UNKNOWN 34 (이미지 없음/후보 0건 — 분모에서 뺀다)
byLabel   KNOWN_NOT_SAME 11 · 🔴🔴 **KNOWN_SAME = 0건**
샵별      looxloo 7 NOT_SAME + 2 UNKNOWN · 나머지 4샵 각 1 NOT_SAME + 8 UNKNOWN
품번축    품번없음 × UNKNOWN 34 · 품번있음 × NOT_SAME 9 · 품번없음 × NOT_SAME 2
```

🔴 **SAME Yield / Recall = 측정불가(분모 0).** 0% 로 적지 않는다.
🟢 그리고 looxloo 7쌍 전부 `KNOWN_NOT_SAME` 이다 — **그 샵이 우리 «그 상품» 을
   팔지 않는다**는 선행 결론(§3-3)과 일치한다.

### 🔴🔴 그런데 FP 가 나왔다 — 이것이 이 WU 의 최대 발견이다

```
falsePositive  knownNotSame 11 · falseSame 1 · rate 9%
  우리:  PèPè 「Lulu T Bar Shoes in Vernice Nero」   code=`01195-VERNICE-NERO`
  후보:  foretforet 「AW25 3차[페페슈즈]**3094** 구두_VERNICE NERO-PP25KASHE3094VNE」
  운영 경로: confidence 0.38 · matchLevel **low** · crossSellerVerdict **SIMILAR**
            → gate=JUDGED → tier=**EXACT**
  독립 라벨: Vision **5점** · 「completely different Mary Jane designs」
  → 🔴 `3094` ≠ `01195`. **다른 모델이고 색상(VERNICE NERO)만 같다.**

🔴🔴 **그리고 이것이 코드 규칙과 모순된다.** `compareModelCode`(model-code.ts:95)의
   분기를 손으로 따라가면:
```
a = 01195VERNICENERO     b = PP25KASHE3094VNE
a === b                      ✗
a.startsWith(b)/역        ✗
공유 접두 길이            0  (`0` vs `P`) → conflict 아님
longestCommonSubstring    🔴 4자 이상 공통 부분문자열이 보이지 않는다
                             (b 의 `ASHE`·`3094` 가 a 에 없다)
→ 규칙대로면 **conflict** 여야 하고, conflict 면 tier=EXCLUDED 다
```
   그런데 EXACT 가 났다. 🔴 즉 **`fetchForetforetModelCode` 가 제목의 코드가 아니라
   «다른 값» 을 뽑았을 가능성이 크다** — 그 함수는 상세 HTML 을 받아
   `extractForetforetModelCode(html)` 를 쓴다(foretforet.ts:304).
   🔴 추정이므로 확정하지 않는다. 아래 STEP 4 가 그것을 찍는다.

🟢 참고 — model-code.ts 주석이 **우리 쌍을 직접 적어 뒀다:**
   「`01195VERNICENERO / PP24KASHE1195NER` 접두사를 전혀 공유하지 않고 숫자
     코어 `1195` 만 공유한다 → 표기법이 다른 같은 상품」 = 의도된 `partial`.
   🔴 그런데 `3094` 는 그 코어를 공유하지 «않는다». 그래서 모순이다.
```

🔴🔴 **MI-P0-12 의 「EXACT 버킷 FP 0」은 «DB 에 저장된 링크» 를 본 숫자였다.
   지금 새로 돌리면 EXACT FP 가 난다.** 그 둘은 다른 모집단이다 —
   저장된 링크는 `PP24KASHE1195NER`(정답)이었고, 현재 검색은
   `PP25KASHE3094V`(다른 모델)를 1위로 올린다.

🔴 즉 **검색 결과가 바뀌어 다른 후보가 1위가 되고, 그것이 품번 추출기로 EXACT 에
   닿는다.** `fetchDomesticModelCode` 가 뽑은 품번과 우리 품번이 `compareModelCode`
   에서 왜 `STRONG_IDENTIFIER` 가 됐는지는 **아직 미확정** 이다(LCS 매칭 의심).

→ 🔴 이것은 「Coverage 부족」이 아니라 **「EXACT 오염」** 이고, MI-P0-12 가 확인한
  `summarizeDomesticMarketSplit`(EXACT 하나가 COMPARISON 전체를 덮는다) 구조에서
  **직접 가격을 오염시킨다.** STEP 4 의 최우선 대상이다.

---

### 3-10. 🟢🟢🟢 STEP 4 — **FP 원인 완전 특정. Production 결함이다.**

추출기를 직접 부르고 운영이 실제로 쓴 품번을 찍었다:

```
후보 title  AW25 3차[페페슈즈]**3094** 구두_VERNICE NERO-PP25KASHE3094VNE
후보 url    https://www.foretforet.com/shop/shopdetail.html?branduid=10249010
후보 sku    PP25KASHE3094VNE          🟢 제목의 코드와 «일치» 한다
🔴🔴 운영이 쓴 국내품번  PP24KASHE**1195**NER   ← **다른 상품의 코드다**
   modelEvidence = partial → matchTruth = STRONG_IDENTIFIER → tier = **EXACT**
독립 라벨   Vision 10점 「completely different Mary Jane designs」
```

🔴🔴 **원인은 `compareModelCode` 가 아니다.** 그 함수는 정상 동작했다 —
`01195VERNICENERO` ↔ `PP24KASHE1195NER` 는 숫자 코어 `1195` 공유로 `partial` 이고,
**model-code.ts 주석이 그 쌍을 「표기법이 다른 같은 상품」으로 직접 적어 뒀다.**

🔴 **진짜 원인: `extractForetforetModelCode`(foretforet.ts) 가 «3094 구두» 상세
   페이지에서 «1195 Lulu T Bar» 의 품번을 뽑는다.** 연관/추천상품 섹션이나
   페이지 다른 영역을 긁는 것으로 보이지만 🔴 그 위치는 **아직 미확정** 이다.

### 🔴🔴 사업적 손실 경로가 «완전히» 연결된다

```
extractForetforetModelCode 가 다른 상품 품번을 뽑는다
 → compareModelCode = partial            (정상 동작)
 → deriveMatchTruth = STRONG_IDENTIFIER
 → priceTierFromLink = **EXACT**
 → market-intelligence.ts:118  exactShopRecords 에 들어간다
 → price-history.ts:644  `exact.sellerCount>0` → resolved=exact,
                         **COMPARISON 전체가 무시된다**
 → domesticLowestPriceKrw 가 «다른 상품» 의 가격
 → computePriceDecision / buildSellerDecision 오판
```

🟢 이것이 CPO 가 요구한 **「Identity disagreement → 잘못된 priceTier → 잘못된
   가격 → 잘못된 sourcing 판단」** 경로의 **실측 1건** 이다.
🔴 단 **금액 영향은 아직 측정하지 않았다**(§15). 그리고 **빈도도 모른다** —
   sample N=9 상품에서 1건이고, 운영 DB 의 foretforet 링크 32건 중 몇 건이
   같은 모양인지는 미측정이다.

---

### 3-11. 🔴🔴 STEP 4b — **「EXACT FP 1건」은 무효다. 내 하니스가 두 후보를 섞었다.**

FP 가 났다던 그 URL 의 JSON-LD 를 직접 받았다:

```
url            foretforet.com/shop/shopdetail.html?branduid=10249010
pageTitle      FORETFORET_AW25 3차[페페슈즈]3094 구두_VERNICE NERO-PP25KASHE3094VNE
JSON-LD 블록   2개 · `@type:Product` **1개**
  mpn          **PP25KASHE3094VNE**   🟢 제목과 일치한다 — 페이지가 «정상» 이다
  name         AW25 3차[페페슈즈]3094 구두_…      sku 040000058616
extractForetforetModelCode(html) = **PP25KASHE3094VNE**   🟢 추출기도 «정상» 이다
페이지에 「1195」 포함 = **false**
```

🔴🔴 **그러면 `PP24KASHE1195NER` 는 추출기가 뽑은 값이 아니다.**
   `judgeDomesticCandidate` 는 내부에서 `selectDomesticCandidate` 로 **대표 후보 1건**
   을 고른다. 운영이 고른 대표는 `1195`(= 정답 Lulu T Bar)였고, 🔴 **내 Vision 은
   `scored[0]`(= 3094)에 돌렸다.** 즉 `tier` 와 `visionScore` 가 **서로 다른 후보**
   를 가리킨다.

🔴 **내 덤프에 그 불일치가 이미 찍혀 있었다** —
   `judgedDomesticModelCode = PP24KASHE1195NER` vs `topCandidateSku = PP25KASHE3094VNE`.
   그걸 「추출기가 엉뚱한 품번을 뽑는다」로 **잘못 읽었다.**

→ 🔴 **§3-9/§3-10 의 「EXACT FP 1건」·「추출기 결함」·「사업적 손실 경로 실측」은
     전부 무효다.** MI-P0-12 의 「EXACT 버킷 FP 0」이 여전히 유효하다.
→ 🔴 그리고 STEP 3 의 `falsePositive rate 9%` 도 무효다(같은 결함).

### 🔴 하니스를 고칠 지점 (STEP 5 전제)

```
judgeDomesticCandidate 가 «고른 대표 후보» 에 Vision 을 돌려야 한다.
  지금: scored[0] 에 돌린다            ← 🔴 운영이 고른 후보와 다를 수 있다
  고칠 것: DomesticJudgement 의 `observed.candidate` / JUDGED 의 선택 결과를 쓴다
  🔴 그 칸 이름을 추측하지 말고 타입에서 읽는다(run-domestic-price-check.ts:504~).
```

---

### 3-12. 🟢🟢 STEP 5 — 하니스 수정 후 재측정. **FP 는 0 이다.**

`DomesticJudgement.JUDGED` 에 `best: ComparisonCandidate` 와 `priceTier` 가 «이미»
있었다(run-domestic-price-check.ts:504~, 주석 「최종 owner 의 값」).
→ Vision 을 `j.best` 에 돌리고 tier 복제 계산을 **지웠다.**

```
재측정 (sample N=9 상품 × 5 샵 = 45쌍)
  라벨 가능 11 · UNKNOWN 34
  byLabel   KNOWN_NOT_SAME 10 · 🟢 **KNOWN_SAME 1**
  SAME Yield   eligibleKnownSame 1 · recovered 1 · **Recall 1/1**
  🟢 FalsePositive  knownNotSame 10 · falseSame **0** · **rate 0%**

🟢 그 1건이 운영이 실제로 만든 EXACT 다:
  우리  PèPè「Lulu T Bar Shoes in Vernice Nero」   code=01195-VERNICE-NERO
  대표  foretforet「AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈-PP24KASHE**1195**NER」
  국내품번 PP24KASHE1195NER · evidence=partial · truth=STRONG_IDENTIFIER · tier=EXACT
  독립 라벨 Vision **98** 「Identical PePè patent t-strap shoes」
```

🔴 **그래서 §3-9/§3-10 은 완전히 폐기한다** — FP 도, 추출기 결함도, 손실 경로도 없다.
🟢 MI-P0-12 의 「EXACT 버킷 FP 0」이 **독립 라벨러로 재확증됐다.**
🔴 단 **분모가 1 이다.** Recall 100% 를 일반화하지 않는다.

---

### 3-13. 🟢🟢 STEP 6 — 분모를 키웠다. **Recall 67% · FP 6% · EXACT FP 0**

```
sample N=26 상품(A 링크있음 5 · B 링크없음 21, 브랜드 층화) × 5 샵 = 130쌍
라벨 가능 40 · UNKNOWN 90
🔴 UNKNOWN 90 은 **전부 「후보 0건」** 이다 — 이미지 문제가 «아니었다»
   (그 샵들이 그 상품을 안 팔거나 검색이 못 찾는다. 둘은 여전히 미분리)

byLabel   KNOWN_NOT_SAME 34 · 🟢 KNOWN_SAME 6
byTier    EXACT 3 · COMPARISON 3

🔴 SAME Yield   eligible 6 · recovered 4 · **Recall 67%**
                미회수 2 = foretforet · 회수 = littleluna 2 · foretforet 1 · deuxbebe 1
🔴 FalsePositive  knownNotSame 34 · falseSame **2** · **rate 6%**
🟢🟢 **FP 2건은 둘 다 `COMPARISON` 이고 `EXACT` 는 0 이다**
   → MI-P0-12 의 「EXACT 버킷 FP 0」이 **세 번째로 확증** 됐다
```

### FP 2건의 실체 — 같은 모델 «다른 색상»

```
우리   Main Story「Bubble Sweatshirt in **Grey Melange**」 (AW26MS185)
후보   deuxbebe「AW26MS185 - Bubble Sweatshirt - **Rose Shadow**」
       품번 «완전 일치» · 색상 다름 → tier=**COMPARISON** · Vision DIFF(맞다)
```

🔴 `COMPARISON` 은 가격 결정에 **들어간다**(market-intelligence.ts:119).
   즉 다른 색상 상품의 가격이 비교 버킷에 섞인다.
🟡 다만 같은 모델 다른 색상은 보통 가격이 같고, `COMPARISON` 은 `EXACT` 가 없을
   때만 쓰인다(price-history.ts:644-645). **금액 영향은 아직 측정하지 않았다.**

### 샵별 후보/이미지 확보 (sample N=26)

```
looxloo     이미지있음 18 · 후보0  8   ← 후보를 가장 많이 낸다
foretforet  이미지있음  8 · 후보0 18
deuxbebe    이미지있음  5 · 후보0 21
littleluna  이미지있음  5 · 후보0 21
rulii       이미지있음  4 · 후보0 22
```

### 품번 축 (§8 Evidence strata)

```
품번있음 × KNOWN_SAME 3 · 품번없음 × KNOWN_SAME **3**
→ 🟢 **품번 없이도 KNOWN_SAME 이 3건 있다** — §10 이 유지하라고 한 축이 실측됐다
품번있음 × NOT_SAME 21 · 품번없음 × NOT_SAME 13
```

---

## 4. 다음 실행이 «즉시» 할 것

```
STEP 1  🟢 완료 — arm A/B/C × 3샵 측정. 결과는 §3-2/3-3. 재실행 금지.

STEP 1b 🟢 **완료 — EXACT 축 8/8 재현.** 결과는 §3-5. 재실행 금지.
        하니스: dom-recovery-02-control-tier.test.ts

STEP 2  🟢 **완료** — 시점 대조로 「가드가 나중」 추정을 반증했다(§3-5 하단).
        🟢 실제 원인 후보: confidence/matchLevel 하락 (과거 0.72 → 지금 low)

STEP 2b 🟢 **완료** — 회귀 확정(0.72→0.58, low). 🔴 단 Decision Value = 0
        (REFERENCE 는 market-intelligence 에서 버려진다). §3-7.
        🔴 **그래서 「회귀 수복」도 레버가 아니다.** 방향을 다시 바꾸지 않는다.

STEP 2c 🔴 rulii 「미취급 ↔ 검색 실패」 분리. (brandOnSearchPage=true 였지만
        상품 링크 0건 — Cafe24 검색 결과 HTML 을 직접 보고 가른다)

STEP 3   🟢 **완료** — GT 구축. 🔴 KNOWN_SAME 0건 → SAME Yield 측정불가(§3-9).
        🟢 라벨 커버리지 11/45. UNKNOWN 34 는 이미지 없음/후보 0건이고 분모에서 뺐다.

STEP 4   🟢 **완료** — FP 원인 완전 특정(§3-10). `extractForetforetModelCode` 가
        다른 상품 품번을 뽑는다. `compareModelCode` 는 정상.

STEP 4b 🟢 **완료 — 그리고 내 FP 판정을 무효화했다**(§3-11).
        페이지·추출기 둘 다 정상이다. 🔴 추출기를 고칠 것이 «없다».

STEP 5   🟢 **완료** — 하니스 수정 + 재측정. Recall 1/1 · **FP 0%**(§3-12).

STEP 6   🟢 **완료** — 분모 6 확보. Recall 67% · FP 6% · EXACT FP 0 (§3-13).
        하니스: `GT_CAP_A` / `GT_CAP_B` 로 표본 상한을 조절한다.

STEP 7   🔴 **§15 가격 영향 — 두 축만 남았다**
        ① FP 2건(같은 모델 다른 색상 → COMPARISON)이 `domesticLowestPriceKrw` 를
           얼마나 움직이는가. 🔴 금액을 봐야 한다(가격이 같으면 영향 0).
        ② Recall 미회수 2건(foretforet)이 **왜** tier 를 못 만들었는가 —
           게이트 탈락인지 대표 후보 선택인지 가른다.
        🔴 둘 다 sample N 이 작다(2건씩). 일반화하지 않는다.

STEP 8   §18 Gate 8개 점검 → 최종 보고 1회(17항).

STEP 2  🟡 rulii — arm A/B/C 는 돌았다(후보 10/3/13). 남은 것은 「미취급 ↔ 검색 실패」
        분리이고, STEP 1b 가 통과한 뒤에 본다.

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
