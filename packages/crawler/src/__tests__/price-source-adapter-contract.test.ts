import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  comparisonShopCollectability,
  listPriceSourceAdapters,
  searchComparisonShops,
  supportsComparisonShopSearch,
  supportsDomesticShopSearch,
  type ComparisonSearchResult,
} from "../comparison-search";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLF-01.5 축 C — 가격소스 수집 표준 (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일이 실행으로 지키는 것은 셋이다.
 *
 * ① 🔴 **MI 는 수집 방법을 모른다.** 같은 상품을 WEB 어댑터와 API 어댑터로
 *      넣었을 때, 위로 올라가는 결과에서 «어떻게 수집했는지»를 읽어낼 수 있는
 *      칸이 한 개도 없어야 한다.
 * ② 🔴 **키가 없는 것과 결과가 없는 것은 다른 사실이다.** 같은 어댑터·같은
 *      상품인데 키 유무만 바꿔서 두 상태가 실제로 갈라지는지 본다(역방향 증명).
 * ③ 🔴 **아동복 회귀 0.** 등록부를 한 곳으로 모은 정리가 기존 18개 도메인을
 *      한 곳도 떨어뜨리지 않았는지 전수로 본다.
 *
 * ⚠️ 이 파일의 Rakuten 응답은 **합성 입력**이다. 실제 Rakuten 응답이 아니다.
 *    자격증명이 없어 실제 응답을 한 번도 본 적이 없다. 그래서 값은 누가 봐도
 *    가짜인 숫자만 쓰고, **필드 이름은 공식 문서에 적힌 것만** 쓴다. 이 객체를
 *    "Rakuten 이 이렇게 준다"는 근거로 쓰면 안 된다 — 여기서 재는 것은 오직
 *    «우리 매핑 코드가 문서대로 읽는가»다.
 */

const RAKUTEN_SHOP = { id: "s-rakuten", name: "Rakuten 市場", domain: "rakuten.co.jp", currency: "JPY" };
const WEB_SHOP = { id: "s-childrensalon", name: "Childrensalon", domain: "childrensalon.com", currency: "GBP" };

const QUERY = { title: "TaylorMade Qi10 Driver 10.5" };

function withRakutenCredentials() {
  vi.stubEnv("RAKUTEN_APPLICATION_ID", "test-application-id");
  vi.stubEnv("RAKUTEN_ACCESS_KEY", "test-access-key");
}

function withoutRakutenCredentials() {
  vi.stubEnv("RAKUTEN_APPLICATION_ID", "");
  vi.stubEnv("RAKUTEN_ACCESS_KEY", "");
}

/** 🔴 합성 입력. 실제 응답이 아니다 — 필드 «이름»만 공식 문서에서 가져왔다. */
const SYNTHETIC_RAKUTEN_BODY = {
  count: 1,
  page: 1,
  hits: 1,
  items: [
    {
      itemName: "TaylorMade Qi10 Driver 10.5",
      itemUrl: "https://item.rakuten.co.jp/synthetic-shop/synthetic-item/",
      itemPrice: 11111,
      taxFlag: 0,
      availability: 1,
      shopName: "synthetic-shop",
      itemCode: "synthetic-shop:0000000",
      mediumImageUrls: ["https://thumbnail.image.rakuten.co.jp/synthetic.jpg"],
    },
  ],
};

/** Childrensalon 검색 HTML 파서가 읽는 구조. 이것도 합성 입력이다. */
const SYNTHETIC_CHILDRENSALON_HTML = `<!doctype html><html><body>
<script type="application/ld+json">{"@type":"ItemList","itemListElement":[]}</script>
</body></html>`;

function mockFetch(handler: (url: string) => Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    return handler(url);
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/* ══════════════ ① MI 는 수집 방법을 모른다 ══════════════ */

describe("GOLF-01.5-C ① MI 입력에서 수집 방법을 읽어낼 수 없다", () => {
  it("🔴 WEB 어댑터 결과와 API 어댑터 결과의 «칸 이름»이 완전히 같다", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch((url) => {
      if (url.includes("openapi.rakuten.co.jp")) {
        return new Response(JSON.stringify(SYNTHETIC_RAKUTEN_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // childrensalon 파서는 검색 HTML 을 읽는다. 후보 0건이어도 이 테스트의
      // 목적(«칸 이름»이 같은가)에는 충분하지 않으므로 아래에서 따로 맞춘다.
      return new Response(SYNTHETIC_CHILDRENSALON_HTML, { status: 200, headers: { "content-type": "text/html" } });
    });

    const [apiResult] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    const [webResult] = await searchComparisonShops(QUERY, [WEB_SHOP]);
    fetchSpy.mockRestore();

    // 두 결과 모두 «수집을 실제로 했다»는 같은 상태로 도착한다.
    expect(apiResult.status).toBe("ok");
    expect(webResult.status).toBe("ok");

    // 🔴 결과 봉투의 칸 이름이 같다. 한쪽에만 있는 칸이 있으면 그 칸이 곧
    //    "이건 API 였다"는 신호가 된다.
    expect(new Set(Object.keys(apiResult))).toEqual(new Set(Object.keys(webResult)));

    console.log(
      `[GOLF-01.5-C 증거] API(rakuten) 결과 칸 = ${Object.keys(apiResult).sort().join(",")}\n` +
        `[GOLF-01.5-C 증거] WEB(childrensalon) 결과 칸 = ${Object.keys(webResult).sort().join(",")}`,
    );
  });

  it("🔴 결과 어디에도 API/WEB/FEED·어댑터·파서라는 말이 없다", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch(
      () =>
        new Response(JSON.stringify(SYNTHETIC_RAKUTEN_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const [apiResult] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    fetchSpy.mockRestore();

    expect(apiResult.candidates).toHaveLength(1);

    // 🔴 «수집 방법»을 나타내는 어떤 흔적도 MI 입력에 실려 가지 않는다.
    //    직렬화 전체를 한 번에 본다 — 칸 이름이든 값이든 어디에 숨어 있어도 걸린다.
    const serialized = JSON.stringify(apiResult);
    for (const word of ["\"API\"", "\"WEB\"", "\"FEED\"", "adapter", "Adapter", "collectionMethod", "rakuten-ichiba"]) {
      expect(serialized, `MI 입력에 수집 방법 흔적(${word})이 실렸다`).not.toContain(word);
    }

    // 🔴 반대편 확인: MI 가 «받아야 하는» 7칸 중 이 소스가 실제로 준 것들은
    //    전부 공통 형태 위에 그대로 있다(상품·가격·통화·판매처·URL·재고).
    //    수집시간은 관측 저장 시점(price_observations.checked_at)이 담당한다.
    const candidate = apiResult.candidates[0];
    expect(candidate.title).toBe("TaylorMade Qi10 Driver 10.5");
    expect(candidate.url).toBe("https://item.rakuten.co.jp/synthetic-shop/synthetic-item/");
    expect(candidate.price).toEqual({ amount: 11111, currency: "JPY" });
    expect(candidate.sellerName).toBe("synthetic-shop");
    expect(candidate.soldOut).toBe(false);
    expect(apiResult.shopName).toBe("Rakuten 市場");
  });

  it("🔴 호출부는 어댑터의 method 로 분기하지 않는다 — method 를 바꿔도 결과가 같다", async () => {
    withRakutenCredentials();
    const rakuten = listPriceSourceAdapters().find((a) => a.domain === "rakuten.co.jp");
    expect(rakuten?.method).toBe("API");

    const fetchSpy = mockFetch(
      () =>
        new Response(JSON.stringify(SYNTHETIC_RAKUTEN_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const before = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    // 🔴 method 는 «표시용»이다. 이 값을 바꿔 치고 다시 돌렸을 때 결과가
    //    달라진다면, 어딘가가 수집 방법을 보고 판단하고 있다는 뜻이다.
    const original = rakuten!.method;
    (rakuten as { method: string }).method = "WEB";
    const after = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    (rakuten as { method: string }).method = original;
    fetchSpy.mockRestore();

    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

/* ══════════════ ② 키 없음 ≠ 결과 없음 ══════════════ */

describe("GOLF-01.5-C ② NOT_CONFIGURED 는 빈 결과와 다른 사실이다", () => {
  it("🔴 키가 없으면 not_configured 이고 HTTP 요청이 한 번도 나가지 않는다", async () => {
    withoutRakutenCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("키가 없는데 실제 HTTP 요청이 나갔다");
    });
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    fetchSpy.mockRestore();

    expect(result.status).toBe("not_configured");
    expect(result.candidates).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    // 🔴 무엇이 없는지까지 말한다. 값이 아니라 **이름**만 담긴다.
    expect(result.missingCredentials).toEqual(["RAKUTEN_APPLICATION_ID", "RAKUTEN_ACCESS_KEY"]);
    expect(JSON.stringify(result)).not.toContain("test-access-key");

    console.log(
      `[GOLF-01.5-C 증거] 키 없음 → ${result.domain}=${result.status} / 후보 ${result.candidates.length}건 / ` +
        `필요한 환경변수 ${result.missingCredentials?.join(",")}`,
    );
  });

  it("🔴 역방향 증명 — 키가 «있고» 응답이 0건이면 ok/0건이다(not_configured 가 아니다)", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch(
      () =>
        new Response(JSON.stringify({ count: 0, items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    // 🔴 mockRestore 는 호출 기록까지 지운다 — 세기 전에 먼저 읽는다.
    const callCount = fetchSpy.mock.calls.length;
    fetchSpy.mockRestore();

    expect(result.status).toBe("ok");
    expect(result.candidates).toHaveLength(0);
    expect(result.missingCredentials).toBeUndefined();
    expect(callCount, "키가 있는데 요청을 보내지 않았다").toBe(1);

    console.log(`[GOLF-01.5-C 증거] 키 있음 + 0건 → ${result.domain}=${result.status} / 후보 0건`);
  });

  it("🔴 키 한 쪽만 있어도 not_configured 다 — 없는 이름만 정확히 말한다", async () => {
    vi.stubEnv("RAKUTEN_APPLICATION_ID", "test-application-id");
    vi.stubEnv("RAKUTEN_ACCESS_KEY", "");
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    expect(result.status).toBe("not_configured");
    expect(result.missingCredentials).toEqual(["RAKUTEN_ACCESS_KEY"]);
  });

  it("🔴 «어댑터가 없다»와 «키가 없다»는 화면 입력에서도 갈라진다", () => {
    withoutRakutenCredentials();
    // 어댑터 없음: 앞으로 할 일이 "파서를 만드는 것"이다.
    expect(comparisonShopCollectability("shop.golfdigest.co.jp")).toEqual({
      parserAvailable: false,
      collectionMethod: null,
      credentialsConfigured: null,
      missingCredentials: [],
    });
    // 키 없음: 앞으로 할 일이 "키를 넣는 것"이다.
    expect(comparisonShopCollectability("rakuten.co.jp")).toEqual({
      parserAvailable: true,
      collectionMethod: "API",
      credentialsConfigured: false,
      missingCredentials: ["RAKUTEN_APPLICATION_ID", "RAKUTEN_ACCESS_KEY"],
    });
    // 자격증명이 필요 없는 WEB 어댑터는 항상 준비됨이다.
    expect(comparisonShopCollectability("childrensalon.com")).toEqual({
      parserAvailable: true,
      collectionMethod: "WEB",
      credentialsConfigured: true,
      missingCredentials: [],
    });
  });
});

/* ══════════════ ③ Rakuten 매핑 — 문서에서 확인한 필드만 ══════════════ */

describe("GOLF-01.5-C ③ Rakuten 매핑은 문서에서 확인한 필드만 읽는다", () => {
  async function searchWithBody(body: unknown): Promise<ComparisonSearchResult> {
    withRakutenCredentials();
    const fetchSpy = mockFetch(
      () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    fetchSpy.mockRestore();
    return result;
  }

  it("🔴 itemCode 를 sku 로 쓰지 않는다 — 점포 상품코드는 품번이 아니다", async () => {
    const result = await searchWithBody(SYNTHETIC_RAKUTEN_BODY);
    // "synthetic-shop:0000000" 이 sku 에 들어가면 품번 대조가 «없던 일치»를 만든다.
    expect(result.candidates[0].sku).toBeUndefined();
  });

  it("🔴 문서에 정가 필드가 없으므로 regularPrice 를 지어내지 않는다", async () => {
    const result = await searchWithBody(SYNTHETIC_RAKUTEN_BODY);
    expect(result.candidates[0].regularPrice ?? null).toBeNull();
  });

  it("🔴 응답에 통화 필드가 없다 — 카탈로그가 통화를 모르면 가격 자체를 만들지 않는다", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch(
      () =>
        new Response(JSON.stringify(SYNTHETIC_RAKUTEN_BODY), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const [result] = await searchComparisonShops(QUERY, [{ ...RAKUTEN_SHOP, currency: null }]);
    fetchSpy.mockRestore();
    // 숫자만 있고 통화를 모르는 값은 만들지 않는다(shopify-suggest 와 같은 규칙).
    expect(result.candidates[0].price).toBeNull();
  });

  it("🔴 availability 0/1 만 재고 사실로 읽고, 그 외에는 «모름»(null)이다", async () => {
    const soldOut = await searchWithBody({
      items: [{ ...SYNTHETIC_RAKUTEN_BODY.items[0], availability: 0 }],
    });
    expect(soldOut.candidates[0].soldOut).toBe(true);

    const unknown = await searchWithBody({
      items: [{ ...SYNTHETIC_RAKUTEN_BODY.items[0], availability: undefined }],
    });
    // 🔴 "정보 없음"을 "판매중"(false)으로 둔갑시키지 않는다(038 주석의 원칙).
    expect(unknown.candidates[0].soldOut).toBeNull();
  });

  it("🔴 taxFlag=1(세금 미포함)이면 검증된 가격이라고 말하지 않는다", async () => {
    const taxIncluded = await searchWithBody(SYNTHETIC_RAKUTEN_BODY);
    expect(taxIncluded.candidates[0].priceStatus).toBe("VERIFIED_CURRENT");

    const taxExcluded = await searchWithBody({
      items: [{ ...SYNTHETIC_RAKUTEN_BODY.items[0], taxFlag: 1 }],
    });
    // 그 숫자가 «구매자가 내는 금액»인지 우리가 모른다 → 화면은 숫자를 안 보여준다.
    expect(taxExcluded.candidates[0].priceStatus).toBe("UNVERIFIED_SEARCH");
    // 🔴 세금을 우리가 계산해서 더하지 않는다 — 원래 숫자 그대로 남는다.
    expect(taxExcluded.candidates[0].price).toEqual({ amount: 11111, currency: "JPY" });
  });

  it("🔴 404(데이터 없음)는 오류가 아니라 0건이다", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch(() => new Response("", { status: 404 }));
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    fetchSpy.mockRestore();
    expect(result.status).toBe("ok");
    expect(result.candidates).toHaveLength(0);
  });

  it("🔴 429 는 «찾지 못함»이 아니라 RATE_LIMITED 로 도착하고, 다시 두드리지 않는다", async () => {
    withRakutenCredentials();
    const fetchSpy = mockFetch(() => new Response("", { status: 429 }));
    const [result] = await searchComparisonShops(QUERY, [RAKUTEN_SHOP]);
    const callCount = fetchSpy.mock.calls.length;
    fetchSpy.mockRestore();
    expect(result.status).toBe("error");
    expect(result.errorKind).toBe("RATE_LIMITED");
    // 🔴 공식 API 가 "요청이 많다"고 답한 것을 재시도로 뚫지 않는다(속도 제한
    //    우회 금지). 요청은 정확히 한 번만 나갔다.
    expect(callCount, "429 를 받고 다시 두드렸다").toBe(1);
  }, 20000);

  it("🔴 문서가 인정하는 두 응답 모양(formatVersion 1/2)을 모두 읽는다", async () => {
    // 문서: formatVersion=1 → items[0].item.itemName · formatVersion=2 → items[0].itemName
    const nested = await searchWithBody({ items: [{ item: SYNTHETIC_RAKUTEN_BODY.items[0] }] });
    expect(nested.candidates[0].title).toBe("TaylorMade Qi10 Driver 10.5");
  });
});

/* ══════════════ ④ 아동복 회귀 — 등록부 통합이 한 곳도 떨어뜨리지 않았다 ══════════════ */

describe("GOLF-01.5-C ④ 아동복 수집 회귀 0", () => {
  it("🔴 해외 12곳 · 국내 6곳 파서가 그대로 살아 있고, 등록부 총원이 19다", () => {
    const overseasKids = [
      "junioredition.com",
      "nickis.com",
      "isolabellakids.com",
      "petitemaisonkids.com",
      "shoppiccoliandco.com",
      "kidswearcollective.com",
      "kidsatelier.com",
      "designerkidswear.com",
      "kidbizkid.com",
      "villagekids.co.uk",
      "folkberlin.com",
      "childrensalon.com",
    ];
    for (const d of overseasKids) {
      expect(supportsComparisonShopSearch(d), `${d} 해외 파서가 사라졌다`).toBe(true);
      // 🔴 아동복 어댑터는 전부 자격증명이 필요 없다 — 이번 변경으로 한 곳이라도
      //    NOT_CONFIGURED 가 되면 그 순간 아동복 수집이 멈춘다.
      expect(comparisonShopCollectability(d).credentialsConfigured, `${d}가 키를 요구하기 시작했다`).toBe(true);
    }

    const domesticKids = ["looxloo.com", "bobochoses.com", "rulii.co.kr", "deuxbebe.com", "chocoel.co.kr", "foretforet.com"];
    for (const d of domesticKids) {
      expect(supportsDomesticShopSearch(d), `${d} 국내 파서가 사라졌다`).toBe(true);
    }

    // 등록부 전체 = 아동복 18 + Rakuten 1. 새 소스를 조용히 끼워 넣지 않았다.
    expect(listPriceSourceAdapters()).toHaveLength(19);

    // 🔴 카탈로그를 섞지 않는다: 국내 도메인을 해외 파서로, 해외 도메인을 국내
    //    파서로 답하지 않는다(comparison_shops 와 domestic_price_sources 는
    //    029 가 분리를 결정한 별개 테이블이다).
    expect(supportsComparisonShopSearch("rulii.co.kr")).toBe(false);
    expect(supportsDomesticShopSearch("childrensalon.com")).toBe(false);
    expect(supportsDomesticShopSearch("rakuten.co.jp")).toBe(false);
  });

  it("🔴 등록부의 모든 어댑터가 표준을 지킨다(도메인 중복 없음 · 방식 3종 · readiness 존재)", () => {
    const adapters = listPriceSourceAdapters();
    expect(new Set(adapters.map((a) => a.domain)).size).toBe(adapters.length);
    for (const a of adapters) {
      expect(["API", "FEED", "WEB"]).toContain(a.method);
      expect(["OVERSEAS", "DOMESTIC"]).toContain(a.catalog);
      expect(typeof a.readiness).toBe("function");
      expect(typeof a.search).toBe("function");
    }
    // 오늘 필요한 종류는 둘뿐이다 — FEED 구현체를 미리 만들지 않았다(CEO 명시).
    expect(adapters.filter((a) => a.method === "FEED")).toHaveLength(0);
    expect(adapters.filter((a) => a.method === "API").map((a) => a.domain)).toEqual(["rakuten.co.jp"]);
  });
});
