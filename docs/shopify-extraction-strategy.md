# Shopify 우선 추출 + Rate Limit 대응 설계안 (제안, 미구현)

> 상태: **설계안 — 구현 보류.** CTO 지시("원인을 확정한 이후에 구현을 진행해주세요")에
> 따라 이 문서는 승인 전까지 코드 변경을 하지 않는다.

## 1. 확인된 사실 (Experiment A-E, production 실측)

`https://www.junioredition.com/en-kr/collections/bobo-choses/products/tangerine-all-over-baby-swim-cap-by-bobo-choses`
대상, `commerce-platform-mocha.vercel.app`에서 직접 실행:

| # | 방식 | 결과 |
|---|------|------|
| A | Playwright (`page.goto`, networkidle) | **HTTP 429**, `server: cloudflare`, `retry-after: 60`, body `local_rate_limited` |
| B | `fetch()` HTML, Chrome UA | **HTTP 200**, 782,949 bytes, 정상 상품 페이지 |
| B' | `fetch()` HTML, UA 없음 | **HTTP 200**, 동일 |
| D | `fetch()` `/products/{handle}.json` | **HTTP 200**, 4,607 bytes, 정상 상품 JSON |
| E | `fetch()` `/products/{handle}.js` | **HTTP 200**, 5,455 bytes, 정상 상품 JSON |

Playwright만 재실행해도 여전히 429(우연/시점 문제 아님을 재확인) — 같은 Vercel egress에서
같은 순간에 plain fetch는 전부 성공했다. **결론: Cloudflare는 Playwright의 브라우저
자동화 요청 패턴(다수의 서브리소스 요청 + 자동화 지문)만 차단하고 있고, 단일 HTML/JSON
fetch는 전혀 막지 않는다.** 이는 CTO가 제시한 4가지 가설 중 "Playwright가 서브리소스를
과다 요청해서 걸린다"에 부합하며, 이번 실험으로는 "Vercel Shared IP" 가설을 완전히
기각하지는 못한다(같은 IP에서 fetch는 통과했으므로 최소한 "IP 자체가 영구 차단"은 아니다).

이 사실 하나로 기존 코드의 구조적 문제도 같이 드러났다: `shopifyStrategy`
(`packages/crawler/src/strategies/shopify.strategy.ts`)는 이미 plain `fetch()`로
`/products/{handle}.json`을 가져오는 로직을 갖고 있지만, `canHandle(ctx)`가 `ctx.html`
(Playwright가 렌더링한 HTML) 안의 `window.Shopify` 마커를 찾는 방식이라 **Playwright
네비게이션이 성공해야만 실행된다.** 즉 지금 구조에서는 Shopify JSON 우회 로직이 이미
있어도 Cloudflare가 그 앞 단계(Playwright 네비게이션)를 막으면 전혀 도달하지 못한다
(`packages/crawler/src/universal-extractor.ts:96` `page.goto()` 호출이 모든 Strategy보다
먼저 실행됨).

## 2. 설계 — Shopify는 Playwright 이전에 판별한다

핵심 변경: Shopify 여부 판별을 **HTML 콘텐츠 기반(사후)**이 아니라 **URL 패턴 기반(사전)**으로
옮긴다. 이러면 브라우저를 켜지도 않고 JSON 우회를 먼저 시도할 수 있다.

```
extractProductImages(url)
  │
  ├─ isLikelyShopify(url)?  (URL 정규화 후 /products/{handle} 패턴 존재 여부만 확인 —
  │                          HTML을 아직 받지 않았으므로 도메인 자체의 Shopify 여부는
  │                          모른다. 대신 "실패해도 비용이 거의 없다"는 점을 이용해
  │                          낙관적으로 먼저 찔러본다.)
  │
  ├─ Yes → fetchShopifyProductJson(url)   (plain fetch, Playwright 없음, 수백ms)
  │           │
  │           ├─ 200 + product.images 존재 → 이미지 후보 확정, 종료
  │           │   (JSON-LD/OpenGraph는 그대로 병행 fetch해서 가격/브랜드 등
  │           │    상품 메타데이터 보강에 사용 — 이미지만 JSON으로 끝내고
  │           │    나머지 상품정보 추출은 기존 Playwright DOM 스캔에 의존하고
  │           │    있으므로, 이 경로를 타도 상품명/가격까지는 못 채운다.
  │           │    → 3항 참고)
  │           │
  │           └─ 실패(404/타임아웃/스키마 불일치) → Shopify 아니거나 JSON 엔드포인트가
  │               막힌 것 → 기존 경로로 폴백
  │
  └─ 폴백 경로(기존과 동일) → Playwright 실행 → JSON-LD → OpenGraph → Shopify(HTML 기반,
      기존 로직 유지) → DOM Scan → 0건이면 재시도 1회
```

### 2-1. 상품 메타데이터(가격/브랜드/설명)는 어떻게 되는가

이번 조사는 이미지 추출 실패("이미지를 찾지 못했습니다.")에서 시작했지만, 실제로
`extractProductData()`도 같은 `page.content()` HTML을 재사용하므로 Playwright가 막히면
가격/브랜드도 함께 못 가져온다. Shopify JSON 응답(`/products/{handle}.json`)에는
`title`, `body_html`, `vendor`(브랜드), `variants[].price` 가 포함되어 있으므로, 이미지뿐
아니라 **상품 데이터 추출도 JSON 우선 경로에 포함시키는 것을 함께 제안한다** — 그래야
"Playwright가 막힌 Shopify 사이트"에서 이미지는 나오는데 가격/브랜드는 비어 있는 반쪽짜리
결과를 피할 수 있다. `product-data-extractor.ts`의 기존 우선순위(JSON-LD → Microdata →
OpenGraph → DOM)에 **Shopify JSON을 최우선으로 추가**하는 형태가 된다.

### 2-2. 캐시 영향

현재 코드에는 페이지/이미지 레벨 캐시가 없다(요청마다 새로 크롤링). 이 설계는 캐시 계층을
새로 만들지 않는다 — Shopify JSON 경로는 요청당 fetch 1~2회로 이미 가볍기 때문에 캐시
없이도 기존 대비 순수 이득(브라우저 미기동)이다. 캐시는 이번 설계 범위 밖으로 남긴다.

### 2-3. 기존에 동작 중인 사이트(비-Shopify)에 대한 영향

`isLikelyShopify(url)`이 URL 패턴만 보고 `false`를 반환하는 사이트(LillaMode/PrestaShop
등)는 **분기 자체를 안 타므로 코드 경로가 100% 동일하게 유지된다** — 회귀 위험 없음.
URL 패턴이 우연히 `/products/{handle}`과 비슷한 비-Shopify 사이트가 있다면 JSON fetch가
404/HTML-아님으로 실패하고 곧바로 기존 폴백으로 넘어가므로, 최악의 경우도 "불필요한 fetch
한 번 추가"일 뿐 결과가 달라지지 않는다.

## 3. Rate Limit 대응 설계 (3순위)

이번 조사에서 확인된 범위(Playwright 자동화 패턴 차단)에 한해서는 위 1번 설계(Playwright
회피)가 가장 직접적인 해결책이다. 다만 Playwright가 최종 폴백으로는 계속 남으므로,
아래 항목들을 함께 제안한다 — 전부 `packages/crawler` 내부에 도메인 단위로 적용:

- **Retry-After 준수**: 429 응답을 받으면 헤더의 `retry-after` 값을 읽어 그 시간만큼은
  같은 도메인으로 재시도하지 않는다(현재는 폴백 재시도가 대기시간과 무관하게 즉시 발생).
- **도메인별 최소 요청 간격**: 마지막 요청 시각을 도메인별로 기록해두고(in-memory Map,
  서버리스 인스턴스 생존 기간에만 유효 — Vercel 특성상 완벽한 전역 제어는 안 되지만
  같은 웜 컨테이너 내 연속 요청은 줄일 수 있다), 최소 간격 미만이면 대기 후 실행.
- **동일 도메인 동시 요청 제한**: 현재 이미지 다운로드 단계(`packages/image`)는 여러
  이미지를 병렬로 내려받는데, 같은 CDN 도메인에 대해 동시성 상한을 두면 다운로드
  단계에서의 유사한 차단 위험도 줄어든다.
- **지수 백오프**: 429/5xx 시 1회 재시도 한정, 대기시간은 `retry-after` 우선 → 없으면
  1s → 2s → 4s 캡.
- **도메인별 큐**: 위 항목들을 모으면 자연스럽게 "도메인별 요청 큐"가 된다 — 새 유틸
  (`packages/crawler/src/domain-rate-limiter.ts` 제안)로 분리해 `universalExtract`와
  이미지 다운로드 양쪽에서 재사용.

이 항목들은 Shopify 여부와 무관하게 모든 사이트에 적용되는 범용 안전장치이므로, 구현
승인 시 Shopify JSON 설계와 별도로 진행해도 무방하다.

## 4. 디버그 라우트 처리 (4순위, 완료)

`/api/debug/navigate`는 `DEBUG_NAVIGATE_TOKEN` 환경변수가 설정되어 있고 요청 헤더
`x-debug-token`이 일치할 때만 동작하며, 토큰 미설정 시 404를 반환해 라우트 존재 자체를
드러내지 않는다. 삭제하지 않고 유지한다(커밋 `969f301`, 배포 완료).

## 5. 다음 단계

이 문서는 설계안이다. 구현 승인이 나면 제안 순서는:
1. `isLikelyShopify` URL 판별 + JSON fetch 우선 경로 (이미지 + 상품데이터 함께)
2. Rate Limit 유틸(`domain-rate-limiter.ts`) — 크롤러/이미지 다운로드 공통 사용
3. 비-Shopify 실사이트(LillaMode 등) 회귀 테스트로 검증 후 배포
