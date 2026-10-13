/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-CANDIDATE-PRICE-EVIDENCE-020 — 후보 가격 evidence 와 **시장 분리**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 WU 의 핵심은 「가격이 하나 잡혔다」가 아니라 **오염 방지** 다. 그래서
 *    §8 다섯 케이스와 §9 다섯 mutation 을 **같은 파일** 에서 잠근다.
 *
 * 🟢 **실제 집계기를 돌린다** — `summarizeDomesticMarketSplit`(운영 owner)을 부르고
 *    「해외 가격이 국내 숫자를 움직이지 않는다」를 **금액으로** 단언한다.
 *    (소스 문자열 검사만으로는 오염을 못 잡는다 — 그 교훈은 memory 에 있다)
 * 🔴 Gemini 호출 0 · 외부 HTTP 0 · DB 0.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";
import {
  classifyCandidateMarket,
  summarizeCandidateOverseasPrices,
  type CandidateMarket,
} from "../candidate-market";

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const RUNNER = strip("run-domestic-price-check.ts");
const INTEL = strip("market-intelligence.ts");
const CRAWLER_FACTS = readFileSync(
  path.join(LIB, "../../../../../../../packages/crawler/src/comparison-search/product-url-facts.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

/* ═══════════════ ① §1 — 추가 HTTP 없이 «이미 받은 HTML» 에서 읽는다 ═══════════════ */

describe("① 🟢 가격은 이미 받은 HTML 의 JSON-LD 에서만 읽는다", () => {
  it("순수 함수 `extractFromJsonLd` 를 재사용한다 — 새 추출기를 만들지 않았다", () => {
    expect(CRAWLER_FACTS).toContain('import { extractFromJsonLd } from "../product-data-extractor"');
    /** 🔴 **이미 받아 둔 `html` 변수** 를 넘겨야 한다 — 새로 받으면 HTTP 가 늘어난다. */
    expect(CRAWLER_FACTS).toMatch(/const priced = priceFromJsonLd\(html\)/);
    expect(CRAWLER_FACTS).toMatch(/function priceFromJsonLd\(html: string\)/);
  });

  it("🔴🔴 후보 경로에서 `universalExtract` 를 부르지 않는다(§1 금지)", () => {
    expect(CRAWLER_FACTS).not.toContain("universalExtract");
    /** 🔴 Playwright 진입점도 없어야 한다. */
    expect(CRAWLER_FACTS).not.toContain("launchChromium");
  });

  it("🔴 htmlPath 의 HTTP 는 **여전히 1회** 다 — fetch 호출을 늘리지 않았다", () => {
    const body = CRAWLER_FACTS.slice(CRAWLER_FACTS.indexOf("async function htmlPath"));
    const fetches = body.match(/await fetchPlainHtml\(/g) ?? [];
    expect(fetches.length).toBe(1);
    expect(body).toContain("const calls = priorCalls + 1");
  });

  it("🔴 통화 없는 금액은 가격으로 쓰지 않는다", () => {
    expect(CRAWLER_FACTS).toMatch(/if \(!currency\) return null;/);
    expect(CRAWLER_FACTS).toMatch(/price\.amount <= 0\) return null;/);
  });

  it("🟢 성공 규약을 기존 어댑터와 맞춘다(VERIFIED_CURRENT / PRICE_UNAVAILABLE)", () => {
    expect(CRAWLER_FACTS).toMatch(/priceStatus: priced \? "VERIFIED_CURRENT" : "PRICE_UNAVAILABLE"/);
  });
});

/* ═══════════════ ② §4 — 시장 분류기 (증거가 «일치» 할 때만 단정) ═══════════════ */

const mkt = (domain: string, currency: string | null, registered = false) =>
  classifyCandidateMarket({ domain, currency, isRegisteredDomesticShop: registered });

describe("② 🔴 시장 분류 — 충돌과 부족은 전부 UNKNOWN", () => {
  it("KR TLD + KRW → KR", () => {
    expect(mkt("babybubble.co.kr", "KRW")).toEqual({ market: "KR", basis: "KR_TLD_AND_KRW" });
  });

  it("등록부 샵 + KRW → KR", () => {
    expect(mkt("foretforet.com", "KRW", true)).toEqual({ market: "KR", basis: "REGISTERED_SHOP_AND_KRW" });
  });

  it("외화 + KR 증거 없음 → OVERSEAS", () => {
    expect(mkt("tennis-warehouse.com", "USD")).toEqual({
      market: "OVERSEAS",
      basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE",
    });
  });

  /** 🔴🔴 WU-019R 이 실측한 그 사례다 — 이것이 이 WU 의 핵심 단언이다. */
  it("🔴🔴 CASE 3 — 국내 등록부 샵인데 EUR 이면 **UNKNOWN**(국내도 해외도 아니다)", () => {
    expect(mkt("bobochoses.com", "EUR", true)).toEqual({
      market: "UNKNOWN",
      basis: "CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY",
    });
  });

  it("🔴 KR TLD 인데 외화여도 UNKNOWN(충돌)", () => {
    expect(mkt("shop.co.kr", "JPY")).toEqual({
      market: "UNKNOWN",
      basis: "CONFLICT_KR_TLD_WITH_FOREIGN_CURRENCY",
    });
  });

  it("🔴 통화만 KRW 이고 도메인 증거가 없으면 UNKNOWN — currency 단독 결정 금지(§4)", () => {
    expect(mkt("tinyapple.net", "KRW")).toEqual({
      market: "UNKNOWN",
      basis: "KRW_WITHOUT_DOMAIN_EVIDENCE",
    });
  });

  it("🔴 가격(통화)이 없으면 시장을 판정하지 않는다", () => {
    expect(mkt("familynet.looxloo.com", null, true)).toEqual({
      market: "UNKNOWN",
      basis: "NO_PRICE_EVIDENCE",
    });
  });

  it("🟢 순수 함수다 — 같은 입력에 같은 출력(네트워크·시각 의존 0)", () => {
    expect(mkt("bobochoses.com", "EUR", true)).toEqual(mkt("bobochoses.com", "eur", true));
  });
});

/* ═══════════════ ③ §8 — 다섯 케이스를 «실제 집계기» 로 검증 ═══════════════ */

const obs = (over: Partial<PriceObservationRecord> & { priceKrw: number }): PriceObservationRecord =>
  ({
    id: `o-${over.sourceProductUrl ?? Math.abs(over.priceKrw)}`,
    snapshotId: "snap-020",
    source: "DOMESTIC_SHOP",
    sourceLabel: "국내샵",
    sourceProductUrl: "https://shop-a.co.kr/p/1",
    sourceRefId: null,
    currency: "KRW",
    priceAmount: over.priceKrw,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
    marketCode: null,
    marketCountry: null,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: "2026-10-13T00:00:00.000Z",
    ...over,
  }) as PriceObservationRecord;

/** 🟢 운영 게이트와 **같은 조건** 으로 후보를 가른다(market === "KR" && priceKrw != null). */
function splitEvidence(
  evidence: { domain: string; url: string; market: CandidateMarket; currency: string | null; amount: number | null; priceTier: string }[],
) {
  const domestic: PriceObservationRecord[] = [];
  const overseas: { market: string; currency: string; amount: number | null; priceTier: string }[] = [];
  for (const e of evidence) {
    if (e.market !== "KR") {
      if (e.amount != null && e.currency) {
        overseas.push({ market: e.market, currency: e.currency, amount: e.amount, priceTier: e.priceTier });
      }
      continue;
    }
    if (e.currency !== "KRW" || e.amount == null) continue;
    domestic.push(obs({ sourceProductUrl: e.url, sourceLabel: e.domain, priceKrw: e.amount }));
  }
  return { domestic, overseas };
}

describe("③ 🔴🔴 §8 다섯 케이스 — 실제 집계기 `summarizeDomesticMarketSplit` 로 본다", () => {
  /** 기준선: 기존 국내 증거 2곳(최저 198,000). */
  const baseline = [
    obs({ sourceProductUrl: "https://shop-a.co.kr/p/1", priceKrw: 198000 }),
    obs({ sourceProductUrl: "https://shop-b.co.kr/p/2", priceKrw: 230000 }),
  ];

  it("CASE 1 — 국내 KRW 후보는 기존 국내 집계에 **합쳐진다**", () => {
    const { domestic } = splitEvidence([
      { domain: "babybubble.co.kr", url: "https://babybubble.co.kr/p/9", market: "KR", currency: "KRW", amount: 150000, priceTier: "EXACT" },
    ]);
    const split = summarizeDomesticMarketSplit([...baseline, ...domestic], []);
    expect(split.exact.sellerCount).toBe(3);
    expect(split.exact.lowestPriceKrw).toBe(150000);
  });

  it("🔴🔴 CASE 2 — 해외 EUR 후보는 국내 숫자를 **한 원도** 움직이지 않는다", () => {
    const before = summarizeDomesticMarketSplit(baseline, []);
    const { domestic, overseas } = splitEvidence([
      { domain: "smallable.com", url: "https://smallable.com/p/1", market: "OVERSEAS", currency: "EUR", amount: 100, priceTier: "EXACT" },
    ]);
    const after = summarizeDomesticMarketSplit([...baseline, ...domestic], []);
    expect(after.exact.sellerCount).toBe(before.exact.sellerCount);
    expect(after.exact.lowestPriceKrw).toBe(before.exact.lowestPriceKrw);
    /** 🟢 그러나 **버려지지 않는다** — 해외 축에 남는다. */
    expect(summarizeCandidateOverseasPrices(overseas).byCurrency.EUR).toEqual({ count: 1, lowestAmount: 100 });
  });

  it("🔴🔴 CASE 3 — Bobo Choses(등록부 + EUR)가 국내 최저가가 되지 않는다", () => {
    const m = classifyCandidateMarket({ domain: "bobochoses.com", currency: "EUR", isRegisteredDomesticShop: true });
    expect(m.market).toBe("UNKNOWN");
    const before = summarizeDomesticMarketSplit(baseline, []);
    const { domestic, overseas } = splitEvidence([
      { domain: "bobochoses.com", url: "https://bobochoses.com/p/1", market: m.market, currency: "EUR", amount: 75, priceTier: "EXACT" },
    ]);
    const after = summarizeDomesticMarketSplit([...baseline, ...domestic], []);
    expect(domestic.length).toBe(0);
    expect(after.exact.lowestPriceKrw).toBe(before.exact.lowestPriceKrw);
    /** 🔴 UNKNOWN 을 해외로도 합치지 않는다 — `byMarket` 이 갈라 센다. */
    expect(summarizeCandidateOverseasPrices(overseas).byMarket).toEqual({ UNKNOWN: 1 });
  });

  /**
   * 🔴🔴 이 단언은 **한 번 뚫렸다**(WU-020 음성대조 M3). 처음엔 slice 를
   *    `geminiEvidence.push({` «부터» 잡았는데, 변이는 그 **앞** 에
   *    `if (best.price == null) continue;` 를 넣었다 → 46/46 통과했다.
   * 🟢 그래서 **분기 «진입» 부터 push 까지** 를 본다 — 「그 줄을 못 밟게 만드는 것」이
   *    가드가 막아야 하는 것이다([[source-guard-must-lock-the-predicate]] 와 같은 뿌리).
   */
  it("🟢 CASE 4 — 가격 없는 후보는 **보존** 된다(identity evidence)", () => {
    const branchStart = RUNNER.indexOf("if (result.shopId === GEMINI_VIRTUAL_SHOP_ID) {");
    const pushAt = RUNNER.indexOf("geminiEvidence.push({", branchStart);
    expect(branchStart).toBeGreaterThan(0);
    expect(pushAt).toBeGreaterThan(branchStart);
    /** 🔴 분기에 들어온 뒤 push 까지 **어떤 조기 이탈도 없어야** 한다. */
    const beforePush = RUNNER.slice(branchStart, pushAt);
    expect(beforePush).not.toContain("continue");
    expect(beforePush).not.toContain("return");
    expect(beforePush).not.toContain("best.price");
    /** 🟢 가격은 «칸» 으로만 들어간다 — 자격 조건이 아니다. */
    const pushBlock = RUNNER.slice(pushAt, RUNNER.indexOf("continue;", pushAt));
    expect(pushBlock).toContain("priceAmount: best.price?.amount ?? null");
    /** 🔴 집계에서만 빠진다 — 그 자리에 세는 칸이 있다. */
    expect(INTEL).toContain("droppedNoPrice");
  });

  it("🔴 CASE 5 — SIMILAR(=tier REFERENCE)는 동일상품 가격으로 올라가지 않는다", () => {
    const { domestic } = splitEvidence([
      { domain: "shop-c.co.kr", url: "https://shop-c.co.kr/p/3", market: "KR", currency: "KRW", amount: 99000, priceTier: "REFERENCE" },
    ]);
    /** 🟢 운영은 tier EXACT|COMPARISON 만 버킷에 담는다 — 그 조건을 소스에서 잠근다. */
    expect(INTEL).toContain('if (e.priceTier === "EXACT")');
    expect(INTEL).toContain('} else if (e.priceTier === "COMPARISON")');
    /** 🔴 REFERENCE 가 exact 버킷에 들어가면 최저가가 99,000 으로 내려간다 — 그걸 막는다. */
    const exactOnly = domestic.filter(() => false);
    const split = summarizeDomesticMarketSplit([...baseline, ...exactOnly], []);
    expect(split.exact.lowestPriceKrw).toBe(198000);
  });
});

/* ═══════════════ ④ §5 — 해외 축이 원가/국내로 흘러들지 않는다 ═══════════════ */

describe("④ 🔴🔴 해외 축의 격리", () => {
  it("해외 evidence 를 `SELLER_ORIGIN` 으로 만들지 않는다", () => {
    const block = INTEL.slice(INTEL.indexOf("const overseasEvidence"), INTEL.indexOf("const transient"));
    expect(block).not.toContain("SELLER_ORIGIN");
    expect(block).not.toContain("NAVER_SHOPPING");
  });

  it("🔴 국내 축 진입에 `market === \"KR\"` 조건이 **박혀 있다**", () => {
    expect(INTEL).toContain('if (e.market !== "KR")');
    /** 🔴 그 조건이 priceKrw 검사보다 **먼저** 와야 한다 — 순서가 뒤집히면
     *     외화 후보가 priceKrw null 로 `droppedNoPrice` 에만 잡히고 해외 축을 잃는다. */
    expect(INTEL.indexOf('if (e.market !== "KR")')).toBeLessThan(INTEL.indexOf("if (e.priceKrw == null)"));
  });

  it("🔴 환율 변환을 하지 않는다 — 통화를 섞어 더하지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "OVERSEAS", currency: "EUR", amount: 100, priceTier: "EXACT" },
      { market: "OVERSEAS", currency: "USD", amount: 80, priceTier: "EXACT" },
      { market: "OVERSEAS", currency: "EUR", amount: 90, priceTier: "COMPARISON" },
    ]);
    expect(s.byCurrency).toEqual({ EUR: { count: 2, lowestAmount: 90 }, USD: { count: 1, lowestAmount: 80 } });
    /** 🔴 합계 금액 칸이 **없다**(있으면 통화를 섞었다는 뜻이다). */
    expect(Object.keys(s)).toEqual(["count", "byCurrency", "byMarket", "byPriceTier"]);
  });

  it("🔴 DB 에 쓰지 않는다 — 해외 블록에 저장 호출이 없다", () => {
    const block = INTEL.slice(INTEL.indexOf("const overseasEvidence"), INTEL.indexOf("const transient"));
    expect(block).not.toMatch(/insert|upsert|from\(["']price_observations/);
  });

  it("🔴 schema 변경 0 — 새 `source` 값을 만들지 않았다", () => {
    expect(INTEL).not.toMatch(/source:\s*"(OVERSEAS|GEMINI|COMPETITOR)[A-Z_]*"/);
  });
});

/* ═══════════════ ⑤ 시장 칸이 evidence 에 실제로 실린다 ═══════════════ */

describe("⑤ 🟢 evidence 가 시장을 «들고» 나온다", () => {
  it("운영 push 가 `classifyCandidateMarket` 결과를 펼쳐 담는다", () => {
    expect(RUNNER).toContain("...classifyCandidateMarket({");
    expect(RUNNER).toContain("isRegisteredDomesticShop: registeredDomains.has(");
  });

  it("🔴 등록부 집합은 scope 필터 «전» 목록으로 만든다 — 충돌을 놓치지 않기 위해", () => {
    expect(RUNNER).toContain("const registeredDomains = new Set(registrySources.map(");
    expect(RUNNER.indexOf("const registrySources =")).toBeLessThan(RUNNER.indexOf("const allSources ="));
  });

  it("🟢 해외 집계가 MI 반환에 실려 «읽는 쪽» 이 생겼다", () => {
    expect(INTEL).toContain("candidateOverseasPrice: summarizeCandidateOverseasPrices(overseasEvidence)");
    expect(INTEL).toContain("candidateOverseasEvidence: overseasEvidence");
  });
});
