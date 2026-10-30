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
import { extractCodeLikeSlugSegment } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2K — **seller SKU → brandModelCode 오염 제거**(운영 1줄)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 결정(2026-10-24) — 「**seller SKU 가 `brandModelCode` 에 들어간 경우에만**
 * 제거한다. 제거 결과는 `UNKNOWN(null)` 이다. **다른 상품의 공식 품번으로 보이는
 * 값은 제거하지 않는다** — `conflict` 는 정상적인 안전장치다.」
 *
 * 🔴 변경 **0** — `SAME_MIN_AXES` · threshold · CATEGORY · TITLE · COLOR ·
 *    code normalization · `partial → exact` · `crossSellerReserved` ·
 *    `NO_TITLE_OVERLAP` · `EXACT_IDENTIFIER` 승격조건 · MI verdict · 검색 ·
 *    Adapter · Gemini/OpenAI/Naver · **데이터 모델 확장** ·
 *    `confirmBrandCodeInEvidence` · `withConfidence` **호출 순서**.
 * 🔴 `226AC009 → B226AC009` 선행문자 보정 **없음**(CPO 재확인 금지).
 *
 * ── 🟢 수정은 한 줄이고 «새 정책이 아니다» ──────────────────────────────────
 * ```
 * `extractCodeLikeSlugSegment` 가 **숫자로 시작하는 첫 조각을 거부** 한다.
 * 🟢 그 함수 주석이 **원래 그것을 약속** 하고 있었다(「판매처 재고번호가 여기
 *    걸리지 않는다」) — 그 약속이 `kids21 700005621lbl` 로 깨져 있었다.
 * 🟢 판별축도 **WU-071 이 이미 측정** 했다(진짜 품번 전부 글자 시작 · 샵 SKU 전부
 *    숫자 시작 · N=13 · 잃는 것 0).
 * ```
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const MINI = "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1";
const DONO = "https://www.donokids.com/shop/shopdetail.html?branduid=3362785";
const ORIGIN_CODE = "B226AC009";

interface GtRow {
  url: string;
  domain: string;
  originCode: string;
  verdict: string;
}

describe("CORE-2K — seller SKU 오염 제거 (운영 1줄)", () => {
  /**
   * ── A. 판별기 단위 — 🔴 Positive 와 Negative 를 «같은 자리» 에서 본다 ─────
   */
  it("A — 숫자로 시작하는 첫 조각만 거부한다(공식 품번은 유지)", () => {
    console.log("\n═══ A. `extractCodeLikeSlugSegment` 판별 ═══");
    const cases: { label: string; slug: string; expect: string | null }[] = [
      /** 🔴 **제거 대상** — kids21 실측 판매처 SKU. */
      { label: "🔴 kids21 판매처 SKU", slug: "700005621lbl", expect: null },
      /** 🟢 **유지 대상** — 공식 품번(브랜드 코드로 시작). */
      { label: "🟢 공식 품번(원상품)", slug: "b226ac009-hug-hairy-monster-t-shirt", expect: "B226AC009" },
      { label: "🟢 공식 품번(다른상품)", slug: "b226ab040-booty-ghosts-t-shirt", expect: "B226AB040" },
      { label: "🟢 공식 품번(주석 실측)", slug: "b226ac114-bobo-choses-bolder-half-zipped-sweatshirt", expect: "B226AC114" },
      /** 🟢 **기존 가드가 그대로** — 숫자만 · 글자만 · 길이. */
      { label: "숫자만(상품번호)", slug: "430701", expect: null },
      { label: "글자만", slug: "bobo-choses-t-shirt", expect: null },
      { label: "너무 짧다", slug: "b22a1", expect: null },
    ];
    for (const c of cases) {
      const got = extractCodeLikeSlugSegment(c.slug);
      console.log(`    ${c.label.padEnd(24)} ${c.slug.padEnd(46)} → ${JSON.stringify(got)}`);
      expect(got, c.label).toBe(c.expect);
    }

    /**
     * 🔴🔴 **그리고 제거의 «효과» 를 같은 테스트에서 단언한다** — 값이 null 이 되면
     *    `compareModelCode` 가 **`unavailable`** 이고 **가짜 conflict 가 사라진다**.
     * 🟢 반대로 「다른 상품 공식 품번」은 **conflict 가 유지** 되어야 한다(CPO 명시).
     */
    expect(compareModelCode(ORIGIN_CODE, extractCodeLikeSlugSegment("700005621lbl"))).toBe("unavailable");
    expect(compareModelCode(ORIGIN_CODE, extractCodeLikeSlugSegment("b226ab040-booty-ghosts-t-shirt"))).toBe("conflict");
    console.log("\n    🟢 판매처 SKU → **unavailable**(가짜 conflict 제거)");
    console.log("    🟢 다른 상품 공식 품번 → **conflict 유지**(정상 안전장치 · CPO 명시)");

    /** 🔴 정규화를 바꾸지 않았다는 것을 **같은 자리** 에서 잠근다. */
    expect(compareModelCode(ORIGIN_CODE, "226AC009")).toBe("partial");
    expect(compareModelCode(ORIGIN_CODE, "#226AC009")).toBe("partial");
    console.log("    🔴 `226AC009` 는 여전히 **partial** — 선행문자 보정 **0**(CPO 금지 준수)");
  });

  /**
   * ── B. 소스 앵커 — 🔴 배선이 끊기면 FAIL 해야 한다 ──────────────────────
   *
   * 🔴 WU-110 교훈: 판정 함수를 직접 부르는 단언은 **배선을 못 본다**.
   */
  it("B — 가드가 owner 한 곳에 있고 금지 축은 그대로다", () => {
    const root = path.join(__dirname, "../../../../../../../..");
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const pf = strip(readFileSync(path.join(root, "packages/shared/src/product-facts.ts"), "utf8"));
    const cs = strip(readFileSync(path.join(root, "packages/crawler/src/comparison-search/cross-seller.ts"), "utf8"));
    const mc = strip(readFileSync(path.join(root, "packages/crawler/src/comparison-search/model-code.ts"), "utf8"));
    const mt = strip(readFileSync(path.join(root, "packages/crawler/src/comparison-search/match-truth.ts"), "utf8"));

    /** 🟢 가드가 승격기 **안** 에 있다(사본 0). */
    expect(pf, "🔴 숫자 시작 거부 가드가 사라지면 오염이 되돌아온다").toContain('if (/^[0-9]/.test(first)) return null;');
    console.log("\n═══ B. 소스 앵커 ═══");
    console.log("    🟢 가드 owner = `extractCodeLikeSlugSegment` **하나** (사본 0)");

    /** 🔴 금지 축이 **한 글자도** 안 바뀌었다. */
    expect(cs).toContain("const SAME_MIN_AXES = 5");
    expect(cs).toContain("const PRESUMED_SAME_MIN_AXES = 3");
    expect(cs).toContain("const IDENTIFIER_AXIS_POINTS = 3");
    expect(cs).toContain('"NO_TITLE_OVERLAP",');
    expect(mt).toContain("!observedDifference && !crossSellerReserved && !colorUnverified");
    expect(mc).toContain('if (prefix >= PARTIAL_MATCH_MIN_LENGTH) return "conflict";');
    expect(mc).toContain('return code.toUpperCase().replace(/[^A-Z0-9]/g, "");');
    console.log("    🔴 threshold · 8축 · 이중잠금 · 정규화 **전부 불변**(소스 단언)");

    /** 🔴 데이터 모델을 넓히지 않았다 — `ShopifyProductLike` 에 sku 칸 **없음** 유지. */
    const sf = strip(readFileSync(path.join(root, "packages/crawler/src/comparison-search/seller-facts.ts"), "utf8"));
    const shape = /export interface ShopifyProductLike \{[\s\S]*?\n\}/.exec(sf)?.[0] ?? "";
    expect(shape, "🔴 데이터 모델 확장 금지(CPO 명시)").not.toContain("sku");
    console.log("    🔴 `ShopifyProductLike` 에 `sku` 칸 **추가 0**(데이터 모델 확장 금지)");
  });

  /**
   * ── C. 운영 순서 실측 — 🔴 `withConfidence` 를 «실제로» 부른다 ───────────
   */
  it("C — 운영 경로에서 오염/가짜 CONFLICT/누출을 잰다", async () => {
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
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
    /**
     * 🔴🔴 **원상품 품번이 살아 있는지가 이 수정의 최대 위험이다** — 원상품 slug 도
     *    같은 함수를 지난다. 사라지면 **확인 경로의 입력이 사라져 전체가 망가진다**.
     */
    expect(dna.brandModelCode, "🔴🔴 원상품 품번이 이 수정으로 사라지면 즉시 STOP 이다").toBe(ORIGIN_CODE);
    console.log(`\n═══ C. 원상품 품번 **${dna.brandModelCode}** 🟢 살아 있다(수정의 최대 위험 통과) ═══`);

    const gt = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "wu-112-human-gt.json"), "utf8"),
    ) as { candidates: GtRow[] };
    const gtRows = gt.candidates.filter((c) => c.originCode === "B226AC009");
    const targets = [
      ...gtRows.map((r) => ({ label: r.domain, url: r.url, human: r.verdict })),
      { label: "donokids.com", url: DONO, human: "SAME?" },
      { label: "miniboutique.co.kr", url: MINI, human: "SAME?" },
    ];

    let measured = 0;
    let unreachable = 0;
    let pollution = 0;
    let falseConflict = 0;
    let realConflict = 0;
    let humanSameRecovered = 0;
    let diffCodeLeak = 0;
    let negFixtureLeak = 0;
    const verdicts = new Map<string, { verdict: string; truth: string; field: string | null; cmp: string }>();

    console.log("\n    판매처                  human     품번칸        compare       verdict        truth");
    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — **측정불가**(0 으로 세지 않는다)`);
        continue;
      }
      measured += 1;
      const cand = f.candidate;

      const [scored] = withConfidence(
        {
          title: ex!.productData!.title ?? "",
          brand: dna.brand.value || undefined,
          sourceUrl: ORIGIN,
          sku: dna.brandModelCode ?? undefined,
          facts: originFacts,
        } as ComparisonQuery,
        [cand],
      );
      const opFacts = scored?.facts ?? cand.facts!;
      const field = opFacts.brandModelCode ?? null;
      const cmp = compareModelCode(ORIGIN_CODE, field);
      const cross = compareCrossSellerProducts(originFacts, opFacts);
      const truth = String(deriveMatchTruth(scored?.matchLevel ?? "low", cmp, cross.verdict, cross.blockers));
      verdicts.set(t.label, { verdict: cross.verdict, truth, field, cmp });

      /** 🔴 **오염** = 품번 칸에 공식 코드체계와 접두사를 공유하지 «않는» 값이 있다. */
      if (field != null && cmp === "conflict") {
        const sharesPrefix = field.slice(0, 4).toUpperCase() === ORIGIN_CODE.slice(0, 4);
        if (sharesPrefix) realConflict += 1;
        else {
          pollution += 1;
          falseConflict += 1;
        }
      }
      if (t.human === "SAME" && cross.verdict === "SAME") humanSameRecovered += 1;
      if (t.human === "DIFFERENT" && cross.verdict === "SAME") {
        diffCodeLeak += 1;
        negFixtureLeak += 1;
      }

      console.log(
        `    ${t.label.padEnd(22)} ${t.human.padEnd(9)} ${String(field).padEnd(13)} ` +
          `${cmp.padEnd(13)} ${cross.verdict.padEnd(14)} ${truth}`,
      );
    }

    expect(measured, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);

    /* ── CPO §5 가 요구한 6 KPI ──────────────────────────────────────── */
    console.log(`\n═══ D. CPO 6 KPI (분모 **${measured}** · 측정불가 **${unreachable}**) ═══`);
    console.log(`    Seller-SKU pollution           CORE-2J **1** → **${pollution}**`);
    console.log(`    False CONFLICT                 CORE-2J **1** → **${falseConflict}**`);
    console.log(`    Human SAME recovery            CORE-2J **3** → **${humanSameRecovered}**`);
    console.log(`    Different-Code leakage         **${diffCodeLeak}**(0 유지)`);
    console.log(`    Negative fixture leakage       **${negFixtureLeak}**(0 유지)`);

    /* ── CPO 가 요구한 3건 개별 판정 ─────────────────────────────────── */
    console.log("\n═══ E. 개별 판정(CPO 요구) ═══");
    const k = verdicts.get("kids21.com");
    const j = verdicts.get("junioredition.com");
    const l = verdicts.get("m.luxboy.com");

    if (k) {
      console.log(`    🟢 **kids21**        품번칸 ${JSON.stringify(k.field)} · ${k.cmp} · ${k.verdict}/${k.truth}`);
      /** 🔴 Positive — 오염이 사라지고 가짜 CONFLICT 가 제거돼야 한다. */
      expect(k.field, "🔴 판매처 SKU 가 품번 칸에 남아 있으면 FAIL").toBeNull();
      expect(k.cmp, "🔴 제거 결과는 unavailable(UNKNOWN)이다").toBe("unavailable");
      expect(k.verdict, "🔴 가짜 CONFLICT 가 제거돼야 한다").not.toBe("CONFLICT");
      console.log("       ⟹ 🟢 **PASS** — seller SKU → UNKNOWN · 가짜 CONFLICT 제거");
      console.log("       🔴 단 **SAME 이 된 것은 아니다**(CPO 「이것만으로 SAME 이 된다고 가정하지 않는다」)");
    } else console.log("    🔴 kids21 **측정불가**");

    if (j) {
      console.log(`    🟢 **junioredition** 품번칸 ${JSON.stringify(j.field)} · ${j.cmp} · ${j.verdict}/${j.truth}`);
      /** 🔴🔴 Negative — 사라지면 **즉시 STOP**(CPO 명시). */
      expect(j.field, "🔴🔴 다른 상품 공식 품번이 제거되면 즉시 STOP").toBe("B226AB040");
      expect(j.cmp, "🔴🔴 conflict 가 유지돼야 한다").toBe("conflict");
      /**
       * 🔵🔵 AGE-LINE-POLICY-01(CPO GO) — 품번 단독 충돌 + 연령 어휘를 뺀 핵심 상품명
       *    완전일치면 조기 반환을 건너뛴다. 🔴 이 쌍은 **CEO 가 SAME 이라 라벨한 그 쌍**
       *    (C33 `junioredition` · B226AB040)이다.
       */
      expect(j.verdict, "🔵 품번 충돌이 보류로 내려온다(CPO GO)").toBe("PRESUMED_SAME");
      /**
       * 🔴🔴 **그래도 가격 축에는 들어가지 않는다** — 그것이 이 정책의 안전 경계다.
       * 🟢 tier 칸은 이 객체에 없으므로 `matchTruth` 로 같은 사실을 단언한다
       *    (tier 자체는 `wu-069` 가 다섯 쌍 **전건 EXCLUDED** 로 잠근다).
       */
      expect(j.truth, "🔴 matchTruth 가 CONFLICT 에서 벗어났다 — 가격 자격이 열린다").toBe("CONFLICT");
      console.log("       ⟹ 🟢 **PASS** — 다른 상품 공식 품번 **유지** · conflict **유지**");
    } else console.log("    🔴 junioredition **측정불가**");

    if (l) {
      console.log(`    🔴 **m.luxboy**      품번칸 ${JSON.stringify(l.field)} · ${l.cmp} · ${l.verdict}/${l.truth}`);
      /** 🔴🔴 Critical Negative — 식별자 승격이 **없어야** 한다. */
      expect(l.cmp, "🔴 이 후보는 품번이 exact 다(확인 배선이 채운다)").toBe("exact");
      expect(l.verdict, "🔴🔴 human DIFFERENT 가 SAME 이 되면 안 된다").not.toBe("SAME");
      expect(
        ["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"].includes(l.truth),
        "🔴🔴 identifier-only 승격이 일어나면 즉시 STOP",
      ).toBe(false);
      console.log("       ⟹ 🟢 **PASS** — 품번 exact 인데도 `NO_TITLE_OVERLAP` + `crossSellerReserved`");
      console.log("          이중 잠금이 **identifier tier 승격을 막는다**(보호 유지)");
    } else console.log("    🔴 m.luxboy **측정불가**");

    /** 🔴🔴 전체 누출 방어. */
    expect(diffCodeLeak, "🔴 human DIFFERENT 가 SAME 으로 누출").toBe(0);
    expect(negFixtureLeak, "🔴 기존 negative fixture 누출").toBe(0);
    /** 🟢 가짜 CONFLICT 가 0 이어야 한다 — 이 WU 의 PASS 조건. */
    expect(falseConflict, "🔴 가짜 CONFLICT 가 남아 있으면 오염이 안 지워진 것이다").toBe(0);
    /** 🟢 진짜 CONFLICT 는 **남아 있어야** 한다(CPO 명시). */
    expect(realConflict, "🔴🔴 다른 상품 공식 품번의 conflict 가 사라지면 안전장치가 죽는다").toBeGreaterThan(0);
  }, 900000);
});
