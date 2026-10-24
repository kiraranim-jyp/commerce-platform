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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2M-VR — **CEO Visual Truth Calibration**(측정 전용 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「**CEO 육안 판정을 기준 truth 로 확정** 하고 MI 를 그에 맞춰
 * 재설계한다」 · 「이번 10개는 먼저 **정답 데이터로 고정** 한다」 ·
 * 「`CONFLICT` 제거 ❌ · 품번 가중치 ❌ · threshold ❌ · CATEGORY ❌ · 브랜드 로직 ❌ ·
 *  본문 탐색 ❌ · 정규화 ❌ — **아무것도 수정하지 않는다**」.
 *
 * 🔴 운영 코드 변경 **0**. 이 파일은 **GT 등록 + GAP 측정** 이다.
 *
 * ── 🔴🔴 먼저 — 기존 GT 와 «상충» 이 둘 있다. 조용히 덮지 않는다 ──────────
 * ```
 * m.luxboy.com          WU-112 **DIFFERENT** → CEO 신규 **SAME**   🔴🔴 상충
 * bornyesterdaykids.com WU-112 **SAME**      → CEO 신규 **UNCERTAIN** 🔴 상충(등급 하향)
 * 🟢 나머지 7건은 일치 · donokids 는 신규(WU-112 에 없다).
 * 🔴 CTO 는 어느 쪽이 맞는지 **정하지 않는다** — CPO 가 「CEO 육안 판정을 기준
 *    truth 로 확정」이라 했으므로 **최신 판정** 을 truth 로 쓰고 상충을 **기록** 한다.
 * ```
 *
 * ── 🔴🔴🔴 그리고 `m.luxboy` 상충이 이 트랙의 «전제» 를 뒤집는다 ───────────
 * ```
 * CORE-2I · 2J · 2K · 2L **네 WU** 가 그 후보를 「**human DIFFERENT 인데 품번 exact**」인
 * 핵심 반례로 썼다. 그것으로 세 결론을 냈다:
 *   ⒜ 「Brand + Code 는 최강 증거」를 **반증** 했다
 *   ⒝ 「품번 단독 승격 경로는 **위험하다**」
 *   ⒞ `NO_TITLE_OVERLAP` + `crossSellerReserved` 이중 잠금을 「**필요한 방어**」로 정당화
 * 🔴🔴 그 전제가 뒤집히면 **셋 다 다시 봐야 한다** — 품번 exact 후보가 실제로 SAME 이면
 *    이중 잠금이 막은 것은 **옳은 동일상품** 이고, 그 방어는 **recall 손실** 이다.
 * 🟢 그리고 그것은 CPO 가 이번에 스스로 적은 방향과 **일치** 한다 —
 *    「품번이 다르다고 DIFFERENT 가 아니다」 · 「CONFLICT 는 너무 강한 규칙일 가능성」.
 * 🔴 **그래도 이번에 아무것도 고치지 않는다**(CPO 명시).
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  ceoRaw: string;
  verdict: "SAME" | "DIFFERENT" | "UNCERTAIN";
  ceoBasis: string;
  priorVerdict: string | null;
  conflict: boolean;
}

describe("CORE-2M-VR — CEO Visual Truth Calibration (운영 변경 0)", () => {
  it("A — GT 10건이 등록되고 상충 2건이 기록돼 있다", () => {
    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8"),
    ) as { candidates: GtCand[]; mapping: Record<string, string> };

    expect(gt.candidates.length, "🔴 CEO 가 판정한 10건 전부 등록돼야 한다").toBe(10);
    /** 🔴 키는 URL 이고 고유해야 한다(WU-095 교훈). */
    expect(new Set(gt.candidates.map((c) => c.url)).size).toBe(10);
    /** 🔴 매핑이 CPO 지시 그대로다 — 「유사」는 SAME 에서 **제외** 된다. */
    expect(gt.mapping).toEqual({ 동일: "SAME", 유사: "DIFFERENT", 판단불가: "UNCERTAIN" });

    const by = (v: string) => gt.candidates.filter((c) => c.verdict === v).length;
    console.log("\n═══ A. CEO Visual Ground Truth ═══");
    console.log(`    SAME **${by("SAME")}** · DIFFERENT **${by("DIFFERENT")}** · UNCERTAIN **${by("UNCERTAIN")}**`);
    expect(by("SAME")).toBe(8);
    expect(by("DIFFERENT")).toBe(1);
    expect(by("UNCERTAIN")).toBe(1);

    /** 🔴🔴 상충을 **기록해 둔 채로** 고정한다 — 숫자로 잠근다. */
    const conflicts = gt.candidates.filter((c) => c.conflict);
    console.log(`\n    🔴🔴 기존 GT 와 **상충 ${conflicts.length}건**`);
    for (const c of conflicts) {
      console.log(`        ${c.domain.padEnd(24)} WU-112 **${c.priorVerdict}** → CEO **${c.verdict}**`);
    }
    expect(conflicts.length, "🔴 상충을 조용히 덮으면 안 된다").toBe(2);
    expect(conflicts.map((c) => c.domain).sort()).toEqual(["bornyesterdaykids.com", "m.luxboy.com"]);
    /** 🔴 상충 건은 **이유를 반드시 적어 둔다**. */
    for (const c of conflicts) {
      expect((c as GtCand & { conflictNote?: string }).conflictNote, `🔴 ${c.domain} 상충 사유가 비었다`).toBeTruthy();
    }
    /** 🟢 CEO 근거가 **전건** 적혀 있다(나중에 「왜 SAME 인가」를 되묻지 않게). */
    for (const c of gt.candidates) expect(c.ceoBasis.length, c.domain).toBeGreaterThan(10);
    console.log("    🟢 CEO 근거 **10/10** 기록 · 상충 사유 **2/2** 기록");
  });

  it("B — CEO ↔ MI GAP 을 10건 전수로 낸다", async () => {
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
    expect(dna.brand.value, "🔴 brand 가 비면 측정이 열화된다").toBeTruthy();
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

    interface Gap {
      domain: string;
      ceo: string;
      verdict: string;
      truth: string;
      /** 🟢 어느 LEVEL 의 정보까지 MI 가 «가지고» 있는가 — 지어내지 않고 센다. */
      l1: string;
      l2: string;
      /** 🔴 CEO 판정과 MI 결과가 갈리는 «성질». */
      gap: string;
    }
    const rows: Gap[] = [];
    let unreachable = 0;

    for (const g of gt.candidates) {
      const f = await factsFromProductUrl(g.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        rows.push({ domain: g.domain, ceo: g.verdict, verdict: `🔴 ${f.status}`, truth: "-", l1: "-", l2: "-", gap: "측정불가" });
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const facts = scored?.facts ?? f.candidate.facts;
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(scored?.matchLevel ?? "low", cmp, cross.verdict, cross.blockers));

      /** 🟢 LEVEL 별 보유 — **있는 칸만** 센다(CPO LEVEL 1/2 정의 그대로). */
      const l1Have = [
        facts.brand ? "브랜드" : null,
        facts.brandModelCode ? "품번" : null,
        facts.title ? "상품명" : null,
        facts.categoryText ? "유형" : null,
        (facts.coreTitleTokens ?? []).length ? "핵심어" : null,
        (facts.imageUrls ?? []).length ? "대표이미지" : null,
      ].filter(Boolean) as string[];
      const l2Have = [
        facts.colorText ? "색상" : null,
        facts.materialText ? "소재" : null,
        facts.fitText ? "핏" : null,
        facts.ageRangeText ? "대상" : null,
        (facts.sizeLabels ?? []).length ? "사이즈" : null,
      ].filter(Boolean) as string[];

      /** 🔴 GAP 의 «성질» 을 적는다 — 숫자 하나로 뭉개지 않는다. */
      const identGrade = truth === "EXACT_IDENTIFIER" || truth === "STRONG_IDENTIFIER";
      let gap: string;
      if (g.verdict === "SAME" && cross.verdict === "SAME" && identGrade) gap = "🟢 일치";
      else if (g.verdict === "SAME" && cross.verdict === "CONFLICT") gap = "🔴🔴 품번 과대평가";
      else if (g.verdict === "SAME") gap = "🔴 판단등급 부족";
      else if (g.verdict === "DIFFERENT" && cross.verdict !== "SAME") gap = "🟢 방향 안전";
      else if (g.verdict === "DIFFERENT") gap = "🔴🔴 오포함";
      else gap = "🟡 가격 비교 가능성 별도 필요";

      rows.push({
        domain: g.domain,
        ceo: g.verdict,
        verdict: cross.verdict,
        truth,
        l1: `${l1Have.length}/6`,
        l2: `${l2Have.length}/5`,
        gap,
      });
    }

    console.log("\n═══ B. CEO-GROUND-TRUTH GAP (10건 전수) ═══");
    console.log("    판매처                  CEO         MI                        L1    L2    GAP");
    for (const r of rows) {
      console.log(
        `    ${r.domain.padEnd(22)} ${r.ceo.padEnd(11)} ${`${r.verdict}/${r.truth}`.padEnd(25)} ` +
          `${r.l1.padEnd(5)} ${r.l2.padEnd(5)} ${r.gap}`,
      );
    }

    const n = (k: string) => rows.filter((r) => r.gap.includes(k)).length;
    console.log("\n═══ C. GAP 집계 ═══");
    console.log(`    🟢 일치                      **${n("일치")}**`);
    console.log(`    🔴🔴 품번 과대평가            **${n("품번 과대평가")}**`);
    console.log(`    🔴 판단등급 부족              **${n("판단등급 부족")}**`);
    console.log(`    🟢 방향 안전(CEO DIFFERENT)   **${n("방향 안전")}**`);
    console.log(`    🔴🔴 오포함                   **${n("오포함")}**`);
    console.log(`    🟡 가격 비교 가능성 별도       **${n("가격 비교")}**`);
    console.log(`    🔴 측정불가                   **${unreachable}**`);

    /** 🔴🔴 **오포함이 있으면 그것이 가장 위험하다** — 틀린 가격이 동일상품 가격이 된다. */
    console.log(
      `\n    🔴 CEO SAME 8건 중 MI 가 **확정 SAME 으로 받은 것** = **${rows.filter((r) => r.ceo === "SAME" && r.gap.includes("일치")).length} / 8**`,
    );

    expect(rows.length, "🔴 10건 전부 표에 있어야 한다").toBe(10);
    /** 🟢 이 WU 는 **고치지 않는다** — 숫자를 남기는 것이 산출물이다. */
    expect(rows.filter((r) => r.gap === "측정불가").length).toBe(unreachable);
  }, 900000);
});
