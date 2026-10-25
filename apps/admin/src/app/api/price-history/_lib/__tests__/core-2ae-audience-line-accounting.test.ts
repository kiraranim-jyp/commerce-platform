import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna, resolveAudienceLine } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AE — **AUDIENCE_LINE Evidence Accounting** (READ-ONLY · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **blocker 를 제거·완화하지 않는다**(CPO §1 · WU-143 이 되돌린 그 자리 · false SAME 13건).
 *    목적은 하나다 — 「**실제 의미 충돌인가 · parser/normalization artifact 인가**」.
 *
 * ── 🟢 운영 발화 경로(코드에서 읽은 것) ────────────────────────────────────────
 * ```ts
 * // cross-seller.ts:385  compareAudienceLine
 * const signalsOf = (f) => [...f.audienceSignals, ...(f.categoryText?[f.categoryText]:[]),
 *                           ...(f.ageRangeText?[f.ageRangeText]:[]), f.title];
 * left = resolveAudienceLine(signalsOf(x)); right = resolveAudienceLine(signalsOf(y));
 * if (!left || !right) → unknown        // 🔴 한쪽이라도 모르면 아무것도 안 한다
 * left === right ? match : **mismatch** // → blocker AUDIENCE_LINE (:1056)
 *
 * // shared/product-facts.ts:619  resolveAudienceLine  — 🔴🔴 **first-match-wins**
 * const tokens = new Set(signals.flatMap(tokenizeFactText));
 * BABY_LINE_TOKENS   → "BABY"     ["baby","babies","newborn","베이비"]
 * JUNIOR_LINE_TOKENS → "JUNIOR"   ["junior","주니어"]
 * CHILD_LINE_TOKENS  → "CHILD"    ["kid","kids","child","children","childrens","아동","키즈"]
 * ```
 * 🔴🔴 **구조적 성질** — 입력이 **모든 신호를 합친 하나의 Set** 이고 우선순위가
 *    **BABY > JUNIOR > CHILD** 다. ⟹ 한 페이지가 「baby」와 「kids」를 **같이** 적으면
 *    (편집샵 태그/컬렉션에서 흔하다) **무조건 `BABY`** 가 된다.
 *    ⟹ 원상품이 `CHILD` 면 **mismatch** 가 되고 그것은 **상품의 사실이 아니라 진열의 사실** 이다.
 * 🔴 이 성질을 「artifact 다」로 **단정하지 않는다** — 아래가 실제로 그 모양인지 측정한다.
 *
 * ── 🟢 복제 범위를 최소로 한다 ─────────────────────────────────────────────────
 * `resolveAudienceLine` 은 **운영 함수를 그대로 부른다**(export 돼 있다).
 * 🔴 복제하는 것은 `signalsOf`(지역 함수 · 네 줄 concat) 하나이고,
 *    `replicationGate` 가 「복제 결과가 운영 blocker 유무를 전건 재현」하는지 단언한다.
 * 🟢 **발화 토큰을 찾는 방법도 복제가 아니다** — 신호를 **하나씩** `resolveAudienceLine([s])`
 *    에 넣어 어느 문자열이 어느 라인을 만드는지 본다(토큰 집합을 베끼지 않는다).
 */

const LIVE = process.env.CORE2AE_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";

const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/core-2m-ceo-visual-gt.json"), "utf8"),
) as { candidates: Array<{ domain: string; url: string; calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN" }> };

const CROSS_FLAT = readFileSync(
  path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .replace(/\s+/g, " ");

const FACTS_FLAT = readFileSync(
  path.join(__dirname, "../../../../../../../../packages/shared/src/product-facts.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .replace(/\s+/g, " ");

/** 🔴 운영 `signalsOf`(cross-seller.ts:385) 의 **복제** — 지역 함수라 부를 수 없다. */
function signalsOf(f: ProductFacts): string[] {
  return [
    ...f.audienceSignals,
    ...(f.categoryText ? [f.categoryText] : []),
    ...(f.ageRangeText ? [f.ageRangeText] : []),
    f.title,
  ];
}

/* ═══════════════════════ 소스 계약 — 네트워크 0 (CI 상주) ═══════════════════════ */

describe("CORE-2AE 소스 계약 — AUDIENCE_LINE 발화 경로를 바이트로 고정한다", () => {
  it("AE-S1 🔴 `compareAudienceLine` 의 신호 묶음이 **네 칸** 이다(복제식 전제)", () => {
    expect(CROSS_FLAT).toContain(
      "const signalsOf = (facts: ProductFacts): string[] => [ ...facts.audienceSignals, ...(facts.categoryText ? [facts.categoryText] : []), ...(facts.ageRangeText ? [facts.ageRangeText] : []), facts.title, ];",
    );
    /** 🔴 한쪽이라도 null 이면 아무것도 하지 않는다 — 그 성질이 사라지면 분모가 바뀐다. */
    expect(CROSS_FLAT).toContain('if (!left || !right) return { outcome: "unknown", values: [left, right] };');
  });

  it("AE-S2 🔴🔴 `resolveAudienceLine` 은 **BABY > JUNIOR > CHILD first-match-wins** 다", () => {
    expect(FACTS_FLAT).toContain(
      'const tokens = new Set(signals.flatMap((s) => tokenizeFactText(s))); for (const token of tokens) if (BABY_LINE_TOKENS.has(token)) return "BABY"; for (const token of tokens) if (JUNIOR_LINE_TOKENS.has(token)) return "JUNIOR"; for (const token of tokens) if (CHILD_LINE_TOKENS.has(token)) return "CHILD"; return null;',
    );
  });

  it("AE-S3 🔴 `mismatch` 가 `AUDIENCE_LINE` blocker 를 만든다", () => {
    expect(CROSS_FLAT).toContain('if (audienceLine.outcome === "mismatch") {');
    expect(CROSS_FLAT).toContain('blocker: "AUDIENCE_LINE",');
  });

  it("AE-S4 🔴🔴 WU-143 방어가 **살아 있다** — AUDIENCE_LINE 이 blocker 목록에 있다", () => {
    /** 🔴 과거 그 blocker 를 빼니 false SAME **13건** 이 났다(그 파일 주석). 유지 확인. */
    expect(CROSS_FLAT).toContain('"AUDIENCE_LINE",');
    expect(CROSS_FLAT).toContain("const SAME_MIN_AXES = 5;");
  });

  it("AE-S5 🟢🟢 **구조적 성질을 운영 함수로 직접 재현한다** — 같이 적으면 BABY 가 이긴다", () => {
    /**
     * 🔴 이것이 이 WU 의 핵심 가설이고, **운영 함수를 그대로 불러** 확인한다(복제 0).
     *    한 페이지가 두 라인을 같이 적으면 **상품의 사실이 아니라 진열의 사실** 이 이긴다.
     */
    expect(resolveAudienceLine(["Kids T-shirts"])).toBe("CHILD");
    expect(resolveAudienceLine(["Baby"])).toBe("BABY");
    expect(
      resolveAudienceLine(["Kids T-shirts", "Baby"]),
      "🔴 순서 의존이 사라졌다 — 이 WU 의 가설 전제가 바뀌었다",
    ).toBe("BABY");
    /** 🟢 그리고 「모름」은 보류를 만들지 않는다. */
    expect(resolveAudienceLine(["Organic cotton t-shirt"])).toBeNull();
  });
});

/* ═══════════════════════════════ 라이브 회계 ═══════════════════════════════ */

describe.runIf(LIVE)("CORE-2AE 라이브 — AUDIENCE_LINE 발화 근거 전수(READ-ONLY)", () => {
  it(
    "§A kids21 · §B cissywears · §C CF · §D negative",
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

      /* ── 원상품 audience evidence ── */
      const oSignals = signalsOf(originFacts);
      const oLine = resolveAudienceLine(oSignals);
      console.log("\n════════ CORE-2AE — AUDIENCE_LINE Evidence Accounting ════════");
      console.log("🔴 운영 변경 0 · blocker 제거 0 · 완화 0\n");
      console.log("═══ 원상품(bobochoses.com) audience evidence ═══");
      console.log(`    resolved = **${oLine}**`);
      for (const s of oSignals) {
        const per = resolveAudienceLine([s]);
        console.log(`      ${per ? `→ ${per}` : "→ (모름)"}   src="${s}"`);
      }

      interface Row {
        domain: string;
        ceo: string;
        line: string | null;
        signals: string[];
        perSignal: Array<{ s: string; line: string | null }>;
        blockers: string[];
        conflicts: string[];
        axesTotal: number;
        verdict: string;
      }
      const rows: Row[] = [];
      for (const g of GT.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    🔴 ${g.domain} 측정불가(${r.status})`);
          continue;
        }
        const f = r.candidate.facts;
        const cross = compareCrossSellerProducts(originFacts, f);
        const sig = signalsOf(f);
        rows.push({
          domain: g.domain,
          ceo: g.calibrationLabel,
          line: resolveAudienceLine(sig),
          signals: sig,
          perSignal: sig.map((s) => ({ s, line: resolveAudienceLine([s]) })),
          blockers: (cross.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
          conflicts: (cross.conflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)),
          axesTotal: (cross.axes ?? []).reduce((s, a) => s + (a.points ?? 0), 0),
          verdict: String(cross.verdict),
        });
      }
      expect(rows.length, "🔴 후보를 하나도 읽지 못했다 — 측정불가").toBe(GT.candidates.length);

      /* ── 🔴🔴 replicationGate — 복제 signalsOf 가 운영 blocker 유무를 재현하는가 ── */
      /**
       * 🔴🔴 **1차 게이트가 3건을 거부했고 그것이 맞았다** — `conflicts` 가 있으면
       *    `compareCrossSellerProducts` 가 **조기 반환** 한다(`verdict:"CONFLICT", axes: []`
       *    · cross-seller.ts:898) ⟹ `compareAudienceLine`(:1053) 에 **도달하지 않는다**.
       *    그래서 「라인이 다른데 blocker 가 없다」가 정상이다.
       * 🟢 복제식에 그 성질을 넣는다. 🔴 그리고 그 사실 자체가 발견이다 —
       *    **conflict 뒤에 숨은 AUDIENCE_LINE 후보가 더 있다**(아래 §C-1 출력).
       */
      const predictAudienceBlocked = (r: Row): boolean =>
        r.conflicts.length === 0 && Boolean(oLine && r.line && oLine !== r.line);
      const mismatch = rows.filter((r) => predictAudienceBlocked(r) !== r.blockers.includes("AUDIENCE_LINE"));
      console.log("\n═══ 🔴 replicationGate — 복제 signalsOf ↔ 운영 blocker ═══");
      console.log(`    mismatch **${mismatch.length}/${rows.length}**`);
      for (const m of mismatch) {
        console.log(`    🔴 ${m.domain}: 복제 ${oLine}↔${m.line} · 운영 blockers[${m.blockers.join(",")}]`);
      }
      expect(mismatch.length, "🔴🔴 복제식이 운영을 재현하지 못한다 — 숫자를 쓰지 않는다(측정 거부)").toBe(0);

      /* ── §A·§B 대상 둘 상세 ── */
      for (const target of ["kids21.com", "cissywears.com"]) {
        const r = rows.find((x) => x.domain === target);
        if (!r) continue;
        console.log(`\n═══ ${target} — AUDIENCE_LINE 발화 근거 ═══`);
        console.log(`    CEO GT        ${r.ceo}`);
        console.log(`    original      resolved=**${oLine}**`);
        console.log(`    candidate     resolved=**${r.line}**`);
        console.log(`    compareAudienceLine  ${oLine} ↔ ${r.line} ⟹ ${oLine === r.line ? "match" : "**mismatch**"}`);
        console.log(`    blocker       ${r.blockers.join(",") || "없음"}`);
        console.log("    candidate 신호 전수(어느 문자열이 어느 라인을 만드는가):");
        for (const p of r.perSignal) {
          console.log(`      ${p.line ? `→ ${p.line}` : "→ (모름)"}   raw="${p.s}"`);
        }
        /** 🔴 핵심 — 후보 쪽에 **두 라인이 같이** 있는가(그러면 순서가 결과를 정한다). */
        const lines = new Set(r.perSignal.map((p) => p.line).filter(Boolean));
        console.log(`    🔴 후보가 말한 라인 집합 = {${[...lines].join(", ")}}  (크기 ${lines.size})`);
        if (lines.size > 1) {
          console.log("        ⟹ 🔴🔴 **두 라인이 같이 있다** — 결과는 BABY>JUNIOR>CHILD 순서가 정했다");
        }
      }

      /* ── §C CF ── */
      console.log("\n═══ §C Counterfactual (🔴 운영 변경 0 · 가정만) ═══");
      console.log("    CF-1 현재 운영 결과 (🔴 `숨음` = conflict 조기반환으로 AUDIENCE 축에 도달조차 안 했다)");
      for (const r of rows) {
        const hidden = r.conflicts.length > 0 && oLine && r.line && oLine !== r.line ? "  🔴 숨음" : "";
        console.log(
          `        ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}line=${String(r.line).padEnd(7)}${r.verdict.padEnd(16)}blockers[${r.blockers.join(",") || "없음"}]${hidden}`,
        );
      }
      const hiddenCount = rows.filter(
        (r) => r.conflicts.length > 0 && oLine && r.line && oLine !== r.line,
      ).length;
      console.log(
        `    🔴 라인이 원상품과 다른 후보 **${rows.filter((r) => r.line && oLine && r.line !== oLine).length}건** · 그중 conflict 에 가려진 것 **${hiddenCount}건**`,
      );
      console.log("    CF-2 raw → resolved 는 위 §A/§B 전수 출력이 전부다(정규화 전/후)");
      console.log(
        "    CF-3 🔴 **「한쪽이 두 라인을 같이 말하면 그 쪽을 «모름» 으로 둔다」** 고 가정했을 때",
      );
      let cf3Same = 0;
      let cf3Diff = 0;
      let cf3Unc = 0;
      const oLines = new Set(oSignals.map((s) => resolveAudienceLine([s])).filter(Boolean));
      const oAmbiguous = oLines.size > 1;
      for (const r of rows) {
        const cLines = new Set(r.perSignal.map((p) => p.line).filter(Boolean));
        const cAmbiguous = cLines.size > 1;
        /** 🟢 모호하면 null 로 둔다 ⟹ `!left || !right` 로 **보류가 사라진다**(운영 규칙 그대로). */
        const cfLeft = oAmbiguous ? null : oLine;
        const cfRight = cAmbiguous ? null : r.line;
        const cfAudienceBlocked = Boolean(cfLeft && cfRight && cfLeft !== cfRight);
        const cfBlockers = r.blockers.filter((b) => b !== "AUDIENCE_LINE").concat(cfAudienceBlocked ? ["AUDIENCE_LINE"] : []);
        /** 🔴 점수·다른 blocker·conflict 는 **그대로** 다 — AUDIENCE 축만 가정한다. */
        const cf = r.conflicts.length > 0
          ? "CONFLICT"
          : cfBlockers.length === 0 && r.axesTotal >= 5
            ? "SAME"
            : r.axesTotal >= 3
              ? "PRESUMED_SAME"
              : r.axesTotal >= 1
                ? "SIMILAR"
                : "UNKNOWN";
        const moved = cf !== r.verdict;
        console.log(
          `        ${r.domain.padEnd(22)}${r.ceo.padEnd(10)}${r.verdict.padEnd(16)}→ ${cf.padEnd(16)}${moved ? "🟢 변화" : "─"}  (후보 라인 ${cLines.size}개)`,
        );
        if (cf === "SAME") {
          if (r.ceo === "SAME") cf3Same += 1;
          if (r.ceo === "DIFFERENT") cf3Diff += 1;
          if (r.ceo === "UNCERTAIN") cf3Unc += 1;
        }
      }
      const ceoSame = rows.filter((r) => r.ceo === "SAME").length;
      console.log(
        `\n    CF-3 SAME recovery **${cf3Same}/${ceoSame}** · DIFFERENT leakage **${cf3Diff}** · UNCERTAIN leakage **${cf3Unc}**`,
      );
      console.log(`    🔴 원상품이 모호한가 = ${oAmbiguous ? "**예**" : "아니오"} (라인 ${oLines.size}개)`);

      /* ── §D negative ── */
      console.log("\n═══ §D negative control — 기존 보호가 흔들리지 않는다 ═══");
      for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
        const r = rows.find((x) => x.domain === d);
        console.log(
          `    ${d.padEnd(22)}${r?.ceo.padEnd(10)}${r?.verdict} · conflicts[${r?.conflicts.join(",")}] · total ${r?.axesTotal}`,
        );
      }
      expect(cf3Diff, "🔴 CF-3 에서 DIFFERENT 가 SAME 으로 올라갔다 — 즉시 STOP").toBe(0);
      expect(cf3Unc, "🔴 CF-3 에서 UNCERTAIN 이 SAME 으로 올라갔다 — 즉시 STOP").toBe(0);
    },
    20 * 60 * 1000,
  );
});
