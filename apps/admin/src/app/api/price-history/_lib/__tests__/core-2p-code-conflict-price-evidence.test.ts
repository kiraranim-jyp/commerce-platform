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
import {
  buildMarketJudgement,
  buildPriceGuide,
  isPriceConfirmed,
  transientDisplayTier,
} from "../../../../pipeline/commerce/mi-same-candidates";
/** 🔴 타입의 owner 는 `mi-same-candidates` 가 아니라 **그 컴포넌트 파일** 이다(읽어서 확인). */
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2P — **Scoped Code Conflict → Price Evidence**(측정 전용 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문(2026-10-24) — 「**`DIFF_OFFICIAL_LOOKING_CODE` 의 CONFLICT 를 제한적으로
 * 완화하면 실제 가격 evidence 를 회복하면서 안전성을 유지할 수 있는가?**」 ·
 * 답은 **A 보류 / B scoped 완화 후보 / C 추가 구조 필요** 중 하나로만 끝낸다.
 *
 * 🔴 운영 코드 변경 **0** · CONFLICT 실제 제거 0 · `crossSellerReserved` 0 ·
 *    `NO_TITLE_OVERLAP` 0 · threshold 0 · `SAME_MIN_AXES` 0 · identifier 승격 0 ·
 *    brand/title/normalization/seller SKU 규칙/price calculation/UI/검색 0 · 외부 API 0.
 *
 * ── 🟢🟢 가격 축의 «진입 조건» 을 소스에서 찾았다 ─────────────────────────
 * ```
 * `buildMarketJudgement`(mi-same-candidates.ts:1012)
 *     if (transientDisplayTier(row) !== "SAME") continue;
 * ⟹ 🔴 **가격 축은 `SAME` 하나만 받는다.** 그 앞의 `transientDisplayTier` 는
 *      `row.matchTruth` 가 있으면 그것을 먼저 읽는다(없으면 `crossSellerVerdict`).
 * 🔴 그래서 **identity 가 올라가는 것과 가격 evidence 가 생기는 것은 다른 사건** 이고,
 *    이 WU 는 그 둘을 **갈라서** 잰다(CPO §3 「자동으로 VALID 라고 가정하지 않는다」).
 * ```
 *
 * 🔴 **CORE-2E 함정을 피한다** — 하니스 row 에 `priceTier` 만 넣으면 가격이 0 이 된다.
 *    운영 게이트는 **`matchTruth`** 를 읽으므로 그 칸을 반드시 채운다.
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";
const BOBO = "https://bobochoses.com/products/b226ab040-hug-hairy-monster-t-shirt";

interface GtCand {
  domain: string;
  url: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

describe("CORE-2P — Scoped code conflict → price evidence (운영 변경 0)", () => {
  it("identity 회복과 가격 evidence 회복을 갈라서 잰다", async () => {
    /* ── 원상품 ─────────────────────────────────────────────────────── */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const h = await fetchPlainHtml(ORIGIN);
      const sb = h ? extractSiteBrandName(h) : null;
      if (sb?.value) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: sb.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    expect(dna.brand.value).toBeTruthy();
    expect(dna.brandModelCode).toBe(ORIGIN_CODE);

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8"),
    ) as { candidates: GtCand[] };
    const query = {
      title: ex!.productData!.title ?? "",
      brand: dna.brand.value || undefined,
      sourceUrl: ORIGIN,
      sku: dna.brandModelCode ?? undefined,
      facts: originFacts,
    } as ComparisonQuery;

    /** 🟢 운영 row 를 만든다 — 🔴 `matchTruth` 를 반드시 채운다(CORE-2E 함정). */
    const toRow = (
      c: { url: string; domain?: string; price?: number | null; priceCurrency?: string | null; priceStatus?: string | null; soldOut?: boolean | null },
      verdict: string,
      truth: string,
      market: string,
    ): GeminiTransientRow =>
      ({
        discoveredUrl: c.url,
        domain: c.domain ?? new URL(c.url).hostname,
        matchTruth: truth,
        crossSellerVerdict: verdict,
        market,
        priceAmount: c.price ?? null,
        priceCurrency: c.priceCurrency ?? null,
        priceStatus: c.priceStatus ?? null,
        soldOut: c.soldOut ?? null,
      }) as unknown as GeminiTransientRow;

    interface Row {
      g: GtCand;
      cls: string;
      code: string | null;
      aVerdict: string;
      aTruth: string;
      bVerdict: string;
      bTruth: string;
      aTier: string | null;
      bTier: string | null;
      market: string;
      price: number | null;
      cur: string | null;
      pstat: string | null;
      aPriceEligible: boolean;
      bPriceEligible: boolean;
      priceConfirmed: boolean;
    }
    const rows: Row[] = [];
    const aRows: GeminiTransientRow[] = [];
    const bRows: GeminiTransientRow[] = [];
    let unreachable = 0;

    for (const g of gt.candidates) {
      const f = await factsFromProductUrl(g.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${g.domain.padEnd(24)} 🔴 ${f.status} — 측정불가`);
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const facts = scored?.facts ?? f.candidate.facts;
      const level = (scored?.matchLevel ?? "low") as "low" | "very_high";
      const cand = scored ?? f.candidate;
      const code = facts.brandModelCode ?? null;

      const judge = (ff: ProductFacts) => {
        const cmp = compareModelCode(ORIGIN_CODE, ff.brandModelCode ?? null);
        const cross = compareCrossSellerProducts(originFacts, ff);
        const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
        return { cmp, verdict: cross.verdict, truth };
      };
      const a = judge(facts);
      const sharesPrefix = !!code && code.slice(0, 4).toUpperCase() === ORIGIN_CODE.slice(0, 4);
      const cls =
        code == null
          ? "CODE_ABSENT"
          : a.cmp === "exact"
            ? "EXACT_OFFICIAL_CODE"
            : sharesPrefix
              ? "🔴 DIFF_OFFICIAL_LOOKING"
              : "🔴 SELLER_SKU";
      /**
       * 🔴 **scoped** — `DIFF_OFFICIAL_LOOKING` 에만 적용한다(CPO §2).
       *    `EXACT_OFFICIAL_CODE` · `SELLER_SKU` · `CODE_ABSENT` 는 **손대지 않는다**.
       */
      const b = cls.includes("DIFF_OFFICIAL_LOOKING") ? judge({ ...facts, brandModelCode: null } as ProductFacts) : a;

      /** 🟢 시장은 **운영 분류기** 로 정한다 — 도메인으로 추정하지 않는다. */
      /**
       * 🔴🔴 **1차 하니스가 가격 칸을 틀렸다** — `ComparisonCandidate.price` 는 숫자가
       *    아니라 **`{ amount, currency } | null`** 이다(types.ts:7). 그래서 `priceAmount`
       *    에 **객체** 가 들어가고 통화가 `null` 이 됐다 ⟹ 가격 측정이 **열화** 됐다.
       *    🔴 그대로 보고했으면 「가격 evidence 0」의 원인을 **게이트 탓으로 오인** 했다.
       *    🟢 타입을 **읽어서** 고쳤다(이 트랙의 칸 타입 추측 함정 · 또 한 번).
       */
      const raw = cand as unknown as {
        price?: { amount: number; currency: string } | null;
        priceStatus?: string | null;
        soldOut?: boolean | null;
      };
      const cc = {
        price: raw.price?.amount ?? null,
        priceCurrency: raw.price?.currency ?? null,
        priceStatus: raw.priceStatus ?? null,
        soldOut: raw.soldOut ?? null,
      };
      /**
       * 🟢 시장은 **운영 분류기** 로 정한다 — 🔴 타입을 추측하지 않고 `CandidateMarketInput`
       *    세 칸을 그대로 채운다(`domain` · `currency` · `isRegisteredDomesticShop`).
       * 🔴 등록부 조회는 service-role 키가 필요해 할 수 없다 ⟹ **false** 로 둔다.
       *    그 칸은 KR 근거가 아니라 **충돌 감지용** 이므로(소스 주석) 이 측정에서는
       *    「국내로 올려주지 않는다」는 **보수적인 방향** 이다.
       */
      const mk = classifyCandidateMarket({
        domain: g.domain,
        currency: cc.priceCurrency ?? null,
        isRegisteredDomesticShop: false,
      });
      const market = String(mk.market);

      const rowA = toRow({ url: g.url, domain: g.domain, ...cc }, a.verdict, a.truth, market);
      const rowB = toRow({ url: g.url, domain: g.domain, ...cc }, b.verdict, b.truth, market);
      aRows.push(rowA);
      bRows.push(rowB);

      rows.push({
        g,
        cls,
        code,
        aVerdict: a.verdict,
        aTruth: a.truth,
        bVerdict: b.verdict,
        bTruth: b.truth,
        aTier: transientDisplayTier(rowA),
        bTier: transientDisplayTier(rowB),
        market,
        price: cc.price ?? null,
        cur: cc.priceCurrency ?? null,
        pstat: cc.priceStatus ?? null,
        /** 🔴 **가격 축 진입** = `buildMarketJudgement` 의 조건 그대로다. */
        aPriceEligible: transientDisplayTier(rowA) === "SAME",
        bPriceEligible: transientDisplayTier(rowB) === "SAME",
        priceConfirmed: isPriceConfirmed(rowA),
      });
    }
    expect(rows.length).toBeGreaterThan(0);

    /* ═══ 1. identity ↔ 가격 축 진입을 갈라서 ═══════════════════════ */
    console.log("\n═══ 1. identity 회복 ↔ 가격 축 진입(별개 사건) ═══");
    console.log("    판매처                  CEO         분류                     전 verdict/tier        후 verdict/tier        가격축 전→후");
    for (const r of rows) {
      console.log(
        `    ${r.g.domain.padEnd(22)} ${r.g.calibrationLabel.padEnd(11)} ${r.cls.padEnd(24)} ` +
          `${`${r.aVerdict}/${r.aTier}`.padEnd(22)} ${`${r.bVerdict}/${r.bTier}`.padEnd(22)} ` +
          `${r.aPriceEligible ? "O" : "X"} → ${r.bPriceEligible ? "O" : "X"}` +
          (r.aVerdict !== r.bVerdict ? "   ← identity 이동" : ""),
      );
    }

    /* ═══ 2. junioredition P1/P2 ═══════════════════════════════════ */
    const je = rows.find((r) => r.g.domain === "junioredition.com");
    console.log("\n═══ 2. junioredition — P1(현재) ↔ P2(scoped CF) ═══");
    if (je) {
      console.log(`    code **${je.code}** · 분류 **${je.cls}**`);
      console.log(`    P1  verdict **${je.aVerdict}** · truth **${je.aTruth}** · displayTier **${je.aTier}** · 가격축 **${je.aPriceEligible ? "진입" : "불가"}**`);
      console.log(`    P2  verdict **${je.bVerdict}** · truth **${je.bTruth}** · displayTier **${je.bTier}** · 가격축 **${je.bPriceEligible ? "진입" : "불가"}**`);
      console.log(`    가격 원본 — market **${je.market}** · price **${je.price}** · currency **${je.cur}** · status **${je.pstat}**`);
      console.log(`    isPriceConfirmed(VERIFIED_CURRENT && 금액 && 통화) **${je.priceConfirmed}**`);
      console.log(
        `    ⟹ ${je.bPriceEligible ? "🟢 **가격 축에 진입한다**" : "🔴🔴 **identity 는 올라가는데 가격 축에는 «못 들어간다»**"}`,
      );
      if (!je.bPriceEligible) {
        console.log(
          `       🔴 이유 — buildMarketJudgement 가 **displayTier === "SAME"** 만 받고,` +
            ` P2 의 displayTier 는 **${je.bTier}** 다`,
        );
      }
    } else console.log("    🔴 junioredition 측정불가");

    /* ═══ 3. 실제 집계기를 돌린다 ═══════════════════════════════════ */
    console.log("\n═══ 3. 운영 집계기 실행 — buildMarketJudgement / buildPriceGuide ═══");
    const jA = buildMarketJudgement(aRows);
    const jB = buildMarketJudgement(bRows);
    for (const [tag, j] of [["P1 현재", jA], ["P2 scoped CF", jB]] as const) {
      const kr = buildPriceGuide(j, "KR");
      const os = buildPriceGuide(j, "OVERSEAS");
      console.log(
        `    ${tag.padEnd(14)} sellers **${j.sellers.length}** · 🇰🇷 same ${kr.sameCount}/priced ${kr.pricedCount} · ` +
          `🌎 same ${os.sameCount}/priced ${os.pricedCount} · 통화 ${JSON.stringify(os.byCurrency.map((c: { currency: string; lowest: number }) => `${c.currency} ${c.lowest}`))}`,
      );
    }
    const gained = jB.sellers.length - jA.sellers.length;
    console.log(`    ⟹ 가격 축 판매처 **${jA.sellers.length} → ${jB.sellers.length}**(증분 **${gained}**)`);

    /* ═══ 4. K7 bobochoses 3회 ═════════════════════════════════════ */
    console.log("\n═══ 4. K7 bobochoses fetch-path 3회(관측값만 · 원인 추정 안 함) ═══");
    const var3: { p: string; code: string | null; verdict: string; tier: string | null; elig: boolean }[] = [];
    for (let i = 0; i < 3; i++) {
      const f = await factsFromProductUrl(BOBO);
      const p = String((f as { fetchPath?: string }).fetchPath ?? f.status);
      if (f.status !== "OK" || !f.candidate?.facts) {
        var3.push({ p, code: null, verdict: "-", tier: null, elig: false });
        continue;
      }
      const [sc] = withConfidence(query, [f.candidate]);
      const ff = sc?.facts ?? f.candidate.facts;
      const cmp = compareModelCode(ORIGIN_CODE, ff.brandModelCode ?? null);
      const cr = compareCrossSellerProducts(originFacts, ff);
      const tr = String(deriveMatchTruth((sc?.matchLevel ?? "low") as "low", cmp, cr.verdict, cr.blockers));
      const row = toRow(
        { url: BOBO, domain: "bobochoses.com" },
        cr.verdict,
        tr,
        String(classifyCandidateMarket({ domain: "bobochoses.com", currency: null, isRegisteredDomesticShop: false }).market),
      );
      const tier = transientDisplayTier(row);
      var3.push({ p, code: ff.brandModelCode ?? null, verdict: cr.verdict, tier, elig: tier === "SAME" });
    }
    for (const [i, v] of var3.entries()) {
      console.log(`    ${i + 1}회  path=${v.p.padEnd(13)} code=${String(v.code).padEnd(12)} verdict=${v.verdict.padEnd(14)} tier=${String(v.tier).padEnd(14)} 가격축=${v.elig ? "O" : "X"}`);
    }
    const varied = new Set(var3.map((v) => `${v.p}|${v.code}|${v.verdict}|${v.elig}`)).size > 1;
    console.log(`    ⟹ ${varied ? "🔴 **3회 안에서 변동이 있다**" : "🟢 **3회는 일정** — 🔴 단 CORE-2L 세션에서는 다른 path/code 가 관측됐다(세션 간 변동)"}`);

    /* ═══ 5. Safety / KPI ══════════════════════════════════════════ */
    const k1 = rows.filter((r) => r.aVerdict === "CONFLICT" && r.bVerdict !== "CONFLICT");
    const k2 = rows.filter((r) => !r.aPriceEligible && r.bPriceEligible);
    const k4 = rows.filter((r) => r.g.calibrationLabel === "DIFFERENT" && (r.aVerdict !== r.bVerdict || r.aPriceEligible !== r.bPriceEligible));
    const k5 = rows.filter((r) => r.g.calibrationLabel === "UNCERTAIN" && (r.aVerdict !== r.bVerdict || r.aPriceEligible !== r.bPriceEligible));
    const exacts = rows.filter((r) => r.cls === "EXACT_OFFICIAL_CODE");
    const k6 = exacts.filter((r) => r.aVerdict !== r.bVerdict || r.aTruth !== r.bTruth || r.aPriceEligible !== r.bPriceEligible);

    console.log("\n═══ 5. KPI ═══");
    console.log(`    K1 scoped conflict recovery   **${k1.length}** — ${k1.map((r) => r.g.domain).join(", ") || "없음"}`);
    console.log(`    K2 **price evidence recovery** **${k2.length}** — ${k2.map((r) => r.g.domain).join(", ") || "없음"}`);
    console.log(
      `    K3 price evidence validity     회복분 중 금액확인 ` +
        `**${k2.filter((r) => r.priceConfirmed).length} VALID** · ` +
        `**${k2.filter((r) => !r.priceConfirmed && r.price != null).length} UNKNOWN(미검증)** · ` +
        `**${k2.filter((r) => r.price == null).length} 금액없음**`,
    );
    console.log(`    K4 DIFFERENT leakage          **${k4.length}** 🔴 분모 **1**(parkette)`);
    console.log(`    K5 UNCERTAIN leakage          **${k5.length}** 🔴 분모 **1**(bornyesterdaykids)`);
    console.log(`    K6 exact-code stability       변화 **${k6.length} / ${exacts.length}** (0 이어야 한다)`);
    console.log(`    K7 fetch-path variance        위 §4`);
    console.log(`    측정불가                       **${unreachable}**`);

    /* ═══ 6. 판정 ══════════════════════════════════════════════════ */
    let label: "A" | "B" | "C";
    if (k4.length > 0 || k5.length > 0 || k6.length > 0) label = "A";
    else if (k2.length > 0) label = "B";
    else if (k1.length > 0) label = "C";
    else label = "A";
    console.log("\n═══ 6. 판정 ═══");
    console.log(
      `    **${label}** — ` +
        (label === "A"
          ? "완화 보류(가격 evidence 회복 없음 또는 safety 문제)"
          : label === "B"
            ? "scoped 완화 유지 후보(가격 evidence 가 실제로 회복되고 누출 0)"
            : "**추가 구조 필요** — identity 는 회복되는데 가격 evidence 가 연결되지 않는다"),
    );
    console.log(
      `    근거 — identity 회복 **${k1.length}** · 가격 evidence 회복 **${k2.length}** · ` +
        `DIFFERENT 누출 **${k4.length}** · UNCERTAIN 누출 **${k5.length}** · exact 변화 **${k6.length}**`,
    );
    console.log("    🔴 운영 변경 결정은 하지 않는다 · 🔴 이번 GT 로 일반 규칙을 확정하지 않는다");

    /** 🔴🔴 안전 단언 */
    expect(k4.length, "🔴 parkette 가 움직이면 그 완화는 즉시 탈락이다").toBe(0);
    expect(k5.length, "🔴 bornyesterdaykids 가 움직이면 가격 근거가 오염된다").toBe(0);
    expect(k6.length, "🔴 exact-code 후보는 scoped CF 의 영향을 받지 않아야 한다").toBe(0);
    /** 🔴 seller SKU 는 완화 대상이 아니다(CPO §2 · CORE-2K 가 이미 닫았다). */
    expect(
      rows.filter((r) => r.cls.includes("SELLER_SKU") && r.aVerdict !== r.bVerdict).length,
      "🔴 SELLER_SKU 를 완화하면 CORE-2K 가 무효가 된다",
    ).toBe(0);
  }, 900000);
});
