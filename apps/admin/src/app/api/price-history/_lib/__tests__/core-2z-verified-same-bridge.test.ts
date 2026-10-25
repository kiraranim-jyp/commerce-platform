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
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import type { DomesticPriceTier } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";
/** 🟢 CORE-2AA — 변환을 복제하지 않고 **운영 owner** 를 부른다. */
import { reviewKey } from "../candidate-review";
import { priceTierWithVerifiedSame } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2Z — **`VERIFIED_SAME` 가격 연결 브리지**(calibration 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 CORE-2Y 가 **PASS-Y** 를 냈다 — 「tier 만 올바르면 **기존 집계가 그대로 돈다**」.
 * 🔴 CPO 가 둘 중 **⒝ 별도 tier 입력 경로** 를 골랐다. **⒜ `verified` 가 `matchTruth` 를
 *    이기도록 순서를 바꾸는 것은 «하지 않는다»** — 그러면 MI 안전장치를 **우회** 한다.
 *
 * ── 🔴 세 상태를 «섞지 않는다» (CPO §2) ──────────────────────────────────────────
 * ```
 * AUTOMATED_MI      기존 verdict / matchTruth / tier      ← 이 WU 가 **한 글자도 안 바꾼다**
 * CEO_GROUND_TRUTH  개발·calibration 용 별도 truth
 * VERIFIED_SAME     **별도의 명시적 price-eligibility 상태**
 *
 * 🔴 VERIFIED_SAME ≠ matchTruth · ≠ 자동 SAME · ≠ MI 우회
 * ```
 * 🔴 §3 — **지금은 calibration / harness 경로에서만** 허용한다. 그래서 이 파일은
 *    **운영 코드 0 줄** 이고 상태 정의도 **이 파일 안** 에 있다(운영 타입을 늘리지 않는다).
 * 🔴 §10 금지 — `if (verified) return "EXACT"` · `human_verdict → matchTruth` ·
 *    `SAME_MIN_AXES` 감소 · `crossSellerReserved` 제거 · CONFLICT/NO_TITLE_OVERLAP 완화.
 */

const LIVE = process.env.CORE2Z_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  ceoBasis: string;
  ceoUiLabel: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

/* ══════════════ §2 — 상태 정의(이 파일 안 · 운영 타입 확장 0) ══════════════ */

/**
 * 🔴 **가격에 쓸 자격** 하나만 말한다. 🔴 **동일성 판정이 아니다** — 그래서 이름이
 *    `VERIFIED_SAME` 이고 `SAME` 이 아니다(자동 MI 의 어휘를 빌리지 않는다).
 */
type PriceEligibility = "VERIFIED_SAME" | "EXCLUDED";

/**
 * 🟢 CEO Ground Truth → price-eligibility. 🔴 **`matchTruth` 를 읽지 않는다**(§2·§10).
 * 🔴 `DIFFERENT`·`UNCERTAIN` 은 **VERIFIED_SAME 을 만들지 않는다**(§3 · §6).
 */
function verifiedSameFromGroundTruth(label: GtCand["calibrationLabel"]): PriceEligibility {
  return label === "SAME" ? "VERIFIED_SAME" : "EXCLUDED";
}

/**
 * 🔴 브리지의 **유일한 변환** — `VERIFIED_SAME` 을 기존 가격 축의 tier 로 옮긴다.
 *    🟢 `EXACT` 는 **「동일상품 가격 축」** 이라는 뜻이고, 그것이 CEO 가 확인한 사실이다.
 *
 * 🟢🟢 **CORE-2AA 에서 운영 owner 로 교체했다** — 전에는 이 파일이 변환을 **복제** 하고
 *    있었다(`e === "VERIFIED_SAME" ? "EXACT" : "EXCLUDED"`). 그러면 운영 배선이 깨져도
 *    이 측정은 계속 초록이다. 🔴 그래서 `priceTierWithVerifiedSame` 을 **그대로 부른다**.
 *
 * 🔴 자격이 없을 때 `EXCLUDED` 를 쓰는 것은 **이 측정의 분모 설계** 다(브리지만의 효과를
 *    보려고 자동 tier 를 0 으로 둔다). 🟢 운영은 **단조** 라 자동값을 내리지 않는다 —
 *    그 성질은 `core-2aa` AA-9/AA-11 이 잠근다.
 */
function tierForVerified(e: PriceEligibility): DomesticPriceTier {
  return priceTierWithVerifiedSame({
    url: PROBE_URL,
    autoTier: "EXCLUDED",
    verifiedSameUrlKeys: e === "VERIFIED_SAME" ? [reviewKey(PROBE_URL)] : [],
  });
}

/** 🟢 자격 함수는 URL 키만 보므로 어떤 URL 이든 된다 — 분기만 재현한다. */
const PROBE_URL = "https://example.com/products/core-2z-probe";

const LIB = path.join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const LINK_SRC = strip(
  readFileSync(path.join(LIB, "..", "..", "domestic-price-sources", "_lib", "domestic-product-link.ts"), "utf8"),
);
const INTEL_SRC = strip(readFileSync(path.join(LIB, "market-intelligence.ts"), "utf8"));
const SELF = strip(readFileSync(__filename, "utf8"));

/* ══════════════ §9·§10 — 금지축이 열리지 않았다(네트워크 0) ══════════════ */

describe("§9·§10 — 판정기를 고치지 않았다", () => {
  it("Z-1 🔴 `verified` 가 `matchTruth` 를 **이기지 않는다**(순서 불변)", () => {
    /** 🔴 CPO §10 이 지목한 그 모양이 **운영에 없다**. */
    expect(LINK_SRC).not.toMatch(/if\s*\(\s*(link\.)?verified\s*\)\s*return\s*"EXACT"/);
    /** 🟢 순서가 그대로다 — 판정이 있으면 `verified` 는 읽히지 않는다(CORE-2Y Q1-b). */
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: true })).toBe("COMPARISON");
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: true })).toBe("EXCLUDED");
  });

  it("Z-2 🔴 `human_verdict` 가 MI·가격 경로에 **들어가지 않는다**(WU-131 유지)", () => {
    expect(INTEL_SRC).not.toContain("humanVerdict");
    expect(LINK_SRC).not.toContain("humanVerdict");
  });

  /** 🔴 브리지가 **판정 어휘를 빌리지 않는다** — 이름도 경로도 분리돼 있어야 한다. */
  it("Z-3 🔴 브리지가 `matchTruth` 를 읽지 않는다(§2 분리)", () => {
    const at = SELF.indexOf("function verifiedSameFromGroundTruth");
    expect(at).toBeGreaterThan(0);
    const body = SELF.slice(at, SELF.indexOf("}", SELF.indexOf("{", at)) + 1);
    for (const banned of ["matchTruth", "crossSeller", "verified:", "priceTierFromLink"]) {
      expect(body, `🔴 브리지가 판정 경로를 읽는다: ${banned}`).not.toContain(banned);
    }
  });
});

/* ══════════════ §4~§8 — 라이브 ══════════════ */

describe("CORE-2Z — VERIFIED_SAME → 기존 가격 집계(운영 변경 0)", () => {
  it.skipIf(!LIVE)("브리지 전수 · 국내 회귀 · leakage", async () => {
    console.log("\n════════ 🔴 CORE-2Z — VERIFIED_SAME 가격 연결 브리지 ════════");
    console.log("🔴 운영 코드 0 줄 · 자동 MI 판정 **무변경** · 집계는 기존 함수 그대로");

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

    interface Row {
      domain: string;
      ceo: GtCand["calibrationLabel"];
      autoVerdict: string;
      autoTruth: string;
      autoTier: DomesticPriceTier | string;
      eligibility: PriceEligibility;
      bridgeTier: DomesticPriceTier;
      market: string;
      /** 🔴 등록부 보정 재분류에 **그대로 다시 넘기는** 원본 입력이다(지우면 KR 후보가 사라진다). */
      evidence: Parameters<typeof classifyCandidateMarket>[0]["marketEvidence"];
      currency: string | null;
      amount: number | null;
    }
    const rows: Row[] = [];
    for (const g of gt.candidates) {
      const r = await factsFromProductUrl(g.url);
      if (r.status !== "OK" || !r.candidate?.facts) {
        throw new Error(`🔴 ${g.domain} 측정불가(${r.status}) — 분모가 깨지면 측정하지 않는다`);
      }
      const [sc] = withConfidence(query, [r.candidate]);
      const facts = sc?.facts ?? r.candidate.facts;
      /** 🟢 **자동 MI 는 그대로 돌린다** — 브리지가 그것을 바꾸지 않는다는 증거다. */
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(sc?.matchLevel ?? "low", cmp, cross.verdict, cross.blockers));
      const autoTier = priceTierFromLink({ matchTruth: truth as never, verified: false });

      const eligibility = verifiedSameFromGroundTruth(g.calibrationLabel);
      const currency = (sc?.price?.currency ?? r.candidate.price?.currency) ?? null;
      rows.push({
        domain: g.domain,
        ceo: g.calibrationLabel,
        autoVerdict: cross.verdict,
        autoTruth: truth,
        autoTier,
        eligibility,
        bridgeTier: tierForVerified(eligibility),
        /** 🔴 **운영 owner 를 부른다** — 추정하지 않는다(CORE-2Y 에서 틀렸던 자리). */
        market: classifyCandidateMarket({
          domain: g.domain,
          currency,
          isRegisteredDomesticShop: false,
          marketEvidence: r.candidate.marketEvidence ?? null,
        }).market,
        /** 🔴 재분류할 때 **이 값을 지우지 않는다** — null 로 덮으면 사이트 증거로 KR 인 후보가 사라진다. */
        evidence: r.candidate.marketEvidence ?? null,
        currency,
        amount: (sc?.price?.amount ?? r.candidate.price?.amount) ?? null,
      });
    }

    /* ── §4 전수 표 ── */
    console.log("\n═══ §4 VERIFIED_SAME 생성(10건 전수) ═══");
    console.log(`    ${"판매처".padEnd(22)}${"CEO".padEnd(11)}${"자동 MI".padEnd(30)}${"자동 tier".padEnd(12)}${"브리지".padEnd(16)}시장/가격`);
    for (const r of rows) {
      console.log(
        `    ${r.domain.padEnd(22)}${r.ceo.padEnd(11)}${`${r.autoVerdict}/${r.autoTruth}`.padEnd(30)}${String(r.autoTier).padEnd(12)}${r.eligibility.padEnd(16)}${r.market} ${r.currency ? `${r.currency} ${r.amount}` : "-"}`,
      );
    }
    const vs = rows.filter((r) => r.eligibility === "VERIFIED_SAME");
    console.log(
      `\n    VERIFIED_SAME **${vs.length}/8** · DIFFERENT **${rows.filter((r) => r.ceo === "DIFFERENT" && r.eligibility === "VERIFIED_SAME").length}/1** · UNCERTAIN **${rows.filter((r) => r.ceo === "UNCERTAIN" && r.eligibility === "VERIFIED_SAME").length}/1**`,
    );

    /* ── §7 기존 집계기 재사용(새 함수 0) ── */
    const priced = rows.filter((r) => r.amount != null && r.currency);
    const recs = (mk: string) =>
      priced
        .filter((r) => r.market === mk)
        .map((r) => ({ market: mk, currency: r.currency!, amount: r.amount, priceTier: r.bridgeTier, sellerKey: r.domain }));
    const kr = summarizeCandidateOverseasPrices(recs("KR"));
    const os = summarizeCandidateOverseasPrices(recs("OVERSEAS"));
    console.log("\n═══ §5·§7 기존 집계기 산출(새 집계 함수 0) ═══");
    console.log(`    🇰🇷 ${JSON.stringify(kr.byCurrency)}`);
    console.log(`    🌎 ${JSON.stringify(os.byCurrency)}`);

    /* ── §7 sellerKey dedupe 증명 ── */
    const dupKr = summarizeCandidateOverseasPrices([...recs("KR"), ...recs("KR")]);
    console.log(`    🔁 같은 입력을 **두 번** 넣어도 → ${JSON.stringify(dupKr.byCurrency)}`);

    /* ── §2 자동 MI 무변경 ── */
    console.log("\n═══ §2 자동 MI 변화 ═══");
    console.log("    자동 verdict 변화 **0** · matchTruth 변화 **0** (브리지는 읽기만 한다)");

    /* ── §6 leakage ── */
    const leak = rows.filter((r) => r.ceo !== "SAME" && r.eligibility === "VERIFIED_SAME");
    console.log("\n═══ 🔴 §6 leakage ═══");
    for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
      const r = rows.find((x) => x.domain === d)!;
      console.log(
        `    ${d.padEnd(22)} 가격 **${r.currency} ${r.amount}** 존재 · 자격 **${r.eligibility}** · tier **${r.bridgeTier}**`,
      );
    }
    console.log(`    ⟹ 「가격이 존재한다」 ≠ 「가격 판단에 쓸 수 있다」 · leakage **${leak.length}**`);

    /* ── §8 국내 가격 회귀 ── */
    const dk = rows.find((r) => r.domain === "donokids.com")!;
    const lb = rows.find((r) => r.domain === "m.luxboy.com")!;
    console.log("\n═══ 🔴 §8 국내 가격 회귀 ═══");
    console.log(`    donokids.com   ${dk.market} ${dk.currency} ${dk.amount}`);
    console.log(`    m.luxboy.com   ${lb.market} ${lb.currency} ${lb.amount}`);
    console.log(`    국내 집계      ${JSON.stringify(kr.byCurrency.KRW ?? null)}`);

    /* ══ 단언 ══ */
    expect(vs.length, "🔴 CEO SAME 8건이 VERIFIED_SAME 이 되지 않았다").toBe(8);
    expect(leak.length, "🔴🔴 DIFFERENT/UNCERTAIN 이 VERIFIED_SAME 이 됐다").toBe(0);
    for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
      const r = rows.find((x) => x.domain === d)!;
      expect(r.amount, `🟢 ${d} 는 가격이 «있어야» 이 단언이 의미가 있다`).not.toBeNull();
      expect(r.bridgeTier, `🔴 ${d} 가 가격 축에 들어갔다`).toBe("EXCLUDED");
    }
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 **§8 회귀 — 「donokids → KR」은 이 하니스에서 «측정불가» 다. 적는다.**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 1차에 `expect(dk.market).toBe("KR")` 로 썼다가 **FAIL** 했다 — 실제 값은
     *    **UNKNOWN** 이다. 원인은 제품이 아니라 **하니스** 다:
     * ```
     * `classifyCandidateMarket` 의 KR 근거 셋 — `.kr` TLD · **등록부** · 사이트 증거 2개+
     * donokids.com 은 `.com` 이고 사이트 증거가 0 이라 **등록부** 로만 KR 이 된다.
     * 🔴 그런데 이 하니스는 DB 를 못 읽어 `isRegisteredDomesticShop:false` 를 넘긴다.
     * 🟢 운영 실측은 이미 있다 — CORE-2R-4 라이브:
     *    `donokids.com market=KR(REGISTERED_SHOP_AND_KRW) · 등록부 제거 시 ⟹ UNKNOWN`
     * ```
     * 🟢 그래서 **두 값을 다 적는다** — 하니스(보수적)와 등록부 보정. 🔴 「운영에서 UNKNOWN
     *    이다」로 **적지 않는다**(그것이 거짓이다).
     */
    expect(dk.market, "🔴 등록부 없이는 UNKNOWN 이 정확한 값이다(운영은 등록부로 KR)").toBe("UNKNOWN");
    expect(dk.amount, "🔴 §8 — donokids 가격 회귀").toBe(88000);
    expect(lb.market).toBe("KR");
    expect(lb.amount, "🔴 §8 — m.luxboy 가격 회귀").toBe(59000);
    /** 🟢 보수적 집계(등록부 미반영) — biskuit 88,000 + m.luxboy 59,000. */
    expect(kr.byCurrency.KRW).toEqual({ count: 2, lowestAmount: 59000, highestAmount: 88000 });

    /**
     * 🟢 **등록부 보정본** — CORE-2R-4 가 **실측** 한 그 한 줄(`donokids.com` 이 등록부에 있다)만
     *    반영한다. 🔴 다른 도메인을 손으로 넣지 않는다(`harness-must-derive-inputs-like-production`).
     */
    const REGISTERED = new Set(["donokids.com"]);
    const withRegistry = priced.map((r) => ({
      ...r,
      market: classifyCandidateMarket({
        domain: r.domain,
        currency: r.currency,
        isRegisteredDomesticShop: REGISTERED.has(r.domain),
        /** 🔴 1차 보정에서 여기를 `null` 로 썼다가 **`m.luxboy` 가 사라졌다**(사이트 증거로 KR 이었다). */
        marketEvidence: r.evidence,
      }).market,
    }));
    const krReg = summarizeCandidateOverseasPrices(
      withRegistry
        .filter((r) => r.market === "KR")
        .map((r) => ({ market: "KR", currency: r.currency!, amount: r.amount, priceTier: r.bridgeTier, sellerKey: r.domain })),
    );
    console.log(`    🇰🇷 등록부 보정   ${JSON.stringify(krReg.byCurrency)}  (donokids 포함)`);
    expect(krReg.byCurrency.KRW).toEqual({ count: 3, lowestAmount: 59000, highestAmount: 88000 });
    /** 🟢 §7 — 같은 판매처를 두 번 넣어도 **숫자가 그대로** 다(`sellerKey` dedupe). */
    expect(dupKr.byCurrency.KRW).toEqual(kr.byCurrency.KRW);
    /** 🔴 통화를 **합치지 않는다** — 해외는 통화별로만. */
    expect(Object.keys(os.byCurrency).sort()).toEqual(["EUR", "GBP", "USD"]);
    /** 🔴 §2 — 브리지가 자동 MI 를 바꾸지 않았다(자동 tier 가 CEO 와 **여전히 다르다**). */
    expect(rows.filter((r) => r.ceo === "SAME" && r.autoTier === "EXACT").length, "🔴 자동 MI 가 바뀌었다").toBe(0);
  }, 900_000);
});
