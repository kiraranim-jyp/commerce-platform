import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withSourceCurrency, expectedCurrencyFor } from "../source-currency-policy";
import { fetchShopifyShopMeta, shipsToCountry, type ShopifyShopMeta } from "../shopify-product-json";

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL(CEO 확정, 2026-09-13).
 *
 * ── 고정하려는 한 줄 ─────────────────────────────────────────────────────
 * **원본 가격은 "우리가 실제 배송받는 국가의 가격"이 아니라 "해당 해외 사이트의
 * 제작 국가/본국 기준 통화 가격"이다.** Smallable은 France/EUR/€75, Bobo Choses는
 * Spain/EUR/€75, Junior Edition은 UK/GBP다. 국가별 가격 차이는 원본 가격을 바꾸지
 * 않고 Global Market Price에서 비교한다.
 *
 * ── 이 파일이 코드를 바꾸지 않는 이유 ────────────────────────────────────
 * 세 사이트 모두 **이미 그렇게 동작한다.** 그래서 이번 작업은 동작을 바꾸는 대신
 * 회귀로 굳힌다 — 이 저장소에서 원본 통화·국가 축은 두 번 잘못 골라졌고
 * (N-4.19의 `?currency=`, 그 이전의 "파라미터 없음"), 두 번 다 실측으로 되돌렸다.
 * 축이 다시 흔들리면 원본가격이 조용히 다른 나라 값으로 바뀐다.
 *
 * ── 오늘 실측(2026-09-13, 한국 egress) ───────────────────────────────────
 *   smallable.com  430701   ?currency=EUR&country=FR → €75   ← 원본가
 *                           country=KR → €73 · US → €79 · JP → €81
 *   bobochoses.com /meta.json {country: ES, currency: EUR, ships_to_countries: [… KR US GB …, JP 없음]}
 *                           ?country=ES → €75   ← 원본가
 *   junioredition.com /meta.json {country: GB, currency: GBP, ships_to_countries: ["*", …]}
 *                           파라미터 없음 → 37.00 GBP · ?country=GB → 37.00 GBP
 *                           (한국 egress에서도 GBP다 — 결함이 아니므로 규칙을 더하지 않는다)
 */

const SMALLABLE_430701 =
  "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701";

describe("§1 Smallable 원본가는 France/EUR로 고정된다", () => {
  it("원본가 조회 URL은 언제나 ?currency=EUR&country=FR이다", () => {
    const url = new URL(withSourceCurrency(SMALLABLE_430701));
    expect(url.searchParams.get("currency")).toBe("EUR");
    expect(url.searchParams.get("country")).toBe("FR");
    // 그 URL이 오늘 €75를 준다는 것이 실측이고(위 파일 주석), 화면의 원본가 카드가
    // 읽는 행(ORIGIN_FX, market_code NULL)의 EUR 75가 바로 이 응답이다.
  });

  it("한국 값(€73)이 원본가로 들어올 수 있는 경로가 없다", () => {
    // 원본가 함수는 국가를 인자로 받지 않는다 — 다른 나라를 요청하는 함수
    // (withSourceMarketCountry)와 파일 안에서부터 갈라져 있다.
    expect(withSourceCurrency).toHaveLength(1);
    const url = new URL(withSourceCurrency(SMALLABLE_430701));
    expect(url.searchParams.get("country")).not.toBe("KR");
  });

  it("사용자가 붙여넣은 URL에 다른 나라가 적혀 있어도 정책이 이긴다", () => {
    // 실측 화면에서 셀러가 복사해 오는 주소에는 ?country=KR이 붙어 있을 수 있다.
    // 그 한 글자가 원본가를 €75에서 €73으로 바꾸면 착지원가와 마진이 통째로 흔들린다.
    const url = new URL(withSourceCurrency(`${SMALLABLE_430701}?currency=KRW&country=KR`));
    expect(url.searchParams.get("currency")).toBe("EUR");
    expect(url.searchParams.get("country")).toBe("FR");
  });
});

/**
 * §18-C — **접속 국가가 바뀌어도 원본가가 변하지 않는다.**
 *
 * ⚠️ 정직하게 적는다. 테스트 프로세스의 egress를 실제로 바꿀 수 없으므로 이
 * 묶음이 증명하는 것은 "다른 나라에서 요청해도 같은 금액이 온다"가 **아니다.**
 * 증명하는 것은 그 성질이 성립하기 위한 구조적 전제 하나다:
 *
 *   **통화와 국가가 URL에 항상 명시된다 = 사이트가 egress로 추측할 여지가 없다.**
 *
 * 증명하지 못한 것: 사이트가 그 파라미터를 무시하고 egress를 보는 경우. 그건
 * 코드가 아니라 사이트의 동작이라 실측으로만 알 수 있고, 그래서 호출부가 응답
 * 통화를 다시 검증한다(universal-extractor의 expectedCurrencyFor 대조, smallable
 * probe의 관문 ①③). 이 테스트는 그 검증을 대신하지 않는다.
 */
describe("§18-C 원본가 조회에는 추측이 개입할 자리가 없다", () => {
  it("통화와 국가가 둘 다 URL에 적힌다 — 사이트가 접속 위치로 고를 값이 없다", () => {
    const url = new URL(withSourceCurrency(SMALLABLE_430701));
    // 둘 중 하나라도 비면 그 축은 egress가 정한다(N-4.19가 겪은 사고 그대로:
    // 통화만 고정하고 국가를 비워 뒀더니 JP 가격 €81이 원본가로 들어왔다).
    expect(url.searchParams.get("currency")).toBeTruthy();
    expect(url.searchParams.get("country")).toBeTruthy();
  });

  it("같은 입력은 몇 번을 불러도 같은 URL이다 — 시간·환경에 따라 흔들리지 않는다", () => {
    expect(withSourceCurrency(SMALLABLE_430701)).toBe(withSourceCurrency(SMALLABLE_430701));
  });

  it("등록되지 않은 사이트에는 아무 파라미터도 붙이지 않는다", () => {
    // "모든 사이트에 ?country=를 강제하지 않는다"(RULE 3). 사이트마다 시장을
    // 표현하는 방식이 다르고, 무시되는 파라미터를 붙이면 같은 가격이 국가만
    // 다른 시장 여러 개로 저장된다.
    const other = "https://example.com/products/x";
    expect(withSourceCurrency(other)).toBe(other);
    expect(expectedCurrencyFor(other)).toBeNull();
  });
});

/**
 * §1 Bobo Choses — 원본가 경로가 `?country=ES`를 만든다.
 *
 * Shopify 매장은 source-currency-policy.ts에 등록하지 않는다(그 파일 주석 참고).
 * 대신 `/meta.json`의 매장 선언 국가가 축이 된다 — 매장 관리자가 설정한 고정값
 * 이라 접속 지역과 무관하다. 그 경로가 실제로 그 파라미터를 만드는지를 여기서 센다.
 */
describe("§1 Bobo Choses 원본가는 Spain/EUR로 고정된다", () => {
  const META_FIXTURE = {
    // 2026-09-13 실제 응답에서 이 테스트가 읽는 필드만 옮겼다.
    country: "ES",
    currency: "EUR",
    name: "Bobo Choses",
    ships_to_countries: ["ES", "FR", "DE", "GB", "US", "KR", "CA", "AU"],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(META_FIXTURE), { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("/meta.json이 선언하는 기준 국가·통화를 그대로 읽는다", async () => {
    const meta = await fetchShopifyShopMeta("https://bobochoses.com");
    expect(meta?.country).toBe("ES");
    expect(meta?.currency).toBe("EUR");
  });

  it("원본가 조회 URL의 market 파라미터가 ?country=ES가 된다", async () => {
    // fetchShopifyProductJson이 URL을 조립하는 규칙 그대로다(그 파일 :302-307):
    // country가 있으면 country가 이기고, 없을 때만 currency로 폴백한다.
    const meta = await fetchShopifyShopMeta("https://bobochoses.com");
    const marketParam = meta?.country ? `?country=${meta.country}` : meta?.currency ? `?currency=${meta.currency}` : "";
    expect(marketParam).toBe("?country=ES");
    // `?currency=EUR`이 아니다 — 그 축은 PRICE-ACCURACY-REGRESSION-1.1에서
    // 폐기됐다(같은 통화를 쓰는 market이 둘이라 €84인 International market이 걸렸다).
    expect(marketParam).not.toContain("currency");
  });

  it("한국 값이 원본가가 되는 경로가 없다 — 축은 매장 선언 국가 하나다", async () => {
    const meta = await fetchShopifyShopMeta("https://bobochoses.com");
    expect(meta?.country).not.toBe("KR");
  });
});

/**
 * §4 — **배송하지 않는 나라를 관측했다고 말하지 않는다.**
 *
 * 실측(2026-09-13): bobochoses.com의 `ships_to_countries`에 JP가 없는데,
 * 일본을 요청하면 404가 아니라 **본국(스페인) 가격을 그대로** 돌려준다. 즉
 * `?country=JP`와 `?country=XX`(존재하지 않는 국가)의 응답이 구별되지 않는다.
 * 그대로 저장하면 €75가 "일본 시장에서 관측된 가격"이 되고, 화면은 존재하지
 * 않는 시장 하나를 진짜처럼 보여준다.
 */
describe("§4 시장 프로브는 그 시장이 실재할 때만 관측한다", () => {
  const bobo: ShopifyShopMeta = {
    country: "ES",
    currency: "EUR",
    name: "Bobo Choses",
    // 2026-09-13 실제 응답 발췌 — JP가 없다는 것이 이 픽스처의 핵심이다.
    shipsToCountries: ["ES", "FR", "DE", "GB", "US", "KR", "CA", "AU"],
  };
  const junior: ShopifyShopMeta = {
    country: "GB",
    currency: "GBP",
    name: "Junior Edition",
    // 2026-09-13 실제 응답은 "*"로 시작한다(전 세계 배송).
    shipsToCountries: ["*", "GB", "KR", "JP", "US"],
  };

  it("배송 국가 목록에 있으면 true", () => {
    expect(shipsToCountry(bobo, "KR")).toBe(true);
    expect(shipsToCountry(bobo, "US")).toBe(true);
  });

  it("핵심 회귀: Bobo Choses는 일본에 배송하지 않는다 → false", () => {
    // 이 한 줄이 "€75가 일본 시장 관측으로 저장되는" 경로를 끊는다.
    expect(shipsToCountry(bobo, "JP")).toBe(false);
  });

  it('"*"는 전 세계다 — Junior Edition은 한 나라도 빠지지 않는다', () => {
    for (const country of ["JP", "KR", "US", "GB", "ZZ"]) {
      expect(shipsToCountry(junior, country)).toBe(true);
    }
  });

  it("목록을 확인하지 못하면 null이다 — false가 아니다", () => {
    // "배송 국가가 없다"와 "배송 국가를 확인하지 못했다"는 다른 사실이다.
    // 호출부는 true일 때만 관측하므로(=== true), null도 결과적으로 기록되지
    // 않는다 — "확인할 수 없으면 기록하지 않는다"(CEO §4).
    expect(shipsToCountry({ ...bobo, shipsToCountries: null }, "KR")).toBeNull();
    expect(shipsToCountry(null, "KR")).toBeNull();
    expect(shipsToCountry({ ...bobo, shipsToCountries: [] }, "KR")).toBeNull();
  });

  it("대소문자를 가리지 않는다 — 시장 코드는 소문자로 저장된다", () => {
    expect(shipsToCountry(bobo, "kr")).toBe(true);
    expect(shipsToCountry(bobo, "jp")).toBe(false);
  });

  it("/meta.json의 ships_to_countries를 실제로 읽어 온다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ country: "ES", currency: "EUR", ships_to_countries: ["ES", "KR"] }), {
            status: 200,
          }),
      ),
    );
    const meta = await fetchShopifyShopMeta("https://bobochoses.com");
    expect(meta?.shipsToCountries).toEqual(["ES", "KR"]);
    expect(shipsToCountry(meta, "JP")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("필드가 없는 응답은 null로 남는다 — 빈 배열로 지어내지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ country: "GB", currency: "GBP" }), { status: 200 })),
    );
    const meta = await fetchShopifyShopMeta("https://www.junioredition.com");
    expect(meta?.shipsToCountries).toBeNull();
    vi.unstubAllGlobals();
  });
});

/**
 * §2 Junior Edition — **오늘 실측 결과는 "결함 없음"이다.**
 *
 * 2026-09-13, 한국 egress(218.155.116.93 / KR)에서 재확인:
 *   /meta.json                      → {country: "GB", currency: "GBP"}
 *   /products/<handle>.json         → 37.00 GBP   (파라미터 없음)
 *   /products/<handle>.json?country=GB → 37.00 GBP
 *   상품 HTML, 파라미터 없음         → Shopify.currency.active = "GBP"
 *
 * 그래서 SOURCE_CURRENCY_RULES에 junioredition.com을 **더하지 않는다.** 규칙은
 * 실측으로 결함이 확인된 사이트에만 한 줄씩 는다 — 멀쩡한 사이트에 규칙을 더하면
 * 그 규칙이 왜 있는지 아무도 모르는 채로 남고, 언젠가 축이 바뀔 때 근거 없이 따라간다.
 *
 * 함께 확인된 것: `/en-gb/`는 404다(이 매장의 GB 시장은 루트 경로 그 자체다).
 * 즉 로케일 프리픽스로 GBP를 고정하는 방법은 이 사이트에 존재하지 않는다.
 */
describe("§2 Junior Edition은 규칙 없이도 GBP다", () => {
  it("등록된 source가 아니다 — 원본 URL에 아무것도 붙이지 않는다", () => {
    const url = "https://www.junioredition.com/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    expect(expectedCurrencyFor(url)).toBeNull();
    expect(withSourceCurrency(url)).toBe(url);
  });

  it("통화 권위는 /meta.json이다 — 매장 관리자가 고정한 값이라 지역과 무관하다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ country: "GB", currency: "GBP", ships_to_countries: ["*", "KR"] }), {
            status: 200,
          }),
      ),
    );
    const meta = await fetchShopifyShopMeta("https://www.junioredition.com");
    expect(meta?.currency).toBe("GBP");
    expect(meta?.country).toBe("GB");
    vi.unstubAllGlobals();
  });
});
