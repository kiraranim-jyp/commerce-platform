import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-ORIGIN-FX-VARIANT-WIRING-04 — **probe 가 원본 URL 의 옵션을 보존한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 근거 = `MI-ORIGIN-FX-DISCREPANCY-03`(원인 확정) · CEO 지시 **P0-A.29-E ㉮**
 *    (`683d9d83` · 2026-09-20)가 **추출 경로만** 고쳤고 이 파일(probe)은 그 전이었다.
 *
 * 🔴 **새 규칙을 만들지 않았다** — 옵션 선택·품절·「못 찾으면 가격 미산출」은
 *    `fetchShopifyProductJson`(shopify-product-json.ts:426-446)에 **이미** 있다.
 *    이 WU 가 한 것은 **URL 을 온전히 넘기는 배선** 하나다.
 *
 * ── 🔴 외부 HTTP 0 ────────────────────────────────────────────────────────
 * `fetchShopifyProductJson` 을 **mock** 해서 「probe 가 어떤 URL 로 물었는가」를 본다.
 * 🔴 실제 네트워크를 쓰면 이 계약이 사이트 상태에 끌려간다(이 트랙의 금지축).
 * 🟢 대표 사례의 **실제 운영 variants 가격표** 는 `-03` fixture 에서 읽는다(지어내지 않는다).
 */

const FIX_03 = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "apps",
  "admin",
  "src",
  "app",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "origin-fx-discrepancy-03.json",
);

const PINNED = "40096037535807";
const SOURCE_URL =
  "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe?_pos=2&_psid=5b9ca5c42&_ss=e&variant=" +
  PINNED;

interface Variant {
  id: string;
  price: { amount?: number; currency?: string } | null;
  optionValues: Record<string, string> | null;
  stockQuantity: number | null;
}

/** 🟢 대표 사례의 가격표를 **운영 fixture 에서** 읽는다. */
function realVariants(): Variant[] {
  const j = JSON.parse(readFileSync(FIX_03, "utf8")) as { snapshots: { variants: Variant[] }[] };
  return j.snapshots[0].variants;
}

/** 🟢 `fetchShopifyProductJson` 의 실제 variant 선택 규칙을 **그 파일 그대로** 흉내 낸다 —
 *  🔴 단 이 테스트는 그 규칙을 «검증» 하지 않는다(그건 그 파일의 계약이다).
 *  여기서 보는 것은 **probe 가 넘긴 URL** 하나다. */
function fakeFetch(url: string): { productData: { price?: { amount: number; currency: string }; available?: boolean }; shopMeta: { country: string; currency: string } } | null {
  const variants = realVariants();
  const requested = new URL(url).searchParams.get("variant");
  const chosen = requested
    ? variants.find((v) => String(v.id) === requested)
    : (variants.find((v) => (v.stockQuantity ?? 0) > 0) ?? variants[0]);
  /** 🔴 지정했는데 못 찾으면 **가격을 내놓지 않는다**(조용한 갈아타기 금지). */
  if (!chosen?.price?.amount) return { productData: {}, shopMeta: { country: "GB", currency: "GBP" } };
  return {
    productData: { price: { amount: chosen.price.amount, currency: "GBP" }, available: (chosen.stockQuantity ?? 0) > 0 },
    shopMeta: { country: "GB", currency: "GBP" },
  };
}

const calls: string[] = [];

vi.mock("../shopify-product-json", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shopify-product-json")>();
  return {
    ...actual,
    /** 🔴 `extractShopifyHandle`·`extractShopifySelectedVariantId` 는 **실제 구현** 을 쓴다. */
    fetchShopifyProductJson: vi.fn((url: string) => {
      calls.push(url);
      return Promise.resolve(fakeFetch(url));
    }),
    fetchShopifyShopMeta: vi.fn(() =>
      Promise.resolve({ country: "GB", currency: "GBP", shipsToCountries: ["GB", "KR", "AU"] }),
    ),
  };
});

const loadProbe = async () => await import("../shopify-market-probe");

describe("MI-ORIGIN-FX-VARIANT-WIRING-04 — probe 가 `?variant=` 를 보존한다", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("A-0 🟢 대표 사례의 가격표가 운영값 그대로다 — £115 / £119 / £123", () => {
    const v = realVariants();
    expect(v, "🔴 variants 9개").toHaveLength(9);
    const pinned = v.find((x) => String(x.id) === PINNED);
    expect(pinned?.optionValues?.Size, "🟢 고정 옵션은 UK 11").toBe("29 EUR (UK 11)");
    expect(pinned?.price?.amount, "🟢 그 옵션 가격 119").toBe(119);
    /** 🔴 첫 구매가능 옵션은 115 다 — 그것이 전에 원가로 쓰였던 값이다. */
    expect(v.find((x) => (x.stockQuantity ?? 0) > 0)?.price?.amount, "🔴 첫 구매가능 115").toBe(115);
  });

  it("B-1 🟢🟢 **대표 사례 — 원가 관측이 £115 가 아니라 지정 옵션 £119 다**", async () => {
    const { probeOriginAndKrMarkets } = await loadProbe();
    const r = await probeOriginAndKrMarkets(SOURCE_URL);
    expect(r, "🔴 Shopify URL 이므로 null 이 아니다").not.toBeNull();
    /** 🔴 이 한 줄이 이 WU 의 목적이다. */
    expect(r!.origin?.amount, "🟢🟢 지정 옵션 가격이 원가로 선다").toBe(119);
    expect(r!.origin?.currency).toBe("GBP");
    expect(r!.kr?.amount, "🟢 en-kr 도 같은 옵션을 묻는다").toBe(119);
    /** 🟢 실제로 그 파라미터를 실어 물었다. */
    for (const u of calls) expect(new URL(u).searchParams.get("variant"), `🔴 ${u}`).toBe(PINNED);
    /** 🔴 요청 수는 늘지 않았다 — 기본 조회는 둘(원본 + en-kr) 그대로다. */
    expect(calls, "🔴 기본 조회는 2회").toHaveLength(2);
  });

  it("B-2 🟢 기록된 `sourceUrl` 이 «무엇을 물었는지» 를 그대로 남긴다(`.json` 뒤에 쿼리)", async () => {
    const { probeOriginAndKrMarkets } = await loadProbe();
    const r = await probeOriginAndKrMarkets(SOURCE_URL);
    expect(r!.origin?.sourceUrl, "🔴 `.json` 이 쿼리 «앞» 이어야 한다").toBe(
      `https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe.json?variant=${PINNED}`,
    );
    expect(r!.kr?.sourceUrl).toBe(
      `https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe.json?variant=${PINNED}`,
    );
    /** 🔴 `...?variant=X.json` 꼴이 되면 안 된다(쿼리 안으로 `.json` 이 들어간 모양). */
    for (const u of [r!.origin?.sourceUrl, r!.kr?.sourceUrl])
      expect(u, "🔴 `.json` 이 쿼리 안에 들어갔다").not.toMatch(/\?[^#]*\.json/);
  });

  it("B-3 🟢 variant 가 «없는» URL 은 기존 동작 그대로 — 쿼리를 만들지 않는다", async () => {
    const { probeOriginAndKrMarkets } = await loadProbe();
    const plain = "https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe";
    const r = await probeOriginAndKrMarkets(plain);
    /** 🟢 첫 구매가능 옵션(£115) — 예전과 같은 값이다(CEO §3 「지정이 없으면 예전 그대로」). */
    expect(r!.origin?.amount, "🟢 미지정이면 기존 규칙").toBe(115);
    for (const u of calls) expect(new URL(u).search, `🔴 ${u} 에 쿼리가 생겼다`).toBe("");
    expect(r!.origin?.sourceUrl, "🟢 예전 모양 그대로").toBe(
      "https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe.json",
    );
  });

  it("B-4 🔴🔴 [04A 로 뒤집힘] 숫자가 아닌 variant 는 **null** — 첫 옵션으로 갈아타지 않는다", async () => {
    /**
     * 🔴🔴 **내 1차 구현이 여기서 틀렸고 CPO 가 잡았다. 그 사실을 남긴다.**
     *    `-04` 에서는 `?variant=abc` 를 「애초에 지정이 없었다」로 떨어뜨려 **£115**(첫
     *    구매가능 옵션)를 돌려줬다. 🔴 그런데 `?variant=99999999999`(숫자인데 없다)는
     *    **null** 이었다 ⟹ 같은 「지정했는데 못 찾았다」인데 결과가 갈렸고, 뒤쪽은
     *    **조용한 갈아타기** 그 자체다(이 트랙이 막는 그 동작).
     * 🟢 `-04A` 가 그것을 하나로 맞췄다 — **명시했는데 쓸 수 없으면 가격을 내놓지 않는다.**
     */
    const { probeOriginAndKrMarkets } = await loadProbe();
    const r = await probeOriginAndKrMarkets(
      "https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe?variant=abc",
    );
    expect(r, "🟢 Shopify 는 맞으므로 모양은 유지된다(null 이 아니다)").not.toBeNull();
    expect(r!.origin, "🔴 115 가 나오면 조용한 갈아타기다").toBeNull();
    expect(r!.kr, "🔴 en-kr 도 없음").toBeNull();
    /** 🔴 요청조차 보내지 않는다 — 쓸 수 없는 지정에 HTTP 를 쓰지 않는다. */
    expect(calls, "🔴 질의 0회").toHaveLength(0);
  });

  it("B-4b 🔴 `?variant=`(빈 값)도 **null** — 「명시했다」는 사실이 우선이다", async () => {
    const { probeOriginAndKrMarkets } = await loadProbe();
    const r = await probeOriginAndKrMarkets(
      "https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe?variant=",
    );
    expect(r!.origin, "🔴 빈 값도 지정이다 — 기존 동작으로 떨어뜨리지 않는다").toBeNull();
    expect(r!.kr).toBeNull();
    expect(calls, "🔴 질의 0회").toHaveLength(0);
  });

  it("B-4c 🔴 확장 시장도 «같은 기준» 이다 — 무효 지정이면 빈 배열", async () => {
    /** 🔴 한쪽만 막으면 한 스냅샷 안에서 다시 갈린다(원가는 없는데 시장 관측은 £115). */
    const { probeAdditionalShopifyMarkets } = await loadProbe();
    for (const bad of ["?variant=abc", "?variant="]) {
      calls.length = 0;
      const results = await probeAdditionalShopifyMarkets(
        `https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe${bad}`,
        ["", "en-kr"],
      );
      expect(results, `🔴 ${bad} — 시장 관측도 만들지 않는다`).toEqual([]);
      expect(calls, `🔴 ${bad} — 질의 0회`).toHaveLength(0);
    }
  });

  it("B-5 🔴🔴 지정한 variant 를 «못 찾으면» 다른 옵션 가격으로 갈아타지 않는다 — 관측이 없다", async () => {
    const { probeOriginAndKrMarkets } = await loadProbe();
    const r = await probeOriginAndKrMarkets(
      "https://www.junioredition.com/products/lulu-t-bar-shoes-in-tobacco-by-pepe?variant=99999999999",
    );
    /**
     * 🔴 이것이 이 WU 의 안전 조건이다 — 115 나 119 가 **나오면 안 된다**.
     * 🟢 `fetchShopifyProductJson` 이 가격을 내놓지 않고 probe 가 null 을 돌려주므로
     *    그 시장 관측 **행 자체가 생기지 않는다**.
     * 🟢 원가는 `run-price-check` 의 기존 폴백(= 스냅샷 추출가)으로 서고 그 값은
     *    **이미 variant 를 존중한다** ⟹ 어느 경로로도 「다른 옵션의 가격」이 되지 않는다.
     */
    expect(r!.origin, "🔴 조용한 대체 금지 — 관측 없음").toBeNull();
    expect(r!.kr, "🔴 en-kr 도 없음").toBeNull();
    for (const u of calls) expect(new URL(u).searchParams.get("variant")).toBe("99999999999");
  });

  it("C-1 🟢 확장 시장 조회도 «같은 옵션» 을 묻는다 — 한 스냅샷 안에서 옵션이 갈리지 않는다", async () => {
    const { probeAdditionalShopifyMarkets } = await loadProbe();
    const results = await probeAdditionalShopifyMarkets(SOURCE_URL, ["", "en-kr"]);
    expect(results.length, "🔴 후보 중 배송 가능한 것만").toBeGreaterThan(0);
    for (const r of results) expect(r.amount, "🟢 전건 지정 옵션 가격").toBe(119);
    for (const u of calls) expect(new URL(u).searchParams.get("variant"), `🔴 ${u}`).toBe(PINNED);
  });

  it("C-2 🔴 후보 목록·게이트·요청 수를 바꾸지 않았다", async () => {
    const { EXPAND_CANDIDATE_MARKET_CODES, probeAdditionalShopifyMarkets } = await loadProbe();
    /** 🔴 목록이 바뀌면 이 WU 의 범위를 넘은 것이다. */
    expect(EXPAND_CANDIDATE_MARKET_CODES).toEqual([
      "en-us",
      "en-gb",
      "en-fr",
      "en-de",
      "en-jp",
      "en-au",
      "en-ca",
      "en-int",
    ]);
    calls.length = 0;
    await probeAdditionalShopifyMarkets(SOURCE_URL, ["", "en-kr"]);
    /** 🔴 `marketMayBeObserved` 가 ships_to(GB·KR·AU) 로 걸러야 한다 — en-int 는 지역이 없어 통과. */
    const asked = calls.map((u) => new URL(u).pathname.split("/products/")[0].replace(/^\//, ""));
    expect(new Set(asked), "🔴 배송 가능 시장 + en-int 만").toEqual(new Set(["en-gb", "en-au", "en-int"]));
  });
});
