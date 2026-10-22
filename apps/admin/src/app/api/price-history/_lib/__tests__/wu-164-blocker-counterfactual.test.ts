import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName, factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-164 — **두 blocker 를 «한 축씩» counterfactual 로 재다** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**둘을 동시에 완화하지 않는다.** 한 축씩 counterfactual ·
 * 전체 precision regression 포함 · **`DIFFERENT` leakage 가 1건이라도 생기면 해당 축 NO-GO**」.
 *
 * 🔴 운영 코드 **0** · flag **0** · 배포 **0** · threshold **0** · `MODEL_CODE` **절대 금지** ·
 *    `NO_TITLE_OVERLAP` 금지축 **삭제 0** · adapter/registry **0** · Gemini **0**.
 * 🔴 반사실은 **운영 함수에 입력만 바꿔** 넣는다(WU-134 STEP-2 방식). 코드를 고치지 않는다.
 * 🔴 게이트 `WU_164_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴 CPO §2 의 답을 **먼저** 적는다(조사로 확정) ──────────────────────────
 * ```
 * 「기존 금지축을 건드리지 않고 쓸 수 있는 **이미 존재하는 alias/normalized title 증거**」
 *   ⟹ 🔴 **없다.**
 *   · `NO_TITLE_OVERLAP` 발화 조건 = `jaccard(distinctive(coreTitleTokens)) === 0`
 *     (cross-seller.ts:922·929)
 *   · `coreTitleTokens` 는 **brand-alias 를 쓰지 않는다**(전수 grep 0)
 *   · `brand-alias` 소비처는 **`product-url-facts.ts:248` 하나** 이고 **브랜드 축 전용** 이다
 *   · 음역 축은 **WU-078 에서 CPO 가 종료** 했다(회수 0 · DIFFERENT 를 열 위험)
 * ⟹ 🔴 **CF-B 는 「새 유사도/느슨한 토큰 매칭」 없이는 성립하지 않는다** = CPO 금지.
 *    그래서 **CF-B 를 돌리지 않았다**(조사 결과로 닫는다).
 * ```
 */
const LIVE = process.env.WU_164_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
/** 🟢 WU-163 이 **실제 페이지네이션 링크에서 회수** 한 URL(지어내지 않았다). */
const BISKUIT =
  "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/70/display/1/";

interface GtRow {
  sid: string;
  originCode: string;
  domain: string;
  url: string;
  verdict: string;
}

const ogTitleOf = (html: string) =>
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;

describe("WU-164 — blocker 축별 counterfactual", () => {
  it.runIf(LIVE)("CF-A(BRAND) 단독으로 재고 DIFFERENT leakage 를 본다", async () => {
    /* eslint-disable no-console */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const originFacts = productFactsFromIdentityDna(dna);
    console.log("\n══════ 🔴 원상품 ══════");
    console.log(`  brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} color=${dna.color}`);

    /* ── ① CF-A 의 «수단» 이 실제로 쓸 수 있는지 측정한다 ── */
    console.log("\n══════ 🔴 CF-A 수단 검증(가정하지 않고 호출한다) ══════");
    const res = await fetch(BISKUIT, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    const siteBrand = extractSiteBrandName(html);
    const og = ogTitleOf(html);
    const viaAlias = og ? lookupBrandByAliasInTitle(og) : null;
    console.log(`  og:title = ${JSON.stringify(og)}`);
    console.log(`  🔴 extractSiteBrandName(html) = ${JSON.stringify(siteBrand)}`);
    console.log(`  🟢 lookupBrandByAliasInTitle(og:title) = ${JSON.stringify(viaAlias)}`);
    console.log("  🔴 헌장 WU-138 은 「`extractSiteBrandName` 로 제거 가능」이라 적었다 —");
    console.log("     🔴 그 함수는 **사이트 이름** 을 낸다. 비스킷에서는 그것이 **틀린 브랜드** 다.");

    /* ── ② baseline ↔ CF-A 를 같은 후보 집합에 돌린다 ── */
    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const rows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    console.log(
      `\n══════ 🔴 회귀 분모 ══════\n  WU-112 GT 중 B226AC009 = **${rows.length}**` +
        `(SAME ${rows.filter((r) => r.verdict === "SAME").length} · DIFFERENT ${rows.filter((r) => r.verdict === "DIFFERENT").length})` +
        ` + 비스킷 신규 1(human SAME · 헌장 WU-138)`,
    );
    console.log("  🔴 **DIFFERENT 분모가 2 다** — 「leakage 0」을 강한 방어 증거로 쓰지 않는다.");
    console.log("  🔴 B226AC010 쪽 DIFFERENT 4 는 **원상품 URL 을 지어내지 않으려** 제외했다.");

    const targets: { label: string; url: string; human: string }[] = [
      ...rows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "biskuit.kr(신규)", url: BISKUIT, human: "SAME" },
    ];

    interface Out {
      label: string;
      human: string;
      base: string | null;
      cfa: string | null;
      baseBlockers: string[];
      cfaBlockers: string[];
      brand: string | null;
    }
    const out: Out[] = [];

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`  ${t.label.padEnd(24)} 🔴 ${f.status} — 분모에서 제외(측정불가)`);
        continue;
      }
      const cf = f.candidate.facts as ProductFacts;
      const base = compareCrossSellerProducts(originFacts, cf);

      /**
       * 🔴🔴 **CF-A — 브랜드 칸 «하나만» 바꾼다.** 근거는 지어낸 것이 아니라
       *    **이미 배포된 `lookupBrandByAliasInTitle`** 이 그 페이지 og:title 에서 찾는 값이다.
       * 🔴 다른 칸은 **한 글자도** 바꾸지 않는다(제목·품번·색상·소재 전부 그대로).
       * 🔴 alias 가 **없으면 바꾸지 않는다** — 「모르면 채우지 않는다」.
       */
      let cfaFacts = cf;
      let aliasBrand: string | null = null;
      try {
        const r2 = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        const h2 = await r2.text();
        const og2 = ogTitleOf(h2);
        aliasBrand = og2 ? (lookupBrandByAliasInTitle(og2) ?? null) : null;
      } catch {
        aliasBrand = null;
      }
      if (aliasBrand) cfaFacts = { ...cf, brand: aliasBrand };
      const cfa = compareCrossSellerProducts(originFacts, cfaFacts);

      out.push({
        label: t.label,
        human: t.human,
        base: base.verdict,
        cfa: cfa.verdict,
        baseBlockers: base.blockers.map((b) => (typeof b === "string" ? b : b.blocker)),
        cfaBlockers: cfa.blockers.map((b) => (typeof b === "string" ? b : b.blocker)),
        brand: aliasBrand,
      });
    }

    console.log("\n══════ 🔴🔴 CF-A 결과(브랜드 축 단독) ══════");
    console.log(`  ${"판매처".padEnd(24)} ${"human".padEnd(10)} ${"baseline".padEnd(15)} ${"CF-A".padEnd(15)} alias`);
    for (const o of out) {
      const flip = o.base !== o.cfa ? " 🔴변화" : "";
      console.log(
        `  ${o.label.padEnd(24)} ${o.human.padEnd(10)} ${String(o.base).padEnd(15)} ${String(o.cfa).padEnd(15)}` +
          ` ${String(o.brand ?? "-").padEnd(12)}${flip}`,
      );
      if (o.base !== o.cfa) {
        console.log(`     baseline blockers ${JSON.stringify(o.baseBlockers)}`);
        console.log(`     CF-A     blockers ${JSON.stringify(o.cfaBlockers)}`);
      }
    }

    const sameOf = (v: string | null) => v === "SAME";
    const baseTrue = out.filter((o) => sameOf(o.base) && o.human === "SAME").length;
    const baseFalse = out.filter((o) => sameOf(o.base) && o.human === "DIFFERENT").length;
    const cfaTrue = out.filter((o) => sameOf(o.cfa) && o.human === "SAME").length;
    const cfaFalse = out.filter((o) => sameOf(o.cfa) && o.human === "DIFFERENT").length;

    console.log("\n══════ 🔴🔴 precision / leakage ══════");
    console.log(`  측정된 후보          ${out.length}`);
    console.log(`  baseline  SAME 중 human SAME ${baseTrue} · 🔴 human DIFFERENT **${baseFalse}**`);
    console.log(`  CF-A      SAME 중 human SAME ${cfaTrue} · 🔴 human DIFFERENT **${cfaFalse}**`);
    console.log(`  🔴 **DIFFERENT leakage 증가 = ${cfaFalse - baseFalse}**  (CPO: 1건이라도 늘면 **NO-GO**)`);
    const biskuit = out.find((o) => o.label.startsWith("biskuit"));
    console.log(
      `\n  🔴 비스킷 — baseline ${biskuit?.base} → CF-A **${biskuit?.cfa}**` +
        ` · CF-A blockers ${JSON.stringify(biskuit?.cfaBlockers ?? [])}`,
    );
    const verdict =
      cfaFalse - baseFalse > 0
        ? "🔴 **NO-GO**(DIFFERENT leakage 증가)"
        : cfaTrue > baseTrue
          ? "🟡 **회수 있음 · leakage 0** — CPO 판정 사안"
          : "🔴 **회수 0** — 이 축만으로는 열리지 않는다";
    console.log(`\n  🔴🔴 CF-A 판정 = ${verdict}`);
    console.log("\n  🔴 CF-B(NO_TITLE_OVERLAP)는 **돌리지 않았다** — 쓸 수 있는 기존 alias/normalized");
    console.log("     title 증거가 **없고**(전수 grep) 새 유사도/느슨한 매칭은 **CPO 금지** 다.");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(out.length).toBeGreaterThan(0);
  }, 900_000);
});
