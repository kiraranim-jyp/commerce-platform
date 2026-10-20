# WU-130 ① 구현 설계 — 해외 자동검색 합류 (🔴 파괴적 함정 1건 선확정)

> 🔴 CPO WU-130: 「이미 존재하는 해외 자동검색 생산자를 `/check → MI → sink → 시장가격 비교`
> 경로에 **합류** 시킨다. 새 검색 시스템을 만드는 작업이 아니다.」

---

## 1. 🔴🔴🔴 **먼저 — 그대로 합치면 «운영 DB 를 오염» 시킨다**

```
`/check` 의 후보 루프는 `searchResults` 를 돌면서 **비(非)transient shopId 면**
`upsertDomesticProductLink` 로 **`domestic_product_links` 에 쓴다**(:1293 부근 가드).
🔴 해외 자동검색(`searchComparisonShops`)이 돌려주는 shopId 는 **`comparison_shops` 의
   실제 id** 다 ⟹ 그걸 그대로 `searchResults` 에 넣으면
   **해외 판매처가 «국내 링크 테이블» 에 저장된다.**
🔴🔴 그것은 ⒜ FK/의미 오염 ⒝ 국내 최저가·판정 입력 오염 ⒞ `price_alerts` 오발화
   까지 번지는 **파괴적 변경** 이다. 🔴 **이 함정을 모른 채 합류하면 안 된다.**
```

## 2. 🟢 그래서 합류 방식은 **기존 아키텍처가 이미 정해 뒀다** — transient 생산자로 넣는다

```
WU-024 가 만든 공용 primitive(`transient-candidates.ts`)의 설계 그대로다:
  ① `__gemini_discovery__`  ② `__url_candidates__`  ③ **새로 추가: `__overseas_auto__`**
🟢 `isTransientShopId()` 가 **upsert 앞에서 끊는다** ⟹ DB 오염이 **구조적으로 불가능** 하다
🟢 그 뒤는 **기존 경로 그대로** — facts → MI → `transientEvidenceSink` →
   `computeMarketIntelligence` → 해외 집계 → 시장 가격 비교
🔴 새 MI·새 판정·새 가격 계산 **0**(지시서 §4·§7 준수)
```

### 구현 단위 (파일 4개 · 다음 세션 1묶음)

```
⒜ transient-candidates.ts   `OVERSEAS_AUTO_SHOP_ID = "__overseas_auto__"` 추가 ·
                            `TRANSIENT_SHOP_IDS` 에 넣는다(술어 하나 유지 · 사본 금지)
⒝ (신규) overseas-auto-pool.ts  `listComparisonShops()` + `sourceFitsScopes` + 
                            `searchComparisonShops()` 를 **그대로 재사용** 해
                            `ComparisonSearchResult[]`(shopId = OVERSEAS_AUTO_SHOP_ID ·
                            domain 은 **실제 판매처 도메인 유지**)로 돌려준다
                            🔴 scope 결정은 `/api/comparison/search` 와 **같은 함수** 를 쓴다
                            (`selectedMarketSourceScopes ?? resolveCategoryScopes`) — 복제 금지
⒞ run-domestic-price-check.ts  `searchResults` 에 **합류 한 줄** ·
                            evidence 배열을 출처별로 가르는 기존 분기에 세 번째 가지 추가
⒟ check/route.ts            그 배열을 `computeMarketIntelligence` 에 **같이** 넘긴다
                            (이미 geminiEvidence/urlCandidateEvidence 를 합쳐 넘기는 그 자리)
```

## 3. 🔴 합류 «전에» 확인할 것 둘 (다음 세션 첫 두 단계)

```
① `searchComparisonShops` 의 반환이 `ComparisonSearchResult` 와 **같은 모양인가**
   (국내 루프가 `r.candidates`·`r.domain`·`r.status` 를 읽는다)
② 해외 후보에 `judgeDomesticCandidate` 를 **그대로** 써도 되는가 —
   그 함수는 국내 품번 추출기(`fetchDomesticModelCode`)를 호출한다.
   🟢 해외 도메인은 추출기 등록부에 없어 **null 을 돌려준다**(= 기존 Gemini 후보와 동일 조건)
   🔴 그래도 **실측으로 확인** 한다(추측 금지).
```

## 4. 🔴 UI 순서는 고정(지시서 §6)

```
① 합류 → ② E2E 로 해외 후보가 자동으로 뜨는 것 확인 → ③ **그 뒤에** 붙여넣기 UI 제거
→ ④ 참고가격 두 구역 → 「시장 가격 비교」 통합
🔴 ③을 먼저 하면 화면이 **완전히 비어 보인다**(국내 0 + 해외 미합류).
```

## 5. 이번 세션 산출 / 상태

```
🟢 산출 — 합류 방식 확정 + **파괴적 함정 1건 선확정**(해외 shopId 를 그대로 넣으면 안 된다)
🔴 코드 변경 **0** · 작업트리 **clean** — 다음 세션이 ⒜부터 바로 시작한다
```
