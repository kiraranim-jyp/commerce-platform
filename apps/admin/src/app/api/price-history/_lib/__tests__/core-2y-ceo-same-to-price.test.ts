import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { withConfidence } from "@commerce/crawler/src/comparison-search/match";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2Y — **사람이 SAME 을 확인했을 때 기존 가격 축에 연결되는가**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §0 — CORE-2X 의 **STOP-C 를 그대로 인정** 한다. 다음은 **다시 열지 않는다**:
 *    `crossSellerReserved` · `SAME_MIN_AXES` · 8축 · title-only SAME · code conflict 전면
 *    완화 · `ProductFacts` 신규 필드 · 가격 수집 · 가격 UI.
 * 🟢 그래서 이 파일은 **운영 코드 0 줄** 이고 반사실은 **입력만** 바꾼다(WU-134/164 방식).
 * 🔴 §7 — 「완화하면 SAME 이 된다」가 나와도 **고치지 않고 보고만** 한다.
 */

const LIVE = process.env.CORE2Y_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  ceoBasis: string;
  ceoUiLabel: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

const LIB = path.join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const LINK_SRC = strip(
  readFileSync(path.join(LIB, "..", "..", "domestic-price-sources", "_lib", "domestic-product-link.ts"), "utf8"),
);
const INTEL_SRC = strip(readFileSync(path.join(LIB, "market-intelligence.ts"), "utf8"));
const REVIEW_SRC = strip(readFileSync(path.join(LIB, "candidate-review.ts"), "utf8"));

/* ══════════════ §6 Q1~Q3 — 코드로 답한다(네트워크 0) ══════════════ */

describe("§6 Q1~Q3 — 가격 집계가 «무엇을» 요구하는가", () => {
  /**
   * 🔴🔴🔴 **Q1 의 답 — 가격 축은 `MI final SAME` 을 요구하지 «않는다». `priceTier` 를 요구한다.**
   *
   * ```
   * market-intelligence.ts  if (e.priceTier === "EXACT" || e.priceTier === "COMPARISON")
   * ⟹ 🟢 「SAME 이어야 가격」이 아니라 「**tier 가 EXACT|COMPARISON 이어야 가격**」이다
   * ```
   */
  it("Q1-a 🟢 가격 적재 게이트는 `priceTier` 다(MI verdict 가 아니다)", () => {
    expect(INTEL_SRC).toContain('e.priceTier === "EXACT" || e.priceTier === "COMPARISON"');
    expect(INTEL_SRC, "🔴 가격 적재가 verdict 를 직접 읽으면 Q1 의 답이 달라진다").not.toContain(
      'e.crossSellerVerdict === "SAME"',
    );
  });

  /**
   * 🔴🔴🔴 **그런데 «사람 확인» 칸은 구조적으로 닿지 못한다 — 이것이 이번 WU 의 핵심 발견이다.**
   *
   * `priceTierFromLink` 는 **`matchTruth` 를 먼저** 보고, `verified` 는 **`matchTruth` 가
   * 하나도 안 걸렸을 때만**(= null/미판정) 읽는다:
   * ```
   * if (EXACT_IDENTIFIER | STRONG_IDENTIFIER) return "EXACT";
   * if (TEXT_CONFIRMED)                        return "COMPARISON";
   * if (SIMILAR)                               return "REFERENCE";
   * if (CONFLICT | INSUFFICIENT_EVIDENCE)      return "EXCLUDED";
   * return link.verified ? "EXACT" : "COMPARISON";   ← 🔴 **여기까지 오지 않는다**
   * ```
   * 🔴 CEO GT 10건은 **전부 matchTruth 가 있다**(TEXT_CONFIRMED / CONFLICT /
   *    INSUFFICIENT_EVIDENCE) ⟹ `verified` 를 true 로 만들어도 **tier 가 안 바뀐다**.
   * 🟢 그래서 「사람이 확인했으니 가격에 쓴다」가 **지금 구조에서는 작동하지 않는다.**
   */
  it("Q1-b 🔴🔴 `verified` 는 `matchTruth` 가 **없을 때만** 읽힌다 — 사람 확인 경로가 닿지 않는다", () => {
    expect(LINK_SRC).toContain('return link.verified ? "EXACT" : "COMPARISON";');
    /** 🔴 네 분기가 **그 줄보다 앞** 에 있다 — 그래서 판정이 있으면 `verified` 가 진다. */
    const at = LINK_SRC.indexOf("return link.verified");
    for (const earlier of ["EXACT_IDENTIFIER", "TEXT_CONFIRMED", "SIMILAR", "INSUFFICIENT_EVIDENCE"]) {
      expect(LINK_SRC.indexOf(earlier), `🔴 ${earlier} 분기가 verified 보다 뒤에 있다`).toBeLessThan(at);
    }
    /** 🟢 실제 동작으로도 단언한다 — 판정이 있으면 `verified` 가 무시된다. */
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: true })).toBe("COMPARISON");
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: true })).toBe("EXCLUDED");
    /** 🔴 판정이 **없을 때만** 사람 확인이 EXACT 를 만든다. */
    expect(priceTierFromLink({ matchTruth: null, verified: true })).toBe("EXACT");
  });

  /**
   * 🔴🔴 **Q2 의 답 — 기존 집계·중복제거·`sellerKey` 는 그대로 재사용된다.**
   *    집계기는 `{market, currency, amount, priceTier, sellerKey}` 만 본다 — **판정 어휘가 없다.**
   *    ⟹ 🟢 tier 만 올바르게 주어지면 **집계는 입력의 출처를 묻지 않는다.**
   */
  it("Q2 🟢 집계기는 판정 어휘를 모른다 — tier 만 본다(재사용 가능)", () => {
    const CAND_SRC = strip(readFileSync(path.join(LIB, "candidate-market.ts"), "utf8"));
    expect(CAND_SRC).toContain('r.priceTier === "EXCLUDED"');
    for (const banned of ["matchTruth", "crossSellerVerdict", "PRESUMED_SAME", "EXACT_IDENTIFIER"]) {
      expect(CAND_SRC, `🔴 집계기가 판정 어휘를 다룬다: ${banned}`).not.toContain(banned);
    }
  });

  /**
   * 🔴🔴🔴 **Q3 의 blocker — WU-131 계약이 «사람 판단 → 가격» 을 막는다.**
   *    `candidate_reviews.human_verdict` 는 **이미 DB 에 있다**(WU-131). 🔴 그런데 그 WU 의
   *    보호 계약이 「이 값은 **MI·가격·알림·등록 payload 에 들어가지 않는다**」이다.
   * 🔴 즉 연결은 **기술적으로 한 줄** 이지만 **계약을 깨야** 한다 ⟹ CPO 판정 사안이다.
   */
  it("Q3 🔴 `human_verdict` 는 판정/가격 경로에서 **격리** 돼 있다(설계)", () => {
    expect(REVIEW_SRC).toContain("humanVerdict");
    /** 🔴 가격/판정 모듈이 그 칸을 **읽지 않는다** — 그것이 격리의 구현이다. */
    expect(INTEL_SRC, "🔴 MI 가 사람 판단을 읽는다 — WU-131 격리가 깨졌다").not.toContain("humanVerdict");
    expect(LINK_SRC).not.toContain("humanVerdict");
  });
});

/* ══════════════ §1·§3·§5 — 라이브 반사실 ══════════════ */

describe("CORE-2Y — Y1 단독 레버 · CEO GT → 가격 연결(운영 변경 0)", () => {
  it.skipIf(!LIVE)("Y1 + CEO-GT 가격 연결 + negative control", async () => {
    console.log("\n════════ 🔴 CORE-2Y ════════");
    console.log("🔴 운영 코드 변경 0 · 반사실은 **입력만** 바꾼다");

    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const h = await fetchPlainHtml(ORIGIN);
      const site = h ? extractSiteBrandName(h) : null;
      if (site?.value) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    expect(dna.brand.value, "🔴 brand 가 비면 측정이 열화된다(측정 거부)").toBeTruthy();
    const query = {
      title: ex!.productData!.title ?? "",
      brand: dna.brand.value || undefined,
      sourceUrl: ORIGIN,
      sku: dna.brandModelCode ?? undefined,
      facts: originFacts,
    } as ComparisonQuery;

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8"),
    ) as { candidates: GtCand[] };

    /* ── §1 Y1 — `BRAND_UNCONFIRMED` 단독 레버(donokids) ── */
    const dk = gt.candidates.find((c) => c.domain === "donokids.com")!;
    const f = await factsFromProductUrl(dk.url);
    expect(f.status, "🔴 donokids 측정불가").toBe("OK");
    const [scoredDk] = withConfidence(query, [f.candidate!]);
    const dkFacts = scoredDk?.facts ?? f.candidate!.facts!;
    const level = scoredDk?.matchLevel ?? "low";

    const run = (facts: ProductFacts) => {
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
      return {
        verdict: cross.verdict,
        truth,
        tier: priceTierFromLink({ matchTruth: truth as never, verified: false }),
        axes: (cross.reasons ?? []).length,
        blockers: (cross.blockers ?? []).map((b) => (b as { blocker: string }).blocker).join(",") || "-",
      };
    };

    const before = run(dkFacts);
    /**
     * 🔴 **반사실은 「브랜드 칸을 채운다」 하나다.** `BRAND_UNCONFIRMED` 는
     *    `brandKnown = Boolean(x.brand && y.brand)` 가 false 일 때 걸리고, donokids 는
     *    **후보측 brand 가 null** 이다 ⟹ 그 칸만 채우면 그 blocker 가 사라진다.
     * 🔴 **값을 지어내지 않는다** — 원상품에서 «이미 확정된» 브랜드를 넣는다(WU-134 방식).
     */
    const after = run({ ...dkFacts, brand: originFacts.brand } as ProductFacts);

    console.log("\n═══ §1 Y1 — donokids `BRAND_UNCONFIRMED` 단독 반사실 ═══");
    console.log(`    후보측 brand        ${JSON.stringify(dkFacts.brand)} → ${JSON.stringify(originFacts.brand)}`);
    console.log(`    BEFORE  verdict=${before.verdict} truth=${before.truth} tier=${before.tier} axes=${before.axes} blockers=${before.blockers}`);
    console.log(`    AFTER   verdict=${after.verdict} truth=${after.truth} tier=${after.tier} axes=${after.axes} blockers=${after.blockers}`);
    const y =
      after.truth === "EXACT_IDENTIFIER" || after.truth === "STRONG_IDENTIFIER"
        ? "Y1(SAME 까지 올라감)"
        : before.truth === after.truth && before.verdict === after.verdict
          ? "Y3(변화 없음)"
          : "Y2(PRESUMED_SAME 까지만)";
    console.log(`    ⟹ **${y}**`);

    /* ── §3·§5 — CEO GT 를 «별도 입력» 으로 기존 가격 집계에 넣는다 ── */
    interface Row {
      domain: string;
      ceo: string;
      /** 🔴 운영이 실제로 낸 tier(= 지금 가격 축에 들어가는 값). */
      autoTier: string;
      /** 🟢 CEO 판정만으로 tier 를 정했을 때(= 반사실). 🔴 운영에 넣지 않았다. */
      ceoTier: string;
      amount: number | null;
      currency: string | null;
      market: string;
    }
    const rows: Row[] = [];
    for (const g of gt.candidates) {
      const r = await factsFromProductUrl(g.url);
      if (r.status !== "OK" || !r.candidate?.facts) {
        rows.push({ domain: g.domain, ceo: g.calibrationLabel, autoTier: `🔴 ${r.status}`, ceoTier: "-", amount: null, currency: null, market: "-" });
        continue;
      }
      const [sc] = withConfidence(query, [r.candidate]);
      const facts = sc?.facts ?? r.candidate.facts;
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(sc?.matchLevel ?? "low", cmp, cross.verdict, cross.blockers));
      const autoTier = priceTierFromLink({ matchTruth: truth as never, verified: false });
      /**
       * 🔴🔴 **CEO 판정 → tier 는 «반사실» 이다.** 운영 경로에 넣지 않았고 넣을 수도 없다
       *    (`priceTierFromLink` 가 `matchTruth` 를 먼저 본다 · Q1-b).
       * 🟢 여기서 재는 것은 **「tier 만 올바르면 가격 축이 도는가」** 하나다.
       */
      const ceoTier = g.calibrationLabel === "SAME" ? "EXACT" : "EXCLUDED";
      rows.push({
        domain: g.domain,
        ceo: g.calibrationLabel,
        autoTier,
        ceoTier,
        /** 🔴 칸 이름을 **추측하지 않는다** — `ComparisonCandidate.price = {amount, currency}` 다
         *     (1차에 `priceAmount` 로 썼다가 **typecheck 가 잡았다** · 이 저장소의 그 함정). */
        amount: sc?.price?.amount ?? r.candidate.price?.amount ?? null,
        currency: sc?.price?.currency ?? r.candidate.price?.currency ?? null,
        /**
         * 🔴🔴 **1차에 TLD 정규식으로 추정했다가 숫자가 왜곡됐다. 적는다.**
         *    `donokids.com` 이 `.com` 이라 해외로 세어져 🇰🇷 집계가 **1곳** 으로 나왔다.
         * 🟢 운영 owner(`classifyCandidateMarket`)를 **그대로 부른다** —
         *    메모 `measure-with-the-production-function` 의 그 규칙이다.
         * 🔴 `isRegisteredDomesticShop` 는 DB 를 읽어야 해서 **false 로 둔다** ⟹
         *    등록부 근거가 빠진 **보수적** 값이다(그 한계를 보고에 적는다).
         */
        market: classifyCandidateMarket({
          domain: g.domain,
          currency: (sc?.price?.currency ?? r.candidate.price?.currency) ?? null,
          isRegisteredDomesticShop: false,
          marketEvidence: r.candidate.marketEvidence ?? null,
        }).market,
      });
    }

    console.log("\n═══ §3 CEO GT ↔ 운영 tier ↔ 가격 ═══");
    console.log(`    ${"판매처".padEnd(22)}${"CEO".padEnd(11)}${"운영 tier".padEnd(12)}${"CEO tier".padEnd(10)}가격`);
    for (const r of rows) {
      console.log(
        `    ${r.domain.padEnd(22)}${r.ceo.padEnd(11)}${String(r.autoTier).padEnd(12)}${r.ceoTier.padEnd(10)}${r.currency ? `${r.currency} ${r.amount}` : "-"}`,
      );
    }

    /** 🟢 **기존 집계기를 그대로** 부른다 — 새 집계 0 · `sellerKey` 중복제거 그대로. */
    const priced = rows.filter((r) => r.amount != null && r.currency);
    const krAuto = summarizeCandidateOverseasPrices(
      priced.filter((r) => r.market === "KR").map((r) => ({ market: "KR", currency: r.currency!, amount: r.amount, priceTier: String(r.autoTier), sellerKey: r.domain })),
    );
    const krCeo = summarizeCandidateOverseasPrices(
      priced.filter((r) => r.market === "KR").map((r) => ({ market: "KR", currency: r.currency!, amount: r.amount, priceTier: r.ceoTier, sellerKey: r.domain })),
    );
    const osCeo = summarizeCandidateOverseasPrices(
      priced.filter((r) => r.market === "OVERSEAS").map((r) => ({ market: "OVERSEAS", currency: r.currency!, amount: r.amount, priceTier: r.ceoTier, sellerKey: r.domain })),
    );

    console.log("\n═══ §3 기존 집계기 산출(새 집계 0) ═══");
    console.log(`    🇰🇷 운영 tier 기준   ${JSON.stringify(krAuto.byCurrency)}`);
    console.log(`    🇰🇷 CEO tier 기준    ${JSON.stringify(krCeo.byCurrency)}`);
    console.log(`    🌎 CEO tier 기준    ${JSON.stringify(osCeo.byCurrency)}`);

    /* ── §5 negative control ── */
    const leakRows = rows.filter((r) => r.ceo !== "SAME" && r.ceoTier !== "EXCLUDED");
    console.log("\n═══ 🔴 §5 negative control ═══");
    console.log(`    CEO DIFFERENT/UNCERTAIN 가 가격에 들어간 수 **${leakRows.length}**`);
    expect(leakRows.length, "🔴🔴 CEO DIFFERENT/UNCERTAIN 이 가격 축에 들어갔다").toBe(0);
    /** 🔴 운영 경로에서도 parkette/bornyesterday 는 EXCLUDED 여야 한다. */
    for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
      const r = rows.find((x) => x.domain === d);
      if (r) expect(r.autoTier, `🔴 ${d} 가 운영 tier 에서 가격에 들어간다`).toBe("EXCLUDED");
    }
    expect(rows.length).toBe(gt.candidates.length);
  }, 900_000);
});
