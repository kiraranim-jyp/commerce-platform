# WU-059 — 잔여 제품/운영 영역 전수 정리 (롱스프린트)

> 🔴 CPO 지시 2026-10-18. 「조사 → 원인 확정 → 전수검토 → 최적안 → 구현 → E2E → 회귀 → 배포 → 보고」 **1회**.
> 🔴 「정책적으로 결정해야 하는 항목과 코드로 안전하게 해결 가능한 항목을 분리해서,
> **안전하지 않은 완화는 하지 않습니다.**」

---

## 0. 한 줄 결론 — **구현한 것은 «경계 고정» 이고, 완화는 하나도 하지 않았다**

```
§1 국내 가격비교      🔴 **HOLD** — 🔴🔴 **WU-057 의 「FP 분모 0」을 정정한다.** 완화하면 False SAME 이 실제로 난다
§2 C27 본문 가격      🔴 **HOLD** — 표준 구조화 데이터 0 · 본문 금액 **8개** · 유일한 후보는 「정가」칸이다
§3 transient 수명     🟢 **현 설계를 보호계약으로 확정** (CPO 가 준 선택지 중 그것)
§4 price_alerts 경계  🟢 **원인 확정 + 경계 고정** · 🔴 정책 1건 상신(파생 알림은 «남는다»)
§5 tier 비대칭        🔴 **정책 판정** — 비대칭이 실재하고 **최저가가 「동일상품 아님」에서 나올 수 있다**
§6 WU-058 UX 잔재     🟢 **0건** (전수) · 🔴 죽은 «틀린» 번호 2개만 정정
§7 핵심 루프 회귀     🟢 보호계약 **11항 전건 생존** · 회귀 8,224 passed
```

🔴 **운영 동작 변경 0.** 바꾼 운영 줄은 **죽은 상수 2개**(화면에 안 나가는 값)뿐이다.

---

## 1. 🔴🔴 국내 가격비교 — WU-057 을 정정한다

### 1-A. 「국내 EXACT 0」의 원인을 **코드 한 줄로** 확정했다

```
match-truth.ts:233  const crossSellerReserved = crossSeller === "PRESUMED_SAME";
match-truth.ts:237  if (!observedDifference && !crossSellerReserved && !colorUnverified) {
match-truth.ts:238    if (modelCode === "exact") return … "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
```

🔴🔴 **헌장 §12 병목 ① 의 문장을 정정한다.** 「품번은 확인되는데 `BRAND_UNCONFIRMED` 가
남는다」는 **증상** 이다. EXACT 를 실제로 막는 것은 **`crossSellerReserved`** 이고,
`BRAND_UNCONFIRMED` 는 verdict 가 `PRESUMED_SAME` 에 머무는 **여러 이유 중 하나** 다.

🟢 실측(fixture 로 커밋 · 항상 실행): 국내 후보 **C27 beaumonde.co.kr**
```
modelCode **exact**(B226AC010 확인됨) · blockers **[BRAND_UNCONFIRMED] 단독** ·
verdict **PRESUMED_SAME** · truth TEXT_CONFIRMED → tier **COMPARISON**   (Human **SAME**)
```
🟢 그리고 **`matchLevel` 은 레버가 아니다** — `very_high` ↔ `low` 로 바꿔도 tier 가 같다
(식별자 경로의 두 값이 `priceTierFromLink` 에서 **둘 다 EXACT** 로 매핑된다).

### 1-B. 🔴🔴 완화 3안을 GT 전수로 쟀다 — 그리고 **WU-057 의 분모 설정이 좁았다**

분모 **GT 51**(Human SAME 27 · DIFFERENT 23) · owner(`deriveMatchTruth`+`priceTierFromLink`)로만 측정

| 안 | 내용 | EXACT | Human SAME | 🔴 Human DIFFERENT | 판정 |
|---|---|---|---|---|---|
| 현행 | — | 12 | 11 | **1** | — |
| CF-1 | `PRESUMED_SAME` 보류 **전면** 해제 | 28 | 19 | **9** | 🔴 **기각**(False SAME +8) |
| CF-2 | `BRAND_UNCONFIRMED` **단독** 일 때 해제 | 19 | 16 | **3** | 🔴 **기각**(False SAME +2) |
| CF-3 | 그 + **품번 exact** 조건 | 17 | 16 | **1** | 🟡 FP +0 · **정책 판정** |

🔴🔴 **WU-057 은 「품번 O 그룹에 Human DIFFERENT 가 0 → FP 분모가 없다」고 적었다.
그 분모가 틀렸다.** 완화는 **게이트 단위로** 적용되므로 분모도 게이트 단위여야 한다 —
`BRAND_UNCONFIRMED` **단독** 군이고, 거기에 Human DIFFERENT 가 **3건 있다**:
```
C50 tinyapple.net  DIFFERENT  blockers [BRAND_UNCONFIRMED] 단독 · 품번 **unavailable**
C51 ladida.com     DIFFERENT  blockers [BRAND_UNCONFIRMED] 단독 · 품번 **unavailable**
C22 donokids.com   DIFFERENT  🟢 **색상미확인이 막는다**(Conker Stripe ↔ Grey Melange)
```
🟢 즉 **「FP 를 증명할 수 없다」가 아니라 「완화하면 FP 가 2건 난다」** 가 정확한 상태다.

### 1-C. 🟡 CF-3 이 유일한 후보다 — 🔴 그래도 구현하지 않았다

```
규칙   blockers === [BRAND_UNCONFIRMED]  &&  modelCode === "exact"  → 보류 해제
효과   +5 Human SAME (C11 C14 C27 C37 C48) · False SAME **+0** · 🟢 국내(.kr) **1건이 처음 EXACT 에 닿는다**(C27)
🟢 안전측 셋이 그대로 작동한다 — ① 품번 재사용 junioredition C19·C20 은
   `SAME_SELLER_DISTINCT_LISTING` 이 **단독 조건을 깨서** 안 건드려진다
   ② C22 는 **색상 축** 이 막는다 ③ `compareModelCode` 의 공통접두 충돌 보호는 유지된다
```

🔴🔴 **구현하지 않은 이유 — 측정 FP 0 은 「FP 가 없다」가 아니다**:
> 품번을 여러 상품에 재사용하는 샵에서 **우리가 그 다른 리스팅을 보지 못한 경우**,
> `SAME_SELLER_DISTINCT_LISTING` 도 색상 증거도 **발화하지 않는다.** C19·C20 이 막힌 것은
> **둘 다 관측됐기 때문** 이다. 🔴 그 조건이 깨진 표본이 GT 51 에 **없다** → **미측정 위험**.
> 🔴 CPO §1: 「False SAME 증가 가능성이 있으면 구현하지 않고 HOLD.」 → **HOLD.**

🔴 **그리고 N=51 · 원상품 호스트 2개(junioredition 44 · bobochoses.co.jp 7)** 다. 일반화하지 않는다.

### 1-D. 🔴 현행에 **False EXACT 가 이미 1건 있다** (고치지 않았다)

```
C06 global.trenbe.com · Human **DIFFERENT** · blockers **없음** · 품번 **exact** → EXACT_IDENTIFIER
⟹ 현행 EXACT precision 11/12 = **91.7%**
```
🔴 identity 로직 재수정은 금지 범위라 **보고만** 한다. 🔴 「정밀도 100%」로 적지 않는다.

### 1-E. 🔴 브랜드 추론/사전/domain 매핑 — **채택 0**

```
❌ 후보 brand 채우기        `biskuit.kr` → **"비스킷"**(샵 이름) 실측 · 채우면 BRAND_MISMATCH 로 **더** 막힌다
❌ `og:site_name`           WU-009-A 실측 — 원상품 호스트 **25/26 이 멀티브랜드 리테일러**
❌ 공식몰 domain→brand 표    🔴 Registry 성격 → §12 「Registry 확대 금지」와 정면 충돌
❌ 품번으로 브랜드 확인       🔴 **순환** 이다 — 품번이 브랜드를 만들고 그 브랜드가 품번 SAME 을 승인한다
🟢 그리고 애초에 브랜드를 채워도 **CF-3 과 같은 효과** 다(brandOk 를 참으로 만드는 것) →
   별 레버가 아니라 **같은 정책 판단 하나** 다
```

---

## 2. 🔴 C27 본문 가격 — HOLD (증거가 HOLD 를 강화한다)

`beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021` 캐시 HTML **125,596 bytes** 실측:

```
application/ld+json        **0**
itemtype=schema.org/Product **0**
og:price / product:price    **0**
itemprop="price"            **0**
```

🔴🔴 **본문에 금액이 «8개» 다 — 일반 숫자 parser 금지가 데이터로 증명됐다**:
```
88,000원  ← 실제 상품가      3,500원 ← 배송비
0원 이상 ~ 80,000원 미만 ← 배송비 구간      80,000원 이상
1,000원 ×3                 🔴 **168,000원** ← 다른 금액
```
🔴 첫 번째가 맞는 것은 **우연** 이다. 「본문 첫 금액」 규칙이면 샵 레이아웃이 바뀌는 순간
**168,000** 을 집는다 — 가격이 2배가 되고, 그 값은 §4 경로로 **판매판정과 알림까지** 간다.

🟡 **유일한 구조화 후보도 안전하지 않다**:
```
<input type="hidden" name="set_goods_fixedPrice" value="88000.00" />
🔴 ⒜ 이것은 웹 표준이 아니라 **고도몰/Cafe24 계열 플랫폼 규약** 이다
      → CPO §2 「사이트/페이지 구조에 종속되지 않는 안전한 증거 방식」을 **충족하지 못한다**
🔴 ⒝ 이름이 **`fixedPrice`(정가)** 다 — 할인 판매가와 다를 수 있다
      (같은 페이지에 `set_goods_total_price value="0"` 이 따로 있다)
```
⟹ **HOLD.** 🔴 「가격 오인 가능성이 있으면 구현하지 않음」(CPO §2)에 **정확히 해당** 한다.

---

## 3. 🟢 transient 참고가격 수명 — 현 설계를 **보호계약으로 확정**

🟢 실측으로 동작이 정정됐다 — 헌장이 적은 「패널이 GET 으로 덮어쓴다」는 **판정** 이야기이고
**두 참고 축은 덮어쓰이지 않는다**:
```
setOverseasReference / setDomesticReference  ← POST `/check` 응답에서만 (Panel:2100-2101)
loadPriceHistory()(GET)                      ← 🟢 이 둘을 **건드리지 않는다**
⟹ 세션 안에서는 **살아 있고** · **페이지 새로고침(F5)** 에만 사라진다
```

🔴 **세션 내 유지를 더 넣지 않은 이유**(이것이 §3 의 답이다):
```
🔴 client 영속화(sessionStorage)를 넣으면 참고가격이 **그것을 만든 POST 보다 오래 살아남는다.**
   그런데 옆에 있는 **판정은 GET(DB 전용)** 에서 온다 → 둘이 **시간이 갈수록 벌어진다.**
   🔴 그러면 「이번 확인에만 쓰입니다」라는 문구가 거짓이 된다.
🟢 참고: 이 앱은 sessionStorage 를 **UI 상태(어느 탭인가)** 에만 쓴다 — 판정 데이터에는 쓰지 않는다.
🔴 DB 영속화는 금지(§12 보호계약 · transient 저장 금지).
⟹ CPO 가 준 선택지 중 **「실제 개선 가치가 없으면 현재 설계를 보호계약으로 확정」** 을 택했다.
```

---

## 4. 🟢 `price_alerts` / 알림 경계 — 원인 확정 · 🔴 정책 1건

### 4-A. 전수 추적 결과 — **해외와 국내가 다르다**

```
해외 transient  → overseasEvidence → `candidateOverseasPrice` **만**
                  🟢 `push` 직후 `continue` 라 판정 버킷에 **닿지 못한다**(계약으로 잠갔다)
                  ⟹ 해외 문구 「판매판정과 국내 최저가에는 반영되지 않습니다」는 **정확하다**
국내 transient  → exactShopRecords / comparisonShopRecords
                  → summarizeDomesticMarketSplit → domesticSummary
                  → computePriceDecision · sellerAction · sellability · representativeVerdict
                  ⟹ 🔴 **판정 입력이다**(WU-039 가 의도적으로 합쳤다)
                  ⟹ 그래서 국내 문구에 「판매판정 미반영」을 **적지 않은 것이 옳다**(WU-056)
```

### 4-B. 🔴🔴 그 경로가 **영속 알림** 까지 간다 — 정책 판단 1건

```
check/route.ts:168  computeMarketAlert({ sellerAction: intelligence.sellerAction, … })
               :175  await openAlertIfNotActive(…)   → **price_alerts 행이 DB 에 남는다**
market-alert.ts:84   sellerAction.status 로 분기 ← priceLevel ← decision.verdict ← **EXACT 전용**
```
⟹ **국내 transient 가 `EXACT` 를 받으면 그 입력으로 «영속 알림» 이 생성될 수 있다.**
🔴 「이번 확인에만 쓰이고 저장되지 않습니다」는 **가격** 이야기이고, **파생된 알림 행은 남는다.**

🟢 **다만 지금은 발화하지 않는다 — 그리고 그 이유가 §1 이다**:
```
🟢 국내 EXACT 가 **0** 이므로(§1) 현재 이 경로는 **도달하지 않는다**
🟢 알림의 «변화량» 축은 DB 전용이다 — `domesticShopTrend7d` = `getPriceHistory(…, "DOMESTIC_SHOP")`
🟢 `opportunity` 두 분기도 transient 가 못 민다 — 추세는 DB · 품절은 transient 가 `soldOut: null`
🔴🔴 **그러나 §1 과 §4 는 «같은 선» 에 있다** — CF-3 을 승인하는 순간 **§4 가 함께 열린다.**
   그래서 두 건을 **따로 판정하면 안 된다.** (이것이 이 WU 의 가장 중요한 발견이다)
```

---

## 5. 🔴 국내/해외 tier 비대칭 — 정책 판정 (숫자는 바꾸지 않았다)

| 축 | 담는 조건 | 코드 |
|---|---|---|
| 국내 | **`EXACT` · `COMPARISON`** 둘뿐 | `market-intelligence.ts:318` |
| 해외 | 🔴 **tier 무관 전부**(`REFERENCE` · `EXCLUDED` 포함) | `:253` push · 조건 없음 |

🔴🔴 **그래서 의미 충돌이 하나 남아 있다** — WU-056-R1 이 고친 것과 **같은 계열** 이다:
```
구역 제목   「🧾 **해외 동일상품** 참고가격」          (CEO PASS · 2026-10-17)
집계기      summarizeCandidateOverseasPrices(candidate-market.ts:137)
            → byCurrency[].lowestAmount 를 **tier 필터 없이** 계산한다
⟹ **「동일상품 아님」(EXCLUDED)으로 판정된 후보의 가격이 그 구역의 «최저가» 가 될 수 있다.**
🟢 계약 테스트로 그 사실을 고정했다 — EUR {EXACT 40, EXCLUDED 9} → lowestAmount **9**
```

🔴 **고치지 않은 이유**: CPO §5 가 「**숫자를 바꾸는 임의 필터링은 하지 않음**」을 명시했다.
tier 필터를 넣는 것은 최저가 숫자를 바꾸는 일이다 → **CPO 판정 사안.**
🟢 `EXCLUDED` 내부 토큰 노출 **0** 은 유지된다(`TIER_LABEL` → 「동일상품 아님」).

---

## 6. 🟢 WU-058 후속 UX 전수검사 — 잔재 **0** · 죽은 «틀린» 값 2개 정정

| | 항목 | 결과 |
|---|---|---|
| ① | 삭제된 `SourcingPanel` 참조 | 🟢 **0** (`SourcingPanel`·`SourcingSignal`·`SOURCE_SELECTING`·`buildSourceSelecting`·`StageFocus.sourcing`·nav `"sourcing"` 전수) |
| ② | 소싱 단계 / 소싱 URL 추가 UI | 🟢 **0** (마운트 DOM 4조합) |
| ③ | 잘못된 단계 번호 | 🟢 파생(`resolveWorkflow`) · 🔴 **builder 의 죽은 값이 `1,2,4,5` 였다 → `1,2,3,4` 로 정정** |
| ④ | 빈 단계 | 🟢 **0** — `MAIN_BY_STAGE`·`IMAGE_ROLE_BY_STAGE` 가 4단계와 1:1 |
| ⑤ | 구식 workflow 설명 | 🟢 현재 상태와 일치(「다섯」은 **②의 MI 내부 5항목** 이고 큰 단계가 아니다) |
| ⑥ | 가격 구역 중복/혼동 | 🟢 제목·아이콘·testId 분리(WU-056-R1) |
| ⑦ | 국내/해외 통화 오염 | 🟢 해외 구역 안에 `₩`·「약」·`≈` **0** |
| ⑧ | 내부 enum/token 노출 | 🟢 JSX 로 렌더되는 영문 토큰 **0**(전부 비교/switch 조건 또는 한국어 번역) |
| ⑨ | 죽은 import/export | 🟢 **0** |

🔴 ③ 은 **동작 변화 0** 이다(파생이 이긴다). 고친 이유는 **읽는 사람을 속이지 않기 위해서** 다 —
WU-058 의 「① ② ④ ⑤」 결함이 바로 그 값들에서 나왔다.

---

## 7. 🟢 핵심 루프 회귀 — 보호계약 전건 생존

```
AI 후보 URL → MI → SAME/DIFFERENT → 가격 검증 → 국내/해외 가격비교 → UI   🟢 유지
AI API 0 · Gemini 0 · 외부 HTTP 0 · 키 0 · 결제 ₩0
transient 저장금지 🟢 (`isTransientShopId(shopId)` upsert 앞 차단 · :1110)
SSRF/DNS rebinding 🟢 (`classifyOutboundUrl` · `guardedLookup` — 파일 변경 0)
COLOR_VARIANT 🟢 · SIZE_SYSTEM 🟢 · `priceSource:"detail"` 🟢 · 국내/해외 축 분리 🟢
환산 ↔ 참고가격 역할 분리 🟢 · 해외 구역 내부 KRW **0** 🟢 · 소싱 UI **0** 🟢
국내 판매판정 ↔ 참고가격 🟡 **분리가 아니다**(§4 — 국내는 판정 입력이다) · 계약으로 **명시** 했다
```

---

## 8. 구현 결과 (운영 변경은 죽은 상수 2개뿐)

```
운영   workflow.ts  builder 의 죽은 `index: 4,5` → `3,4`   (파생이 이기므로 동작 변화 **0**)
테스트 wu-059-boundaries.test.ts **13건** 신규 — §1 §3 §4 §5 경계를 계약으로 고정
       fixtures/wu-059-gt-facts.json — 🔴 GT 캐시의 **실측 facts** 를 커밋(손으로 만들지 않았다)
```

🔴 **하니스가 두 번 틀렸고 둘 다 기록한다**:
```
① 손으로 만든 facts 가 **실제보다 깨끗했다** — C27 verdict 가 `PRESUMED_SAME` 이 아니라
   `SIMILAR` 로 나왔다(축이 모자랐다). 🟢 실측 facts 를 fixture 로 커밋해 고쳤다.
   (메모 `fixtures-must-be-dirty` 가 적어 둔 그 함정이다)
② `sessionStorage` 단언이 실패했는데 실제로는 **주석 안의 설명** 이었다 —
   🔴 헌장이 「여덟 번 걸렸다」고 적어 둔 **주석 벗기기** 함정을 또 밟았다. 🟢 벗기고 고쳤다.
```

---

## 9. Negative / Mutation

baseline **13 passed** · 변형마다 **원상복구 확인**

| | 변형 | 결과 |
|---|---|---|
| M1 | `crossSellerReserved` 무력화(보류 해제) | 🔴 **1 failed** |
| M2 | 해외 evidence 를 판정 버킷에 섞기 | 🔴 **1 failed** |
| M3 | 국내 적재에 `REFERENCE`/`EXCLUDED` 허용 | 🔴 **1 failed** |
| M4 | 국내 문구에 「판매판정 미반영」 되살리기 | 🔴 **1 failed** |
| M5 | Panel 에 `sessionStorage` 영속화 도입 | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **13 passed** |

---

## 10~12. Regression / Typecheck / Build

```
회귀      apps/admin  **567 files / 8,224 passed** / failed 0 (skipped 94)
typecheck **0 errors** (🔴 한때 2 — 내 테스트의 `as Record<string, unknown>` 캐스트. baseline 과 비교해 잡았다)
build     **exit 0**
```

---

## 13. Commit / Push

```
339cc8e1  measure(059): 잔여 5영역 전수 — 완화하면 False SAME 이 «실제로» 난다 (HOLD, 운영 변경 0)
1c659f8c  docs(charter): §12 병목 넷 → 다섯으로 정정 — ①의 원인은 증상이 아니라 PRESUMED_SAME 보류다
git status                                            → clean
git rev-list --left-right --count origin/main...HEAD  → 0   0
```

## 14. Deploy

```
main push → Vercel Production 자동 배포 · `339cc8e1` 분 **● Ready**(duration 4m)
🔴 커밋 해시는 CLI 가 보여주지 않는다 — **타임스탬프로만** 대응시켰다(단정하지 않는다).
   확실한 증거는 빌드 로그의 `Commit:` 줄이다(메모 production-307-is-not-route-evidence).
🟢 **런타임 동작 변경이 0** 이므로 배포 전후 Production 거동이 같아야 한다 — §15 가 그것이다.
```

## 15. Production Evidence (read-only GET · 인증 앞단)

```
GET  /                            **200**
GET  /pipeline                    307   🟢 인증 리다이렉트(정상 보호)
GET  /today                       307   🟢 같음
POST /api/price-history/check     401   🟢 인증 가드(정상)
🔴 307/401 을 「route 가 없다」로 읽지 않는다.
🔴 그리고 이 네 값은 **동작 무변경의 증거이지 기능 증거가 아니다** — 이 WU 는
   화면/판정을 바꾸지 않았으므로 Production 에서 «새로 보일 것» 이 없다.
```

## 16. External API Evidence

```
AI / Gemini / 외부 검색 API  **0 호출** · 키 0 · 결제 **₩0**
외부 HTTP                    **0** — 전부 기존 GT 캐시 + 순수 함수
🟢 Gemini 잔액 ₩3,171 **보존**(flag OFF 유지 · 이 WU 가 flag 를 건드리지 않았다)
```

---

## 17. 🔴 Known Unknowns — 0% 로 적지 않는다

```
① 🔴 **CF-3 의 미측정 FP 모드** — 품번 재사용 샵의 다른 리스팅을 못 본 경우. GT 51 에 표본이 **없다**
② 🔴 **일반화 한계** — N=51 · 원상품 호스트 **2개** · 후보 도메인 ~15개. 전수 498 값이 아니다
③ 🔴 **§4 알림 경로의 «실제» 발화 횟수** — 국내 EXACT 0 이라 지금은 0 이지만,
   운영 `price_alerts` 행을 세어 확인하지 **않았다**(DB 쓰기 금지 구간 · 범위 밖)
④ 🔴 **C06 False EXACT 의 원인** — global.trenbe.com 이 왜 blockers 0 인지 미조사
⑤ 🔴 **beaumonde `set_goods_fixedPrice` 가 판매가와 같은 비율** — 1건만 봤다(측정불가)
⑥ 🔴 Production 실화면은 **CEO 만** 확인할 수 있다
```

---

## 18. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     🔴 CEO 확인 필요 여부는 **CPO 판정**
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음(외부 호출 0)
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지(§15)
```

---

## 19. 🔴🔴 CPO 판정 요청 — **5건 · 그중 둘은 «함께» 판정해야 한다**

| | 안건 | CTO 권고 | 🔴 주의 |
|---|---|---|---|
| ① | **CF-3**(`BRAND_UNCONFIRMED` 단독 + 품번 exact → 보류 해제) | 🟡 **보류 권고** | 측정 FP 0 · **미측정 FP 모드 1개** |
| ② | **§4 파생 알림** — transient 입력으로 만든 `price_alerts` 행을 남길 것인가 | 🟡 판정 필요 | 🔴🔴 **①을 승인하면 ②가 함께 열린다. 따로 판정하면 안 된다** |
| ③ | **§5 해외 집계 tier** — `EXCLUDED` 를 최저가에서 뺄 것인가 | 🟡 판정 필요 | 숫자가 바뀐다(CPO §5 가 임의 변경 금지) |
| ④ | **§2 `fixedPrice` 칸** — 플랫폼 종속 증거를 허용할 것인가 | 🔴 **비권고** | 「정가 ≠ 판매가」 위험 |
| ⑤ | **C06 False EXACT 1건** — 조사 WU 를 열 것인가 | 🟡 | identity 수정은 금지 범위 |

🔴 **CEO Action: 없음.** 이 WU 는 운영 동작을 바꾸지 않았으므로 Production 실화면 확인이
필요하지 않다. 🔴 CEO 확인이 필요한지는 **CPO 가 판정** 한다(§3 게이트).
