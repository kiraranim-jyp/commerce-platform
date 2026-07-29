# 플랫폼별 옵션(Variant) 추출 가능 여부 조사

CPO 지시(P0-1): "URL 하나 넣으면 자동등록" 컨셉에서 옵션을 못 가져오면 상품 절반
이상이 결국 사람 손을 다시 타게 된다 — 옵션 자동화 우선순위를 AI 콘텐츠 생성보다
위로 올린다.

**신뢰도 표기 원칙**: 이번 세션에서 실제 대상 URL로 직접 검증한 것만 "실측
(확인됨)"으로 표시한다. 공식 문서/업계 통념 기반 추정은 "추정(미검증)"으로
분명히 구분한다 — 확인 안 된 걸 확인됐다고 적지 않는다.

## Epic A — Shopify: 실측(확인됨)

`junioredition.com`의 실제 상품(`tangerine-all-over-baby-swim-cap-by-bobo-choses`)
을 `{origin}/products/{handle}.json`로 직접 조회해서 확인함(이 엔드포인트는
`packages/crawler/src/shopify-product-json.ts`가 **이미 이미지 추출을 위해
호출하고 있다** — 옵션 데이터도 같은 응답 안에 이미 들어 있는데 지금은 버려지고
있다는 뜻).

**실제 응답 구조**:
```json
{
  "options": [
    { "name": "Size", "position": 1, "values": ["Baby Hat 48cm (6-12 Months)", "Baby Hat 50cm (1-2 Years)"] }
  ],
  "variants": [
    {
      "title": "Baby Hat 48cm (6-12 Months)",
      "price": "21.00", "price_currency": "GBP", "compare_at_price": "42.00",
      "sku": "AB22-2", "barcode": "8445782375526",
      "option1": "Baby Hat 48cm (6-12 Months)", "option2": null, "option3": null,
      "inventory_quantity": 2, "image_id": null
    },
    { "title": "Baby Hat 50cm (1-2 Years)", "sku": "AB23-2", "inventory_quantity": 5, "...": "..." }
  ],
  "images": [ { "id": 75208910242168, "src": "...", "variant_ids": [] }, "..." ]
}
```

| 항목 | 가능 여부 |
|---|---|
| option1/2/3 | 가능 — `variants[].option1/2/3` |
| 옵션명(Size/Color 등) | 가능 — `options[].name` (다국어/자유 텍스트, 매장마다 다름) |
| 옵션 값 목록 | 가능 — `options[].values[]` |
| Variant별 SKU | 가능 — `variants[].sku` |
| Variant별 가격 | 가능 — `variants[].price` + `price_currency`(할인 전가는 `compare_at_price`) |
| Variant별 재고 | 가능 — `variants[].inventory_quantity` (단, `inventory_management`가 `null`이면 재고추적 안 하는 매장이라 이 필드가 의미 없을 수 있음) |
| 옵션 이미지 | **구조적으로 가능, 이번 상품엔 없음** — `images[].variant_ids`로 특정 이미지를 특정 variant에 연결하는 필드가 존재하지만, 이번 실측 상품은 색상 옵션이 없어서(사이즈만) 전부 빈 배열(`variant_ids: []`)이었다. 색상 옵션이 있는 다른 Shopify 상품으로 별도 검증 필요. |

**가능 %(Shopify)**: **거의 100%** — 지금 크롤러가 이미 호출하는 API 응답에
전부 들어있다. 추가 네트워크 호출 없이 파싱 필드만 늘리면 된다(`packages/crawler/src/shopify-product-json.ts`의
`ShopifyJsonVariant`/`ShopifyJsonOption` 인터페이스가 지금 `price`/`name`만
읽고 나머지를 버리고 있음).

**제한사항**:
- 옵션명이 매장마다 자유 텍스트(Size/Colour/색상 등 전부 다름) — CartPilot
  표준 모델(P0-2)로 정규화 필요.
- `inventory_management`가 꺼져있는 매장은 재고 수치를 못 믿는다(무제한 판매
  매장일 수 있음).
- 옵션 이미지는 매장이 실제로 연결해뒀을 때만 있다(구조는 100% 지원, 데이터는
  매장 나름).

## Epic B — Magento: 추정(미검증)

이번 세션에 실제 Magento 매장 URL로 테스트하지 않았다 — 공식 문서/업계 통념
기준 추정치다.

- Shopify처럼 인증 없이 붙는 단일 공개 JSON 엔드포인트가 없다.
- 상품 상세 HTML에 configurable product의 옵션/가격/재고 매트릭스가
  `data-mage-init` 속성 안 JSON blob(`Magento_ConfigurableProduct/js/...`)으로
  임베드되는 경우가 흔함 — DOM 파싱(Playwright) 필요, 사이트/테마마다 구조가
  다를 수 있음.
- 매장이 `/graphql` 엔드포인트를 열어뒀으면 인증 없이 `configurable products`
  쿼리로 variant SKU/가격/속성을 받을 수 있다는 게 일반적인 Magento 2 동작이나,
  매장마다 GraphQL이 꺼져 있거나 CORS로 막혀 있을 수 있음.

**가능 %(Magento)**: 추정 50~70%(매장 설정에 크게 좌우) — **실제 대상 매장
URL이 있어야 확정 가능**.

## Epic C — WooCommerce: 추정(미검증)

- 공식 REST API(`/wp-json/wc/v3/products`)는 컨슈머 키/시크릿 인증이 필요해서
  CartPilot처럼 매장 소유자 인증 정보 없이 접근하는 구조와 안 맞는다.
- WooCommerce Blocks가 쓰는 Store API(`/wp-json/wc/store/v1/products/{id}`)는
  공개/무인증인 경우가 많다는 게 일반적으로 알려진 동작이지만, 이번 세션에
  실제 매장으로 검증하지 못했다 — 매장의 WooCommerce 버전/설정에 따라 막혀
  있을 수 있다.
- JSON-LD(`schema.org/Product`)의 `offers` 배열로 폴백 가능하나, 보통 가격
  범위/재고 유무 정도만 있고 옵션별 SKU 전체 매트릭스까지는 잘 안 담는
  매장이 많다.

**가능 %(WooCommerce)**: 추정 40~60% — **실제 대상 매장 URL 필요**.

## Epic D — Shopline: 추정(미검증, 근거 부족)

공식 문서 페이지에 접근했으나 문서 상세 내용을 확인하지 못했다("Storefront
API"/"Ajax API" 존재 자체는 확인했지만 인증 요구사항 등 세부 스키마 미확인).
**실제 대상 Shopline 매장 URL 없이는 가능 여부를 단정할 수 없다** — 추측성
숫자를 적지 않는다.

## Epic E — Cafe24/Makeshop 등 국내 플랫폼: 조사 착수 전

이번 조사에서 다루지 못했다. Cafe24는 Open API가 있지만 매장별 OAuth 인증이
필요해 보이고, 스토어프론트 HTML에 옵션 JSON이 임베드되는 방식(국내 플랫폼
공통 패턴)일 가능성이 높다 — **다음 조사 대상**.

## 종합

| 플랫폼 | 옵션 추출 가능 여부 | 신뢰도 | 근거 |
|---|---|---|---|
| Shopify | 가능(거의 100%) | **실측** | 이미 호출 중인 API 응답에 전부 있음 |
| Magento | 조건부 가능(추정 50~70%) | 추정 | 매장 GraphQL/HTML 구조에 좌우 |
| WooCommerce | 조건부 가능(추정 40~60%) | 추정 | Store API 공개 여부에 좌우 |
| Shopline | 미확정 | 근거 부족 | 실제 매장 URL 필요 |
| Cafe24/Makeshop | 미조사 | - | 다음 스프린트 |

**결론**: 지금 당장 실행 가능하고 확실한 건 Shopify다 — 크롤러가 이미 갖고
있는 데이터를 버리고 있을 뿐이다. Magento/WooCommerce/Shopline/Cafe24는
"확인됨"이라고 보고할 수 없다 — 실제 대상 매장 URL을 받아야 진짜 가능 여부를
알 수 있다.
