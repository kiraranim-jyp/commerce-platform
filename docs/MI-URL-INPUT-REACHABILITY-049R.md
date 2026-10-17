# WU-049-R FINAL — 실제 Production UI 입력 경로 검증 · CEO 테스트 경로 확정

> 🟢 **결론 = A (실제 UI 입력 가능).** 🔴 단 **2단 접힘 + 선행조건 3개** 뒤에 있다.
> 🔴 운영 코드 변경 **0** · 새 UI **0** · 새 producer **0** · 정책 **0**.

---

## 1. 결론 — **A** (UI 에 있다 · 못 찾은 이유가 규명됐다)

입력칸은 실재하고 **CEO 가 쓸 수 있다**. CPO 가 찾지 못한 이유는 부재가 아니라 **경로** 다.

```
DomesticPriceIntelligencePanel.tsx:3279-3299
  label        🔗 비교할 판매처 상품 URL (선택)
  placeholder  https://… (한 줄에 하나)
  testid       wu024-candidate-urls
  실행 버튼     🔄 다시 분석            ← 🔴 「지금 확인」이 아니다(아래 §4)
```

---

## 2. 🔴🔴 왜 안 보였나 — **접힘이 «둘» 이고 이름이 닮았다**

```
① presentation (SUMMARY → FULL)   버튼 「가격 판단 상세보기 →」   ← 상태 marketDetailOpen
② 되물음        (FULL 안에서)      버튼 「왜 이렇게 판단했나요?」  ← 상태 showMarketDetail
```

🔴 **두 상태는 서로 «다른» 값인데 이름이 `marketDetailOpen` ↔ `showMarketDetail` 로 닮았다.**
①을 통과해도 ②가 `useState(false)` 라 입력칸은 **DOM 에 없다**.

🔴 그리고 ①이 자동으로 열리는 단계는 **하나뿐이다**(`stage-focus.ts:221-231` 실측):

| 단계 | 상품정보 탭 · 아무것도 안 누름 | 펼친 뒤 |
|---|---|---|
| ① COLLECTING | 🔴 HIDDEN | 🔴 HIDDEN |
| ② MARKET_JUDGING | 🟢 **FULL** | 🟢 FULL |
| ③ SOURCE_SELECTING | 🟡 SUMMARY | 🟢 FULL |
| ④ REGISTRATION_PREPARING | 🟡 SUMMARY | 🟢 FULL |
| ⑤ COMMERCE_REGISTERING | 🟡 SUMMARY | 🟢 FULL |
| **채널 탭(스마트스토어/쿠팡/롯데ON)** | 🔴 HIDDEN | 🔴 **HIDDEN** |

🔴🔴 **채널 탭에서는 펼쳐도 영구히 없다** — 거기서 찾았다면 못 찾는 것이 정상이다.

### 🔴 선행조건이 하나 더 있다 — **시장 분석이 로드돼야 한다**

```
Panel:1896  setData(json.ok ? json : null)
Panel:2163  if (!data) → 「시장 분석 데이터를 불러오지 못했습니다」 **한 줄만** 렌더
            → 🔴 되물음 버튼조차 없다 → 입력칸에 영구히 닿지 못한다
Panel:2137  autoChecking || loading || justCompleted → 스켈레톤
Panel:1937  「분석이 끝났습니다」는 **800ms 뒤 스스로 꺼지는** 전이 상태다
```

---

## 3. direct URL input 의 실체 — **UI 이고 API-only 가 아니다**

```
UI    textarea 「🔗 비교할 판매처 상품 URL」   Panel:3289
 ↓    onCandidateUrlsChange = setCandidateUrlsText   Panel:2203  (🟢 wiring 살아 있다)
API   POST /api/price-history/check  body.candidateUrls   Panel:2045-2050
 ↓    route.ts:54-66  배열 검증 + 상한(MAX_CANDIDATE_URL_PAYLOAD) · 🔴 requireUser 가 «먼저»
producer  run-domestic-price-check.ts:927  if (input.candidateUrls && length > 0)
 ↓    buildUrlCandidatePool → 가상 샵 **__url_candidates__**
MI    judgeDomesticCandidate — 🟢 Gemini 경로와 **같은 함수 · 전용 규칙 0**
price enrichCandidatePrices (:1080 · isUrlPool)
집계   computeMarketIntelligence(…, transientEvidence)  check/route.ts:159
 ↓    candidateOverseasPrice
UI    overseasReference → OverseasReferencePrice   ← 🟢 WU-049 가 이은 구간
저장   🔴 **없음** — isTransientShopId 가 upsert 앞에서 끊는다
```

---

## 4. 🔴 직전 WU-049 보고서의 **CEO 안내 2건이 틀렸다** (이 WU 의 산출)

```
❌ 「가격비교 구역의 직접 URL 입력칸」   → 🟢 실제 위치는 **MI 「왜 이렇게 판단했나요?」 안**
❌ 「**지금 확인** 을 누른다」           → 🟢 실제 라벨은 **「🔄 다시 분석」**
   (「지금 확인」은 **주석에만** 있는 말이다 — 버튼으로 존재하지 않는다 · 전수 grep)
```

🔴 CEO 가 그 안내로 테스트했다면 **버튼을 못 찾아 FAIL 로 보고했을 것** 이다.

---

## 5. 소싱추가와의 관계 — **다른 기능이다**

```
「+ 소싱처 직접 추가」  SourcingPanel.tsx:392-407 → POST → **sourcing_candidates** 테이블
                      sourceKind "SELLER_ENTERED" 고정
🔴 price-history 는 그 테이블을 **읽지 않는다**(WU-040 확정 · 참조 0)
→ 🔴 WU-049 의 direct candidate input 과 **무관하다.** 전용하지 않았다.
```

---

## 6. 검증 — 🔴 **마운트해서 «눌러봤다»**

새 하니스 `wu-049r-url-input-reachability.test.ts` (jsdom + `createRoot` + 실제 click).
🟢 선례 `bulk-reference-reachability.test.ts` 와 같은 방식이고 **같은 이유** 다 —
`renderToStaticMarkup` 은 effect 가 돌지 않아 **「접혀 있다」와 「아예 없다」를 구분 못 한다.**

```
9 passed
  A FULL   처음엔 입력칸 없음 · 되물음 1번 클릭 → **입력칸 + 「🔄 다시 분석」 등장**
           🔴🔴 입력한 URL 이 **POST /check 의 candidateUrls 로 실제로 간다**
  B SUMMARY 입력칸·되물음 **둘 다 DOM 에 없음** · 「가격 판단 상세보기」만 있다
           HIDDEN → 렌더 **빈 문자열**
  C 선행조건 GET ok=false → 「불러오지 못했습니다」 + 되물음 **없음** → 도달 불가
  D 규칙표  단계 5 × 탭 2 전수 — 위 §2 표를 코드로 잠갔다
음성대조  M1 입력칸 제거 **2 FAIL** · M2 wiring 제거 **1 FAIL** → 복구 **9 passed**
```

🔴🔴 **내 첫 단언이 헛단언이었다 — 숨기지 않고 적는다.**
```
처음엔 `input.value` 를 넣고 **그대로 다시 읽었다.** 내가 DOM 을 직접 바꿨으니
wiring 이 끊겨도 통과한다 → 변이 M2 가 **9/9 통과** 했다.
🟢 축을 「POST body 에 실리는가」로 바꿨고, React 의 값 추적기 때문에
   prototype setter 로 입력해야 실제 타이핑과 같아진다. 그 뒤 M2 가 **FAIL** 로 뒤집혔다.
🔴 이것은 WU-018·020 과 **같은 계열의 실수** 다(엉뚱한 구간을 단언했다).
```

```
회귀      admin **558 files / 8,162 passed · failed 0**  (직전 557/8,153 → +1파일 +9 = 이 하니스)
typecheck **0** (내 오류 1건을 고쳤다 — mock 선언에 `init` 누락)
build     🔴 실행하지 않았다 — **운영 코드 변경 0** 이고 테스트는 번들에 들어가지 않는다.
          🟢 같은 tsconfig 의 `tsc --noEmit` 이 0 이므로 타입 축은 덮였다.
          (CPO §11 「불필요한 전체 회귀는 반복하지 않는다」)
```

---

## 7. 코드 변경 — **운영 0**

```
추가  apps/admin/src/app/pipeline/commerce/__tests__/wu-049r-url-input-reachability.test.ts
추가  docs/MI-URL-INPUT-REACHABILITY-049R.md
운영  **0** (git status 로 확인 — 변이는 전부 원상복구)
```

🔴 금지 전수 0: WU-049 로직 변경 0 · 새 UI 0 · 소싱 연결 0 · Registry 0 · MI 0 ·
가격 계산 0 · 환율 0 · transient 저장 0 · AI 0 · Gemini 0 · threshold/color/SKU/GTIN 0.

---

## 8. 🔴 발견했지만 **고치지 않은 것**(제품 정책 · CPO 판정)

```
🔴 **발견 가능성(discoverability) 결함.** 입력칸이 「왜 이렇게 판단했나요?」 안에 있다.
   🟢 그 자리는 **의도적** 이다 — Panel:3326 이 적어 뒀다: 「입력은 행동이고 결과는
      결론이다. 입력까지 올리면 첫 화면 계약(product-tab-first-screen 18건)이 깨진다」.
   🔴 그러나 **CPO 가 못 찾았다** 는 것이 실측 증거다. 셀러도 못 찾을 수 있다.
   🔴 라벨도 「비교할 판매처 상품 URL」이라 **「동일상품 후보를 직접 넣는다」로 읽히지 않는다.**
🟡 선택지(CTO 가 고르지 않았다) ⒜ 현상 유지 + 안내 문서로만 해결
   ⒝ 라벨/도움말 문구만 바꾼다(첫 화면 계약 무영향) ⒞ 입력칸을 접힘 밖으로 올린다
      (🔴 첫 화면 계약 18건과 충돌 → 별도 WU)
```

---

## 9. 최종 판정

```
A / B / C  →  **A**
원인 규명 · 경로 확정 · 마운트+클릭 증명 · 음성대조 2종 FAIL · 회귀 8,162 · typecheck 0
운영 코드 변경 0
──────────────────────────────────────────
**GO**
```

---

## 10. 🔴 CEO Action — Production 테스트 1회 (정확한 경로)

```
URL   https://ttaejyo.vercel.app/pipeline        (로그인 필요)
상품  Bobo Choses  Hug Hairy Monster T-Shirt  (B226AC009)
```

**클릭 순서 — 이 순서가 이 WU 의 산출물이다**

1. 상품을 연다. **「상품정보」 탭에 있어야 한다** — 🔴 스마트스토어/쿠팡/롯데ON 탭에서는
   MI 가 **아예 없다**(설계).
2. **`Market Intelligence`** 구역을 본다.
   - 🟢 「**왜 이렇게 판단했나요?**」가 보이면 → **3번으로**
   - 🟡 「🟡 조건부 판매 …」 **한 줄 요약** 만 보이면 → **「가격 판단 상세보기 →」를 먼저 누른다**
   - 🔴 「시장 분석 데이터를 불러오지 못했습니다」면 → 새로고침. 그 상태에서는 입력칸이 없다
   - ⏳ 「시장 분석 중」이면 → 끝날 때까지 기다린다(10~20초)
3. 「**왜 이렇게 판단했나요?**」를 누른다.
4. 그 안의 「**🔗 비교할 판매처 상품 URL (선택)**」 칸에 아래 둘을 **한 줄에 하나씩** 넣는다.
```
https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt
https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue
```
5. 「**🔄 다시 분석**」을 누른다. (🔴 「지금 확인」이라는 버튼은 **없다**)

**🟢 PASS — 금액이 아니라 구조를 본다**
```
① 「🌐 해외 참고가격」 구역이 **뜬다**
② 금액 앞에 **통화 코드**(EUR / USD)가 있다 — `$`·`€` 기호만 있으면 FAIL
③ 「환율로 환산하지 않았습니다」 + 「참고용입니다 — 판매판정과 국내 최저가에는
   반영되지 않습니다」 두 문장이 있다
④ 국내 최저가·판매판정 숫자가 **해외 가격 때문에 움직이지 않는다**
⑤ 아래 「직접 입력」 후보 구역에 두 판매처가 보인다
```

**🔴 FAIL 은 이 여섯뿐**
```
원화(₩) 환산 · 통화 코드 소실 · 국내 최저가 변동 · 판매판정 변동 ·
해외 가격을 EXACT/국내 동일상품가로 승격 · 참고가격 구역에 승격/확정 버튼 등장
```

**🔴 FAIL 이 «아닌» 것**
```
금액이 EUR 40 / USD 58 이 아님 — 그건 과거 측정값이고 사이트 가격은 바뀐다
한쪽이 「가격 미확인」 — 그 사이트가 응답하지 않은 것이다
새로고침하면 사라짐 — **설계다**(transient 는 저장하지 않는다 · WU-024 불변식)
```

🔴 **질문은 「숫자가 뜨는가」가 아니라 「그 숫자의 의미와 영향 범위가 화면에서
정직하게 분리되어 있는가」다.**
