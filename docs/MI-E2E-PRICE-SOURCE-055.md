# WU-055-A FINAL — AI 후보 URL → MI → 국내/해외 가격비교 E2E

> 🟡 **판정 = HOLD.** 🟢 **국내 가격비교 경로가 처음으로 열렸다(도달 0 → 5)** 이고
> 해외 16 **불변** · MI 안전성 **완전 불변** 이다. 🔴 그러나 §20 의 GO 조건 중
> **「국내 «동일상품(EXACT)» 가격」은 여전히 0** 이라 전체 E2E 가 완성되지 않았다.
> 🔴 운영 변경 **2파일 · 2곳** · 새 정책 **0** · 환산 **0** · Registry **0** · AI **0**.

---

## 1. 전체 E2E 현재 상태 (GT 51건 · host 그룹 35 · 운영 함수만)

| 축 | 상태 |
|---|---|
| A 후보 공급 | 🟢 **작동** — 51 URL → pool 진입 49 · host 그룹 35 |
| B MI 연결 | 🟢 **작동** — 전건 `judgeDomesticCandidate` 통과(또는 명시적 DROP 3) |
| C 동일상품 | 🟡 FALSE SAME **2** · SAME MISS **17** (이 WU 에서 **불변**) |
| D 국내 가격 | 🟢 **0 → 5** (이 WU 의 수정) · 🔴 단 전부 `COMPARISON` |
| E 해외 가격 | 🟢 **16** (WU-049/051 그대로 · 불변) |
| F 화면 | 🟢 **이미 그린다** — 「국내」 뱃지 · 통화 그대로 · 검증상태 문구 |

```
landing   🟢 해외 참고가격 16 · 🟢 국내 가격비교 5 · D 가격없음 9 · B 판정전탈락 3 · E 시장미확정 2
market    OVERSEAS 16 · UNKNOWN 11 · KR 5 · (판정전 3)
matchTruth EXACT_IDENTIFIER 4 · STRONG_IDENTIFIER 8 · TEXT_CONFIRMED 16 · CONFLICT 2 · SIMILAR 2
priceTier  EXACT 12 · COMPARISON 16 · EXCLUDED 2 · REFERENCE 2
```

---

## 2–3. 🔴🔴 최초 병목과 원인 — **필드 하나가 빠져 있었다**

```
product-url-facts.ts htmlPath
   priceStatus: VERIFIED_CURRENT  🟢 세운다
   priceSource:                   🔴 **세우지 않았다**
        ↓
withConfidence → derivePriceStatus(match.ts:537)
   priceSource !== "detail"  ⟹  **UNVERIFIED_SEARCH 로 되돌린다**
        ↓
enrichCandidatePrices
   전부 blanket UNVERIFIED_SEARCH · **Shopify handle 이 있는 것만** 복구
        ↓
⟹ 국내 비-Shopify 후보는 `VERIFIED_CURRENT` 가 **구조적으로 불가능**
⟹ `priceKrw = VERIFIED_CURRENT && KRW` 가 항상 null → 국내 축 진입 **0**
```

🔴 **실측이 그것을 그대로 보여줬다** — 수정 전:

```
해외 도달 16건 → priceStatus VERIFIED_CURRENT **16/16**
국내 KR 5건    → priceStatus **UNVERIFIED_SEARCH 전건** → 「D 가격 없음」으로 탈락
                 (KRW 88,000 / 226,000 / 258,000 / 117,000 ×2 를 **갖고 있었는데도**)
```

### 🔴🔴 그리고 내 1차 하니스가 **게이트를 지어냈다 — 그 결과를 버렸다**

```
내가 쓴 것   국내 축 자격 = `crossSellerVerdict === "SAME"`
운영의 실제  market === "KR" && priceKrw != null && priceTier ∈ {EXACT, COMPARISON}
             (+ 그 앞에 `judgeDomesticCandidate` 가 있다)
⟹ 1차 측정은 「MI blockers 때문에 국내가 막힌다」는 **틀린 결론** 을 냈다.
🟢 운영 순서로 다시 짜자 **matchTruth/tier 는 28/35 가 이미 자격을 갖췄고**
   병목은 **가격 검증 한 곳** 임이 드러났다.
🔴 §5-B 가 여덟 번 경고한 「운영 경로를 한 단계 빠뜨렸다」의 **아홉 번째** 다.
```

---

## 4. 기존 51건 측정 — 🔴 **URL 을 새로 만들지 않았다**

```
입력  WU-036 Human GT 51건(23 도메인 · SAME 27 / DIFFERENT 23 / UNCERTAIN 1)
      + DB 의 실제 원상품 스냅샷 6건(S1~S6 · source_url 로 조회)
비용  실제 HTTP(읽기 전용) · AI 0 · Gemini 0 · DB 쓰기 0
🟢 원상품 품번이 전건 있다 — B226AC010 / B226AC009 / B126AI018 / 01195-VERNICE-NERO /
   B226AC117 / AW26MS185 (🔴 내 덤프가 `canonical_product.identifier` 를 읽어 「null」로
   잘못 보고했다 — 실제 칸은 `sku` 이고 DNA 가 `identifier` 를 파생한다. **12번째** 칸 추측 실수)
```

---

## 5. 국내 가격비교 결과 — 🟢 **0 → 5**

| searchId | 판매처 | Human GT | matchTruth | tier | 가격 | 시장 근거 |
|---|---|---|---|---|---|---|
| S2 | **biskuit.kr** | **SAME** | TEXT_CONFIRMED | COMPARISON | **KRW 88,000** | KR_TLD_AND_KRW |
| S6 | m.web.mustit.co.kr | (GT 없음) | TEXT_CONFIRMED | COMPARISON | KRW 226,000 | KR_TLD_AND_KRW |
| S6 | **biskuit.kr** | **SAME** | TEXT_CONFIRMED | COMPARISON | KRW 258,000 | KR_TLD_AND_KRW |
| S4 | littleluna.co.kr | DIFFERENT | TEXT_CONFIRMED | COMPARISON | KRW 117,000 | KR_TLD_AND_KRW |
| S4 | miniboutique.co.kr | DIFFERENT | TEXT_CONFIRMED | COMPARISON | KRW 117,000 | KR_TLD_AND_KRW |

🟢 **CPO 가 WU-050 에서 전달한 AI 가격 `88,000` · `117,000` 대역이 실제로 국내 축에
들어왔다** — 다만 출처는 beaumonde 가 아니라 **biskuit.kr** 이다.

🔴🔴 **과장하지 않는다 — 셋을 그대로 적는다**:
```
① **전부 `COMPARISON`(유사상품)** 이고 `EXACT`(동일상품 가격)는 **0** 이다.
   EXACT 가 되려면 matchTruth 가 EXACT/STRONG_IDENTIFIER 여야 하고, 이 다섯은
   전부 TEXT_CONFIRMED 다. ⟹ **국내 «동일상품» 가격은 여전히 0.**
② 다섯 중 **Human DIFFERENT 가 2건** 이다(littleluna · miniboutique).
   🟢 그 둘은 `COMPARISON` 버킷이고, 헌장 기록대로 `exact.sellerCount > 0` 이면
      COMPARISON 전체가 무시된다 → **동일상품 가격으로 쓰이지 않는다.**
   🔴 그러나 「국내 유사상품」 목록에는 **보인다.**
③ WU-054 의 C27(beaumonde · 품번 일치 · 88,000)은 **여전히 막혀 있다** —
   그 샵은 가격이 **본문 텍스트** 라 JSON-LD/microdata 로 읽히지 않는다(§14).
```

---

## 6. 해외 가격비교 결과 — 🟢 **16 · 완전 불변**

```
priceStatus VERIFIED_CURRENT **16/16** · 통화 그대로(EUR · USD · GBP · JPY · CAD)
🟢 WU-049/051 규칙 유지 — 환산 0 · 기호만 표시 0 · 국내 최저가 합산 0 ·
   판매판정 변경 0 · PRESUMED→EXACT 승격 0
🔴 수정 전/후 **같은 16** 이다(회귀 0).
```

---

## 7. MI SAME/DIFFERENT — 🟢 **완전 불변** (§7 보호 충족)

```
후보 49건  verdict  SAME 12 · PRESUMED_SAME 23 · CONFLICT 10 · SIMILAR 4
🔴 FALSE SAME **2** (수정 전과 동일)
🟡 SAME MISS **17** (수정 전과 동일)
matchTruth / priceTier / market 분포 **완전 동일**
⟹ 🟢 identity 를 한 줄도 건드리지 않았다는 **직접 증거** 다.
```

🟢 보호 대상 유지 확인: C06 · Grey Melange↔Graystone · AC042↔AC043 · baby/kids ·
set/composition — 관련 계약 테스트가 전체 회귀에서 전건 통과(563 files).

---

## 8. 가격 검증 결과

```
수정 전  VERIFIED_CURRENT 16 · UNVERIFIED_SEARCH 14 · PRICE_UNAVAILABLE 2 · (미설정 3)
수정 후  VERIFIED_CURRENT **21** · UNVERIFIED_SEARCH 9 · PRICE_UNAVAILABLE 2 · (미설정 3)
🟢 늘어난 5건은 **전부 상세 페이지에서 직접 읽은 가격** 이다(목록 가격 승격 0).
🔴 「임의 숫자 추출」 0 — 가격은 여전히 JSON-LD / microdata 에서만 온다(§9 준수).
   정가·할인가·배송비·쿠폰가·회원가 구분 로직을 **만들지 않았다**.
```

---

## 9. 변경 파일 — 운영 **2파일 · 2곳**

```
packages/crawler/src/comparison-search/product-url-facts.ts
  + priceSource: priced ? "detail" : null      ← 상세에서 읽었다는 «사실» 을 적는다
packages/crawler/src/comparison-search/price-source-adapter.ts
  ~ enrichCandidatePrices 가 priceSource==="detail" 을 **덮어쓰지 않는다**
```

🔴 **새 정책이 아니다.** 신뢰도 규칙은 여전히 `derivePriceStatus`(match.ts:537) 하나이고,
그 주석이 자격 사례까지 적어 뒀다 — 「**검색 자체가 상세 페이지를 조회하는 경우**」.
`factsFromProductUrl` 이 정확히 그 경우인데 그 사실이 **기록되지 않았을** 뿐이다.

🟢 **영향 범위가 transient 경로로 한정된다(전수 확인)**:
```
enrichCandidatePrices 호출부는 둘 — shopifySuggestAdapter(:345) · transient 루프(:1078)
  · shopify-suggest 후보는 `priceSource` 를 세우지 않는다 → 보존 분기에 안 들어온다
  · `priceSource:"detail"` 을 세우는 **bobochoses.com 어댑터는 `enrichScored` 가 없다**
    → 이 함수를 애초에 타지 않는다
  · rakuten-ichiba 도 `enrichCandidatePrices` 를 쓰지 않는다
```

---

## 10. E2E (§17 Test 1~7)

| | 조건 | 결과 |
|---|---|---|
| 1 | 국내 SAME → verified KRW → 국내 가격비교 | 🟡 **도달 5** · 🔴 tier 는 COMPARISON |
| 2 | 해외 SAME → verified → 해외 참고가격 | 🟢 **16** |
| 3 | DIFFERENT → 가격비교 제외 | 🟢 CONFLICT 2 → `EXCLUDED` · SIMILAR 2 → `REFERENCE` |
| 4 | PRESUMED → EXACT 승격 금지 | 🟢 PRESUMED 23 중 EXACT tier **0**(전부 TEXT_CONFIRMED 이하) |
| 5 | SAME + 가격 없음 → 제외 | 🟢 「D 가격 없음」 9건 |
| 6 | 여러 통화 코드 유지 | 🟢 EUR/USD/GBP/JPY/CAD 각각 보존 |
| 7 | 국내+해외+DIFFERENT 혼합 분리 | 🟢 S4·S6 에서 세 축이 각각 올바른 영역 |

---

## 11. Mutation

```
M1 `priceSource: "detail"` 제거            **1 FAIL**(소스 가드)
   🔴 정직하게 적는다 — 기능 단언은 fixture 가 `priceSource` 를 직접 세우므로
      **잡지 못했다.** fix ① 의 행동 커버리지는 **live 체인(국내 0→5)** 이다.
M2 enrich 의 detail 보존 분기 제거          **3 FAIL**(기능 2 + 가드 1)
원상복구 **9 passed**
🔴 하니스 결함 1건 자진 보고 — `selectCandidatesForDetailConfirmation` 의 **정의** 가
   함수보다 앞에 있어 slice 가 비었다(함수 시작 이후로 끊어 고쳤다).
```

---

## 12. Regression / Build / Security

```
회귀      admin **563 files / 8,197 passed · failed 0**
typecheck **0** · build **exit 0**
security  🟢 fetch/URL 경계 **무변경** — `outbound-guard.ts`(SSRF·사설IP·포트) ·
          `guardedLookup`(DNS rebinding) · redirect 처리 **한 줄도 건드리지 않았다**.
          변경 2파일은 둘 다 **기존에 받은 응답을 해석** 하는 자리다.
          🟢 client bundle 영향 0 — 새 import 0 · `node:dns` 유입 0 (build 0 확인)
금지 전수 AI 0 · Gemini 0 · consumer AI 0 · Registry 0 · Sourcing 연결 0 ·
          GTIN 승격 0 · 색상사전 0 · threshold 0 · PRESUMED 자동승격 0 ·
          카테고리 확장 0 · UX 대개편 0 · listing parser 0 · 새 URL 0 ·
          환산 0 · transient 저장 0(`isTransientShopId` 가드 그대로)
```

---

## 13. Production

```
커밋 2ef8f072 → main push → Vercel 배포
smoke  GET / **200** · /pipeline 307(인증) · POST /api/price-history/check 401(인증)
작업트리 clean · origin/main 0/0
```

---

## 14. 남은 병목 — 🔴 **셋이고 서로 다르다**

```
🔴 ① 국내 «EXACT» 가 0 — 다섯 건 전부 `TEXT_CONFIRMED`(→ COMPARISON) 다.
     EXACT 가 되려면 품번 축(EXACT/STRONG_IDENTIFIER)이 서야 하고, 그것을 막는 것은
     WU-054 가 찾은 그 질문이다 — **품번이 확인됐는데 BRAND_UNCONFIRMED 가 남는다**.
     🔴 그 완화는 SAME 게이트/정책 변경이라 CPO 판정 사안이고 손대지 않았다.
🔴 ② beaumonde(C27)는 여전히 막혀 있다 — 가격이 **본문 텍스트**("88,000원")라
     JSON-LD/microdata 로 읽히지 않는다. 🔴 「본문 숫자+원」 추출은 §9 가 금지한
     단순 숫자 추출과 맞닿아 안전성 측정이 선행이다.
🟡 ③ 화면의 **집계** 는 transient 를 반영하지 않는다 — 개별 판매처 행은 「국내」 뱃지와
     금액·검증상태를 **이미 보여주지만**, 국내 «최저가» 집계는 GET 경로(transient 미전달)
     에서 오므로 바뀌지 않는다. 🟢 WU-049 와 같은 구조이고 **저장하지 않기 때문** 이다.
```

### 🔴🔴 그리고 **새로 활성화된 쓰기 경로 하나를 보고한다**

```
POST /check 는 transient 를 포함한 `intelligence.sellerAction` 으로
`computeMarketAlert` → `openAlertIfNotActive` / `resolveAlertsNotIn` 을 호출한다
(check/route.ts:168-183 · **price_alerts 에 쓴다**).
🔴 수정 전에는 국내 축에 값이 안 들어가 그 경로가 **사실상 무력** 했다.
   이제 KRW 가격 5건이 들어가므로 **알림이 달라질 수 있다.**
🟢 WU-039 가 열어 둔 설계대로 동작하는 것이고 새 경로가 아니다.
🟢 **화면의 판매판정은 불변** 이다 — 그 값은 GET(transient 미전달)에서 온다.
   그래서 구역 문구(「국내 최저가 및 판매판정에 영향을 주지 않습니다」)는
   **화면 기준으로는 여전히 참** 이다.
🔴 그러나 「알림」까지 포함해 읽으면 그 문구가 좁다 — **문구 조정은 제품 정책이라
   임의로 바꾸지 않았다.** CPO 판정 사안으로 올린다.
```

---

## 15. 최종 판정

```
🟢 GO    — 아니다. §20 의 「국내 SAME 가격비교 작동」을 **EXACT 기준으로는** 충족하지
           못했다(국내 EXACT 0). 유사상품 축만 열렸다
🟡 HOLD  — **그렇다.** 최초 병목(가격 검증)은 **해결·배포** 했고 국내 축이 처음 열렸다.
           남은 셋(①품번↔브랜드 보류 ②본문 가격 ③집계 전달)은 전부 **정책 판단** 이다
🔴 STOP  — 아니다. 보안/ToS/비용/파괴적 변경 요인 없음
────────────────────────────────────────────
**HOLD** (🟢 부분 GO — 국내 가격비교 경로 개통 · 해외 불변 · MI 불변)
```

---

## 16. CEO Action — **테스트 1회 (선택)**

🔴 화면에 **새 구역이 생기지 않는다.** 바뀌는 것은 「국내」 뱃지가 붙은 transient 후보의
가격 상태 문구가 **「판매처 표시가 · 상세 검증 전」 → 「상세 페이지에서 확인한 가격」** 으로
올라가는 것이다.

```
URL    https://ttaejyo.vercel.app/pipeline      (로그인 필요)
경로   상품정보 탭 → Market Intelligence → 「왜 이렇게 판단했나요?」
       → 「🔗 비교할 판매처 상품 URL (선택)」 → 「🔄 다시 분석」
```

🟢 **기대 — 국내 판매처 URL 을 넣었을 때**
```
「국내」 뱃지 + 금액(예: KRW 88,000) + **「상세 페이지에서 확인한 가격 · 판매판정 미반영」**
```
🔴 **FAIL 기준** — 원화로 환산된 외화 · 통화코드 소실 · 미검증 가격이 「확인한 가격」으로
표시됨 · 해외 가격이 국내 최저가에 합산됨.

🔴 **이 테스트는 필수가 아니다** — 코드 축 검증은 끝났고(563 files / 8,197), 화면 변화가
문구 한 줄이다. CPO 가 필요하다고 판단할 때만 요청하면 된다.
