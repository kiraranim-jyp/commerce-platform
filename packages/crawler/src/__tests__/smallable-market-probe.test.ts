import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { probeAdditionalMarkets, supportsSiteMarketProbe } from "../market-probe";
import { extractFromJsonLd } from "../product-data-extractor";
import { withSourceMarketCountry, withSourceCurrency, supportsMarketCountryProbe } from "../source-currency-policy";
import {
  SMALLABLE_CANDIDATE_MARKET_COUNTRIES,
  isSmallableProductUrl,
  parseSmallableProductId,
  readMetaRefreshTarget,
  readSmallableMarketPrice,
  readSmallableRequestedCountry,
} from "../smallable-market-probe";

/**
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13).
 *
 * 네트워크를 타지 않는다. fixture는 2026-09-13에 실제 HTTP 응답에서 JSON-LD
 * 블록만 그대로 떠온 것이다 — breadcrumb 마지막 항목에 요청 쿼리
 * (`?currency=EUR&country=XX`)가 남아 있어서 fixture만 봐도 어느 국가의 응답인지
 * 확인할 수 있다.
 *
 * 실측값:
 *     country=   430632(AAA1804532)   430651(AAA1804641)
 *     FR             €45                  €75
 *     KR             €44                  €73
 *     US             €47                  €79
 *     JP             €49                  €81
 *
 * 430651의 FR 75 / KR 73은 SMALLABLE-PRICE-1이 2026-09-12에 잰 표와 같다 — 같은
 * 방법이 하루 뒤에도 같은 값을 낸다는 확인이다.
 */
const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf-8");

const URL_430632 =
  "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632";
const URL_430651 =
  "https://www.smallable.com/en/product/b.c.-organic-cotton-zipped-sweatshirt-navy-blue-bobo-choses-430651";

describe("시장 관측 대상 URL을 고른다", () => {
  it("상품 URL만 받는다 — 목록/브랜드 페이지에 probe를 돌리면 남의 가격을 관측한다", () => {
    expect(isSmallableProductUrl(URL_430632)).toBe(true);
    expect(isSmallableProductUrl("https://smallable.com/en/product/x-430632")).toBe(true);
    expect(isSmallableProductUrl("https://www.smallable.com/en/fashion/children/boy")).toBe(false);
    expect(isSmallableProductUrl("https://junioredition.com/products/booty-ghosts-t-shirt")).toBe(false);
    expect(isSmallableProductUrl("not-a-url")).toBe(false);
  });

  it("상품 id는 URL 끝의 숫자다 — JSON-LD model과 대조할 유일한 근거", () => {
    expect(parseSmallableProductId(URL_430632)).toBe("430632");
    expect(parseSmallableProductId(`${URL_430651}?currency=EUR&country=KR`)).toBe("430651");
    expect(parseSmallableProductId("https://www.smallable.com/en/fashion/children")).toBeNull();
  });

  it("후보 배송국가는 실측된 네 곳뿐이다 — 중복 없이", () => {
    expect(SMALLABLE_CANDIDATE_MARKET_COUNTRIES).toEqual(["FR", "KR", "US", "JP"]);
    expect(new Set(SMALLABLE_CANDIDATE_MARKET_COUNTRIES).size).toBe(SMALLABLE_CANDIDATE_MARKET_COUNTRIES.length);
  });
});

describe("원본가격 정책(FR 고정)은 이번 작업에서 한 글자도 바뀌지 않는다", () => {
  it("핵심 회귀: withSourceCurrency는 여전히 FR + EUR을 강제한다", () => {
    const u = new URL(withSourceCurrency(URL_430651));
    expect(u.searchParams.get("country")).toBe("FR");
    expect(u.searchParams.get("currency")).toBe("EUR");
  });

  it("시장 probe URL은 통화를 그대로 두고 배송국가만 바꾼다", () => {
    const u = new URL(withSourceMarketCountry(URL_430651, "KR")!);
    expect(u.searchParams.get("country")).toBe("KR");
    // 통화는 등록된 원본 통화 그대로다 — 나라마다 현지 통화를 받으면 사이트
    // 자체 환율 스프레드가 섞여 시장 간 차이를 읽을 수 없게 된다.
    expect(u.searchParams.get("currency")).toBe("EUR");
  });

  it("등록되지 않은 사이트에는 국가 파라미터를 붙이지 않는다 — 없는 시장을 만들지 않는다", () => {
    expect(withSourceMarketCountry("https://junioredition.com/products/x", "KR")).toBeNull();
    expect(supportsMarketCountryProbe("https://junioredition.com/products/x")).toBe(false);
    expect(supportsMarketCountryProbe(URL_430651)).toBe(true);
    // 국가 코드 모양이 아니면 요청 자체를 만들지 않는다.
    expect(withSourceMarketCountry(URL_430651, "KOREA")).toBeNull();
  });
});

describe("응답에서 읽는 것 — 요청한 상품의 가격만", () => {
  it("핵심 회귀: 430632 FR €45 / KR €44", () => {
    const fr = readSmallableMarketPrice(fixture("smallable-430632-fr.html"), "430632");
    const kr = readSmallableMarketPrice(fixture("smallable-430632-kr.html"), "430632");
    expect(fr).toMatchObject({ sku: "AAA1804532", amount: 45, currency: "EUR", available: true });
    expect(kr).toMatchObject({ sku: "AAA1804532", amount: 44, currency: "EUR", available: true });
  });

  it("핵심 회귀: 430651 FR €75 / KR €73 — ProductGroup/hasVariant 안에 있어도 읽는다", () => {
    const fr = readSmallableMarketPrice(fixture("smallable-430651-fr.html"), "430651");
    const kr = readSmallableMarketPrice(fixture("smallable-430651-kr.html"), "430651");
    expect(fr).toMatchObject({ sku: "AAA1804641", amount: 75, currency: "EUR" });
    expect(kr).toMatchObject({ sku: "AAA1804641", amount: 73, currency: "EUR" });
  });

  it("원본가격 추출 경로와 같은 금액을 읽는다 — 시장가와 원본가가 갈라지지 않는다", () => {
    // extractFromJsonLd는 원본가격(SMALLABLE-PRICE-1)이 쓰는 경로 그대로다.
    const viaSourcePath = extractFromJsonLd(fixture("smallable-430651-fr.html"));
    const viaMarketProbe = readSmallableMarketPrice(fixture("smallable-430651-fr.html"), "430651");
    expect(viaMarketProbe!.amount).toBe(viaSourcePath!.price!.amount);
    expect(viaMarketProbe!.sku).toBe(viaSourcePath!.sku);
  });

  it("핵심 회귀: 다른 상품의 페이지에서는 가격을 만들어내지 않는다", () => {
    // 430651 페이지에 430632를 요청하면 null이다. 이 규칙이 없으면 형제 색상
    // 변형·추천상품 카드의 금액이 이 상품의 시장가로 저장된다.
    expect(readSmallableMarketPrice(fixture("smallable-430651-fr.html"), "430632")).toBeNull();
    expect(readSmallableMarketPrice(fixture("smallable-430632-fr.html"), "430651")).toBeNull();
  });

  it("JSON-LD가 없으면(리다이렉트 스텁 등) null — 빈 페이지에서 숫자를 짜내지 않는다", () => {
    expect(readSmallableMarketPrice(fixture("smallable-430632-redirect.html"), "430632")).toBeNull();
    expect(readSmallableMarketPrice("<html><body>44 €</body></html>", "430632")).toBeNull();
  });
});

describe("요청한 배송국가로 응답했다는 증거", () => {
  it("breadcrumb 마지막 항목이 요청 쿼리를 그대로 되싣는다", () => {
    expect(readSmallableRequestedCountry(fixture("smallable-430632-fr.html"))).toBe("FR");
    expect(readSmallableRequestedCountry(fixture("smallable-430632-kr.html"))).toBe("KR");
    expect(readSmallableRequestedCountry(fixture("smallable-430651-kr.html"))).toBe("KR");
  });

  it("핵심 회귀: FR 응답은 KR 관측으로 쓸 수 없다", () => {
    // smallable은 인식 못 한 파라미터를 조용히 무시한다(실측). 그때 저장하면
    // FR 가격(€45)이 KR 시장가로 둔갑한다 — 값이 없는 것보다 훨씬 나쁘다.
    expect(readSmallableRequestedCountry(fixture("smallable-430632-fr.html"))).not.toBe("KR");
  });

  it("되싣은 값이 없으면 null이다 — 국가 선택기 링크를 증거로 세지 않는다", () => {
    // 페이지 어딘가에 country=KR이 있는지 전체 검색하면 국가 선택기 때문에
    // 어떤 국가를 요청해도 통과한다. breadcrumb 하나만 본다.
    const withSelectorLinks = `<html><head>
<script type="application/ld+json">{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","item":"https://www.smallable.com/en/product/x-1?currency=EUR"}]}</script>
</head><body><a href="/en?country=KR">KR</a><a href="/en?country=JP">JP</a></body></html>`;
    expect(readSmallableRequestedCountry(withSelectorLinks)).toBeNull();
    expect(readSmallableRequestedCountry("<html></html>")).toBeNull();
  });
});

describe("옛 슬러그로 저장된 URL", () => {
  it("Next 클라이언트 리다이렉트를 한 번 따라간다 — HTTP 3xx가 아니라 200 + meta refresh다", () => {
    const target = readMetaRefreshTarget(
      fixture("smallable-430632-redirect.html"),
      "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-off-white-bobo-choses-430632?currency=EUR&country=FR",
    );
    expect(target).toBe(
      "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632?currency=EUR&country=FR",
    );
    // 따라가도 상품은 같다 — 이 조건이 아니면 따라가지 않는다.
    expect(parseSmallableProductId(target!)).toBe("430632");
  });

  it("meta refresh가 없으면 null", () => {
    expect(readMetaRefreshTarget(fixture("smallable-430632-fr.html"), URL_430632)).toBeNull();
  });
});

/**
 * 분기는 한 줄이다 — Shopify면 지금까지의 경로, 등록된 사이트면 그 사이트의
 * probe, 둘 다 아니면 아무 요청도 보내지 않는다.
 */
describe("probeAdditionalMarkets 분기", () => {
  it("등록된 사이트만 사이트별 probe를 갖는다", () => {
    expect(supportsSiteMarketProbe(URL_430632)).toBe(true);
    // Shopify는 사이트별 목록에 없다 — Shopify 경로가 따로 있기 때문이다.
    expect(supportsSiteMarketProbe("https://junioredition.com/products/booty-ghosts-t-shirt")).toBe(false);
    expect(supportsSiteMarketProbe("https://unknown-shop.example/p/1")).toBe(false);
  });

  it("핵심 회귀: 어느 쪽도 아닌 URL은 네트워크를 타지 않고 빈 배열이다", async () => {
    await expect(probeAdditionalMarkets("https://unknown-shop.example/p/1", [])).resolves.toEqual([]);
  });
});
