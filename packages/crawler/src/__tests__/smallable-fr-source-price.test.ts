import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd } from "../product-data-extractor";

/**
 * SMALLABLE-PRICE-1(CPO 지시, 2026-09-12) — "Smallable 원본 상품가격 기준 = FR".
 *
 * 여기서 고정하는 것은 **금액 그 자체**다. 위 정책(source-currency-policy.ts)이
 * URL에 `?currency=EUR&country=FR`을 붙이는지는 별도 테스트가 지키고, 이 파일은
 * 그렇게 받아온 페이지에서 실제로 어떤 숫자가 나오는지를 못박는다.
 *
 * 실측 근거(2026-09-12, 실제 추출 경로 universalExtract로 확인):
 *
 *     country=   430651   430705
 *     KR           73       63
 *     FR           75       65     ← 원본 상품가격
 *     US           79       68
 *     JP           81       70     ← Production 크롤러 egress가 JP라 여태 이 값이었다
 *
 * FR인 근거는 판매자가 공시한 판매조건이다: 표시가는 프랑스 부가세가 포함된 EUR이고,
 * EU 밖으로 배송하면 프랑스 부가세를 빼고 도착국가 세금·관세를 따로 물린다. 배송비도
 * 도착지별로 따로 계산한다. 따라서 FR 값만이 도착지 비용이 섞이지 않은 원본
 * 상품가격이고, KR 73/63은 "한국까지 배송된 값"이라 국제배송비·수입비용 정책과
 * 경계가 뭉개진다.
 *
 * 430705의 FR 값은 **짐작하지 않고 새로 실측했다**. KR 63에서 유추하면 63이지만
 * 실제로는 65다 — 국가별 차이가 상품마다 같은 폭이 아니라는 뜻이라, 한 상품에서 잰
 * 차이를 다른 상품에 옮겨 쓰면 안 된다.
 *
 * 네트워크를 타지 않는다. fixture는 위 실측 때 렌더링된 페이지에서 JSON-LD 스크립트를
 * 그대로 떠온 것이다(breadcrumb 마지막 항목의 URL에 `?country=FR&currency=EUR`이
 * 남아 있어서, fixture만 봐도 어느 국가 응답인지 확인할 수 있다).
 */
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");

describe("smallable FR 원본가격 — 실측값을 고정한다", () => {
  it("핵심 회귀: 430651(B.C. Organic Cotton Zipped Sweatshirt) → EUR 75.00", () => {
    const r = extractFromJsonLd(fixture("smallable-430651-fr.html"));
    expect(r?.sku).toBe("AAA1804641");
    expect(r?.price).toEqual({ amount: 75, currency: "EUR" });
    // KR/JP 값이 새어 들어오면 즉시 실패한다 — 여기서 걸러야 착지원가까지 안 번진다.
    expect(r?.price?.amount).not.toBe(73);
    expect(r?.price?.amount).not.toBe(81);
  });

  it("핵심 회귀: 430705(Organic Cotton Bobo Ample Joggers) → EUR 65.00", () => {
    const r = extractFromJsonLd(fixture("smallable-430705-fr.html"));
    expect(r?.sku).toBe("AAA1804944");
    expect(r?.price).toEqual({ amount: 65, currency: "EUR" });
    // KR 63을 그대로 옮겨 쓰는 실수를 막는다 — FR은 65다.
    expect(r?.price?.amount).not.toBe(63);
  });

  it("두 상품이 서로의 가격을 받아가지 않는다", () => {
    const a = extractFromJsonLd(fixture("smallable-430651-fr.html"));
    const b = extractFromJsonLd(fixture("smallable-430705-fr.html"));
    expect(a?.sku).not.toBe(b?.sku);
    expect(a?.price?.amount).not.toBe(b?.price?.amount);
  });
});

/**
 * 지키는 불변조건: **상품을 특정하지 못하면 가격은 없다.**
 *
 * smallable 상품 페이지는 ProductGroup 안에 색상 변형이 나열되고, 그 중 지금 보고
 * 있는 색상만 offers를 가진다. 나머지 형제 변형은 URL만 있다(fixture의 430650이
 * 그렇다). 페이지에는 그 외에도 추천상품 카드가 잔뜩 있다. 상품을 특정하지 못했을 때
 * 옆 상품 가격이나 "아무 숫자"를 끌어오면, 값이 비어 있을 때보다 훨씬 나쁘다 —
 * 비어 있으면 사람이 알아채지만 틀린 숫자는 착지원가까지 조용히 흘러간다.
 */
describe("상품을 특정하지 못하면 가격을 만들어내지 않는다", () => {
  it("핵심 회귀: Product 노드가 없으면 null — 이웃 상품 가격을 대신 쓰지 않는다", () => {
    // 실제 페이지 구조에서 Product만 빠진 형태: breadcrumb + 가격을 가진 추천상품 카드.
    const html = `<!DOCTYPE html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"item":"https://www.smallable.com/en","name":"Home"}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"url":"https://www.smallable.com/en/product/other-430650","offers":{"@type":"Offer","priceCurrency":"EUR","price":"73"}}]}</script>
</head><body></body></html>`;
    expect(extractFromJsonLd(html)).toBeNull();
  });

  it("JSON-LD가 아예 없으면 null", () => {
    expect(extractFromJsonLd("<!DOCTYPE html><html><head></head><body>73 €</body></html>")).toBeNull();
  });

  it("Product는 있지만 offers가 없으면 가격만 비운다 — 제목/SKU는 살린다", () => {
    // 통화와 무관한 필드까지 같이 버리면 지금까지 얻던 정보가 사라진다.
    const html = `<!DOCTYPE html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"No Offer Product","sku":"AAA0000001","brand":{"@type":"Brand","name":"Bobo Choses"}}</script>
</head><body></body></html>`;
    const r = extractFromJsonLd(html);
    expect(r?.sku).toBe("AAA0000001");
    expect(r?.price).toBeUndefined();
    expect(r?.priceValidity).toBe("MISSING");
  });
});
