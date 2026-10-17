import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichCandidatePrices, productFactsFromListing, withConfidence } from "@commerce/crawler";
import type { ComparisonCandidate } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-055 — **상세 페이지에서 읽은 가격이 「미검증」으로 되돌려지지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 고친 것은 **필드 하나와 분기 하나** 이고, **새 정책이 아니다.** 이 리포의
 *    가격 신뢰도 규칙은 한 곳에 있다(`derivePriceStatus` · match.ts:537):
 * ```
 * priceSource === "detail"  ⟹  VERIFIED_CURRENT
 * 그 외                      ⟹  UNVERIFIED_SEARCH
 * ```
 *    그 주석이 자격 사례까지 적어 뒀다 — 「검색 자체가 상세 페이지를 조회하는 경우」.
 *    🟢 `factsFromProductUrl` 이 **정확히 그 경우** 인데 `priceSource` 를 세우지
 *    않아서, 두 번 되돌려졌다(withConfidence → enrich).
 *
 * 🔴 실측 효과(WU-055 체인 · GT 51건 / host 35): **국내 가격비교 도달 0 → 5**,
 *    해외 16 **불변**, matchTruth/priceTier/market 분포 **완전 동일**.
 */

const repoRoot = (() => {
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo 루트를 찾지 못했다");
})();
const strip = (p: string) =>
  readFileSync(path.join(repoRoot, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const FACTS_SRC = strip("packages/crawler/src/comparison-search/product-url-facts.ts");
const ADAPTER_SRC = strip("packages/crawler/src/comparison-search/price-source-adapter.ts");
const MATCH_SRC = strip("packages/crawler/src/comparison-search/match.ts");

/** 🔴 상세에서 읽은 국내 후보 — Shopify handle 이 **없다**(그래서 enrich 가 복구하지 못한다). */
function detailSourcedKrwCandidate(): ComparisonCandidate {
  return {
    title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
    url: "https://biskuit.kr/goods/view?no=12345",
    price: { amount: 88_000, currency: "KRW" },
    regularPrice: null,
    imageUrl: null,
    confidence: 0,
    priceSource: "detail",
    priceStatus: "VERIFIED_CURRENT",
    facts: productFactsFromListing({
      title: "보보쇼즈 26FW 아동 긴팔 티셔츠 Booty Ghosts T-shirt B226AC010",
      url: "https://biskuit.kr/goods/view?no=12345",
      brand: "Bobo Choses",
    }),
  };
}

/** 🔴 검색 목록에서 온 후보 — `priceSource` 가 없다. **이쪽은 변하지 않아야 한다.** */
function searchSourcedCandidate(): ComparisonCandidate {
  const c = detailSourcedKrwCandidate();
  return { ...c, priceSource: undefined, priceStatus: undefined };
}

const QUERY = {
  title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
  brand: "Bobo Choses",
  sku: "B226AC010",
  sourceUrl: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt",
  facts: productFactsFromListing({
    title: "Booty Ghosts Long Sleeve T-Shirt",
    url: "https://www.junioredition.com/en-kr/products/booty-ghosts-long-sleeve-t-shirt",
    brand: "Bobo Choses",
  }),
};

/* ══════════════ A. 🟢 상세 출처 가격이 «끝까지» 유지된다 ══════════════ */

describe("A. 상세 출처 가격 보존 (순수 · HTTP 0)", () => {
  it("🟢 withConfidence 가 VERIFIED_CURRENT 를 유지한다", () => {
    const [out] = withConfidence(QUERY as never, [detailSourcedKrwCandidate()]);
    expect(out?.priceStatus).toBe("VERIFIED_CURRENT");
  });

  /** 🔴 **이 단계가 되돌리고 있었다.** Shopify handle 이 없어 복구도 불가능했다. */
  it("🟢🟢 enrichCandidatePrices 가 더 이상 되돌리지 않는다", async () => {
    const scored = withConfidence(QUERY as never, [detailSourcedKrwCandidate()]);
    const out = await enrichCandidatePrices(scored, "biskuit.kr", QUERY as never);
    expect(out[0]?.priceStatus).toBe("VERIFIED_CURRENT");
    expect(out[0]?.priceSource).toBe("detail");
    expect(out[0]?.verificationAttempted).toBe(true);
    /** 🔴 금액·통화를 바꾸지 않는다. */
    expect(out[0]?.price).toEqual({ amount: 88_000, currency: "KRW" });
  });

  /**
   * 🔴🔴 **국내 축 자격을 운영 술어로 확인한다**(run-domestic-price-check.ts:1294).
   *    이 한 줄이 통과해야 `priceKrw` 가 채워지고 국내 가격비교에 들어간다.
   */
  it("🟢 운영 술어로 priceKrw 가 채워진다", async () => {
    const scored = withConfidence(QUERY as never, [detailSourcedKrwCandidate()]);
    const [out] = await enrichCandidatePrices(scored, "biskuit.kr", QUERY as never);
    const priceKrw =
      out!.priceStatus === "VERIFIED_CURRENT" && out!.price?.currency === "KRW" ? out!.price.amount : null;
    expect(priceKrw).toBe(88_000);
  });
});

/* ══════════════ B. 🔴 검색 출처는 «변하지 않는다» (회귀 방어) ══════════════ */

describe("B. 검색 출처 후보는 그대로 미검증이다", () => {
  it("🔴 priceSource 가 없으면 UNVERIFIED_SEARCH 로 시작한다", async () => {
    const scored = withConfidence(QUERY as never, [searchSourcedCandidate()]);
    expect(scored[0]?.priceStatus).toBe("UNVERIFIED_SEARCH");
    const [out] = await enrichCandidatePrices(scored, "biskuit.kr", QUERY as never);
    expect(out?.priceStatus).toBe("UNVERIFIED_SEARCH");
    expect(out?.priceSource).toBe("search");
  });

  /** 🔴 그러므로 국내 축에 **들어가지 않는다** — 미검증 가격을 비교가격으로 쓰지 않는다. */
  it("🔴 검색 출처는 priceKrw 가 null 이다", async () => {
    const scored = withConfidence(QUERY as never, [searchSourcedCandidate()]);
    const [out] = await enrichCandidatePrices(scored, "biskuit.kr", QUERY as never);
    const priceKrw =
      out!.priceStatus === "VERIFIED_CURRENT" && out!.price?.currency === "KRW" ? out!.price.amount : null;
    expect(priceKrw).toBeNull();
  });
});

/* ══════════════ C. 🔴 소스 가드 — 규칙의 «단일 소유자» 를 잠근다 ══════════════ */

describe("C. 배선 경계", () => {
  /** 🟢 판정 규칙은 여전히 `derivePriceStatus` 하나다 — 사본을 만들지 않았다. */
  it("🟢 신뢰도 규칙의 owner 가 그대로다", () => {
    expect(MATCH_SRC).toContain('if (candidate.priceSource === "detail")');
    expect(MATCH_SRC).toContain('priceStatus: "VERIFIED_CURRENT", verificationAttempted: true');
  });

  /** 🔴 상세에서 가격을 읽었으면 **그 사실을** 적는다. 가격이 없으면 세우지 않는다. */
  it("🔴 factsFromProductUrl 이 priceSource 를 적는다", () => {
    expect(FACTS_SRC).toContain('priceSource: priced ? "detail" : null');
  });

  /** 🔴 enrich 의 보존 분기 — **덮어쓰기 앞** 에 있어야 한다. */
  it("🔴 enrich 가 detail 출처를 보존한다", () => {
    /** 🔴 좌표를 틀렸다 — `selectCandidatesForDetailConfirmation` **정의** 가 이 함수보다
     *     «앞» 에 있어서 slice 가 비었다. 함수 시작 «이후» 의 첫 등장으로 끊는다. */
    const start = ADAPTER_SRC.indexOf("export async function enrichCandidatePrices");
    expect(start, "enrichCandidatePrices 가 사라졌다").toBeGreaterThan(0);
    const body = ADAPTER_SRC.slice(
      start,
      ADAPTER_SRC.indexOf("selectCandidatesForDetailConfirmation", start),
    );
    expect(body).toContain('c.priceSource === "detail"');
    expect(body).toContain('priceStatus: "VERIFIED_CURRENT" as const');
  });

  /** 🔴🔴 **환산을 만들지 않았다** — 통화를 그대로 둔다. */
  it("🔴 두 파일에 환율/KRW 환산이 없다", () => {
    for (const src of [FACTS_SRC, ADAPTER_SRC]) {
      expect(src).not.toMatch(/convertToKrw|exchangeRate|fetchLiveExchangeRates/);
    }
  });
});
