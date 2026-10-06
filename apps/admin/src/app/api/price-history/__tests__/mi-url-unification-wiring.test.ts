import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-URL-INPUT-UNIFICATION ④ — **국내/해외 판별과 그 배선.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 판별을 «동작으로» 잰다. 소스에 `currency` 라는 글자가 없다는 것만으로는
 * 「통화로 판별하지 않는다」를 증명할 수 없다 — 다른 이름으로 같은 짓을 할 수 있다.
 * 그래서 **원화로 파는 해외 사이트** 를 실제로 넣어 보고 「해외」로 남는지 본다.
 *
 * 실측 근거(저장소 기록): Bobo Choses `/en-kr` ₩162,000 · `/en-de` €75 —
 * 같은 판매처가 시장마다 통화를 바꾼다. `currency === "KRW"` 로 가르면 이
 * 상품이 국내 소싱으로 오판되고, 그 순간 착지원가에서 국제배송비가 사라진다.
 */

const hoisted = vi.hoisted(() => ({
  /** `domestic_price_sources` 카탈로그. 🔴 실제 seed 에 있는 도메인들이다. */
  domains: [] as string[],
  calls: 0,
}));

vi.mock("../../domestic-price-sources/_lib/domestic-price-source", () => ({
  listDomesticPriceSources: async () => {
    hoisted.calls += 1;
    return hoisted.domains.map((domain, index) => ({ id: `s${index}`, domain }));
  },
}));

/* 아래 import 사슬이 Supabase/네트워크를 건드리지 않도록 끊는다. */
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => null }));
vi.mock("@/lib/exchange-rates", () => ({ fetchLiveExchangeRates: async () => ({ rates: {} }) }));

const { isDomesticSourcedProduct } = await import("../_lib/market-intelligence");

const WS = "ws-1";

beforeEach(() => {
  hoisted.calls = 0;
  /* 030·032·034·036·037·074 가 실제로 seed 한 도메인 중 일부. */
  hoisted.domains = [
    "looxloo.com",
    "bobochoses.com",
    "rulii.co.kr",
    "deuxbebe.com",
    "coupang.com",
    "musinsa.com",
  ];
});

describe("🔴 통화로 판별하지 않는다", () => {
  it("🔴 원화로 파는 «해외» 사이트를 국내로 오판하지 않는다 — 카탈로그에 없으면 해외다", async () => {
    /* tennis-warehouse 는 국내 카탈로그에 없다 → 해외. 통화와 무관하다. */
    expect(
      await isDomesticSourcedProduct("https://www.tennis-warehouse.com/x/descpageMASGT-STMMLS.html", WS),
    ).toBe(false);
  });

  it("🔴 Bobo Choses 는 카탈로그에 «국내 공식몰» 로 등록돼 있어 국내다 — 경로(/en-de)와 무관", async () => {
    /* 🔴 이 사이트가 €75 로 팔든 ₩162,000 으로 팔든 판별은 «등록 사실» 로 한다.
       즉 판별이 통화를 보지 않는다는 것을 양방향으로 못박는다. */
    expect(await isDomesticSourcedProduct("https://bobochoses.com/en-de/products/x", WS)).toBe(true);
    expect(await isDomesticSourcedProduct("https://bobochoses.com/ko-kr/products/x", WS)).toBe(true);
  });
});

describe("도메인 일치 규칙", () => {
  it("등록된 국내 판매처면 true", async () => {
    expect(await isDomesticSourcedProduct("https://www.coupang.com/vp/products/9765875397", WS)).toBe(true);
    expect(await isDomesticSourcedProduct("https://rulii.co.kr/product/123", WS)).toBe(true);
  });

  it("www. 가 있어도 같다", async () => {
    expect(await isDomesticSourcedProduct("https://www.musinsa.com/goods/1", WS)).toBe(true);
    expect(await isDomesticSourcedProduct("https://musinsa.com/goods/1", WS)).toBe(true);
  });

  it("서브도메인도 같은 판매처다", async () => {
    expect(await isDomesticSourcedProduct("https://shop.looxloo.com/p/1", WS)).toBe(true);
  });

  it("🔴 비슷한 이름에 속지 않는다 — 접미사 일치만 인정한다", async () => {
    /* `notlooxloo.com` 은 `looxloo.com` 으로 끝나지만 «다른 도메인» 이다. */
    expect(await isDomesticSourcedProduct("https://notlooxloo.com/p/1", WS)).toBe(false);
    expect(await isDomesticSourcedProduct("https://looxloo.com.evil.example/p/1", WS)).toBe(false);
  });

  it("🔴 카탈로그에 없는 호스트는 «해외» 다 — 모르는 쪽으로 열지 않는다", async () => {
    /* 열면 해외 상품의 착지원가에서 국제배송비가 조용히 빠진다 —
       그 방향으로 틀리지 않도록 기본값을 기존 동작(해외)으로 둔다. */
    expect(await isDomesticSourcedProduct("https://www.macys.com/shop/product/x", WS)).toBe(false);
    expect(await isDomesticSourcedProduct("https://example.co.kr/p/1", WS)).toBe(false);
  });

  it("URL 을 읽을 수 없으면 판별하지 않는다 — 기존 동작 유지", async () => {
    expect(await isDomesticSourcedProduct("not a url", WS)).toBe(false);
    expect(await isDomesticSourcedProduct("", WS)).toBe(false);
  });

  it("카탈로그가 비어 있으면 전부 해외다", async () => {
    hoisted.domains = [];
    expect(await isDomesticSourcedProduct("https://www.coupang.com/vp/products/1", WS)).toBe(false);
  });
});

describe("🔴 배선 — MI 가 그 사실을 어디에 쓰는가", () => {
  const source = async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗긴다 — 이 파일은 결정을 설명하는 주석이 코드보다 길다. */
    return readFileSync(join(__dirname, "..", "_lib", "market-intelligence.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
  };

  it("해외물류비 사다리에 그 사실을 넘긴다", async () => {
    expect(await source()).toContain("overseasInbound: !domesticSourced");
  });

  it("🔴 국내면 구매자 수입부담을 «만들지 않는다» — 없는 세금을 말하지 않는다", async () => {
    const code = await source();
    expect(code).toContain("cost != null && !domesticSourced");
  });

  it("🔴 국내면 국제배송비 «금액» 을 비운다 — ₩0 을 성분으로 내보내지 않는다", async () => {
    const code = await source();
    /* 산술에는 0 을 쓰지만(합계에 더할 항이 없다는 뜻), 성분으로는 null 이다. */
    expect(code).toContain("shippingNotApplicable");
    expect(code).toMatch(/shippingNotApplicable\s*\n?\s*\?\s*\{\s*value:\s*null/);
  });

  it("🔴 판별은 «한 번» 만 한다 — 두 축이 다른 답을 들고 가지 않는다", async () => {
    const code = await source();
    const detections = code.match(/await isDomesticSourcedProduct\(/g) ?? [];
    expect(detections).toHaveLength(1);
  });

  it("🔴 판별 함수가 통화를 읽지 않는다", async () => {
    const code = await source();
    const fn = code.slice(code.indexOf("export async function isDomesticSourcedProduct"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).not.toContain("currency");
    expect(body).not.toContain("KRW");
    expect(body).not.toContain("price");
  });
});
