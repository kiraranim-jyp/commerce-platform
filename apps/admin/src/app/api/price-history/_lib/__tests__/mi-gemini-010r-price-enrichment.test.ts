import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-REGISTRATION-CONSUMER-010R — 가격 보강 → 기존 증거 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일의 절반은 «실제 집계기» 를 돌린다**(소스 문자열 검사가 아니다).
 *    `summarizeDomesticMarketSplit` 는 순수 함수이고 런타임 배열을 받으므로,
 *    010R 이 만드는 transient 레코드를 그대로 넣어 **기존 규칙이 실제로 무엇을
 *    내놓는지** 확인할 수 있다. 🟢 그래서 「읽는 코드가 있다」에서 끝내지 않고
 *    **그 값이 기존 계약에 어떻게 반영되는가** 를 증명한다(지시서 §7·§13).
 *
 * 🔴 네트워크를 타지 않는다. 실제 Gemini/HTTP 는 LIVE 하니스가 담당한다.
 */

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const RUNNER = strip("run-domestic-price-check.ts");
const INTEL = strip("market-intelligence.ts");

/** 🟢 운영 실측 모양 그대로 — DOMESTIC_SHOP 279행 전부 market_code=null · KRW. */
const rec = (over: Partial<PriceObservationRecord>): PriceObservationRecord => ({
  id: "r", snapshotId: "s", source: "DOMESTIC_SHOP", sourceLabel: "foretforet.com",
  sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=1",
  sourceRefId: "shop-1", currency: "KRW", priceAmount: 50_000,
  shippingCostAmount: null, taxAmount: null, exchangeRate: null,
  priceKrw: 50_000, salePriceKrw: null, originalPriceKrw: null, soldOut: null,
  marketCode: null, marketCountry: null, shippingPolicyStatus: null, shippingPolicyNote: null,
  checkedAt: "2026-10-13T00:00:00.000Z", ...over,
});

/**
 * 010R 이 market-intelligence 에서 만드는 것과 **같은 모양** 의 transient 레코드.
 *
 * 🔴🔴 **`sourceProductUrl` 을 반드시 후보 자신의 URL 로 준다.**
 *    처음 이 helper 가 `sourceLabel` 만 바꾸고 URL 을 기존 레코드 것으로 뒀더니
 *    `sellerCount` 가 **1** 로 나왔다 — `sellerIdentityKey`(price-history.ts:353)가
 *    **`sourceProductUrl` 의 host 를 먼저** 보기 때문에 두 레코드가 **같은 판매처로
 *    병합** 됐다. 🟢 내 fixture 결함이었고 운영은 `sourceProductUrl: e.discoveredUrl`
 *    로 올바르다 — 그 사실을 아래 「판매처 식별」 블록이 잠근다.
 */
const transient = (over: Partial<PriceObservationRecord>): PriceObservationRecord =>
  rec({
    id: "gemini-transient:x",
    sourceLabel: "looxloo.com",
    sourceProductUrl: "https://looxloo.com/products/x",
    sourceRefId: null,
    ...over,
  });

/* ══════════════ Case B — 가격 없으면 승격되지 않는다 (§3) ══════════════ */

describe("Case B. 🔴🔴 가격 없는 후보는 기존 집계에 «들어가도» 집계되지 않는다", () => {
  it("priceKrw=null 레코드는 sellerCount 를 늘리지 않는다 — 기존 규칙이 막는다", () => {
    const split = summarizeDomesticMarketSplit([transient({ priceKrw: null, priceAmount: null })], []);
    expect(split.exact.sellerCount).toBe(0);
    expect(split.basis).toBe("NONE");
  });

  it("🟢 그래서 §3 의 금지(가격 없음 → matched)는 **내 규칙이 아니라 기존 규칙** 이다", () => {
    const split = summarizeDomesticMarketSplit([], [transient({ priceKrw: null })]);
    expect(split.comparison.sellerCount).toBe(0);
    expect(split.resolved.lowestPriceKrw).toBeNull();
  });

  it("🔴 그리고 010R 은 그 앞에서 한 번 더 거른다(버킷 오염 방지)", () => {
    expect(INTEL).toContain("if (e.priceKrw == null)");
    expect(INTEL).toContain("droppedNoPrice += 1");
  });
});

/* ══════════════ Case A — 가격 있으면 기존 의미로 들어간다 ══════════════ */

describe("Case A. 🟢 가격이 확인된 후보는 기존 계약에 정상 반영된다", () => {
  it("EXACT transient 하나만 있어도 basis=EXACT · sellerCount=1 · lowest 가 잡힌다", () => {
    const split = summarizeDomesticMarketSplit([transient({ priceKrw: 42_000, priceAmount: 42_000 })], []);
    expect(split.basis).toBe("EXACT");
    expect(split.exact.sellerCount).toBe(1);
    expect(split.resolved.lowestPriceKrw).toBe(42_000);
  });

  it("COMPARISON 으로 들어가면 basis=COMPARISON 이다 — EXACT 로 승격되지 않는다", () => {
    const split = summarizeDomesticMarketSplit([], [transient({ priceKrw: 42_000 })]);
    expect(split.basis).toBe("COMPARISON");
    expect(split.exact.sellerCount).toBe(0);
  });
});

/* ══════════════ Case E — 혼합. 🔴 가장 중요하다 ══════════════ */

describe("Case E. 🔴🔴 기존 국내 후보 + Gemini 후보 혼합", () => {
  const existing = rec({ id: "db-1", sourceRefId: "shop-1", priceKrw: 50_000, priceAmount: 50_000 });

  it("🟢 seller 가 둘로 세어진다 — 중복 집계가 아니다(판매처가 다르다)", () => {
    const split = summarizeDomesticMarketSplit(
      [existing, transient({ sourceLabel: "looxloo.com", sourceProductUrl: "https://looxloo.com/products/a", priceKrw: 47_000, priceAmount: 47_000 })],
      [],
    );
    expect(split.exact.sellerCount).toBe(2);
    expect(split.resolved.lowestPriceKrw).toBe(47_000);
  });

  it("🔴 Gemini 가 더 비싸면 기존 최저가가 «그대로» 유지된다 — 덮어쓰지 않는다", () => {
    const split = summarizeDomesticMarketSplit(
      [existing, transient({ sourceLabel: "rulii.co.kr", sourceProductUrl: "https://rulii.co.kr/products/b", priceKrw: 61_000, priceAmount: 61_000 })],
      [],
    );
    expect(split.resolved.lowestPriceKrw).toBe(50_000);
    expect(split.exact.sellerCount).toBe(2);
  });

  it("🔴 가격 없는 Gemini 가 섞여도 기존 증거가 줄지 않는다", () => {
    const base = summarizeDomesticMarketSplit([existing], []);
    const mixed = summarizeDomesticMarketSplit([existing, transient({ priceKrw: null })], []);
    expect(mixed.exact.sellerCount).toBe(base.exact.sellerCount);
    expect(mixed.resolved.lowestPriceKrw).toBe(base.resolved.lowestPriceKrw);
    expect(mixed.basis).toBe(base.basis);
  });

  /**
   * 🔴🔴 **설계 확인에서 찾은 회귀 위험을 실제로 재현한다 — 그리고 내 가설을 정정한다.**
   *
   * 처음엔 「marketCode 가 다르면 `sellerCount` 가 0 이 된다」고 봤다. **틀렸다.**
   * 실제 동작은 둘이 갈린다(price-history.ts:545-556):
   * ```
   * sellerCount    = new Set(activeRecords.map(sellerIdentityKey)).size
   *                  → **market 해석과 무관** 하게 센다
   * lowestPriceKrw = resolvedMarket?.lowestPriceKrw ?? null
   *                  → `resolvePriceMarketKey`(:436)가 null 을 내면 **가격이 null**
   * ```
   * 🔴🔴 **실측 결과는 내 두 번째 가설보다도 나빴다.** 「가격이 null 이 된다」가
   *    아니라 — `marketRegionOf("en-kr") === "KR"` 이고 `null` 키는 KR 로 매칭되지
   *    않으므로 `matched.length === 1` 이 되어 **「en-kr 시장」이 유일한 가격 출처로
   *    선택된다.** 결과: **기존 국내 가격(50,000)이 조용히 버려지고 Gemini 가격
   *    (47,000)으로 «교체» 된다.** 판매처 수는 2 로 남아 있어서 눈에 띄지도 않는다.
   * 🟢 `marketCode: null` 로 맞추면 market key 가 하나라 `SINGLE` 로 해석되고
   *    두 가격이 **같은 시장에서 함께** 집계된다.
   */
  it("🔴🔴 marketCode 를 다르게 주면 기존 가격이 «교체» 된다 — 그래서 null 로 맞춘다", () => {
    const ok = summarizeDomesticMarketSplit([existing, transient({ priceKrw: 47_000, marketCode: null })], []);
    expect(ok.exact.sellerCount).toBe(2);
    expect(ok.exact.lowestPriceKrw).toBe(47_000);
    /** 🟢 둘이 같은 시장에 있으므로 기존 50,000 도 집계에 살아 있다. */
    expect(ok.exact.highestPriceKrw).toBe(50_000);

    const broken = summarizeDomesticMarketSplit(
      [existing, transient({ priceKrw: 47_000, marketCode: "en-kr" })],
      [],
    );
    /** 🔴🔴 판매처 수는 2 로 «그대로» 인데 가격 집계에는 Gemini 것만 남는다 —
     *     기존 50,000 이 사라졌다. 이것이 marketCode 를 맞춰야 하는 이유다. */
    expect(broken.exact.sellerCount).toBe(2);
    expect(broken.exact.lowestPriceKrw).toBe(47_000);
    expect(broken.exact.highestPriceKrw).toBe(47_000);
    expect(broken.exact.highestPriceKrw).not.toBe(50_000);
  });
});

/* ══════════════ Case C/D — fail-soft · OFF ══════════════ */

describe("Case C. 🟢 가격 보강 실패가 전체를 깨뜨리지 않는다", () => {
  it("enrichCandidatePrices 호출이 try/catch 로 감싸져 있다", () => {
    const i = RUNNER.indexOf("priced = await enrichCandidatePrices(");
    expect(i).toBeGreaterThan(-1);
    const around = RUNNER.slice(Math.max(0, i - 200), i + 200);
    expect(around).toContain("try {");
    expect(around).toContain("catch");
  });

  it("🔴 실패하면 점수만 있는 후보로 계속 간다(그러면 priceKrw 가 null → 집계 제외)", () => {
    expect(RUNNER).toContain("let priced = scored;");
  });
});

describe("Case D. 🔴 Gemini OFF 면 가격 보강이 돌지 않는다", () => {
  it("enrichCandidatePrices 가 flag 분기 «안» 에 있다", () => {
    const flag = RUNNER.indexOf("isGeminiDiscoveryEnabled()");
    const enrich = RUNNER.indexOf("enrichCandidatePrices(scored");
    expect(flag).toBeGreaterThan(-1);
    expect(enrich).toBeGreaterThan(flag);
    /** 🔴 그 블록이 닫히기 «전» 이어야 한다 — 위치만 보면 속는다. */
    const block = RUNNER.slice(flag, enrich);
    expect(block).not.toContain("\n  }\n");
  });

  it("OFF 면 evidence 가 null 이라 위 루프가 한 번도 돌지 않는다", () => {
    expect(RUNNER).toContain("geminiEvidence: geminiMetrics === null ? null : geminiEvidence");
    expect(INTEL).toContain("for (const e of geminiEvidence ?? [])");
  });
});

/* ══════════════ §8 자기참조 선제거 ══════════════ */

describe("§8 🔴 자기참조는 가격 보강 «전» 에 제거된다 — HTTP 낭비 금지", () => {
  it("isSelfReferenceCandidate 가 enrichCandidatePrices 보다 «앞» 에 있다", () => {
    const self = RUNNER.indexOf("const notSelf = r.candidates.filter");
    const enrich = RUNNER.indexOf("enrichCandidatePrices(scored");
    expect(self).toBeGreaterThan(-1);
    expect(enrich).toBeGreaterThan(self);
  });

  it("🔴 008A 정책을 쓴다 — 자기참조 판정을 새로 만들지 않았다", () => {
    expect(RUNNER).toContain("!isSelfReferenceCandidate(query.sourceUrl, c.url)");
  });
});

/* ══════════════ §6 HTTP 분리 · §10 저장 0 ══════════════ */

describe("§6/§10 🔴 HTTP 를 구분해 세고, 저장은 0 이다", () => {
  it("Gemini 가격 보강 호출 수를 국내 상세 fetch 와 «다른 칸» 으로 센다", () => {
    expect(RUNNER).toContain("geminiPriceEnrichCalls");
    expect(RUNNER).toContain("domesticModelCodeFetchCount");
    expect(RUNNER).toContain("geminiPriceEnrichCalls += 1");
  });

  it("🔴 가격을 얻었어도 저장 경로가 없다", () => {
    const loop = INTEL.slice(INTEL.indexOf("for (const e of geminiEvidence ?? [])"));
    const body = loop.slice(0, loop.indexOf("const domesticMarketSplit"));
    for (const forbidden of ["insert", "upsert", "supabase", "prisma", "recordPrice", "await "]) {
      expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("🔴 transient 레코드가 price_observations 로 가지 않는다(함수 안에서만 산다)", () => {
    expect(INTEL).toContain("const transient: PriceObservationRecord = {");
    /** 🔴 그 변수를 반환하거나 저장하지 않는다 — 버킷 push 두 곳이 전부다. */
    const hits = INTEL.match(/\btransient\b/g) ?? [];
    /** 🔴 선언 1 + 타입 주석 1 + 버킷 push 2 = 4. 🔴 숫자만 믿지 않는다 —
     *     위 단언이 **저장 어휘 부재** 를 함께 본다. */
    expect(hits.length).toBe(4);
  });
});

/* ══════════════ 🔴🔴 판매처 식별 — 병합되면 증거가 사라진다 ══════════════ */

describe("🔴🔴 판매처 식별 — transient 는 «자기 URL» 을 들고 가야 한다", () => {
  /**
   * 🔴 `sellerIdentityKey`(price-history.ts:353)는 **`sourceProductUrl` 의 host 를
   *    먼저** 본다(없으면 `sourceLabel`, 그다음 `id`). 그래서 transient 레코드가
   *    기존 레코드와 같은 host 를 들고 가면 **같은 판매처로 병합** 되고
   *    `sellerCount` 가 늘지 않는다. 🔴 실제로 내 fixture 가 그 실수를 했고
   *    `sellerCount` 1 이 나왔다 — 운영 코드가 같은 실수를 하면 증거가 조용히 사라진다.
   */
  it("운영이 sourceProductUrl 에 후보 URL 을 넣는다", () => {
    const loop = INTEL.slice(INTEL.indexOf("for (const e of geminiEvidence ?? [])"));
    const body = loop.slice(0, loop.indexOf("const domesticMarketSplit"));
    expect(body).toContain("sourceProductUrl: e.discoveredUrl");
    expect(body).toContain("sourceLabel: e.domain");
  });

  it("🔴 같은 host 를 주면 병합된다 — 그 사실을 숫자로 고정한다", () => {
    const a = rec({ id: "db-1", priceKrw: 50_000 });
    const sameHost = transient({
      sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=999",
      priceKrw: 47_000,
    });
    const split = summarizeDomesticMarketSplit([a, sameHost], []);
    expect(split.exact.sellerCount).toBe(1);
  });
});
