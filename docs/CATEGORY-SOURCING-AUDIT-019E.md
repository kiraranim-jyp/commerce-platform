# WU-019E — Category / Sourcing Dependency Audit (조사만 · 코드 0)

🔴 UI 제거 0 · validation 0 · API 0 · Registry 0 · extractor 0 · Suggest 0 · MI 0 ·
threshold 0 · 색상사전 0 · parser 0 · DB 0 · 새 검색 0 · AI 0 · **HTTP 0** · 비용 ₩0.

## ① 확정된 사실 (owner 경로 grep · 추측 0)

### Category — 🔴 **값의 출처가 「사용자 분석 입력」이 아니다**
```
resolveMarketCategoryScopes(product, snapshot.workspace.marketCategoryProfileId)
   price-history/check/route.ts:62      → run-domestic-price-check(categoryScopes)
resolveCategoryScopes({...})            domestic-price-sources/search/route.ts:127
comparison/search/route.ts:83           → sourceFitsScopes(s.categoryScope, categoryScopes)
```
🟢 즉 `categoryScopes` 는 **상품 + workspace 프로필**에서 파생된다.
🔴 그리고 **Discovery 에 실제로 영향을 준다** — `sourceFitsScopes` 가 **어느 샵을 뒤질지**
   고른다(category-scope.ts:88 주석: 「조사 대상 사이트를 정하는 값은 `categoryScopes` 하나뿐」).
→ 🔴 **「분석에 category 가 필요 없다」는 성립하지 않는다**(값은 자동 파생이지만 **쓰인다**).

### Sourcing — 🔴 **두 개가 서로 다른 것이다**
```
① 사용자-facing 소싱 선택   products/[id]/sourcing-candidates · selected-source
   → **해외 매입처 선택**(어디서 사 올 것인가)
② 시스템 내부 source/registry  domestic_price_sources · comparison_shops
   → **어디를 뒤질 것인가**(Discovery 대상)
🔴 ①과 ②는 다른 축이다. ①을 지워도 ②는 남는다(반대도 참).
```

## ② 판정 — 🔴 **일부 UNKNOWN 으로 남긴다**(이번 범위에서 전수 확인 못 함)

| 입력 | 분석 | Discovery | MI | 가격 | 등록 | 최종 |
|---|---|---|---|---|---|---|
| Category | 🟢 사용(자동 파생) | 🔴 **사용**(샵 선택) | ⚪ 미사용(확인됨 — MI owner 인자에 없음) | 🟡 UNKNOWN | 🟡 UNKNOWN | **KEEP**(값은 자동 파생) |
| Sourcing ①(사용자 선택) | 🟡 UNKNOWN | ⚪ 미사용(Discovery 는 ②를 쓴다) | ⚪ 미사용 | 🟡 UNKNOWN | 🟡 UNKNOWN | 🟡 **UNKNOWN** |

| 위치 | Category | Sourcing |
|---|---|---|
| 상단 Flow | 🟡 UNKNOWN(값 파생 경로는 workspace 프로필) | 🟡 UNKNOWN |
| 상품정보 영역 | 🟡 UNKNOWN | 🟡 UNKNOWN |
| 분석 API | 🔴 `categoryScopes` 로 **사용됨** | ⚪ 분석 payload 에서 미확인 |
| 등록 단계 | 🟡 UNKNOWN | 🟡 UNKNOWN |

🔴 **UNKNOWN 을 REMOVE 로 읽지 않는다.** UI 3곳(상단 Flow · 상품정보 · 등록)의 전수
추적은 이번 범위에서 끝내지 못했다 — 그 사실을 적는 것이 이 감사의 결과다.

## ③ Q 답
```
Q1 URL-only 분석 가능?   🟡 **UNKNOWN** — 분석 자체는 URL 로 시작하지만 Discovery 가
   `categoryScopes` 로 샵을 고르므로 「없어도 같은 결과」가 아니다
Q2 category 는 분석용인가 등록용인가  → 🔴 **분석(Discovery)에서도 쓰인다** → SPLIT 아님
Q3 sourcing 은 사용자 선택인가 내부 결정인가 → **둘 다 존재**(서로 다른 축)
Q4 Suggest 가 기존 sourcing 을 필요로 하는가 → 🔴 **comparison/search 경로는
   `sourceFitsScopes` 로 샵을 고른다.** 🟢 단 ALT-3 하니스는 **샵 목록을 코드에서 직접**
   줘서 66/66 이 됐다 — 그것은 「sourcing 의존이 없다」의 증거가 **아니다**(CPO 경고 그대로)
```

## ④ WU-019D Registry/extractor 결정 — **보류 유지**
🔴 Sourcing 판정이 UNKNOWN 이므로 extractor 확대 판단의 선행조건이 **아직 안 닫혔다**.

## ⑤ 다음 작업 후보 — 1개
🟡 **UI 3곳(상단 Flow · 상품정보 · 등록)의 category/sourcing 전수 추적** — 이번에 남긴
UNKNOWN 을 닫는 것 하나다. 🔴 조사만.
