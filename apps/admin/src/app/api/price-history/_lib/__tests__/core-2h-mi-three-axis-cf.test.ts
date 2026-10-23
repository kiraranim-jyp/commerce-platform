import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { factsFromProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2H — **MI 3축 Counterfactual**(TITLE / BRAND / MARKET · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**운영 코드에서 아무것도 열지 않는다**」 ·
 * 「세 축을 **한꺼번에 열지 않는다**(TITLE → BRAND → MARKET 순서)」 ·
 * 「PASS 를 **「B226AC009 가 SAME 이 되었느냐」 하나로 판단하지 않는다**」 ·
 * 「🔴 **DIFFERENT leakage** 와 **기존 negative fixture** 를 반드시 본다」.
 *
 * ── 🟢🟢 반사실 방식 — **운영 함수에 «입력만» 바꿔 넣는다**(WU-134/164 방식) ──
 * ```
 * 🔴 코드를 **한 글자도 고치지 않았다**. 세 축 전부 입력으로 재현된다:
 *   H-1 TITLE   후보 `facts.coreTitleTokens` 를 **실제 제목에서** 다시 만들어 넣는다
 *   H-2 BRAND   후보 `facts.brand` 를 **실제 제목의 한글/영문 브랜드** 로 채운다
 *               (`lookupBrandByAliasInTitle` — WU-151 의 기존 자산)
 *   H-3 MARKET  `classifyCandidateMarket({ isRegisteredDomesticShop: true })`
 *               (= 등록부에 넣었다면 어떻게 되는가. 🔴 규칙을 바꾸지 않았다)
 * ```
 *
 * 🔴 MI 완화 **0** · threshold **0** · synonym 추가 **0** · alias 추가 **0** ·
 *    market rule 변경 **0** · Adapter **0** · Search API **0** · Gemini/OpenAI/Naver **0** ·
 *    Seller UI **0** · 국내 가격을 가격대에 강제 투입 **0**.
 * 🔴 게이트 `CORE2H_PROBE=1` 없으면 SKIP.
 */
const LIVE = process.env.CORE2H_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🟢 CORE-2F/2G 가 **실제 링크에서** 회수한 두 국내 상세 URL(지어낸 것 0). */
const MINI = "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/";
const DONO =
  "https://www.donokids.com/shop/shopdetail.html?branduid=3362785&xcode=058&mcode=003&scode=&type=X&sort=order&current_category=058&search=";

interface GtRow {
  sid: string;
  originCode: string;
  domain: string;
  url: string;
  verdict: string;
}

const ogTitleOf = (html: string) =>
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ?? null;

/** 🟢 같은 blocker 목록을 두 벌로 적지 않기 위한 축약. */
const blockerNames = (r: { blockers?: readonly { blocker: string }[] } | null): string[] =>
  (r?.blockers ?? []).map((b) => b.blocker);

describe("CORE-2H — MI 3축 counterfactual", () => {
  it.runIf(LIVE)("TITLE / BRAND / MARKET 를 한 축씩 재고 leakage 를 본다", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2H — MI 3축 counterfactual ════════");
    console.log("  🔴 운영 코드 변경 0 — 반사실은 **입력만** 바꾼다(WU-134/164 방식)");

    /* ── 원상품 ─────────────────────────────────────────────────────── */
    let ex = await shopifySiteStrategy.extract(ORIGIN);
    const siteBrandOf = (r: typeof ex) =>
      String((r?.productData as Record<string, unknown> | undefined)?.siteBrandName ?? "");
    let tries = 1;
    while (!siteBrandOf(ex) && tries < 3) {
      await new Promise((r) => setTimeout(r, 20_000));
      ex = await shopifySiteStrategy.extract(ORIGIN);
      tries += 1;
    }
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    let dna = buildProductIdentityDna(product);
    /**
     * 🔴🔴 **brand 복구는 간헐적으로 실패한다** — 이 실행에서 **3/3 실패** 해 게이트가
     *    측정을 거부했다(🟢 거부가 맞다 · 열화된 숫자를 보고하지 않는다).
     * 🟢 그래서 **운영 파서를 직접 불러** 같은 페이지에서 확보한다(값을 지어내지 않는다).
     *    CORE-2E/2F/2G 가 쓴 것과 **같은 보강** 이다.
     */
    if (!dna.brand.value) {
      const html = await fetchPlainHtml(ORIGIN.replace("/ko-kr/", "/"));
      const site = html ? extractSiteBrandName(html) : null;
      if (site) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
        console.log(`  🔴 brand 를 **하니스가 보강** 했다 — 운영 파서 ${site.evidence}`);
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    console.log(
      `\n  원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} color=${JSON.stringify(dna.color)}`,
    );
    console.log(`  원상품 coreTitleTokens = ${JSON.stringify(originFacts.coreTitleTokens)}`);
    expect(dna.brand.value, "🔴 brand 가 비면 전건 BRAND_UNCONFIRMED 가 되어 측정이 열화된다").toBeTruthy();

    /* ── leakage 분모 — 기존 human GT(negative fixture) ────────────────── */
    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const gtDiff = gtRows.filter((r) => r.verdict === "DIFFERENT");
    console.log(
      `\n  회귀 분모(WU-112 GT · B226AC009) = **${gtRows.length}**` +
        ` — SAME ${gtRows.filter((r) => r.verdict === "SAME").length} · DIFFERENT **${gtDiff.length}**`,
    );
    console.log("  🔴 **DIFFERENT 분모가 작다** — 「leakage 0」을 강한 방어 증거로 쓰지 않는다(WU-164 와 같은 한계).");

    /* ── 측정 대상 = GT 전건 + 신규 둘 ─────────────────────────────────── */
    const targets: { label: string; url: string; human: string }[] = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "miniboutique.co.kr(신규)", url: MINI, human: "SAME?" },
      { label: "donokids.com(신규)", url: DONO, human: "SAME?" },
    ];
    console.log("  🔴 신규 둘의 human 라벨은 **없다** — `SAME?` 로 적는다(CTO 가 판정하지 않는다).");

    interface Row {
      label: string;
      human: string;
      facts: ProductFacts;
      ogTitle: string | null;
      /** 🔴 H-2 가 **무엇으로** 브랜드를 복구했는가(없으면 null — 만들지 않았다). */
      viaAlias: string | null;
      /**
       * 🔴🔴 **축 수** — blocker 가 0 이어도 축이 모자라면 SAME 이 아니다.
       *    그 숫자를 적지 않으면 「blocker 를 없앴는데 왜 SAME 이 아닌가」를 설명할 수 없다.
       */
      baseAxes: number;
      h1Axes: number;
      h2Axes: number;
      baseAxisNames: string[];
      base: string;
      baseBlockers: string[];
      h1: string;
      h1Blockers: string[];
      h2: string;
      h2Blockers: string[];
      market: string;
      marketCf: string;
      currency: string | null;
    }
    const rows: Row[] = [];

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`    ${t.label.padEnd(26)} 🔴 ${f.status} — 분모에서 제외(측정불가)`);
        continue;
      }
      const facts = f.candidate.facts;
      /** 🟢 제목은 **그 페이지의 og:title** 에서 읽는다(지어내지 않는다). */
      let ogTitle: string | null = null;
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        ogTitle = ogTitleOf(await res.text());
      } catch {
        ogTitle = null;
      }

      /* ── baseline ─────────────────────────────────────────────── */
      const base = compareCrossSellerProducts(originFacts, facts);

      /**
       * ── H-1 TITLE 단독 ────────────────────────────────────────
       * 🟢 후보의 `coreTitleTokens` 를 **실제 제목(og:title)에서 다시 만들어** 넣는다.
       * 🔴 토큰을 **지어내지 않는다** — 그 페이지가 적은 말만 쓴다.
       * 🔴 다른 칸은 **baseline 그대로** 다(한 축씩).
       */
      const titleTokens = (ogTitle ?? facts.title ?? "")
        .toLowerCase()
        .split(/[^a-z0-9가-힣]+/)
        .filter((w) => w.length >= 2);
      const h1 = compareCrossSellerProducts(originFacts, {
        ...facts,
        coreTitleTokens: [...new Set([...(facts.coreTitleTokens ?? []), ...titleTokens])],
      });

      /**
       * ── H-2 BRAND 단독 ───────────────────────────────────────
       * 🟢 후보 `facts.brand` 를 **실제 제목의 브랜드** 로 채운다
       *    (`lookupBrandByAliasInTitle` — 기존 자산 · 새 alias 0).
       * 🔴 제목에 브랜드가 없으면 **채우지 않는다**(모르면 만들지 않는다).
       */
      /**
       * 🔴🔴 **1차 반사실이 여기서 틀렸다 — `og:title` «만» 봤다.**
       *
       * 실측 — 도노키즈의 `og:title` 은 **빈 문자열** 이라 alias 가 발화하지 못했고
       * H-2 가 「변화 0」으로 나왔다. 🔴 그런데 그 후보의 `coreTitleTokens` 에는
       * **「보보쇼즈」가 이미 있다** ⟹ 「브랜드를 복구할 수단이 없다」가 **거짓** 이다.
       * 🟢 그래서 제목 출처를 **셋** 으로 넓혔다(전부 **그 페이지가 적은 말** 이다):
       *    `og:title` → `facts.title` → `coreTitleTokens.join(" ")`
       * 🔴 alias 표를 **늘리지 않았다** — 기존 `lookupBrandByAliasInTitle` 하나다.
       */
      const titleSources = [ogTitle, facts.title, (facts.coreTitleTokens ?? []).join(" ")];
      let viaAlias: string | null = null;
      for (const s of titleSources) {
        if (!s) continue;
        const hit = lookupBrandByAliasInTitle(s);
        if (hit) {
          viaAlias = hit;
          break;
        }
      }
      const h2 = viaAlias
        ? compareCrossSellerProducts(originFacts, { ...facts, brand: viaAlias })
        : base;

      /* ── H-3 MARKET 단독 ──────────────────────────────────────── */
      const cur = f.candidate.price?.currency ?? null;
      const host = new URL(t.url).hostname.replace(/^www\./, "");
      const market = classifyCandidateMarket({ domain: host, currency: cur, isRegisteredDomesticShop: false });
      const marketCf = classifyCandidateMarket({ domain: host, currency: cur, isRegisteredDomesticShop: true });

      rows.push({
        label: t.label,
        human: t.human,
        facts,
        ogTitle,
        viaAlias,
        baseAxes: (base.axes ?? []).length,
        h1Axes: (h1.axes ?? []).length,
        h2Axes: (h2.axes ?? []).length,
        baseAxisNames: (base.axes ?? []).map((a) => a.axis),
        base: base.verdict,
        baseBlockers: blockerNames(base),
        h1: h1.verdict,
        h1Blockers: blockerNames(h1),
        h2: h2.verdict,
        h2Blockers: blockerNames(h2),
        market: market.market,
        marketCf: marketCf.market,
        currency: cur,
      });
      await new Promise((r) => setTimeout(r, 1200));
    }

    /* ── 결과표 ──────────────────────────────────────────────────── */
    console.log("\n════════ 🔴 축별 결과(한 축씩) ════════");
    console.log("  label                      human      base            H1(TITLE)       H2(BRAND)");
    for (const r of rows) {
      console.log(
        `  ${r.label.padEnd(26)} ${r.human.padEnd(10)} ${r.base.padEnd(15)} ${r.h1.padEnd(15)} ${r.h2}`,
      );
    }

    const same = (v: string) => v === "SAME";
    const count = (sel: (r: Row) => string, human: string) => rows.filter((r) => r.human === human && same(sel(r))).length;
    const leak = (sel: (r: Row) => string) => rows.filter((r) => r.human === "DIFFERENT" && same(sel(r))).length;

    console.log("\n════════ 🔴🔴 CPO 요구 표 ════════");
    console.log("  실험      대상                SAME(human SAME)  🔴 DIFFERENT leakage  conflicts");
    const confl = (sel: (r: Row) => string[]) => rows.reduce((n, r) => n + sel(r).length, 0);
    console.log(
      `  BASE      전체                ${String(count((r) => r.base, "SAME")).padStart(2)}` +
        `                ${String(leak((r) => r.base)).padStart(2)}                    ${confl((r) => r.baseBlockers)}`,
    );
    console.log(
      `  TITLE     전체                ${String(count((r) => r.h1, "SAME")).padStart(2)}` +
        `                ${String(leak((r) => r.h1)).padStart(2)}                    ${confl((r) => r.h1Blockers)}`,
    );
    console.log(
      `  BRAND     전체                ${String(count((r) => r.h2, "SAME")).padStart(2)}` +
        `                ${String(leak((r) => r.h2)).padStart(2)}                    ${confl((r) => r.h2Blockers)}`,
    );

    console.log("\n════════ 🔴 신규 둘의 축별 변화 ════════");
    for (const r of rows.filter((x) => x.human === "SAME?")) {
      console.log(`  ── ${r.label} ──`);
      console.log(`    og:title = ${JSON.stringify((r.ogTitle ?? "").slice(0, 80))}`);
      console.log(`    후보 coreTitleTokens = ${JSON.stringify(r.facts.coreTitleTokens)}`);
      console.log(`    base   ${r.base.padEnd(15)} blockers=${JSON.stringify(r.baseBlockers)}`);
      console.log(`    H1     ${r.h1.padEnd(15)} blockers=${JSON.stringify(r.h1Blockers)}`);
      console.log(`    H2     ${r.h2.padEnd(15)} blockers=${JSON.stringify(r.h2Blockers)} · 복구된 brand=${JSON.stringify(r.viaAlias)}`);
      console.log(`    H3     market ${r.market} → (등록부에 있다면) **${r.marketCf}** · currency=${r.currency}`);
      console.log(`    🔴 축 수 — base ${r.baseAxes} · H1 ${r.h1Axes} · H2 **${r.h2Axes}** (SAME 에 필요한 수를 못 채우면 blocker 0 이어도 SAME 이 아니다)`);
      console.log(`    🔴 base axes = ${JSON.stringify(r.baseAxisNames)}`);
    }

    /**
     * 🔴🔴 **H-3 leakage — market 축은 «다른 fixture» 에서 본다.**
     *    `isRegisteredDomesticShop: true` 는 「등록부에 넣었다면」이고, 그 변화가
     *    **외화 후보** 에 어떤 영향을 주는지가 그 축의 위험이다(WU-020 ④ 충돌 규칙).
     */
    console.log("\n════════ 🔴 H-3 MARKET leakage(외화 후보에 등록부를 세우면) ════════");
    const foreign = rows.filter((r) => r.currency && r.currency !== "KRW");
    for (const r of foreign) {
      console.log(
        `  ${r.label.padEnd(26)} ${r.currency} · base ${r.market} → CF **${r.marketCf}**` +
          `${r.marketCf === "KR" ? "  🔴🔴 외화가 국내로 들어온다" : "  🟢 충돌로 막힌다"}`,
      );
    }
    console.log(`  (외화 후보 ${foreign.length}건 · KRW 후보 ${rows.length - foreign.length}건)`);

    console.log("\n  🔴 세 축을 **동시에 열지 않았다** · 운영 코드/계약 변경 **0** · 조합 실험 **0**.");
    expect(rows.length).toBeGreaterThan(0);
  }, 1_800_000);
});
