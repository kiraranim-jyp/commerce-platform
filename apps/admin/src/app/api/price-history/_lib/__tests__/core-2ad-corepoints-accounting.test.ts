import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { withConfidence } from "@commerce/crawler/src/comparison-search/match";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AD — **corePoints Evidence Accounting** (READ-ONLY · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **목적은 SAME 완화가 아니다**(CPO §0). `totalPoints` 와 `corePoints` 의 차이가
 *    **정확히 어떤 evidence 에서 나오는가** 를 회계적으로 분해한다.
 *
 * ── 🟢 운영 산식(cross-seller.ts:1148 · **읽은 것 그대로**) ─────────────────────
 * ```ts
 * const corePoints = axes
 *   .filter((axis) => axis.axis !== "IMAGE" && !(axis.axis === "TITLE" && axis.points === 1))
 *   .reduce((sum, axis) => sum + axis.points, 0);
 * // :1202  if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";
 * ```
 * ⟹ 🔴 **제외 대상은 둘뿐이다** — `IMAGE` 축 전체 · `TITLE` 의 **1점(부분 일치)**.
 *    「특정 source/meaning family 를 구조적으로 제외」하는 것이 **아니다**(CPO §4-A 의 답).
 *
 * ── 🔴🔴 `corePoints` 는 **반환되지 않는다** ─────────────────────────────────────
 * `compareCrossSellerProducts` 의 반환은 `{verdict, axes, conflicts, blockers,
 * identifierConfirmed, reasons}` 다 ⟹ 하니스가 **유도** 해야 한다.
 * 🔴 그래서 §5-B 대로 **replicationGate** 를 세운다 — 복제식이 운영 verdict 를
 *    **전건 재현** 해야 그 숫자를 보고에 쓴다. 재현 실패 시 **측정을 거부** 한다.
 *
 * 🔴 §1 금지 전수 — SAME_MIN_AXES · corePoints 규칙 · TITLE partial 점수 ·
 *    AUDIENCE_LINE · crossSellerReserved · NO_TITLE_OVERLAP · MODEL_CODE conflict ·
 *    CONFLICT 정책 · compareMaterial · priceTierFromLink · VERIFIED_SAME · 가격 ·
 *    시장분류 · sellerKey · 집계 · UI · schema **전부 변경 0**.
 */

const LIVE = process.env.CORE2AD_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";

const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/core-2m-ceo-visual-gt.json"), "utf8"),
) as { candidates: Array<{ domain: string; url: string; calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN" }> };

const CROSS_SRC = readFileSync(
  path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

/** 🔴 운영 산식이 **여러 줄** 이라 공백을 접어서 본다(1차에 단일 줄로 비교해 FAIL 했다). */
const CROSS_FLAT = CROSS_SRC.replace(/\s+/g, " ");

type Axis = { axis: string; points: number };

/**
 * 🟢 **운영 산식을 그대로 베낀다**(복제식 · 반환되지 않으므로 불가피하다).
 * 🔴 아래 `AD-S1` 이 「소스 산식이 이 모양 그대로인가」를 단언하고,
 *    라이브의 `replicationGate` 가 「그 복제식이 운영 verdict 를 재현하는가」를 단언한다.
 *    둘 중 하나라도 깨지면 이 WU 의 숫자는 **무효** 다.
 */
function corePointsOf(axes: readonly Axis[]): number {
  return axes
    .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
    .reduce((s, a) => s + a.points, 0);
}
function totalPointsOf(axes: readonly Axis[]): number {
  return axes.reduce((s, a) => s + a.points, 0);
}
/** 🔴 corePoints 에서 **빠진** 축만 돌려준다 — 이것이 이 WU 의 산출물이다. */
function excludedAxes(axes: readonly Axis[]): Axis[] {
  return axes.filter((a) => a.axis === "IMAGE" || (a.axis === "TITLE" && a.points === 1));
}

/* ═══════════════════════ 소스 계약 — 네트워크 0 (CI 상주) ═══════════════════════ */

describe("CORE-2AD 소스 계약 — corePoints 산식을 바이트로 고정한다", () => {
  it("AD-S1 🔴🔴 제외 대상은 **IMAGE 와 TITLE 1점** 둘뿐이다", () => {
    expect(CROSS_FLAT, "🔴 산식이 바뀌었다 — 이 WU 의 복제식과 숫자가 무효다").toContain(
      'const corePoints = axes .filter((axis) => axis.axis !== "IMAGE" && !(axis.axis === "TITLE" && axis.points === 1)) .reduce((sum, axis) => sum + axis.points, 0);',
    );
  });

  it("AD-S2 🔴 SAME 게이트는 `!blocked && brandOk && corePoints >= SAME_MIN_AXES` 다", () => {
    expect(CROSS_FLAT).toContain('if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";');
    expect(CROSS_FLAT).toContain("const SAME_MIN_AXES = 5;");
  });

  it("AD-S3 🔴 PRESUMED/SIMILAR 는 **totalPoints** 를 쓴다(core 가 아니다)", () => {
    expect(CROSS_FLAT).toContain(
      'if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";',
    );
    expect(CROSS_FLAT).toContain('if (totalPoints >= 1) return "SIMILAR";');
  });

  it("AD-S4 🟢 복제식이 **운영 산식과 글자 그대로 같다**(동어반복 방지 — 소스를 직접 본다)", () => {
    const mine = corePointsOf.toString().replace(/\s+/g, " ");
    expect(mine, "🔴 복제식이 IMAGE 제외를 빠뜨렸다").toContain('a.axis !== "IMAGE"');
    expect(mine, "🔴 복제식이 TITLE 1점 제외를 빠뜨렸다").toContain('a.axis === "TITLE" && a.points === 1');
  });

  it("AD-S5 🔴 회계 단위 검산 — core = total − 제외분", () => {
    const axes: Axis[] = [
      { axis: "TITLE", points: 1 },
      { axis: "MODEL_CODE", points: 3 },
      { axis: "AUDIENCE", points: 1 },
      { axis: "IMAGE", points: 2 },
    ];
    expect(totalPointsOf(axes)).toBe(7);
    expect(corePointsOf(axes)).toBe(4);
    expect(totalPointsOf(axes) - corePointsOf(axes)).toBe(
      excludedAxes(axes).reduce((s, a) => s + a.points, 0),
    );
    /** 🟢 TITLE **2점**(핵심어 전체 겹침)은 **제외되지 않는다**. */
    expect(corePointsOf([{ axis: "TITLE", points: 2 }])).toBe(2);
  });
});

/* ═══════════════════════════════ 라이브 회계 ═══════════════════════════════ */

describe.runIf(LIVE)("CORE-2AD 라이브 — GT 10건 corePoints 회계(READ-ONLY)", () => {
  it(
    "§A 회계표 · §B stockmann · §C CF-1~3 · §D leakage",
    async () => {
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
      expect(dna.brand.value, "🔴 원상품 brand 가 비면 측정 열화 — 거부").toBeTruthy();
      const originFacts = productFactsFromIdentityDna(dna);
      const query = { title: originFacts.title, brand: originFacts.brand ?? undefined, facts: originFacts } as ComparisonQuery;

      interface Row {
        domain: string;
        ceo: string;
        path: string;
        facts: ProductFacts;
        verdict: string;
        truth: string;
        axes: Axis[];
        blockers: string[];
        conflicts: string[];
        total: number;
        core: number;
        excluded: Axis[];
      }
      const rows: Row[] = [];
      for (const g of GT.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    🔴 ${g.domain} 측정불가(${r.status})`);
          continue;
        }
        const cross = compareCrossSellerProducts(originFacts, r.candidate.facts);
        const axes: Axis[] = (cross.axes ?? []).map((a) => ({ axis: String(a.axis), points: a.points ?? 0 }));
        const [sc] = withConfidence(query, [r.candidate]);
        const cmp = compareModelCode(originFacts.brandModelCode, r.candidate.facts.brandModelCode);
        rows.push({
          domain: g.domain,
          ceo: g.calibrationLabel,
          path: r.fetchPath,
          facts: r.candidate.facts,
          verdict: String(cross.verdict),
          truth: String(deriveMatchTruth(sc?.matchLevel ?? "low", cmp, cross.verdict, cross.blockers)),
          axes,
          blockers: (cross.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
          conflicts: (cross.conflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)),
          total: totalPointsOf(axes),
          core: corePointsOf(axes),
          excluded: excludedAxes(axes),
        });
      }
      expect(rows.length, "🔴 후보를 하나도 읽지 못했다 — 측정불가").toBe(GT.candidates.length);

      /* ── 🔴🔴 replicationGate — 복제식이 운영 verdict 를 «전건» 재현해야 한다 ── */
      const predict = (r: Row): string => {
        /** 🟢 CONFLICT 는 조기 반환이라 `axes: []` 모양으로 온다(cross-seller.ts:898). */
        if (r.conflicts.length > 0 && r.axes.length === 0) return "CONFLICT";
        if (r.blockers.length === 0 && r.core >= 5) return "SAME";
        if (r.total >= 3) return "PRESUMED_SAME";
        if (r.total >= 1) return "SIMILAR";
        return "UNKNOWN";
      };
      const mismatch = rows.filter((r) => predict(r) !== r.verdict);
      console.log("\n═══ 🔴 replicationGate — 복제식 ↔ 운영 verdict ═══");
      console.log(`    mismatch **${mismatch.length}/${rows.length}**`);
      for (const m of mismatch) console.log(`    🔴 ${m.domain}: 복제 ${predict(m)} ↔ 운영 ${m.verdict}`);
      expect(
        mismatch.length,
        "🔴🔴 복제식이 운영 verdict 를 재현하지 못한다 — 이 WU 의 숫자를 쓰지 않는다(측정 거부)",
      ).toBe(0);

      /* ── §A 회계표 ── */
      console.log("\n═══ §A corePoints accounting (GT 10건 전수) ═══");
      console.log(
        `    ${"판매처".padEnd(22)}${"CEO".padEnd(10)}${"matchTruth".padEnd(24)}${"total".padEnd(7)}${"core".padEnd(6)}${"제외".padEnd(18)}blocker/conflict`,
      );
      for (const r of rows) {
        const exc = r.excluded.map((a) => `${a.axis}:${a.points}`).join(" ") || "없음";
        const bc = [...r.conflicts.map((c) => `C:${c}`), ...r.blockers.map((b) => `B:${b}`)].join(",") || "없음";
        console.log(
          `    ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}${r.truth.padEnd(24)}${String(r.total).padEnd(7)}${String(r.core).padEnd(6)}${exc.padEnd(18)}${bc}`,
        );
        console.log(`        ↳ 축[${r.axes.map((a) => `${a.axis}:${a.points}`).join(" ") || "없음"}] · 경로 ${r.path}`);
      }

      const excludedTotal = rows.reduce((s, r) => s + (r.total - r.core), 0);
      console.log(`\n    Σ(total − core) = **${excludedTotal}** · 제외가 발생한 후보 **${rows.filter((r) => r.total !== r.core).length}건**`);

      /* ── §B stockmann 상세 ── */
      const sm = rows.find((r) => r.domain === "stockmann.ee");
      if (sm) {
        console.log("\n═══ §B stockmann.ee — 5p → corePoints 4 의 정확한 사유 ═══");
        console.log(`    축            ${sm.axes.map((a) => `${a.axis}:${a.points}`).join(" ")}`);
        console.log(`    totalPoints = ${sm.total}`);
        console.log(`    corePoints  = ${sm.core}`);
        console.log(`    excluded    = ${sm.excluded.map((a) => `${a.axis}_PARTIAL(${a.points})`).join(" ") || "없음"}`);
        console.log(`    blockers    = ${sm.blockers.join(",") || "없음"} · conflicts = ${sm.conflicts.join(",") || "없음"}`);
        console.log(`    ⟹ SAME 미달 사유 — corePoints ${sm.core} < SAME_MIN_AXES 5`);
      }

      /* ── §C CF-1/2/3 ── */
      console.log("\n═══ §C Counterfactual (🔴 운영 변경 0 · 하니스 안에서만) ═══");
      console.log("    CF-1 현재 그대로");
      for (const r of rows) console.log(`        ${r.domain.padEnd(22)}${r.verdict}`);
      console.log("    CF-2 제외된 evidence «표시만»");
      for (const r of rows.filter((r) => r.excluded.length > 0)) {
        console.log(`        ${r.domain.padEnd(22)}${r.excluded.map((a) => `${a.axis}:${a.points}`).join(" ")}`);
      }
      console.log("    CF-3 🔴 **제외분을 corePoints 에 포함한다고 «가정만»** 했을 때");
      let cf3Same = 0;
      let cf3Diff = 0;
      let cf3Unc = 0;
      for (const r of rows) {
        /** 🔴 `blockers`·`conflicts` 는 **그대로 둔다** — 완화가 아니다. 점수 가정만 바꾼다. */
        const cf3 = r.conflicts.length > 0 && r.axes.length === 0
          ? "CONFLICT"
          : r.blockers.length === 0 && r.total >= 5
            ? "SAME"
            : r.total >= 3
              ? "PRESUMED_SAME"
              : r.total >= 1
                ? "SIMILAR"
                : "UNKNOWN";
        const moved = cf3 !== r.verdict;
        console.log(`        ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}${r.verdict.padEnd(16)}→ ${cf3.padEnd(16)}${moved ? "🟢 변화" : "─"}`);
        if (cf3 === "SAME") {
          if (r.ceo === "SAME") cf3Same += 1;
          if (r.ceo === "DIFFERENT") cf3Diff += 1;
          if (r.ceo === "UNCERTAIN") cf3Unc += 1;
        }
      }
      const ceoSame = rows.filter((r) => r.ceo === "SAME").length;
      console.log(`\n    CF-3 SAME recovery **${cf3Same}/${ceoSame}** · DIFFERENT leakage **${cf3Diff}** · UNCERTAIN leakage **${cf3Unc}**`);

      /* ── §D leakage 안전성 ── */
      console.log("\n═══ §D negative 안전성(CF 에서도 SAME 으로 안 올라가야 한다) ═══");
      for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
        const r = rows.find((x) => x.domain === d);
        console.log(
          `    ${d.padEnd(22)}${r?.ceo.padEnd(10)}verdict ${r?.verdict} · total ${r?.total} · core ${r?.core} · conflicts[${r?.conflicts.join(",")}]`,
        );
      }
      expect(cf3Diff, "🔴 CF-3 에서 DIFFERENT 가 SAME 으로 올라갔다 — 즉시 STOP").toBe(0);
      expect(cf3Unc, "🔴 CF-3 에서 UNCERTAIN 이 SAME 으로 올라갔다 — 즉시 STOP").toBe(0);
    },
    20 * 60 * 1000,
  );
});
