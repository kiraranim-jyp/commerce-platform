import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import type { ModelEvidenceResult } from "@commerce/crawler/src/comparison-search/evidence";
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
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2Q — **`TEXT_CONFIRMED → SAME` 최소 조합**(측정 전용 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문(2026-10-24) — 「**CEO 가 SAME 으로 판정한 후보 중, 공식 품번 충돌 때문에
 * `PRESUMED_SAME` 에 머무는 경우를 실제 가격 evidence 까지 연결할 수 있는 최소
 * 안전 조건이 무엇인가?**」 · 「각 조합마다 **가격 집계까지** 연결해서
 * `SAME → price evidence eligible → 실제 가격` 이 되는지 확인한다」.
 *
 * 🔴 운영 코드 변경 **0** — 전부 **입력(인자)** 으로만 조합한다.
 *    `deriveMatchTruth(level, **modelCode**, **crossSeller**, **blockers**)` 가 네 칸을
 *    인자로 받으므로 조합 행렬을 **변이 없이** 만들 수 있다.
 * 🔴 범위 — **품번 conflict 가 있는 후보에만** 적용한다.
 *    `EXACT_OFFICIAL_CODE` · `SELLER_SKU` · `CODE_ABSENT` 는 **손대지 않는다**(CPO 명시).
 *
 * ── 🔴🔴 착수 전에 확정된 구조 둘(앞 WU 가 소스에서 읽었다) ────────────────
 * ```
 * ⒜ 가격 축 진입 = `transientDisplayTier(row) === "SAME"` (buildMarketJudgement:1012)
 * ⒝ `transientDisplayTier` 는 `row.matchTruth` 를 **먼저** 읽는다
 * ⟹ 그래서 이 WU 의 질문은 「**어떤 조합이 matchTruth 를 SAME 등급으로 올리는가**」다
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

describe("CORE-2Q — TEXT_CONFIRMED → SAME 최소 조합 (운영 변경 0)", () => {
  it("조합 행렬을 만들고 가격 집계까지 연결한다", async () => {
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

    const toRow = (
      url: string,
      domain: string,
      truth: string,
      verdict: string,
      market: string,
      price: number | null,
      cur: string | null,
      pstat: string | null,
      soldOut: boolean | null,
    ): GeminiTransientRow =>
      ({
        discoveredUrl: url,
        domain,
        matchTruth: truth,
        crossSellerVerdict: verdict,
        market,
        priceAmount: price,
        priceCurrency: cur,
        priceStatus: pstat,
        soldOut,
      }) as unknown as GeminiTransientRow;

    interface Cand {
      g: GtCand;
      cls: string;
      code: string | null;
      cmp: ModelEvidenceResult;
      verdict: string;
      blockers: { blocker: string; detail: string }[];
      axes: string[];
      level: "low" | "very_high";
      market: string;
      price: number | null;
      cur: string | null;
      pstat: string | null;
      soldOut: boolean | null;
      /** scoped CF 로 품번 칸을 비웠을 때의 cross 결과(축 수가 줄어드는지 본다). */
      nullAxes: string[];
      nullVerdict: string;
      /** 🔴 품번 칸을 비우면 blockers 도 달라진다 — 같이 보관한다(1차에 빠뜨렸다). */
      nullBlockers: { blocker: string; detail: string }[];
    }
    const cands: Cand[] = [];
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
      const cmp = compareModelCode(ORIGIN_CODE, code);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const crossNull = compareCrossSellerProducts(originFacts, { ...facts, brandModelCode: null } as ProductFacts);

      const sharesPrefix = !!code && code.slice(0, 4).toUpperCase() === ORIGIN_CODE.slice(0, 4);
      const cls =
        code == null
          ? "CODE_ABSENT"
          : cmp === "exact"
            ? "EXACT_OFFICIAL_CODE"
            : sharesPrefix
              ? "🔴 DIFF_OFFICIAL_LOOKING"
              : "🔴 SELLER_SKU";

      /** 🔴 `price` 는 `{amount,currency}|null` 이다(CORE-2P 에서 틀렸던 칸). */
      const raw = cand as unknown as {
        price?: { amount: number; currency: string } | null;
        priceStatus?: string | null;
        soldOut?: boolean | null;
      };
      const mk = classifyCandidateMarket({
        domain: g.domain,
        currency: raw.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });

      cands.push({
        g,
        cls,
        code,
        cmp,
        verdict: cross.verdict,
        blockers: [...cross.blockers] as { blocker: string; detail: string }[],
        axes: cross.axes.map((a) => a.axis),
        level,
        market: String(mk.market),
        price: raw.price?.amount ?? null,
        cur: raw.price?.currency ?? null,
        pstat: raw.priceStatus ?? null,
        soldOut: raw.soldOut ?? null,
        nullAxes: crossNull.axes.map((a) => a.axis),
        nullVerdict: crossNull.verdict,
        nullBlockers: [...crossNull.blockers] as { blocker: string; detail: string }[],
      });
    }
    expect(cands.length).toBeGreaterThan(0);

    /* ═══ 1. 품번 conflict 후보 특정 ════════════════════════════════ */
    const targets = cands.filter((c) => c.cls.includes("DIFF_OFFICIAL_LOOKING"));
    console.log("\n═══ 1. 범위 — 품번 conflict 가 있는 후보만 ═══");
    for (const c of cands) {
      console.log(
        `    ${c.g.domain.padEnd(22)} ${c.g.calibrationLabel.padEnd(10)} ${c.cls.padEnd(24)} ` +
          `code=${String(c.code).padEnd(12)} cmp=${c.cmp.padEnd(11)} verdict=${c.verdict}` +
          (c.cls.includes("DIFF_OFFICIAL_LOOKING") ? "   ★ 대상" : ""),
      );
    }
    console.log(`    ⟹ 대상 **${targets.length}** · 비대상 **${cands.length - targets.length}**(손대지 않는다)`);

    /* ═══ 2. 🔴🔴 축 수 — 왜 PRESUMED_SAME 에 머무는가 ════════════ */
    console.log("\n═══ 2. 축 구성 — `SAME_MIN_AXES` 는 5 다(운영 불변) ═══");
    for (const c of targets) {
      console.log(`    ${c.g.domain}`);
      console.log(`      현재(품번 유지)  axes ${JSON.stringify(c.axes)}(**${c.axes.length}**) · verdict **${c.verdict}** · blockers ${JSON.stringify(c.blockers.map((b) => b.blocker))}`);
      console.log(`      품번 칸 비움      axes ${JSON.stringify(c.nullAxes)}(**${c.nullAxes.length}**) · verdict **${c.nullVerdict}**`);
    }
    /**
     * 🔴🔴 **1차에 적은 「딜레마」가 데이터로 반증됐다** — 「비우면 축이 줄어든다」고
     *    썼는데 실제로는 **0 → 6 으로 늘어난다**. `conflict` 가 축 계산 자체를 막고 있었다.
     * 🔴 그래도 verdict 는 `SAME` 이 아니라 `PRESUMED_SAME` 이다 ⟹ 축만으로는 부족하고
     *    등급 규칙의 다른 조건이 남는다. 🔴 그 조건을 **추측하지 않는다**(아래 행렬이 답한다).
     */
    console.log("    🔴 **1차 가설(「비우면 축이 줄어든다」)은 반증됐다** — 축이 **0 → 6** 으로 늘어난다.");
    console.log("       🟢 `conflict` 가 축 계산 자체를 막고 있었다. 🔴 그래도 verdict 는 `PRESUMED_SAME` 이다.");

    /* ═══ 3. 조합 행렬 — 입력만 ════════════════════════════════════ */
    /**
     * 🔴 `partial` / `exact` 를 **코드를 지어내서** 만들지 않는다 —
     *    `deriveMatchTruth` 의 `modelCode` **인자에 그 값을 직접** 넘긴다.
     *    🟢 그래야 「품번을 긍정 증거로 취급하면」이라는 가정만 바뀐다(다른 칸 불변).
     * 🔴 그리고 그것은 **「품번 가중치 변경」이 어떤 효과를 내는가의 측정** 이지
     *    그 변경을 제안하는 것이 아니다(CPO 금지 유지).
     */
    interface Combo {
      id: string;
      desc: string;
      code: ModelEvidenceResult;
      reserve: boolean;
      dropTitle: boolean;
    }
    const combos: Combo[] = [
      { id: "C0", desc: "현재(운영)", code: "conflict", reserve: true, dropTitle: false },
      { id: "C1", desc: "scoped: 품번 칸 비움", code: "unavailable", reserve: true, dropTitle: false },
      { id: "C2", desc: "C1 + crossSellerReserved 제거(M4)", code: "unavailable", reserve: false, dropTitle: false },
      { id: "C3", desc: "C1 + M4 + NO_TITLE_OVERLAP 제거(M5)", code: "unavailable", reserve: false, dropTitle: true },
      { id: "C4", desc: "품번을 partial 로 취급", code: "partial", reserve: true, dropTitle: false },
      { id: "C5", desc: "C4 + M4", code: "partial", reserve: false, dropTitle: false },
      { id: "C6", desc: "C4 + M4 + M5", code: "partial", reserve: false, dropTitle: true },
      { id: "C7", desc: "품번을 exact 로 취급 + M4(상한 참조)", code: "exact", reserve: false, dropTitle: false },
    ];

    console.log("\n═══ 3. 조합 행렬 → matchTruth → displayTier → 가격축 ═══");
    const results = new Map<string, { truth: string; tier: string | null; elig: boolean }>();
    for (const c of targets) {
      console.log(`\n    ${c.g.domain} (CEO **${c.g.calibrationLabel}** · 가격 ${c.cur ?? "-"} ${c.price ?? "-"} · ${c.pstat})`);
      console.log("      조합  설명                                      matchTruth              displayTier     가격축");
      for (const k of combos) {
        /**
         * 🔴🔴 **1차 행렬이 틀렸다** — 「품번 칸을 비운」 조합(C1~C3)에서도
         *    **품번 유지 상태의 `verdict`/`blockers`** 를 그대로 넘겼다. 품번을 비우면
         *    cross-seller 가 **다시 계산** 되어 verdict 와 blockers 가 **둘 다 달라진다**
         *    (실측: `CONFLICT` → `PRESUMED_SAME`, 축 **0 → 6**) ⟹ C1~C3 숫자가 거짓이었다.
         * 🟢 그래서 그 조합에서는 **그때의 cross 결과** 를 쓴다.
         * 🟢 C5~C7 은 `reserve=false`(verdict 인자를 안 쓴다)라 영향이 없었다.
         */
        const nulled = k.code === "unavailable";
        const src = nulled ? { verdict: c.nullVerdict, blockers: c.nullBlockers } : { verdict: c.verdict, blockers: c.blockers };
        const bl = k.dropTitle ? src.blockers.filter((b) => b.blocker !== "NO_TITLE_OVERLAP") : src.blockers;
        const truth = String(
          deriveMatchTruth(c.level, k.code, k.reserve ? (src.verdict as never) : undefined, bl as never),
        );
        const row = toRow(c.g.url, c.g.domain, truth, c.verdict, c.market, c.price, c.cur, c.pstat, c.soldOut);
        const tier = transientDisplayTier(row);
        const elig = tier === "SAME";
        results.set(`${c.g.domain}|${k.id}`, { truth, tier, elig });
        console.log(
          `      ${k.id}    ${k.desc.padEnd(42)} ${truth.padEnd(23)} ${String(tier).padEnd(15)} ${elig ? "🟢 진입" : "X"}`,
        );
      }
    }

    /* ═══ 4. 가격 집계까지 — 진입한 조합만 ═════════════════════════ */
    console.log("\n═══ 4. 실제 가격 집계(buildMarketJudgement → buildPriceGuide) ═══");
    const baseRows = cands.map((c) =>
      toRow(
        c.g.url,
        c.g.domain,
        String(deriveMatchTruth(c.level, c.cmp, c.verdict as never, c.blockers as never)),
        c.verdict,
        c.market,
        c.price,
        c.cur,
        c.pstat,
        c.soldOut,
      ),
    );
    const jBase = buildMarketJudgement(baseRows);
    console.log(`    현재          sellers **${jBase.sellers.length}** · 🌎 priced ${buildPriceGuide(jBase, "OVERSEAS").pricedCount}`);

    let firstEligible: string | null = null;
    for (const k of combos) {
      /** 🔴 **대상 후보에만** 조합을 적용한다 — 나머지는 현재 값 그대로. */
      const rows = cands.map((c) => {
        const isTarget = c.cls.includes("DIFF_OFFICIAL_LOOKING");
        const nulled = isTarget && k.code === "unavailable";
        const src = nulled ? { verdict: c.nullVerdict, blockers: c.nullBlockers } : { verdict: c.verdict, blockers: c.blockers };
        const bl = isTarget && k.dropTitle ? src.blockers.filter((b) => b.blocker !== "NO_TITLE_OVERLAP") : src.blockers;
        const cmp = isTarget ? k.code : c.cmp;
        const reserve = isTarget ? k.reserve : true;
        const truth = String(
          deriveMatchTruth(c.level, cmp, reserve ? (src.verdict as never) : undefined, bl as never),
        );
        return toRow(c.g.url, c.g.domain, truth, src.verdict, c.market, c.price, c.cur, c.pstat, c.soldOut);
      });
      const j = buildMarketJudgement(rows);
      const os = buildPriceGuide(j, "OVERSEAS");
      const kr = buildPriceGuide(j, "KR");
      if (j.sellers.length > jBase.sellers.length && !firstEligible) firstEligible = k.id;
      console.log(
        `    ${k.id} ${k.desc.padEnd(40)} sellers **${j.sellers.length}** · ` +
          `🌎 same ${os.sameCount}/priced ${os.pricedCount} ${JSON.stringify(os.byCurrency.map((x: { currency: string; lowest: number }) => `${x.currency} ${x.lowest}`))} · 🇰🇷 ${kr.sameCount}`,
      );
    }

    /* ═══ 5. Safety — 전 GT 통과 ═══════════════════════════════════ */
    console.log("\n═══ 5. Safety(조합을 대상에만 적용 · 전 GT 10건) ═══");
    for (const k of combos) {
      let diffLeak = 0;
      let uncLeak = 0;
      let exactChanged = 0;
      for (const c of cands) {
        const isTarget = c.cls.includes("DIFF_OFFICIAL_LOOKING");
        const baseTruth = String(deriveMatchTruth(c.level, c.cmp, c.verdict as never, c.blockers as never));
        const nulled = isTarget && k.code === "unavailable";
        const src = nulled ? { verdict: c.nullVerdict, blockers: c.nullBlockers } : { verdict: c.verdict, blockers: c.blockers };
        const bl = isTarget && k.dropTitle ? src.blockers.filter((b) => b.blocker !== "NO_TITLE_OVERLAP") : src.blockers;
        const truth = String(
          deriveMatchTruth(c.level, isTarget ? k.code : c.cmp, isTarget && !k.reserve ? undefined : (src.verdict as never), bl as never),
        );
        const t0 = transientDisplayTier(toRow(c.g.url, c.g.domain, baseTruth, c.verdict, c.market, c.price, c.cur, c.pstat, c.soldOut));
        const t1 = transientDisplayTier(toRow(c.g.url, c.g.domain, truth, c.verdict, c.market, c.price, c.cur, c.pstat, c.soldOut));
        if (c.g.calibrationLabel === "DIFFERENT" && t1 === "SAME") diffLeak += 1;
        if (c.g.calibrationLabel === "UNCERTAIN" && t1 === "SAME") uncLeak += 1;
        if (c.cls === "EXACT_OFFICIAL_CODE" && t0 !== t1) exactChanged += 1;
      }
      console.log(
        `    ${k.id} ${k.desc.padEnd(40)} DIFFERENT 누출 **${diffLeak}** · UNCERTAIN 누출 **${uncLeak}** · exact 변화 **${exactChanged}**`,
      );
      expect(diffLeak, `🔴 ${k.id} 에서 parkette 가 SAME 이 되면 그 조합은 탈락이다`).toBe(0);
      expect(uncLeak, `🔴 ${k.id} 에서 bornyesterdaykids 가 SAME 이 되면 가격이 오염된다`).toBe(0);
      expect(exactChanged, `🔴 ${k.id} 가 exact-code 후보를 움직이면 범위를 벗어난다`).toBe(0);
    }

    /* ═══ 6. 결론 ═══════════════════════════════════════════════════ */
    console.log("\n═══ 6. 최소 조합 ═══");
    console.log(`    🔴 가격 축 판매처를 **늘리는 첫 조합** = **${firstEligible ?? "없음"}**`);
    const je = targets[0];
    if (je) {
      for (const k of combos) {
        const r = results.get(`${je.g.domain}|${k.id}`);
        if (r?.elig) console.log(`    🟢 ${k.id}(${k.desc}) → displayTier **SAME** · 가격축 진입`);
      }
      const eligible = combos.filter((k) => results.get(`${je.g.domain}|${k.id}`)?.elig);
      console.log(`    ⟹ 진입하는 조합 **${eligible.length} / ${combos.length}**`);
      console.log(
        `    🔴 그리고 ${je.g.domain} 의 가격은 **${je.cur} ${je.price}** 인데 status **${je.pstat}** 이라`,
      );
      const row = toRow(je.g.url, je.g.domain, "STRONG_IDENTIFIER", je.verdict, je.market, je.price, je.cur, je.pstat, je.soldOut);
      console.log(
        `       \`isPriceConfirmed\` = **${isPriceConfirmed(row)}** ⟹ ${isPriceConfirmed(row) ? "🟢 금액이 확정 가격으로 쓰인다" : "🔴 **등급을 올려도 「가격 확인 필요」로 남는다**(두 번째 관문)"}`,
      );
    }
    console.log("    🔴 운영 변경 결정은 하지 않는다 · 🔴 품번 가중치 변경을 제안하지 않는다");
  }, 900000);
});
