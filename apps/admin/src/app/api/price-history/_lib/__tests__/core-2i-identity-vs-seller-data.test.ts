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
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2I — **상품 Identity ↔ 판매처 관리정보 분리 검증**(측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「**동일상품 판정에 사용해야 하는 값과, 판매처가 자체적으로
 * 관리할 수 있어 동일상품 식별 재료로 사용하면 안 되는 값을 제대로 분리하고 있는가?**」
 *
 * 🔴 **운영 코드 변경 0** — WU-164/CORE-2H 방식(운영 함수 + **입력** counterfactual).
 * 🔴 threshold 변경 0 · SKU/카테고리/옵션 승격 0 · 가격/시장 축 사용 0 · synonym 0.
 *
 * ── 🟢 이 하니스가 «측정하는» 것 ─────────────────────────────────────────────
 * ```
 * ① 축 전수 — 운영이 세는 축과 점수(코드에서 읽는다 · 지어내지 않는다)
 * ② Brand + Product Code 의 **실제 판정** (B226AC009 · 국내 둘 + GT 전건)
 * ③ 🔴 품번 칸이 **비어 있는가** — 「축이 모자라다」와 「품번을 못 읽는다」는 다른 문제다
 * ④ CF-ID 반사실 — **그 페이지에 적힌 품번** 을 Identity 칸에 넣으면 판정이 바뀌는가
 * ⑤ 🔴 Negative — 같은 브랜드 **다른 품번** 이 SAME 으로 새지 않는가
 * ⑥ 🔴 Conflict — 품번 충돌 방어가 작동하는가
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const MINI = "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1";
const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";

/** 🟢 원상품 품번 — 🔴 지어낸 값이 아니라 조사 대상 그 자체다. */
const ORIGIN_CODE = "B226AC009";
/** 🔴 Negative 용 **다른 상품의 실제 품번** — 같은 브랜드·같은 시즌(AC) 라인. */
const OTHER_CODES = ["B226AC010", "B226AC117", "B226AC042"];

interface GtRow {
  url: string;
  domain: string;
  originCode: string;
  verdict: string;
}

function ogTitleOf(html: string): string | null {
  const m = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(html);
  return m ? m[1] : null;
}

/** 🔴 한 축씩 — 다른 칸은 **baseline 그대로** 다. */
function withCode(facts: ProductFacts, code: string | null): ProductFacts {
  return { ...facts, brandModelCode: code } as ProductFacts;
}

describe("CORE-2I — Identity / Seller-managed 분리 검증 (운영 변경 0)", () => {
  /**
   * ── A. 축 전수와 «점수» — 운영 코드에서 읽는다 ───────────────────────────
   *
   * 🔴 임의로 항목을 추가하지 않는다(CPO §5) — 소스의 `axes.push` 자리를 센다.
   */
  it("A — SAME 축 전수·점수·Layer 분류가 소스와 일치한다", () => {
    const src = readFileSync(
      path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
      "utf8",
    );
    /** 🔴 주석을 벗긴다(여덟 번 걸린 함정). */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

    const pushes = [...code.matchAll(/axes\.push\(\{\s*axis:\s*"([A-Z_]+)",\s*points:\s*([A-Z_]+|\d+)/g)].map(
      (m) => ({ axis: m[1], points: m[2] }),
    );
    const distinct = [...new Set(pushes.map((p) => p.axis))].sort();

    console.log("\n═══ A. 운영이 세는 축 전수(소스 `axes.push` · 주석 제거 후) ═══");
    for (const p of pushes) console.log(`    ${p.axis.padEnd(12)} points=${p.points}`);
    console.log(`\n  고유 축 **${distinct.length}** = ${JSON.stringify(distinct)}`);

    /**
     * 🔴 축 이름을 하드코딩해 잠근다 — 새 축이 생기면 이 단언이 FAIL 로 알려준다.
     *
     * 🔴🔴 **1차에 내 단언이 틀렸고 코드가 맞았다** — `SIZE` 를 목록에서 빼고 「조건부
     *    경로라서 안 잡힌다」고 가정했는데 실제로는 `axes.push` 로 **똑같이 올라간다**.
     *    ⟹ 고유 축은 8 이 아니라 **9** 다. 가정이 아니라 실행이 분모를 확정했다.
     */
    expect(distinct).toEqual([
      "AUDIENCE",
      "CATEGORY",
      "COLOR",
      "FIT",
      "IMAGE",
      "MATERIAL",
      "MODEL_CODE",
      "SIZE",
      "TITLE",
    ]);

    /** 🟢 품번 점수가 **혼자서 5에 못 닿는다** — 설계된 의도다(소스 주석이 그렇게 적는다). */
    expect(code).toContain("const IDENTIFIER_AXIS_POINTS = 3");
    expect(code).toContain("const SAME_MIN_AXES = 5");
    expect(code).toContain("const PRESUMED_SAME_MIN_AXES = 3");
    console.log("\n  🔴🔴 IDENTIFIER_AXIS_POINTS=3 < SAME_MIN_AXES=5 ⟹ **품번 단독으로 SAME 이 될 수 없다**");
    console.log("  🟢 그러나 `match-truth.ts` 에 **축 수를 건너뛰는 식별자 경로가 «이미» 있다**(아래 D).");

    /**
     * 🔴🔴 **Seller-managed 데이터가 SAME 축에 들어가 있는가** — CPO §6 의 핵심 질문.
     *    소스에서 가격·SKU·시장·URL·옵션이 축으로 push 되는지 **직접** 본다.
     */
    for (const forbidden of ['axis: "PRICE"', 'axis: "SKU"', 'axis: "MARKET"', 'axis: "URL"', 'axis: "OPTION"']) {
      expect(code, `🔴 ${forbidden} 가 SAME 축에 있으면 구조적 설계 오류다`).not.toContain(forbidden);
    }
    console.log("  🟢 PRICE · SKU · MARKET · URL · OPTION 은 SAME 축에 **없다**(소스 전수).");
  });

  /**
   * ── B. 품번 표기 정규화 — CPO §8 ────────────────────────────────────────
   *
   * 🔴 「무조건 문자열 제거」로 정규화하지 않는다. **기존 로직이 무엇을 하는지** 를 잰다.
   */
  it("B — 사이트별 품번 표기를 기존 로직이 어떻게 보는가", () => {
    const forms = ["B226AC009", "#226AC009", "226AC009", "B-226AC009", "B 226AC009", "b226ac009"];
    console.log("\n═══ B. 품번 표기 변형 × 기존 `compareModelCode`(운영 함수) ═══");
    const got: Record<string, string> = {};
    for (const f of forms) {
      const out = compareModelCode(ORIGIN_CODE, f);
      got[f] = out;
      console.log(`    ${ORIGIN_CODE} ↔ ${f.padEnd(12)} → **${out}**`);
    }
    /** 🟢 기존 정규화가 이미 흡수하는 것 — 기호/공백/대소문자. */
    expect(got["B-226AC009"]).toBe("exact");
    expect(got["B 226AC009"]).toBe("exact");
    expect(got["b226ac009"]).toBe("exact");
    /** 🔴🔴 선행 `B` 가 없는 꼴은 **exact 가 아니다** — `partial` 이다. */
    expect(got["#226AC009"]).toBe("partial");
    expect(got["226AC009"]).toBe("partial");
    console.log("\n  🔴🔴 선행 영문자가 빠진 꼴(`#226AC009`)은 **partial** 이고 exact 가 **아니다**.");
    console.log("     ⟹ 축 점수가 3 이 아니라 **2** 이고, 식별자 경로(`modelCode==='exact'`)에 **닿지 않는다**.");

    /** 🔴 Negative — 같은 브랜드 **다른 품번** 은 반드시 exact 가 아니어야 한다. */
    console.log("\n  🔴 같은 브랜드 다른 품번(Negative):");
    for (const other of OTHER_CODES) {
      const out = compareModelCode(ORIGIN_CODE, other);
      console.log(`    ${ORIGIN_CODE} ↔ ${other} → **${out}**`);
      expect(out, "🔴 다른 품번이 exact 가 되면 Identity 축이 누출된다").not.toBe("exact");
      expect(out, "🔴 같은 코드체계 다른 상품은 conflict 여야 한다").toBe("conflict");
    }
    console.log("  🟢🟢 **같은 접두사 뒤가 갈리면 `conflict`** — 품번 보호가 작동한다.");
  });

  /**
   * ── C/D/E. 실제 사례 재검증 + CF-ID 반사실 ──────────────────────────────
   */
  it("C — B226AC009 실제 후보에서 Identity 칸과 판정을 분리해 잰다", async () => {
    /* ── 원상품 ─────────────────────────────────────────────────────────── */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    /** 🔴 brand 복구가 **간헐적으로** 실패한다(메모 `origin-brand-recovery-fails-intermittently`). */
    if (!dna.brand.value) {
      const html = await fetchPlainHtml(ORIGIN);
      const site = html ? extractSiteBrandName(html) : null;
      if (site?.value) {
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
    expect(dna.brand.value, "🔴 brand 가 비면 전건 BRAND_UNCONFIRMED 가 되어 측정이 열화된다").toBeTruthy();

    console.log("\n═══ C. 원상품 Identity ═══");
    console.log(`    brand          = ${JSON.stringify(dna.brand.value)}`);
    console.log(`    brandModelCode = ${JSON.stringify(dna.brandModelCode)}   ← 🔴 Layer A`);
    console.log(`    coreTitleTokens= ${JSON.stringify(originFacts.coreTitleTokens)}   ← Layer B`);

    /* ── 측정 대상 = GT 전건 + 국내 둘 ─────────────────────────────────── */
    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const targets = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "miniboutique.co.kr", url: MINI, human: "SAME?" },
      { label: "donokids.com", url: DONO, human: "SAME?" },
    ];
    console.log(
      `\n  분모 = GT ${gtRows.length}(SAME ${gtRows.filter((r) => r.verdict === "SAME").length} ·` +
        ` DIFFERENT ${gtRows.filter((r) => r.verdict === "DIFFERENT").length}) + 국내 신규 2`,
    );
    console.log("  🔴 국내 둘의 human 라벨은 **없다** — `SAME?`(CTO 가 판정하지 않는다).");

    interface Row {
      label: string;
      human: string;
      candCode: string | null;
      codeOutcome: string;
      pageCode: string | null;
      baseVerdict: string;
      baseAxes: string[];
      /**
       * 🔴 **타입을 추측하지 않는다** — `blockers` 는 `string[]` 이 아니라
       *    `{ blocker, detail }[]` 다(🟢 typecheck 가 사전에 잡았다 · 이 트랙 15번째).
       */
      baseBlockers: { blocker: string; detail: string }[];
      baseTruth: string;
      cfVerdict: string;
      cfAxes: string[];
      cfTruth: string;
      negVerdict: string;
      negTruth: string;
    }
    const rows: Row[] = [];

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`    ${t.label.padEnd(24)} 🔴 ${f.status} — 분모에서 제외(측정불가)`);
        continue;
      }
      const facts = f.candidate.facts;

      /**
       * 🟢 **그 페이지가 실제로 적은 품번** 을 찾는다 — 🔴 지어내지 않는다.
       *    원상품 품번의 **관측된 두 꼴**(원형 · 선행 영문자 제거)만 본다(CORE-2G 와 같은 기준).
       */
      let pageCode: string | null = null;
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        const html = await res.text();
        const hay = html.toLowerCase();
        const bare = ORIGIN_CODE.replace(/^[A-Za-z]/, "");
        if (hay.includes(ORIGIN_CODE.toLowerCase())) pageCode = ORIGIN_CODE;
        else if (hay.includes(bare.toLowerCase())) pageCode = bare;
        /** 🟢 og:title 을 같이 적는다 — 「그 페이지가 무엇을 말하는가」의 증거다. */
        const og = ogTitleOf(html);
        if (t.label.includes("miniboutique") || t.label.includes("donokids")) {
          console.log(`\n    ── ${t.label} og:title = ${JSON.stringify(og)}`);
          console.log(`       페이지에서 찾은 품번 = ${JSON.stringify(pageCode)}`);
        }
      } catch {
        pageCode = null;
      }

      /* ── baseline ─────────────────────────────────────────────── */
      const base = compareCrossSellerProducts(originFacts, facts);
      const codeOutcome = compareModelCode(originFacts.brandModelCode ?? null, facts.brandModelCode ?? null);
      /** 🔴 `level` 은 **low** 로 고정한다 — 그래야 「식별자 경로가 혼자 EXACT 를 만드는가」만 본다. */
      const baseTruth = deriveMatchTruth("low", codeOutcome, base.verdict, base.blockers);

      /**
       * ── CF-ID 반사실 — **그 페이지에 적힌 품번** 을 Identity 칸에 넣는다 ──
       * 🔴 **입력만** 바꾼다(운영 코드 0) · 🔴 없으면 넣지 않는다(「모르면 채우지 않는다」).
       */
      const cfFacts = pageCode ? withCode(facts, pageCode) : facts;
      const cf = compareCrossSellerProducts(originFacts, cfFacts);
      const cfOutcome = compareModelCode(originFacts.brandModelCode ?? null, cfFacts.brandModelCode ?? null);
      const cfTruth = deriveMatchTruth("low", cfOutcome, cf.verdict, cf.blockers);

      /**
       * ── 🔴 Negative(Conflicting Identity) — **같은 브랜드 다른 품번** ──
       *    CF-ID 와 **완전히 같은 입력** 에 품번만 다른 상품 것으로 바꾼다.
       *    🔴 이것이 SAME/EXACT 로 올라가면 Identity 축이 누출된다는 직접 증거다.
       */
      const negFacts = withCode(facts, OTHER_CODES[0]);
      const neg = compareCrossSellerProducts(originFacts, negFacts);
      const negOutcome = compareModelCode(originFacts.brandModelCode ?? null, OTHER_CODES[0]);
      const negTruth = deriveMatchTruth("low", negOutcome, neg.verdict, neg.blockers);

      rows.push({
        label: t.label,
        human: t.human,
        candCode: facts.brandModelCode ?? null,
        codeOutcome,
        pageCode,
        baseVerdict: base.verdict,
        baseAxes: base.axes.map((a) => a.axis),
        baseBlockers: [...base.blockers],
        baseTruth: String(baseTruth),
        cfVerdict: cf.verdict,
        cfAxes: cf.axes.map((a) => a.axis),
        cfTruth: String(cfTruth),
        negVerdict: neg.verdict,
        negTruth: String(negTruth),
      });
    }

    expect(rows.length, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);

    /* ── 표 ─────────────────────────────────────────────────────────────── */
    console.log("\n═══ D. 후보별 Identity 칸 ↔ 판정 ═══");
    console.log(
      "    판매처                  human     품번칸        code      base            CF-ID            NEG(다른품번)",
    );
    for (const r of rows) {
      console.log(
        `    ${r.label.padEnd(22)} ${r.human.padEnd(9)} ${String(r.candCode).padEnd(13)} ` +
          `${r.codeOutcome.padEnd(9)} ${`${r.baseVerdict}/${r.baseTruth}`.padEnd(15)} ` +
          `${`${r.cfVerdict}/${r.cfTruth}`.padEnd(16)} ${r.negVerdict}/${r.negTruth}`,
      );
    }

    /* ── 🔴 품번 칸이 비어 있는 비율 ──────────────────────────────────── */
    const noCode = rows.filter((r) => !r.candCode);
    const hasPageCode = rows.filter((r) => r.pageCode);
    const emptyButOnPage = rows.filter((r) => !r.candCode && r.pageCode);
    console.log("\n═══ E. 🔴🔴 Identity 칸 공백 — 「축이 모자라다」와 다른 문제다 ═══");
    console.log(`    품번 칸이 **비어 있는** 후보        **${noCode.length} / ${rows.length}**`);
    console.log(`    그런데 **페이지에는 품번이 있는** 후보  **${hasPageCode.length} / ${rows.length}**`);
    console.log(`    🔴 **둘 다** 인 후보(= 읽을 수 있는데 안 읽는다)  **${emptyButOnPage.length}**`);
    for (const r of emptyButOnPage) console.log(`        · ${r.label} — 페이지 품번 ${r.pageCode}`);

    /* ── KPI (CPO §11) ───────────────────────────────────────────────── */
    const humanSame = rows.filter((r) => r.human === "SAME");
    const humanDiff = rows.filter((r) => r.human === "DIFFERENT");
    const baseSame = (rs: Row[]) => rs.filter((r) => r.baseVerdict === "SAME").length;
    const cfSame = (rs: Row[]) => rs.filter((r) => r.cfVerdict === "SAME").length;
    const truthExact = (rs: Row[], k: "baseTruth" | "cfTruth" | "negTruth") =>
      rs.filter((r) => r[k] === "EXACT_IDENTIFIER" || r[k] === "STRONG_IDENTIFIER").length;

    console.log("\n═══ F. KPI (CPO §11) ═══");
    console.log(`    Strong Identity SAME Recall      base ${baseSame(humanSame)}/${humanSame.length} → CF-ID ${cfSame(humanSame)}/${humanSame.length}`);
    console.log(`    🔴 Different-Code Leakage         NEG 에서 SAME = **${rows.filter((r) => r.negVerdict === "SAME").length} / ${rows.length}**`);
    console.log(`    🔴 Existing Negative Leakage      human DIFFERENT 가 CF-ID 에서 SAME = **${cfSame(humanDiff)} / ${humanDiff.length}**`);
    console.log(`    Conflict Protection               NEG 에서 식별자 등급 = **${truthExact(rows, "negTruth")} / ${rows.length}**(0 이어야 한다)`);
    console.log(`    식별자 등급(base)                 ${truthExact(rows, "baseTruth")}/${rows.length} → CF-ID ${truthExact(rows, "cfTruth")}/${rows.length}`);
    console.log(`    Unknown/Uncertain(base)           ${rows.filter((r) => r.baseVerdict === "UNKNOWN" || r.baseVerdict === "SIMILAR").length}/${rows.length}`);

    /** 🔴🔴 **가장 중요한 단언** — 같은 브랜드 다른 품번이 SAME 이나 식별자 등급이 되면 FAIL. */
    expect(rows.filter((r) => r.negVerdict === "SAME").length, "🔴 다른 품번이 SAME 으로 누출된다").toBe(0);
    expect(truthExact(rows, "negTruth"), "🔴 다른 품번이 식별자 등급(EXACT/STRONG)으로 누출된다").toBe(0);
    /** 🔴 기존 negative fixture 가 CF-ID 에서도 지켜지는가. */
    expect(cfSame(humanDiff), "🔴 기존 human DIFFERENT 가 CF-ID 로 SAME 이 되면 순손실이다").toBe(0);

    /**
     * ── 🔴🔴 그런데 «SAME 이 아니다」로 끝내지 않는다 ─────────────────────
     *
     * CF-ID 가 `m.luxboy.com`(**human DIFFERENT**)을 `SIMILAR` → **`PRESUMED_SAME`**
     * 으로 올렸다. SAME 은 아니지만 matchTruth 가 **`TEXT_CONFIRMED`** 이고 그 등급은
     * `priceTierFromLink` 에서 **COMPARISON(가격 참고)** 이다 ⟹ 🔴 **그 금액이 국내
     * 가격 축에 들어갈 수 있다**(WU-138 이 KRW 59,000 유입으로 측정한 그 모양).
     * 🔴 그래서 「leakage 0」으로 적지 않는다 — **등급을 갈라** 센다.
     */
    const cfPresumedFromDiff = humanDiff.filter(
      (r) => r.baseVerdict !== "PRESUMED_SAME" && r.cfVerdict === "PRESUMED_SAME",
    );
    console.log(
      `\n  🔴🔴 **등급을 갈라 센 leakage** — human DIFFERENT 가 CF-ID 로 **PRESUMED_SAME(=가격 참고)**` +
        ` 으로 올라간 건 **${cfPresumedFromDiff.length} / ${humanDiff.length}**`,
    );
    for (const r of cfPresumedFromDiff) {
      console.log(`      · ${r.label} — ${r.baseVerdict}/${r.baseTruth} → ${r.cfVerdict}/${r.cfTruth}`);
    }
    console.log("  🔴 ⟹ 「SAME 누출 0」만 적으면 이 유입을 숨긴다(CPO §11 의 Different-Code Leakage 와 다른 축).");
  }, 900000);

  /**
   * ── G. 🔴🔴 **Layer C 오염** 과 **Brand+Code 동시 보유** — CPO §16 ───────
   *
   * §16 성공 기준 두 조건을 **같이** 잰다:
   *   ⒜ 강한 식별자(브랜드+품번)가 **약한 사이트별 정보에 의해 무력화되지 않는가**
   *   ⒝ 같은 브랜드 **다른 품번** 이 SAME 으로 새지 않는가
   *
   * 🔴 입력만 바꾼다(운영 코드 0) · 🔴 CTO 가 축을 열지 않는다 — **측정만** 한다.
   */
  it("G — Layer C 오염 제거 / Brand+Code 동시 보유 반사실", async () => {
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData).toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const html = await fetchPlainHtml(ORIGIN);
      const site = html ? extractSiteBrandName(html) : null;
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

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const targets = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "donokids.com", url: DONO, human: "SAME?" },
      { label: "miniboutique.co.kr", url: MINI, human: "SAME?" },
    ];

    console.log("\n═══ G. Layer C 오염 제거 · Brand+Code 동시 보유 ═══");
    console.log(
      "    판매처                  human     base                 CF-C(오염제거)        CF-BOTH(brand+code)   NEG-BOTH",
    );

    let pollutedCount = 0;
    let cleanRecovered = 0;
    let bothSame = 0;
    let bothSameHumanDiff = 0;
    let negBothSame = 0;
    let measured = 0;
    /**
     * 🔴🔴 CPO §14-D — **「Product Code 기반 SAME 을 별도 Strong Identity 경로로
     *    만들면 안전한가」** 를 이 분모에서 직접 잰다.
     *
     * 식별자 등급(`EXACT_IDENTIFIER`/`STRONG_IDENTIFIER`)은 `priceTierFromLink` 에서
     * **EXACT = 동일상품 가격** 이다 ⟹ human DIFFERENT 가 거기 닿으면 **틀린 가격** 이
     * 셀러 화면의 「동일상품 가격」이 된다.
     */
    let identHumanDiff = 0;
    /** 🔴 **등급을 갈라** 센다 — PRESUMED_SAME(=가격 «참고») 유입은 SAME 누출과 다른 축이다. */
    let presumedHumanDiff = 0;

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — 측정불가`);
        continue;
      }
      measured += 1;
      const facts = f.candidate.facts;

      /** 🟢 그 페이지가 적은 품번(관측된 두 꼴만) · 🔴 지어내지 않는다. */
      let pageCode: string | null = null;
      let pageHtml = "";
      try {
        const res = await fetch(t.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        pageHtml = await res.text();
        const hay = pageHtml.toLowerCase();
        const bare = ORIGIN_CODE.replace(/^[A-Za-z]/, "");
        if (hay.includes(ORIGIN_CODE.toLowerCase())) pageCode = ORIGIN_CODE;
        else if (hay.includes(bare.toLowerCase())) pageCode = bare;
      } catch {
        pageCode = null;
      }

      const base = compareCrossSellerProducts(originFacts, facts);
      const baseOut = compareModelCode(originFacts.brandModelCode ?? null, facts.brandModelCode ?? null);
      const baseTruth = String(deriveMatchTruth("low", baseOut, base.verdict, base.blockers));

      /**
       * ── CF-C — 🔴 **Layer C 오염 제거**: 품번 칸의 값이 **원상품 품번과 접두사를
       *    공유하지 않으면**(= 판매처 자체 SKU 거나 다른 라인) 그 칸을 **비운다**.
       * 🟢 「모른다」로 되돌리는 것이고 **값을 지어내지 않는다**.
       * 🔴 이것은 CPO §2 의 「SKU 가 다르다 ≠ 다른 상품」을 **입력에서** 재현한 것이다.
       */
      const candCode = facts.brandModelCode ?? null;
      const polluted = candCode != null && baseOut === "conflict" && pageCode != null;
      const pollutedAny = candCode != null && baseOut === "conflict";
      if (pollutedAny) pollutedCount += 1;
      const cfCFacts = pollutedAny ? withCode(facts, null) : facts;
      const cfC = compareCrossSellerProducts(originFacts, cfCFacts);
      const cfCOut = compareModelCode(originFacts.brandModelCode ?? null, cfCFacts.brandModelCode ?? null);
      const cfCTruth = String(deriveMatchTruth("low", cfCOut, cfC.verdict, cfC.blockers));
      if (pollutedAny && cfC.verdict !== "CONFLICT") cleanRecovered += 1;

      /**
       * ── CF-BOTH — 🟢 **브랜드 + 품번을 «둘 다»** Identity 칸에 넣는다.
       * 🔴 브랜드는 **그 페이지의 말** 에서만 복구한다(`brand-alias` 운영 함수 · CORE-2H 와 같다).
       * 🔴 품번은 **그 페이지에 적힌 꼴** 만 쓴다.
       */
      const titleForAlias =
        ogTitleOf(pageHtml) ||
        facts.title ||
        (facts.coreTitleTokens ?? []).join(" ");
      const viaAlias = facts.brand ? null : lookupBrandByAliasInTitle(titleForAlias ?? "");
      const bothFacts = withCode(
        { ...facts, brand: facts.brand ?? viaAlias ?? undefined } as ProductFacts,
        pageCode ?? (pollutedAny ? null : candCode),
      );
      const both = compareCrossSellerProducts(originFacts, bothFacts);
      const bothOut = compareModelCode(originFacts.brandModelCode ?? null, bothFacts.brandModelCode ?? null);
      const bothTruth = String(deriveMatchTruth("low", bothOut, both.verdict, both.blockers));
      if (both.verdict === "SAME") {
        bothSame += 1;
        if (t.human === "DIFFERENT") bothSameHumanDiff += 1;
      }
      if (t.human === "DIFFERENT") {
        if (bothTruth === "EXACT_IDENTIFIER" || bothTruth === "STRONG_IDENTIFIER") identHumanDiff += 1;
        if (both.verdict === "PRESUMED_SAME" && base.verdict !== "PRESUMED_SAME") presumedHumanDiff += 1;
        /**
         * 🔴🔴 **무엇이 막는지 찍는다** — 1차 M3(식별자 게이트에서 `crossSellerReserved`
         *    제거)가 **통과** 했고, 그 이유를 추측하지 않기 위해 넣었다.
         *    「가드가 하중을 안 진다」와 「그 후보가 애초에 그 분기에 도달하지 않는다」는
         *    **완전히 다른 결론** 이다(이 트랙에서 네 번 틀린 자리).
         */
        console.log(
          `        🔎 ${t.label} human DIFFERENT 진단 — pageCode=${JSON.stringify(pageCode)} ·` +
            ` CF-BOTH code=${JSON.stringify(bothFacts.brandModelCode)} · compareModelCode=${bothOut} ·` +
            ` blockers=${JSON.stringify([...both.blockers])} · conflicts=${JSON.stringify(Object.keys(both.conflicts ?? {}))}`,
        );
      }

      /**
       * ── 🔴 NEG-BOTH — CF-BOTH 와 **완전히 같은 입력** 에 품번만 **다른 상품** 것.
       *    🔴 여기서 SAME 이 나오면 「브랜드+품번 경로」가 누출된다는 직접 증거다.
       */
      const negBoth = compareCrossSellerProducts(originFacts, withCode(bothFacts, OTHER_CODES[0]));
      const negBothOut = compareModelCode(originFacts.brandModelCode ?? null, OTHER_CODES[0]);
      const negBothTruth = String(deriveMatchTruth("low", negBothOut, negBoth.verdict, negBoth.blockers));
      if (negBoth.verdict === "SAME") negBothSame += 1;

      console.log(
        `    ${t.label.padEnd(22)} ${t.human.padEnd(9)} ${`${base.verdict}/${baseTruth}`.padEnd(20)} ` +
          `${`${cfC.verdict}/${cfCTruth}`.padEnd(21)} ${`${both.verdict}/${bothTruth}`.padEnd(21)} ` +
          `${negBoth.verdict}/${negBothTruth}` +
          (polluted ? "   🔴 Layer C 오염" : ""),
      );
      if (both.verdict === "SAME" && base.verdict !== "SAME") {
        console.log(
          `        🟢 **회복** ${base.verdict} → SAME · 축 ${JSON.stringify(both.axes.map((a) => a.axis))}` +
            ` · blockers ${JSON.stringify([...both.blockers])} · brand ${JSON.stringify(bothFacts.brand)}` +
            ` · code ${JSON.stringify(bothFacts.brandModelCode)}`,
        );
      }
    }

    console.log("\n═══ H. 결론 숫자 ═══");
    console.log(`    측정된 후보                         **${measured}**`);
    console.log(`    🔴 품번 칸이 **conflict 값** 인 후보   **${pollutedCount}**(= Layer C/다른라인 오염)`);
    console.log(`    🟢 오염을 비웠을 때 CONFLICT 탈출     **${cleanRecovered} / ${pollutedCount}**`);
    console.log(`    🟢 CF-BOTH 에서 SAME                 **${bothSame}**`);
    console.log(`    🔴 그중 human DIFFERENT              **${bothSameHumanDiff}**(0 이어야 한다)`);
    console.log(`    🔴 NEG-BOTH 에서 SAME                **${negBothSame} / ${measured}**(0 이어야 한다)`);
    console.log(
      `    🔴🔴 human DIFFERENT 가 **식별자 등급**(=동일상품 가격)에 닿은 건  **${identHumanDiff}**(0 이어야 한다)`,
    );
    console.log(
      `    🔴 human DIFFERENT 가 **PRESUMED_SAME(=가격 참고)** 으로 «새로» 올라간 건  **${presumedHumanDiff}**`,
    );
    console.log("       🔴 위 두 줄은 **다른 축** 이다 — 「SAME 누출 0」만 적으면 아래 줄을 숨긴다.");

    /** 🔴🔴 **누출 방어가 이 WU 의 PASS 조건이다**(CPO §16 두 번째 조건). */
    expect(negBothSame, "🔴 브랜드+품번을 둘 다 넣어도 «다른 품번» 은 SAME 이 되면 안 된다").toBe(0);
    expect(bothSameHumanDiff, "🔴 human DIFFERENT 가 CF-BOTH 로 SAME 이 되면 순손실이다").toBe(0);
    /** 🔴🔴 CPO §14-D 의 안전성 단언 — 이것이 깨지면 **틀린 가격이 「동일상품 가격」이 된다**. */
    expect(identHumanDiff, "🔴 human DIFFERENT 가 식별자 등급(=EXACT tier)에 닿으면 안 된다").toBe(0);
  }, 900000);
});
