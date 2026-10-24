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
import { confirmBrandCodeInTitle } from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2L — **Body Evidence Counterfactual**(측정 전용 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「**본문/description 까지 품번 확인 범위를 넓혔을 때 실제
 * 이득과 leakage 가 어떻게 변하는가?**」 · 「①의 이득보다 **②~⑤의 안전성이 우선**」.
 *
 * 🔴 운영 코드 변경 **0** · 정규화 **0**(`226AC009 ≠ B226AC009` 그대로) ·
 *    threshold **0** · CATEGORY **0** · `NO_TITLE_OVERLAP` **0** ·
 *    `crossSellerReserved` **0** · identifier-only **0** · 데이터 모델 확장 **0**.
 *
 * ── 🟢 반사실을 «운영 primitive» 로 만든다 — 새 함수 0 ─────────────────────
 * ```
 * 현재 건초더미  `confirmBrandCodeInEvidence(code, { title, url, sku })`   ← 셋뿐
 * 반사실        같은 판정 규칙(`confirmBrandCodeInTitle`)에 **본문을 넣는다**
 * 🟢 그 함수가 운영의 판정 primitive 다 — 문자열을 영숫자 아닌 것으로 쪼개고
 *    **한 토큰이 품번과 완전히 같을 때만** 인정한다(부분 일치 금지).
 * 🔴 그래서 `226AC009` 는 본문에 있어도 **채택되지 않는다**(정규화 금지가 유지된다).
 * ```
 *
 * ── 🔴 본문을 «두 가지» 로 가른다 — 위험도가 다르다 ────────────────────────
 * ```
 * ⒜ VISIBLE   태그·script·style 를 벗긴 **사람이 읽는 본문**
 * ⒝ RAW_HTML  속성·JSON-LD·script 를 **포함한 전체**(가장 넓고 가장 위험하다)
 * 🔴 둘을 한 숫자로 섞지 않는다 — CPO 가 고를 선택지가 둘이기 때문이다.
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const MINI = "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1";
const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";
const ORIGIN_CODE = "B226AC009";

/** 🔴 CPO 가 지목한 핵심 fixture 넷. */
const KEY = ["stockmann.ee", "m.luxboy.com", "junioredition.com", "kids21.com"];

interface GtRow {
  url: string;
  domain: string;
  originCode: string;
  verdict: string;
}

/** 🟢 사람이 읽는 본문만 남긴다 — script·style·태그를 벗긴다. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

describe("CORE-2L — Body Evidence Counterfactual (운영 변경 0)", () => {
  it("A — 현재 건초더미는 셋이고 본문은 안 본다(소스 앵커)", () => {
    const root = path.join(__dirname, "../../../../../../../..");
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const mt = strip(readFileSync(path.join(root, "packages/crawler/src/comparison-search/match.ts"), "utf8"));
    const di = strip(
      readFileSync(path.join(root, "packages/crawler/src/comparison-search/domestic-identifiers.ts"), "utf8"),
    );
    for (const f of ["title: c.title", "url: c.url", "sku: c.sku"]) expect(mt).toContain(f);
    expect(mt, "🔴 본문/description 은 현재 건초더미에 없다").not.toContain("description: c.");
    /** 🟢 그리고 판정 규칙이 **토큰 전체 일치** 라는 것을 잠근다(부분 일치 금지). */
    expect(di).toContain("export function confirmBrandCodeInTitle");
    console.log("\n═══ A. 현재 건초더미 = **title · url · sku** 셋뿐(본문 0) ═══");
    /** 🔴 정규화 금지가 유지된다는 것을 **같은 자리** 에서 단언한다. */
    expect(confirmBrandCodeInTitle(ORIGIN_CODE, "상품코드 226AC009 입니다")).toBeNull();
    expect(confirmBrandCodeInTitle(ORIGIN_CODE, "상품코드 B226AC009 입니다")).toBe(ORIGIN_CODE);
    console.log("    🔴 본문에 `226AC009` 만 있으면 **채택되지 않는다**(정규화 금지 유지)");
    console.log("    🟢 본문에 `B226AC009` 원형이 **한 토큰으로** 있으면 채택된다");
  });

  it("B — 본문 확대의 이득과 leakage를 운영 순서로 잰다", async () => {
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
    expect(dna.brandModelCode, "🔴 원상품 품번이 없으면 확인 경로가 돌 수 없다").toBe(ORIGIN_CODE);

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const targets = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "donokids.com", url: DONO, human: "SAME?" },
      { label: "miniboutique.co.kr", url: MINI, human: "SAME?" },
    ];

    interface Row {
      label: string;
      human: string;
      base: { field: string | null; cmp: string; verdict: string; truth: string };
      vis: { field: string | null; cmp: string; verdict: string; truth: string };
      raw: { field: string | null; cmp: string; verdict: string; truth: string };
    }
    const rows: Row[] = [];
    let measured = 0;
    let unreachable = 0;

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — **측정불가**(0 으로 세지 않는다)`);
        continue;
      }
      measured += 1;
      const cand = f.candidate;

      let html = "";
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        html = await res.text();
      } catch {
        html = "";
      }

      /** 🟢 ① 현재 운영 — `withConfidence` 를 **그대로** 부른다. */
      const query = {
        title: ex!.productData!.title ?? "",
        brand: dna.brand.value || undefined,
        sourceUrl: ORIGIN,
        sku: dna.brandModelCode ?? undefined,
        facts: originFacts,
      } as ComparisonQuery;
      const [scored] = withConfidence(query, [cand]);
      const opFacts = scored?.facts ?? cand.facts!;
      const level = scored?.matchLevel ?? "low";

      const judge = (facts: ProductFacts) => {
        const field = facts.brandModelCode ?? null;
        const cmp = compareModelCode(ORIGIN_CODE, field);
        const cross = compareCrossSellerProducts(originFacts, facts);
        const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
        return { field, cmp, verdict: cross.verdict, truth };
      };

      /**
       * 🟢 ②③ 반사실 — **품번 칸이 비어 있을 때만** 본문에서 확인한다.
       * 🔴 운영의 `=== null` 조건을 **그대로** 복제한다 — 오염된 칸을 덮지 않는다.
       * 🔴 판정 규칙은 운영 primitive(`confirmBrandCodeInTitle`)를 그대로 쓴다.
       */
      const widen = (hay: string): ProductFacts => {
        if (opFacts.brandModelCode != null || !hay) return opFacts;
        const found = confirmBrandCodeInTitle(ORIGIN_CODE, hay);
        return found ? ({ ...opFacts, brandModelCode: found } as ProductFacts) : opFacts;
      };

      const base = judge(opFacts);
      const vis = judge(widen(visibleText(html)));
      const raw = judge(widen(html));

      rows.push({ label: t.label, human: t.human, base, vis, raw });
    }

    expect(measured, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);

    /* ── 표 ─────────────────────────────────────────────────────────────── */
    console.log(`\n═══ B. 본문 확대 반사실(분모 **${measured}** · 측정불가 **${unreachable}**) ═══`);
    console.log(
      "    판매처                  human     ① 현재                  ② +VISIBLE              ③ +RAW_HTML",
    );
    const fmt = (x: { cmp: string; verdict: string }) => `${x.cmp}/${x.verdict}`;
    for (const r of rows) {
      const mark = KEY.includes(r.label) ? " ★" : "";
      console.log(
        `    ${r.label.padEnd(22)} ${r.human.padEnd(9)} ${fmt(r.base).padEnd(23)} ` +
          `${fmt(r.vis).padEnd(23)} ${fmt(r.raw)}${mark}`,
      );
    }

    /* ── 핵심 fixture 넷 개별 판정 ─────────────────────────────────────── */
    console.log("\n═══ C. CPO 핵심 fixture 넷 ═══");
    for (const key of KEY) {
      const r = rows.find((x) => x.label === key);
      if (!r) {
        console.log(`    🔴 ${key} — **측정불가**`);
        continue;
      }
      console.log(
        `    ${key.padEnd(20)} human ${r.human.padEnd(10)}\n` +
          `       ① 현재      ${JSON.stringify(r.base.field)} · ${r.base.cmp} · ${r.base.verdict}/${r.base.truth}\n` +
          `       ② +VISIBLE  ${JSON.stringify(r.vis.field)} · ${r.vis.cmp} · ${r.vis.verdict}/${r.vis.truth}\n` +
          `       ③ +RAW_HTML ${JSON.stringify(r.raw.field)} · ${r.raw.cmp} · ${r.raw.verdict}/${r.raw.truth}`,
      );
    }

    /* ── CPO 5 KPI ────────────────────────────────────────────────────── */
    const ident = (x: { truth: string }) => x.truth === "EXACT_IDENTIFIER" || x.truth === "STRONG_IDENTIFIER";
    const sameGain = (k: "vis" | "raw") =>
      rows.filter((r) => r.human === "SAME" && r[k].verdict === "SAME" && r.base.verdict !== "SAME").length;
    const identLeak = (k: "base" | "vis" | "raw") =>
      rows.filter((r) => r.human === "DIFFERENT" && ident(r[k])).length;
    const sameLeak = (k: "base" | "vis" | "raw") =>
      rows.filter((r) => r.human === "DIFFERENT" && r[k].verdict === "SAME").length;
    /** 🔴 ④ seller-SKU 재오염 — 본문 확대가 **품번 아닌 값** 을 끌어들였는가. */
    const reContam = (k: "vis" | "raw") =>
      rows.filter((r) => {
        const v = r[k].field;
        if (v == null || r.base.field != null) return false;
        return v !== ORIGIN_CODE;
      }).length;
    const luxboy = rows.find((r) => r.label === "m.luxboy.com");
    const stock = rows.find((r) => r.label === "stockmann.ee");

    console.log("\n═══ D. CPO 5 KPI ═══");
    console.log(`    ① stockmann SAME 회복        현재 ${stock ? `${stock.base.verdict}` : "측정불가"} →` +
      ` VISIBLE ${stock ? stock.vis.verdict : "-"} · RAW ${stock ? stock.raw.verdict : "-"}`);
    console.log(`    ② m.luxboy identifier leak   현재 **${identLeak("base")}** → VISIBLE **${identLeak("vis")}** · RAW **${identLeak("raw")}**`);
    console.log(`    ③ Different-Code leakage     현재 **${sameLeak("base")}** → VISIBLE **${sameLeak("vis")}** · RAW **${sameLeak("raw")}**`);
    console.log(`    ④ seller-SKU 재오염          VISIBLE **${reContam("vis")}** · RAW **${reContam("raw")}**`);
    console.log(`    ⑤ negative fixture leakage   현재 **${sameLeak("base")}** → VISIBLE **${sameLeak("vis")}** · RAW **${sameLeak("raw")}**`);
    console.log(`    🟢 human SAME 신규 회복        VISIBLE **${sameGain("vis")}** · RAW **${sameGain("raw")}**`);

    /** 🔴 현재 상태의 안전성은 **반드시** 유지돼야 한다(이 하니스가 열화를 감지한다). */
    expect(identLeak("base"), "🔴 현재 운영에서 human DIFFERENT 가 식별자 등급이면 이미 결함이다").toBe(0);
    expect(sameLeak("base"), "🔴 현재 운영에서 human DIFFERENT 가 SAME 이면 이미 결함이다").toBe(0);

    /** 🟢 junioredition 의 conflict 는 세 조건 **전부** 에서 유지돼야 한다. */
    const j = rows.find((r) => r.label === "junioredition.com");
    if (j) {
      for (const [k, v] of [["①", j.base], ["②", j.vis], ["③", j.raw]] as const) {
        expect(v.cmp, `🔴🔴 ${k} junioredition conflict 가 사라지면 안전장치가 죽는다`).toBe("conflict");
      }
      console.log("\n    🟢 junioredition — ①②③ **전부 conflict 유지**");
    }
    /** 🟢 kids21 은 세 조건 전부에서 **공식 품번이 아닌 값을 갖지 않아야** 한다. */
    const k21 = rows.find((r) => r.label === "kids21.com");
    if (k21) {
      for (const [k, v] of [["①", k21.base], ["②", k21.vis], ["③", k21.raw]] as const) {
        expect(
          v.field == null || v.field === ORIGIN_CODE,
          `🔴🔴 ${k} kids21 에 판매처 SKU 가 되살아나면 CORE-2K 가 무효다`,
        ).toBe(true);
      }
      console.log("    🟢 kids21 — ①②③ **판매처 SKU 재오염 0**");
    }

    /** 🔴🔴 이 WU 의 핵심 — **안전성이 ①의 이득보다 우선** 이다(CPO 명시). */
    console.log("\n═══ E. 판정 재료(🔴 CTO 는 결정하지 않는다) ═══");
    if (luxboy) {
      const worse = ident(luxboy.vis) || ident(luxboy.raw) || luxboy.vis.verdict === "SAME" || luxboy.raw.verdict === "SAME";
      console.log(
        `    m.luxboy 위험 변화 — ① ${luxboy.base.verdict}/${luxboy.base.truth} →` +
          ` ② ${luxboy.vis.verdict}/${luxboy.vis.truth} → ③ ${luxboy.raw.verdict}/${luxboy.raw.truth}`,
      );
      console.log(`    ⟹ ${worse ? "🔴 **위험이 증가한다**" : "🟢 **위험 증가 없음**"}`);
    }
    if (stock) {
      const gained = stock.vis.verdict !== stock.base.verdict || stock.raw.verdict !== stock.base.verdict;
      console.log(
        `    stockmann 이득 변화 — ① ${stock.base.cmp}/${stock.base.verdict} →` +
          ` ② ${stock.vis.cmp}/${stock.vis.verdict} → ③ ${stock.raw.cmp}/${stock.raw.verdict}`,
      );
      console.log(`    ⟹ ${gained ? "🟢 **변화 있음**" : "🔴 **변화 0**"}`);
    }
  }, 900000);
});
