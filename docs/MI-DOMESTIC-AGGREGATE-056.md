# WU-056 FINAL — 국내/해외 가격비교 집계·노출 E2E

> 🟢 **판정 = GO (코드·배포 완료).** 🔴 단 **Production UI PASS 는 CEO 1회 확인이 필요** 하다
> (로그인 뒤 화면은 CTO 가 볼 수 없다 · §18 이 허용한 「최종 사용자 테스트 1회」).
> 🔴 운영 **4파일** + 컴포넌트 일반화 1 · 새 컴포넌트 **0** · 새 집계기 **0** ·
> 권위 집계/판매판정/국내 최저가 **무변경** · 환산 **0** · transient 저장 **0**.

---

## 1. 전체 E2E 상태

```
AI 후보 URL → 후보 공급 🟢 → MI 판정 🟢 → 가격 evidence 🟢 → VERIFIED_CURRENT 🟢
   ├─ 국내 → 개별 후보 🟢 → **집계 🟢(이 WU)** → **UI 🟢(이 WU)**
   └─ 해외 → 개별 후보 🟢 → 집계 🟢(WU-049) → UI 🟢(WU-049 · 불변)
```

🔴 **직전 상태와의 차이는 두 칸뿐** 이다 — 국내 「집계」와 「UI」. 나머지는 WU-055 에서
이미 🟢 였다.

---

## 2. 국내 가격비교 집계 경로 (완성)

```
transient candidate
 → judgeDomesticCandidate        matchTruth · **priceTier(owner 값)**
 → market === "KR" && priceKrw   (runner:1294 · market-intelligence:216·262)
 → exactShopRecords / comparisonShopRecords   ← 🟢 권위 집계(DB 와 합쳐짐 · 무변경)
 → 🆕 domesticTransientRecords               ← 🔴 **별 배열**(이 WU)
 → candidateDomesticPrice = summarizeCandidateOverseasPrices(...)   ← 해외와 **같은 집계기**
 → POST /check 응답 `domesticReference`
 → Panel state → 「🇰🇷 국내 참고가격」 블록
```

🔴 **권위 집계를 오염시키지 않았다** — `domesticTransientRecords` 는
`summarizeDomesticMarketSplit`(국내 최저가 계산)에 **들어가지 않는다**(테스트가 그것을 단언).

---

## 3. 해외 집계 경로 — 🟢 **불변 · 연결 유지 확인**

```
candidateOverseasEvidence → candidateOverseasPrice → overseasReference → 「🌐 해외 참고가격」
🟢 WU-049 계약 **17/17 통과**(한 줄도 바꾸지 않았다)
🟢 route 응답에 두 칸이 **나란히** 실린다(테스트가 둘 다 단언)
```

---

## 4. 🔴🔴 최초 병목 — **둘이었다**

```
① POST `/check` 응답에 **국내 집계 칸이 없었다**
   (WU-049 가 해외만 열었다 — `overseasReference` 하나)
② 패널이 POST 직후 **`loadPriceHistory()`(GET)로 덮어쓴다**(Panel:2093)
   🔴 GET 은 `computeMarketIntelligence(snapshotId, ws)` — **인자 2개** 라
      transient 를 넘기지 않는다 → 그 값에 이번 후보가 **없다**
⟹ WU-055 가 국내 가격을 `VERIFIED_CURRENT` 까지 올렸는데도 **집계가 화면에 닿지 못했다.**
```

---

## 5. 수정 내용 — 운영 4파일 · 🔴 **새 계산 0**

```
market-intelligence.ts   + domesticTransientRecords[] (별 배열)
                         + candidateDomesticPrice  ← **해외와 같은 집계기** 호출
check/route.ts           + domesticReference: intelligence?.candidateDomesticPrice ?? null
DomesticPriceIntelligencePanel.tsx  state + 응답 파싱 + prop + 렌더
OverseasReferencePrice.tsx  문구 4개를 주입구로 열었다(기본값 = WU-049 상수)
overseas-reference.ts    + DOMESTIC_REFERENCE_{TITLE,NOTE,SCOPE}
```

🟢 **§11 준수 — 새 컴포넌트를 만들지 않았다.** 집계 모양(통화별 최저가 · 판매처 수 ·
등급)이 국내/해외에서 동일하고 빌더가 통화 중립이라, **같은 블록을 문구만 바꿔** 쓴다.
기본값이 해외 상수이므로 **기존 호출부와 계약 17건은 한 줄도 바뀌지 않는다.**

🔴 집계기 이름에 `Overseas` 가 남아 있다 — **해외 전용 로직이 0** 인 범용 함수이고
(통화·시장·tier 로만 묶는다), 바꾸면 WU-020/039/050 계약 3건이 함께 흔들려 **그대로 뒀다**.

### 🔴🔴 국내 문구는 해외 문구를 **복사하지 않았다**

```
해외  「참고용입니다 — 판매판정과 국내 최저가에는 반영되지 않습니다.」   🟢 유지(참이다)
국내  「이번 확인에만 쓰이고 저장되지 않습니다 — 새로고침하면 사라집니다.」
🔴 국내에 「판매판정 미반영」을 **쓰지 않았다** — POST 가 transient 를 포함한
   `sellerAction` 으로 `price_alerts` 를 갱신하므로(§10) 그 단정이 **좁게는 거짓** 이다.
   🟢 그래서 **확실한 사실만** 적었다. 문구 확대는 제품 정책이라 하지 않았다.
   🔴 그 선택을 테스트가 **단언으로 고정** 했다(국내 문구에 「판매판정」이 없어야 한다).
```

---

## 6. C27 결과 — 🔴 **여전히 막혀 있다** (§7 대로 무리하지 않았다)

```
beaumonde.co.kr · B226AC010 · Human GT SAME · 본문에 88,000원
현재  JSON-LD 0 · microdata 0 → 가격이 **본문 텍스트** → `VERIFIED_CURRENT` 미승격
      → priceKrw null → 국내 집계 미도달
🔴 **본문 숫자 parser 를 만들지 않았다**(§7 · §9 — 정가/할인가/배송비/쿠폰가 구분 불가)
🟢 그러나 **같은 가격대가 다른 샵에서 들어왔다** — `biskuit.kr` 이 **KRW 88,000** 으로
   국내 집계에 도달했다(Human GT **SAME**). 즉 C27 이 막혀도 그 상품의 국내 가격은 보인다.
```

---

## 7. 국내 KPI (GT 51건 · host 그룹 35 · WU-055 체인 재사용)

```
국내 가격비교 도달 host  **5**
  biskuit.kr          KRW  88,000  TEXT_CONFIRMED  COMPARISON  Human **SAME**
  biskuit.kr          KRW 258,000  TEXT_CONFIRMED  COMPARISON  Human **SAME**
  m.web.mustit.co.kr  KRW 226,000  TEXT_CONFIRMED  COMPARISON  (GT 없음)
  littleluna.co.kr    KRW 117,000  TEXT_CONFIRMED  COMPARISON  Human DIFFERENT
  miniboutique.co.kr  KRW 117,000  TEXT_CONFIRMED  COMPARISON  Human DIFFERENT
집계  KRW 최저 **88,000** · 판매처 5곳 · 등급 **유사상품 5**
```

🔴🔴 **과장하지 않는다 — 셋을 그대로 적는다**:
```
① **국내 `EXACT`(동일상품 가격)는 여전히 0.** 다섯 건 전부 `TEXT_CONFIRMED` →
   tier `COMPARISON` 이다. §19 의 「국내 SAME」을 **EXACT 기준으로는 충족하지 못했다.**
② 다섯 중 Human **DIFFERENT 2건** 이 섞인다. 🟢 `COMPARISON` 버킷이고 운영 규칙상
   `exact.sellerCount > 0` 이면 COMPARISON 전체가 무시되므로 **동일상품 가격으로
   쓰이지 않는다**. 🔴 그러나 「국내 참고가격」 집계에는 **들어간다**(판매처 5곳).
   그래서 구역 제목을 **「참고가격」** 으로 두고 등급(「유사상품 5」)을 같이 적는다.
③ 이 숫자는 **GT 51 표본** 이다 — 운영 전수 값이 아니다.
```

---

## 8. 해외 KPI — 🟢 **16 · 불변**

```
VERIFIED_CURRENT 16/16 · 통화 그대로(EUR·USD·GBP·JPY·CAD) · 환산 0
🟢 수정 전/후 **같은 16**(회귀 0)
```

---

## 9. MI 안전성 — 🟢 **완전 불변**

```
후보 49  SAME 12 · PRESUMED_SAME 23 · CONFLICT 10 · SIMILAR 4
🔴 FALSE SAME **2**(불변) · 🟡 SAME MISS **17**(불변)
matchTruth / priceTier / market 분포 **완전 동일**
🟢 identity 코드 변경 **0** — C06 · Grey Melange↔Graystone · AC042↔AC043 ·
   baby/kids · set/composition 계약 전건 통과(564 files)
🔴 하니스에서 **별 gate 를 만들지 않았다** — `judgeDomesticCandidate` 의
   `matchTruth`/`priceTier` 를 **owner 값 그대로** 썼다(WU-055 의 그 실수 재발 0).
```

---

## 10. `price_alerts` 영향 — 🔴 **A·B·C·D 모두 답한다**

```
A transient 가 price_alerts 에 저장되는가
  🔴 **간접적으로 그렇다.** transient 후보 «자체» 는 저장되지 않지만,
     POST `/check` 가 transient 를 포함한 `intelligence.sellerAction` 으로
     `computeMarketAlert` → `openAlertIfNotActive` / `resolveAlertsNotIn` 을 부른다
     (check/route.ts:168-183) ⟹ **price_alerts 행이 달라질 수 있다.**
B 의도된 기존 계약인가
  🟢 **그렇다.** WU-039 가 transient 를 `computeMarketIntelligence` 에 넘기도록
     열었고 CPO 가 GO 했다. 🔴 다만 WU-055 까지는 국내 축에 값이 들어가지 않아
     **사실상 무력** 했고, 이제 **실제로 작동한다.**
C 가격비교 집계와 seller decision 이 섞이는가
  🟢 **화면에서는 섞이지 않는다** — 「국내 참고가격」은 별 칸이고,
     `domesticCompetition`(권위 집계)과 화면의 판매판정은 **GET 기반** 이라 불변이다.
  🔴 **알림 경로에서는 섞인다**(위 A).
D 기존 문구와 모순이 있는가
  🟡 **좁은 범위에서 그렇다.** 기존 구역 문구
     「국내 최저가 및 판매판정에 영향을 주지 않습니다」(`TRANSIENT_SCOPE_NOTICE`)는
     **화면 기준으로는 참** 이고 **알림까지 포함하면 좁다.**
  🔴 **문구를 바꾸지 않았다** — 제품 정책이라 CPO 판정으로 올린다(§9 지시 그대로).
  🟢 대신 **새 국내 구역에는 그 단정을 쓰지 않았다**(§5).
```

---

## 11. UI 결과 — 마운트 DOM 으로 증명

```
🇰🇷 국내 참고가격            유사상품 5
   KRW 88,000   판매처 5곳
   「국내 판매처의 상세 페이지에서 확인한 가격입니다 — 원래 통화 그대로입니다.」
   「이번 확인에만 쓰이고 저장되지 않습니다 — 새로고침하면 사라집니다.」

🌐 해외 참고가격            동일상품 2 · 유사상품 1
   EUR 40   판매처 1곳
   USD 58   판매처 1곳
   「… 환율로 환산하지 않았습니다.」 / 「참고용입니다 — 판매판정과 국내 최저가에는 …」
```

🟢 개별 판매처 행은 **이미 있었다**(「국내」 뱃지 · 통화 그대로 · 검증상태 문구).
🟢 국내 구역을 해외 **앞** 에 둔다 — 셀러 질문 순서(「국내에 얼마에 파는가」 먼저).
🔴 값이 없으면 **구역 자체가 렌더되지 않는다**(「0건」으로 칸을 만들지 않는다).

---

## 12. GET / reload 경계 (§15)

```
POST 직후   🟢 「🇰🇷 국내 참고가격」·「🌐 해외 참고가격」 둘 다 보인다
새로고침     🔴 **둘 다 사라진다** — GET 은 `computeMarketIntelligence(snapshotId, ws)`
            **인자 2개** 로 transient 를 넘기지 않는다(소스로 확인)
🟢 권위 집계(국내 최저가·판매판정)는 새로고침해도 **그대로** 다 — 그 값은 DB 기반이다
🔴 **transient 영구 저장으로 풀지 않았다**(§15 금지). 「저장되지 않는다」를 **문구가
   직접 말한다** — 화면이 거짓말하지 않는 쪽을 택했다.
🟡 이것이 UX 를 깨뜨리는가 — **부분적으로 그렇다.** 셀러가 새로고침하면 방금 본
   국내/해외 참고가격이 사라진다. 🔴 해결은 「transient 를 어디에 둘 것인가」라는
   WU-039 §6 의 미결 결정이고 이 WU 범위가 아니다.
```

---

## 13. Mutation

```
M1 응답 칸 제거(`domesticReference`)        **1 FAIL**
M2 MI 집계를 빈 배열로                      **1 FAIL**
M3 패널 렌더 testId 제거                    **1 FAIL**
M4 국내 문구를 **해외 문구로 복사**          **1 FAIL**  ← 「판매판정 미반영」 단정 금지가 잠긴다
원상복구 **11 passed** · WU-049 **17 passed**(합 28)
```

---

## 14. Regression / Security

```
회귀      admin **564 files / 8,208 passed · failed 0**
typecheck **0** · build **exit 0**
security  🟢 fetch/URL 경계 **무변경** — `outbound-guard`(SSRF·사설IP·포트) ·
          `guardedLookup`(DNS rebinding) · redirect **한 줄도 건드리지 않았다**
          🟢 client bundle 영향 0 — 새 외부 import 0 · `node:dns` 유입 0(build 0)
금지 전수 AI 0 · Gemini 0 · Registry 0 · Sourcing 연결 0 · 환산 0 ·
          transient 영구저장 0(`isTransientShopId` 가드 그대로) · 새 tier 0 ·
          판매판정 임의 변경 0 · threshold 0 · 새 UI 컴포넌트 0
```

🔴 **typecheck 가 한때 4로 올랐다** — 내 패치 스크립트가 prop 타입을 **응답 json 타입**
블록에 잘못 넣어 식별자가 중복됐다. 정확한 블록으로 옮겨 0 으로 돌렸다(자진 보고).

---

## 15. Production

```
커밋 cd762a8f → main push → Vercel 배포
smoke  GET / **200** · /pipeline 307(인증) · POST /api/price-history/check 401(인증)
작업트리 clean · origin/main 0/0
```

---

## 16. 남은 문제

```
🔴 ① **국내 `EXACT` 0** — 다섯 건 전부 `TEXT_CONFIRMED`. EXACT 가 되려면 품번 축이
     서야 하고, 막는 것은 WU-054 가 찾은 그 질문이다(품번은 확인되는데
     `BRAND_UNCONFIRMED` 가 남는다). 🔴 identity policy 라 **HOLD 로 넘긴다**(§8 지시).
🔴 ② **C27(beaumonde)** — 가격이 본문 텍스트. 안전한 추출 기준 측정이 선행이다.
🟡 ③ **새로고침 시 참고 구역 소멸** — transient 수명 결정(WU-039 §6) 선행.
🔴 ④ **`TRANSIENT_SCOPE_NOTICE` 문구** — 알림 경로까지 포함하면 좁다(§10-D).
     제품 정책이라 바꾸지 않았다. **CPO 판정 요청.**
🟡 ⑤ Human DIFFERENT 2건이 「국내 참고가격」 집계(판매처 5곳)에 포함된다 —
     동일상품 가격으로는 쓰이지 않지만 셀러에게는 보인다. 등급을 같이 적어 완화했다.
```

---

## 17. 최종 판정

```
🟢 GO    — **그렇다(코드·배포 기준).** §19 의 두 축이 응답→화면까지 연결됐고
           Production 에 배포·smoke 완료. False SAME 증가 0 · 해외↔국내 오염 0 ·
           통화 손실 0 · transient 영구저장 0 · 판매판정 임의변경 0
🟡 단      **Production UI PASS 는 미확인** — 로그인 뒤 화면은 CTO 가 볼 수 없다.
           그리고 국내 `EXACT` 0 은 **identity WU 로 넘어간다**(§8)
🔴 STOP  — 아니다
────────────────────────────────────────────
**GO** (Code/Deploy) · **Production UI PASS 대기**
```

---

## 18. 🔴 CEO Action — **테스트 1회** (§18 이 허용한 그 한 번)

```
URL    https://ttaejyo.vercel.app/pipeline      (로그인 필요)
상품   Bobo Choses  Booty Ghosts Long Sleeve T-Shirt  (B226AC010)
       — 또는 Hug Hairy Monster T-Shirt (B226AC009)
```

**순서**
1. 상품을 연다 · **「상품정보」 탭** 에 머문다 (🔴 채널 탭에는 MI 가 없다)
2. `Market Intelligence` → 「**왜 이렇게 판단했나요?**」
   (🟡 한 줄 요약만 보이면 「**가격 판단 상세보기 →**」를 먼저 누른다)
3. 「**🔗 비교할 판매처 상품 URL (선택)**」 칸에 한 줄에 하나씩 — **국내 1 + 해외 1**
```
https://biskuit.kr/product/detail.html?product_no=
https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt
```
🔴 위 biskuit URL 은 **예시 형태** 다 — 정확한 상품 주소는 CPO 가 기존 GT 에서 집어
전달해 주셔야 한다(🔴 CTO 가 추정해 적지 않는다).

4. 「**🔄 다시 분석**」

**🟢 PASS — 금액이 아니라 구조를 본다**
```
① 「🇰🇷 국내 참고가격」 구역이 **뜬다** (KRW · 판매처 n곳 · 등급)
② 「🌐 해외 참고가격」 구역이 **같이 뜬다** (EUR/USD 등 **통화 코드 그대로**)
③ 두 구역이 **섞이지 않는다** — 해외 금액이 국내 구역에 없고, 그 반대도 없다
④ 「국내 최저가」·판매판정 숫자가 **해외 가격 때문에 움직이지 않는다**
⑤ 각 판매처 행에 「국내」/(해외는 뱃지 없음) + 검증상태 문구가 붙는다
```

**🔴 FAIL 기준**
```
원화로 환산된 외화 · 통화 코드 소실($/€만) · 해외 금액이 국내 구역에 표시 ·
국내 금액이 해외 구역에 표시 · 해외 가격이 국내 최저가에 합산 ·
참고가격 구역에 「동일상품 확인」 같은 승격 버튼
```

**🔴 FAIL 이 «아닌» 것**
```
금액이 예시와 다름 — 사이트 가격은 바뀐다
한쪽 구역만 뜸 — 그 축에 검증된 가격이 없는 것이다(정직한 동작)
🔴 **새로고침하면 두 구역이 사라짐 — 설계다**(transient 는 저장하지 않는다 · §12)
국내 구역에 「유사상품」으로 적힘 — 현재 국내 `EXACT` 는 0 이다(§16-①)
```
