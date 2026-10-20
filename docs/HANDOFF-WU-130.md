# 🔴 인수인계 — WU-130 부터 이어서 한다 (2026-10-20)

> 🔴 **새 세션은 이 문서 하나만 읽고 ⒜부터 바로 시작한다.** 재조사 금지 — 아래가 확정 사실이다.
> 🔴 헌장(`CLAUDE.md`) §12 가 전체 상태이고, 이 문서는 **다음 한 묶음의 실행 지시** 다.

---

## 0. 지금 어디인가 (한 줄)

> **MI 는 넣으면 정확히 판단한다. 문제는 「후보를 누가 찾아오는가」이고, WU-130 이 그것을 고친다.**

```
배포 상태   WU-113(샵 대표 선택 색상 2차 키) · WU-129 1단계(AI 답변 붙여넣기 파싱 결함 수정)
작업트리    clean · origin/main ahead 0 / behind 0 · Production `/` 200
누적 Human GT  **37건** (fixtures/wu-112·wu-116·wu-125-human-gt.json · 전부 **URL 키**)
가격        🔴 **HOLD** — 동일상품 단계가 실제 따져에서 확인된 뒤에만 시작
```

## 1. 🔴🔴 고정된 작업 순서 (CPO 확정 · 벗어나지 않는다)

```
① 자동 후보 공급(국내+해외) → ② 실제 따져 노출 → ③ CEO 육안 GT 누적
→ ④ MI 안정화 → ⑤ 그 다음에야 가격
🔴 CEO 는 **배포된 화면만** 본다. CTO 검토 artifact 는 **제품 PASS 가 아니다.**
🔴 CEO 에게 「다음에 뭘 할까요」를 묻지 않는다(§12 「운영 방식 고정」).
```

## 2. 🟢 WU-130 ⒜~⒟ — **이것만 하면 된다** (설계 확정 · 전문 `docs/MI-OVERSEAS-MERGE-130-DESIGN.md`)

```
목표  해외 자동검색(`searchComparisonShops`)을 `/check → MI → sink → 시장 가격 비교` 에 **합류**
🟢 국내 자동검색(`searchDomesticShops`)은 **이미 /check 에서 자동 실행된다**(:921·924) — 유지·확인만

⒜ transient-candidates.ts      `OVERSEAS_AUTO_SHOP_ID = "__overseas_auto__"` 추가 ·
                               `TRANSIENT_SHOP_IDS` 에 넣는다(술어 하나 유지 · 사본 금지)
⒝ overseas-auto-pool.ts(신규)   `listComparisonShops()` + `isCollectableAccess` + `sourceFitsScopes`
                               + `searchComparisonShops()` **그대로 재사용** ·
                               scope 는 `selectedMarketSourceScopes ?? resolveCategoryScopes`
                               (= `/api/comparison/search` 와 **같은 함수** · 복제 금지) ·
                               shopId 는 **OVERSEAS_AUTO_SHOP_ID** · domain 은 실제 판매처 유지
⒞ run-domestic-price-check.ts  `searchResults` 에 합류 한 줄 + evidence 출처 분기 **세 번째 가지**
⒟ check/route.ts               그 배열을 `computeMarketIntelligence` 에 **같이** 넘긴다
```

### 🔴🔴🔴 합류 전에 반드시 아는 함정 (이것 때문에 설계가 이 모양이다)

```
`/check` 후보 루프는 **비transient shopId 면** `upsertDomesticProductLink` 로
**`domestic_product_links` 에 쓴다**. `searchComparisonShops` 의 shopId 는
**`comparison_shops` 의 실제 id** 다 ⟹ 그대로 넣으면 **해외 판매처가 국내 링크
테이블에 저장되고** 국내 최저가·판정 입력·`price_alerts` 까지 오염된다.
🟢 transient shopId 로 넣으면 `isTransientShopId()` 가 **upsert 앞에서 끊는다** ⟹ 구조적 안전.
```

### 합류 전 실측 2건 (추측 금지)

```
① `searchComparisonShops` 반환이 `ComparisonSearchResult`(`r.candidates`·`r.domain`·`r.status`)
   와 **같은 모양인가**
② 해외 후보에 `judgeDomesticCandidate` 를 그대로 써도 되는가 —
   국내 품번 추출기(`fetchDomesticModelCode`)가 해외 도메인에 **null** 을 주는지 **실측**
   (기존 Gemini 후보와 같은 조건이면 OK)
```

## 3. 그 다음 (같은 묶음 안에서 이어서)

```
② E2E — S1 `B226AC010` · S2 `B226AC009` 를 원상품으로, **아무것도 붙여넣지 않고**
   원상품 → /check → 국내/해외 후보 → facts → MI → sink → market intelligence → /pipeline
③ 「+ AI 조사 결과 붙여넣기」 **사용자 UI 제거**(파서 `extractCandidateUrlsFromAiAnswer` 는 **보존**)
   🔴 ②가 확인된 **뒤에** 한다 — 먼저 지우면 화면이 완전히 비어 보인다
④ 🇰🇷 국내 참고가격 · 🧾 해외 동일상품 참고가격 **표시 구역 제거** →
   **「시장 가격 비교」 한 구역** 에서 국내/해외를 나눠 보여준다
   🔴 **표시만** 바꾼다 — `domesticTransientRecords` · `candidateDomesticPrice` ·
      `computeMarketAlert` · 가격 계산은 **불변**(지우면 판정·알림이 바뀐다)
   🔴 계약 `wu-056r1-price-section-identity` 를 「구역 **안** 의 국내/해외 분리」로 갱신해야 한다
⑤ 전체 회귀(**8,406 기준**) · typecheck **0** · build exit 0 · 배포 · worktree clean → **보고 1회**
```

## 4. 🔴 절대 건드리지 않는 것 (지시서 §9 전수)

```
MI 8축 · threshold · SAME/PRESUMED/CONFLICT 기준 · color/brand/model code 보호 ·
matchLevel · MATERIAL · GARMENT_FORM · 새 identity 축(**소매 길이 축 금지**) ·
가격 계산/판정 · `domesticTransientRecords` · `candidateDomesticPrice` · `computeMarketAlert` ·
Registry 확대 · 신규 adapter · snapshot 재사용 · 외부 URL 영구 저장 · 새 schema/migration ·
외부 AI API · Gemini 비용 활성화 · AI 의 SAME/DIFFERENT 판단 사용 ·
셀러에게 URL 입력/AI 조사 요구
```

## 5. STOP 조건 (이 넷만 CPO 에게 올린다)

```
① 외부 AI API/비용 정책 ② 영구 저장 정책 변경 ③ 보안/정책 경계
④ 파괴적 Production 변경에 사업 승인 필요
🔴 그 외는 조사 → 원인 확정 → 최소 수정 → 테스트 → 회귀 → E2E → 배포까지 **CTO 가 끝낸다.**
```

## 6. 이 트랙에서 반복된 실수 (새 세션이 먼저 읽는다)

```
🔴 **칸 이름을 추측하지 않는다** — 이번 세션도 `pool.droppedUrls`(없는 칸) · `ProductFacts.category`
   로 두 번 틀렸다. 타입/운영 코드에서 **읽고** 쓴다.
🔴 **정규식을 쉘/파이썬 문자열로 편집하지 않는다** — 백슬래시가 소실된다. **Edit 로** 쓴다.
🔴 **미커밋 구현의 복구에 `git checkout --` 를 쓰지 않는다** — 구현이 지워진다(파일 백업 사용).
🔴 **변이가 «적용됐는지» 확인한다** — 적용 실패를 「통과」로 읽은 적이 있다.
🔴 **하니스가 운영 경로를 그대로 베낀다** — 직접 함수를 부르면 **배선 결함을 못 본다**(소스 앵커 병행).
```

## 7. CEO 에게 드릴 말 (완료 보고 때 **한 번만**)

> 「배포했습니다. **아무것도 붙여넣지 말고** `B226AC009` / `B226AC010` 을 열어서
> 🇰🇷 국내 / 🌎 해외 후보가 **자동으로** 나타나는지만 확인해 주십시오.」
