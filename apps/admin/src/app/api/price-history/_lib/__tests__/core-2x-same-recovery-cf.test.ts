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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2X — **CEO 가 동일하다고 한 상품이 왜 SAME 이 안 되는가**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 순서를 고정했다 — **SAME 이 가격의 «선행 조건»** 이다. 그래서 이번에는
 *    가격 UI 를 손대지 않고 **MI 가 실제 동일상품을 SAME 으로 확정하는지** 만 잰다.
 *
 * ── 🔴 이 하니스가 «하지 않는» 것 (CPO §1 금지 전수) ───────────────────────────────
 * ```
 * ❌ crossSellerReserved 완화   ❌ SAME threshold 하향   ❌ 8축 threshold 변경
 * ❌ title-only relaxation      ❌ product-code-only SAME ❌ seller SKU 승격
 * ❌ 가격 수집/집계/환산          ❌ 원가·마진·추천가        ❌ DB/schema/API
 * 🟢 **운영 코드 0 줄.** 반사실은 **입력(ProductFacts)만** 바꾼다(WU-134/164 방식).
 * ```
 *
 * ── 🔴🔴 C3/C6 은 «측정불가» 다. 0 으로 적지 않는다 ────────────────────────────────
 * ```
 * CPO 의 C3(Description)·C4 의 Pattern/Detail·C6(Additional detail)은
 * `ProductFacts` 에 **담는 칸이 없다**(14칸 전수: urlSlug · brand · brandModelCode ·
 * sellerSku · title · coreTitleTokens · categoryText · colorText · materialText ·
 * fitText · ageRangeText · sizeLabels · audienceSignals · imageUrls).
 * ⟹ 🔴 그 축은 **「측정불가」** 이고 CORE-2M 이 화면에 적어 둔 그 사실과 같다.
 * 🟢 그래서 사다리를 **칸이 있는 축으로만** 세운다(없는 값을 지어내지 않는다).
 * ```
 */

const LIVE = process.env.CORE2X_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  ceoBasis: string;
  ceoUiLabel: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
}

/**
 * 🔴 **사다리의 각 칸은 「그 축만 남긴다」** 는 뜻이다 — 나머지는 `null`/빈 배열로 둔다.
 *    🟢 그래야 「어느 증거 집합이 SAME 에 충분한가」를 **단조 증가** 로 읽을 수 있다.
 * 🔴 `urlSlug`·`sellerSku` 는 사다리에서 **빼지 않는다** — 그 둘은 CPO 의 증거 목록에
 *    없고(판매처 자체 값이다) 건드리면 기존 가드(`wu-095`·CORE-2K)를 흔든다.
 */
const LADDER = [
  { id: "C1", label: "브랜드+상품명+유형", keys: ["brand", "title", "coreTitleTokens", "categoryText"] },
  { id: "C2", label: "C1+품번", keys: ["brand", "title", "coreTitleTokens", "categoryText", "brandModelCode"] },
  {
    id: "C4",
    label: "C2+색상/소재/핏/대상/사이즈",
    keys: [
      "brand",
      "title",
      "coreTitleTokens",
      "categoryText",
      "brandModelCode",
      "colorText",
      "materialText",
      "fitText",
      "ageRangeText",
      "sizeLabels",
      "audienceSignals",
    ],
  },
  {
    id: "C5",
    label: "C4+대표이미지",
    keys: [
      "brand",
      "title",
      "coreTitleTokens",
      "categoryText",
      "brandModelCode",
      "colorText",
      "materialText",
      "fitText",
      "ageRangeText",
      "sizeLabels",
      "audienceSignals",
      "imageUrls",
    ],
  },
] as const;

/** 🟢 그 축만 남긴 facts. 🔴 **값을 만들어 넣지 않는다** — 있는 것만 통과시킨다. */
function restrict(facts: ProductFacts, keys: readonly string[]): ProductFacts {
  const out = { ...facts } as unknown as Record<string, unknown>;
  const keep = new Set<string>([...keys, "urlSlug", "sellerSku"]);
  for (const k of Object.keys(out)) {
    if (keep.has(k)) continue;
    out[k] = Array.isArray(out[k]) ? [] : null;
  }
  return out as unknown as ProductFacts;
}

describe("CORE-2X — CEO SAME 복구 반사실(운영 변경 0)", () => {
  it.skipIf(!LIVE)("C0~C5 사다리 · SAME recovery / leakage", async () => {
    console.log("\n════════ 🔴 CORE-2X — SAME 판정 복구 반사실 ════════");
    console.log("🔴 운영 코드 변경 0 · 반사실은 **입력만** 바꾼다(WU-134/164 방식)");

    /* ── 원상품(브랜드 복구 포함 · CORE-2M-VR 와 같은 순서) ── */
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
    expect(dna.brandModelCode).toBe(ORIGIN_CODE);
    console.log(`① 원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode}`);

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

    interface Row {
      domain: string;
      ceo: string;
      /** 🔴 사다리 칸별 최종 등급 — `verdict / matchTruth`. */
      cells: Record<string, string>;
      blockers: string;
      conflicts: string;
      code: string;
    }
    const rows: Row[] = [];
    let unreachable = 0;

    for (const g of gt.candidates) {
      const f = await factsFromProductUrl(g.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        rows.push({ domain: g.domain, ceo: g.calibrationLabel, cells: {}, blockers: `🔴 ${f.status}`, conflicts: "-", code: "-" });
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const full = scored?.facts ?? f.candidate.facts;
      const level = scored?.matchLevel ?? "low";

      const cells: Record<string, string> = {};
      /** C0 — **운영 그대로.** 🔴 이 값이 기준선이고 아래 칸들과 섞지 않는다. */
      const cmp0 = compareModelCode(ORIGIN_CODE, full.brandModelCode ?? null);
      const cross0 = compareCrossSellerProducts(originFacts, full);
      const truth0 = String(deriveMatchTruth(level, cmp0, cross0.verdict, cross0.blockers));
      cells.C0 = `${cross0.verdict}/${truth0}`;

      for (const step of LADDER) {
        const restricted = restrict(full, step.keys);
        const cmp = compareModelCode(ORIGIN_CODE, restricted.brandModelCode ?? null);
        const cross = compareCrossSellerProducts(originFacts, restricted);
        const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
        cells[step.id] = `${cross.verdict}/${truth}`;
      }

      rows.push({
        domain: g.domain,
        ceo: g.calibrationLabel,
        cells,
        blockers: (cross0.blockers ?? []).map((b) => (b as { blocker: string }).blocker).join(",") || "-",
        conflicts: Object.keys(cross0.conflicts ?? {}).join(",") || "-",
        code: cmp0,
      });
    }

    /* ── 표 ── */
    const ids = ["C0", ...LADDER.map((s) => s.id)];
    console.log("\n═══ 사다리 (verdict/matchTruth) ═══");
    console.log(`    ${"판매처".padEnd(22)}${"CEO".padEnd(11)}${ids.map((i) => i.padEnd(30)).join("")}`);
    for (const r of rows) {
      console.log(
        `    ${r.domain.padEnd(22)}${r.ceo.padEnd(11)}${ids.map((i) => (r.cells[i] ?? "-").padEnd(30)).join("")}`,
      );
    }
    console.log("\n═══ C0 차단 사유(운영) ═══");
    for (const r of rows) {
      console.log(`    ${r.domain.padEnd(22)} code=${String(r.code).padEnd(12)} blockers=${r.blockers} conflicts=${r.conflicts}`);
    }

    /* ── 🔴 안전 KPI — 칸마다 센다 ── */
    const isSame = (cell?: string) =>
      !!cell && cell.startsWith("SAME/") && /EXACT_IDENTIFIER|STRONG_IDENTIFIER/.test(cell);
    console.log("\n═══ 🔴 안전 KPI ═══");
    console.log(`    ${"칸".padEnd(6)}${"SAME recovery".padEnd(18)}${"DIFFERENT leak".padEnd(18)}UNCERTAIN leak`);
    const kpi: Record<string, { rec: number; diff: number; unc: number }> = {};
    for (const i of ids) {
      const rec = rows.filter((r) => r.ceo === "SAME" && isSame(r.cells[i])).length;
      const diff = rows.filter((r) => r.ceo === "DIFFERENT" && isSame(r.cells[i])).length;
      const unc = rows.filter((r) => r.ceo === "UNCERTAIN" && isSame(r.cells[i])).length;
      kpi[i] = { rec, diff, unc };
      console.log(`    ${i.padEnd(6)}${`${rec} / ${rows.filter((r) => r.ceo === "SAME").length}`.padEnd(18)}${String(diff).padEnd(18)}${unc}`);
    }

    console.log("\n═══ 🔴 측정불가 ═══");
    console.log(`    fetch 실패 **${unreachable}건**`);
    console.log(
      "    🔴 C3(상세설명) · Pattern/Detail · C6(추가 디테일)은 **ProductFacts 에 칸이 없다** ⟹ **측정불가**",
    );
    console.log("    🔴 0% 로 적지 않는다 — 분모가 없다(CORE-2M 이 화면에 적어 둔 그 사실).");

    /**
     * 🔴🔴 **이 하니스는 「완화해도 되는가」를 묻지 않는다** — 「**있는 증거로 SAME 이
     *    되는가**」를 묻는다. 그래서 단언은 **안전 축** 에만 건다.
     * 🔴 DIFFERENT/UNCERTAIN 이 어느 칸에서든 SAME 으로 올라가면 **즉시 FAIL** 이다
     *    (CPO §6 의 negative control — parkette · bornyesterdaykids).
     */
    for (const i of ids) {
      expect(kpi[i].diff, `🔴🔴 ${i}: CEO DIFFERENT 가 SAME 으로 올라갔다(negative control 붕괴)`).toBe(0);
      expect(kpi[i].unc, `🔴🔴 ${i}: CEO UNCERTAIN 이 SAME 으로 올라갔다`).toBe(0);
    }
    /** 🟢 원상품 증거가 살아 있었다는 것(측정 유효성)만 단언한다. */
    expect(rows.length).toBe(gt.candidates.length);
  }, 900_000);
});
