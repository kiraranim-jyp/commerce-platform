# Discovery Benchmark Harness

`MI-DISCOVERY-LONGSPRINT-P1 / P1.1` — 외부 Search 를 **1차 후보군 Discovery** 로 쓰고
기존 MI 를 **2차 Truth Layer** 로 유지했을 때 실제로 나아지는지 재기 위한 실험 하니스.

> 🔴 **이것은 Production 코드가 아니다.** `@commerce/crawler` 의 `index.ts` 가 이
> 디렉터리를 export 하지 않고, 그 사실을 `__tests__` 의 Architecture Boundary 테스트가
> 지킨다. Production 런타임은 여기 있는 것을 하나도 import 하지 않는다.

## 절대원칙

```
Search = Recall          외부 검색은 «후보 URL 발견» 까지만
MI     = Precision/Truth 동일성·가격의 진실은 기존 MI 가 정한다
```

그래서 계약에 **외부 검색이 SAME/SIMILAR 를 말할 자리가 없다.** `DiscoveredUrl` 에는
`verdict`·`matchTruth`·`similarity` 칸이 **없고**, 테스트가 그 부재를 단언한다.

## 파이프라인

```
ProductIdentity
   ↓  query-generator.ts        Q1..Q8 (없는 칸으로 쿼리를 «지어내지 않는다»)
DiscoveryProvider[]             외부/내부 — URL 만 돌려준다
   ↓  candidate-pool.ts         1차 중복 제거 (추적 파라미터만 제거, ?variant= 는 보존)
   ↓  url-resolver.ts           ★ 이번 스프린트의 새 경계
   │    ├ redirect resolve
   │    ├ 404 detection
   │    ├ canonical detection
   │    ├ product / listing / unknown 분류   (상품 판별이 목록보다 «먼저»)
   │    └ locale normalization  → origin + handle 재조립
   ↓  candidate-pool.ts         2차 병합 (dedupeKey = origin|handle — 판매처는 «합치지 않는다»)
CrawlerAdapter                  주입 — 기존 크롤러를 부른다
   ↓
MiAdapter                       주입 — 기존 deriveMatchTruth / priceTierFromLink 를 부른다
   ↓  kpi.ts                    못 재는 것은 null (0 이 아니다)
LaneResult
```

## 왜 URL Resolver 가 독립 계층인가

2026-10-07 실측(표본 10 · 일반 웹검색, Main Story / Bobo Choses 2종):

| 결과 | 건수 |
|---|---:|
| 사용 가능한 상품 URL | **1** |
| 목록/브랜드 페이지 | **7** |
| 404 (검색 색인이 낡음) | 1 |
| 302 → 홈 (URL 모양은 상품) | 1 |

외부 검색 URL 을 그대로 크롤러에 넣으면 **70% 가 목록 페이지**다. 그래서 중간 계층이
필요하다.

## 🔴 이번 단계에서 «하지 않는» 것

| | 왜 |
|---|---|
| 목록 페이지에서 상품 추출 | 사이트별 Parser 프로젝트로 변질된다 — 그게 Closed Registry 의 비용이다. `LISTING_PAGE` 로 정확히 식별하고 **보류** 한다 |
| Google / Naver 실제 연동 | 자격증명 대기 (CEO) |
| Identity · 가격 로직 수정 | 기존 것을 **주입받아 부른다**. 하니스가 판정을 흉내 내면 벤치마크가 기존 시스템이 아니라 하니스를 재게 된다 |
| Main Story 레지스트리 등록 | 별도 작업 (P1.1 §17) |
| Shopify suggest `limit` 5→10 | 별도 최적화 후보로 **기록만** (P1.1 §18) |

## 실측에서 배운 함정 셋 (테스트로 고정됨)

1. **목록 «아래» 중첩된 상품 URL** — `/en-kr/collections/{c}/products/{h}` 는 상품이다.
   목록 판별이 먼저 오면 진짜 상품을 버린다.
2. **검색 URL 을 그대로 크롤러에 넘기면 로케일 가격으로 샌다** — junioredition 은
   `/en-kr/` 로 리다이렉트하고, 기존 크롤러는 로케일이 있으면 그 로케일 가격(KRW)을
   믿는 분기를 탄다. 그래서 `origin + handle` 로 재조립한다. 🔴 **크롤러 가격 로직을
   고치지 않고** adapter 경계에서 보호한다.
3. **`?variant=` 를 중복제거로 지우면 안 된다** — 이 저장소는 그걸 버렸다가
   「UK 11 을 골라 준 URL 이 UK 4 가격으로 바뀐」 사고를 냈다(P0-A.29-E).

## 쓰는 법

```ts
const lane = await runLane("Hybrid", jobFixture, [provider], {
  probe,      // (url) => { status, finalUrl, canonicalUrl }
  crawler,    // 기존 크롤러를 감싼 것
  mi,         // 기존 deriveMatchTruth / priceTierFromLink 를 감싼 것
});
const kpi = computeJobKpi(lane, jobFixture.groundTruth);
```

🔴 `probe`·`crawler`·`mi` 를 **주입** 하는 이유는 ① 테스트가 네트워크 없이 모든 분기를
덮게 하고 ② 하니스가 호출 수를 **실제로 세게** 하기 위해서다(§11-J 비용은 추정하지
않는다).

## 남은 선행 조건

```
P0  JOB-261007-001~005 export (3 엔드포인트 × 5건)      CEO
P0  Ground Truth URL/domain 확정                        CEO/CPO
P0  GEMINI_API_KEY (1회용 → 측정 → 즉시 폐기)            CEO   비용: 무료 한도 내
P1  Naver 쇼핑검색 API 자격증명 (선택)                   CEO
    Lane 개명 승인 — Gemini+grounding / Naver shop.json  CPO
```

`JobFixture` 와 `JobGroundTruth` 타입이 그 입력이 들어올 자리다. 데이터가 오면
provider 구현 + 실제 probe/crawler/mi 배선만 붙이면 벤치마크가 돈다.
