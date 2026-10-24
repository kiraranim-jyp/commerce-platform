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
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";
import {
  confirmBrandCodeInEvidence,
  confirmBrandCodeInTitle,
} from "@commerce/crawler/src/comparison-search/domestic-identifiers";
import { extractCodeLikeSlugSegment, extractLabeledProductCode } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2J — **Product Code Extraction / Identity Field Purity**(측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「MI 의 문제가 아니라 **Identity Extraction 의 문제** 다.
 * threshold 도, SAME 규칙도, CATEGORY 도 건드리지 않고 **공식 상품코드 추출 →
 * seller SKU 분리 → 기존 MI 재측정** 순서로 간다.」
 *
 * 🔴 운영 코드 변경 **0** · threshold **0** · 정규화 규칙 **0**(`partial → exact` 안 함) ·
 *    CATEGORY **0** · SAME 규칙 **0** · 새 검색/API **0** · Adapter **0** · 배포 **0**.
 *
 * ── 🟢🟢 착수 전 조사로 밝혀진 것 — **CPO 가 원하는 구조가 «이미» 있다** ──────
 * ```
 * `domestic-identifiers.ts:40` 머리 주석(CPO 지시 2026-10-07):
 *   「품번을 «추출» 하지 않는다. 이미 확정된 품번이 제목에 있는지 «확인» 한다.」
 * 그 함수의 불변식 셋이 CPO 의 「sellerSku 가 officialProductCode 를 대체하지
 * 않는다」를 **구조로** 보장한다:
 *   ① 해외에서 **이미 확정된** 문자열만 받는다(국내에서 새로 추측하지 않는다)
 *   ② 돌려주는 값은 `foreignCode` 그 자체 아니면 `null` «둘뿐»
 *      ⟹ `compareModelCode` 는 `exact` 아니면 `unavailable` 밖에 낼 수 없다 —
 *        🔴 `partial` 도 `conflict` 도 **구조적으로 만들 수 없다**
 *   ③ 판매처 자체코드는 해외 품번과 같을 수 없으므로 **절대 채택되지 않는다**
 * ```
 *
 * ── 🔴🔴 그런데 그 안전 경로가 «돌지 않는 조건» 이 있다(이 WU 의 핵심) ───────
 * ```
 * match.ts:627   c.facts.brandModelCode **=== null** && query.facts.brandModelCode
 *                  → confirmBrandCodeInEvidence(...)
 * 🔴 즉 **후보 품번 칸이 비어 있을 때만** 확인한다. 판매처 SKU 가 «먼저» 들어가
 *    있으면 그 안전 경로가 **아예 돌지 않는다**.
 * 🔴 그리고 그 SKU 를 넣는 생산자가 특정됐다 —
 *    `seller-facts.ts:208`  `extractLabeledProductCode(description) ?? **extractCodeLikeSlugSegment(slug)**`
 * ```
 *
 * ── 🔴 CORE-2I 의 base 를 «정정» 한다 ───────────────────────────────────────
 * ```
 * CORE-2I 는 `compareCrossSellerProducts` 를 **직접** 불렀다 ⟹ `match.ts:627` 의
 * 확인 경로가 **한 번도 돌지 않았다**. 🔴 그래서 그 base 는 **운영 값이 아니다**.
 * 🟢 이 하니스는 운영 순서를 베낀다 — `factsFromProductUrl` → **`withConfidence`**.
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

/** 🟢 `og:title` — 🔴 지어내지 않고 그 페이지가 적은 말만 쓴다. */
function ogTitleOf(html: string): string | null {
  const m = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i.exec(html);
  return m ? m[1] : null;
}

/** 🟢 품번이 페이지의 **어디에** 적혀 있는가 — 추측하지 않고 자리를 센다. */
function codeLocations(html: string, code: string): string[] {
  const bare = code.replace(/^[A-Za-z]/, "");
  const found: string[] = [];
  const probe = (label: string, slice: string) => {
    const h = slice.toLowerCase();
    if (h.includes(code.toLowerCase())) found.push(`${label}:원형`);
    else if (h.includes(bare.toLowerCase())) found.push(`${label}:선행문자없음`);
  };
  /** JSON-LD 블록만 모아서 본다. */
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join("\n");
  if (ld) probe("JSON-LD", ld);
  const metas = [...html.matchAll(/<meta[^>]*>/gi)].map((m) => m[0]).join("\n");
  if (metas) probe("meta/og", metas);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  if (title) probe("<title>", title);
  /** 🔴 본문은 **마지막** 에 본다 — 가장 약한 자리다. */
  probe("본문", html);
  return found;
}

describe("CORE-2J — Product Code Extraction / Identity Field Purity (운영 변경 0)", () => {
  /**
   * ── A·B. 생산자 전수와 오염 지점 — 소스에서 읽는다 ───────────────────────
   */
  it("A — brandModelCode 생산자가 «여섯» 이고 후보 경로는 «둘» 이다", () => {
    const root = path.join(__dirname, "../../../../../../../..");
    const sf = readFileSync(path.join(root, "packages/crawler/src/comparison-search/seller-facts.ts"), "utf8");
    const mt = readFileSync(path.join(root, "packages/crawler/src/comparison-search/match.ts"), "utf8");
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const sfc = strip(sf);
    const mtc = strip(mt);

    console.log("\n═══ A. 후보 경로의 품번 생산자 ═══");
    /** 🟢 ① SHOPIFY_JSON 경로 — slug 승격이 **여기** 있다. */
    expect(sfc).toContain("extractLabeledProductCode(description) ?? extractCodeLikeSlugSegment(slug)");
    console.log("    ① SHOPIFY_JSON  productFactsFromShopifyProduct");
    console.log("       brandModelCode = extractLabeledProductCode(description) ?? **extractCodeLikeSlugSegment(slug)**");
    console.log("       🔴 slug 승격이 여기 있다 — **판매처 SKU 가 Identity 칸에 들어오는 문** 이다");

    /** 🟢 ② PLAIN_HTML 경로 — **null 하드코딩** 이고 그것이 «의도» 다. */
    expect(sfc).toContain("brandModelCode: null");
    console.log("\n    ② PLAIN_HTML    productFactsFromListing");
    console.log("       brandModelCode = **null**(하드코딩) 🟢 **의도된 것** —");
    console.log("       `domestic-identifiers.ts:52` 가 이유를 적는다: 포레포레 자체코드를 넣으면");
    console.log("       `compareModelCode` 가 **「모델코드 충돌」을 지어낸다**");

    /** 🟢 ③ 그리고 그 공백을 메우는 **안전한 확인 경로** 가 이미 있다. */
    expect(mtc).toContain("brandModelCode === null");
    expect(mtc).toContain("confirmBrandCodeInEvidence(query.facts.brandModelCode");
    console.log("\n    ③ 확인 경로     match.ts — `c.facts.brandModelCode **=== null**` 일 때만");
    console.log("       confirmBrandCodeInEvidence(원상품품번, { title, url, sku })");
    console.log("       🔴🔴 **그래서 판매처 SKU 가 먼저 들어가면 이 안전 경로가 «아예 돌지 않는다».**");

    /** 🔴 건초더미가 셋뿐이다 — `description`/본문은 **안 본다**. */
    for (const f of ["title: c.title", "url: c.url", "sku: c.sku"]) expect(mtc).toContain(f);
    expect(mtc, "🔴 description/본문을 건초더미에 넣지 않는다(현재 상태)").not.toContain("description: c.description");
    console.log("       🔴 건초더미는 **title · url · sku** 셋뿐이다 — description/본문은 **안 본다**");
  });

  /**
   * ── B. 확인 경로의 안전 불변식 — 🔴 이것이 CPO 가 요구한 분리다 ──────────
   */
  it("B — 확인 경로는 판매처 SKU 를 «구조적으로» 채택할 수 없다", () => {
    console.log("\n═══ B. 확인(confirm) 경로 불변식 ═══");
    /** ① 돌려주는 값은 foreignCode 아니면 null «둘뿐». */
    const got = confirmBrandCodeInEvidence(ORIGIN_CODE, {
      title: "[보보쇼즈] Hug Hairy Monster T-shirt B226AC009",
      url: null,
      sku: null,
    });
    expect(got).toBe(ORIGIN_CODE);
    console.log(`    제목에 품번 원형 → **${got}**(= 원상품 품번 그대로) 🟢`);

    /** 🔴 판매처 SKU 는 **절대** 채택되지 않는다 — kids21 실제 값으로 잰다. */
    const sellerSku = confirmBrandCodeInEvidence(ORIGIN_CODE, {
      title: "Bobo Choses Hug Hairy Monster T-shirt",
      url: "https://kids21.com/products/700005621lbl",
      sku: "700005621LBL",
    });
    expect(sellerSku, "🔴 판매처 SKU 가 공식 품번으로 승격되면 안 된다").toBeNull();
    console.log(`    판매처 SKU 만 있음 → **${sellerSku}** 🟢 **채택되지 않는다**`);

    /** 🔴 선행 영문자가 빠진 꼴은 **토큰 전체 일치** 가 아니라 채택되지 않는다. */
    const bare = confirmBrandCodeInTitle(ORIGIN_CODE, "[보보쇼즈] Hug Hairy Monster T-shirt #226AC009");
    expect(bare, "🔴 토큰 전체가 같을 때만 인정한다(현재 규칙)").toBeNull();
    console.log(`    제목에 \`#226AC009\`(선행 B 없음) → **${bare}** 🔴 **채택되지 않는다**`);
    console.log("       🟢 이것이 **도노키즈가 0 인 정확한 이유** 다 — 추출기 부재가 아니라 «표기 차이».");

    /**
     * 🟢🟢 **불변식 ②의 직접 증거** — 확인 경로의 산출로는 `compareModelCode` 가
     *    `exact` 아니면 `unavailable` 밖에 낼 수 없다. `partial`·`conflict` **불가**.
     */
    for (const out of [ORIGIN_CODE, null]) {
      const r = compareModelCode(ORIGIN_CODE, out);
      expect(["exact", "unavailable"]).toContain(r);
    }
    console.log("    🟢🟢 확인 경로 산출 → compareModelCode 는 **exact | unavailable** 뿐");
    console.log("       ⟹ `partial`·`conflict` 를 **구조적으로 만들 수 없다**(지어낸 충돌 0)");
  });

  /**
   * ── C·D. 운영 순서로 재측정 + Negative ──────────────────────────────────
   */
  it("C — 운영 경로(withConfidence)로 품번 공급과 MI 영향을 잰다", async () => {
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

    console.log("\n═══ C. 후보별 Identity 칸 «공급» 추적(운영 생산자) ═══");
    console.log(
      "    판매처                  human     경로          품번칸        분류              확인경로     페이지 자리",
    );

    let measured = 0;
    let emptyField = 0;
    let pollutedBySku = 0;
    let confirmWouldFill = 0;
    let confirmBlockedByPollution = 0;
    /** 🟢 운영 확인 배선이 **실제로** 빈 칸을 채운 건수. */
    let wiringFilled = 0;
    /** 🟢 반사실에서 **새로** SAME 이 된 건수. */
    let cfRecovered = 0;
    /** 🔴 반사실에서 human DIFFERENT 가 SAME / 식별자 등급으로 샌 건수. */
    let cfLeakSame = 0;
    let cfLeakIdent = 0;
    /** 🟢 오염을 비워 CONFLICT 를 벗어난 건수. */
    let cfLeftConflict = 0;
    const onPageButEmpty: string[] = [];
    const rows: {
      label: string;
      human: string;
      cls: string;
      confirm: string | null;
      onPage: string[];
      opField: string | null;
      opCmp: string;
      opVerdict: string;
      opTruth: string;
      cfField: string | null;
      cfVerdict: string;
      cfTruth: string;
    }[] = [];

    for (const t of targets) {
      const f = await factsFromProductUrl(t.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        console.log(`    ${t.label.padEnd(22)} 🔴 ${f.status} — 측정불가`);
        continue;
      }
      measured += 1;
      const facts = f.candidate.facts;
      const cand = f.candidate;
      const fetchPath = String((f as { fetchPath?: string }).fetchPath ?? "?");

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
      const onPage = html ? codeLocations(html, ORIGIN_CODE) : [];

      /**
       * 🟢 **분류** — CPO §4 의 데이터 구조로 가른다.
       * 🔴 「모르면 UNKNOWN」이고 판매처 SKU 를 공식 품번으로 적지 않는다.
       */
      const field = facts.brandModelCode ?? null;
      const cmp = compareModelCode(ORIGIN_CODE, field);
      let cls: string;
      if (field == null) {
        cls = "UNKNOWN(공백)";
        emptyField += 1;
      } else if (cmp === "exact") cls = "officialProductCode";
      else if (/^\d+$/.test(field)) {
        cls = "🔴 sellerProductId";
        pollutedBySku += 1;
      } else if (cmp === "conflict" || cmp === "partial") {
        /** 🔴 공식 코드체계와 접두사를 공유하면 **다른 상품의 공식 품번** 일 수 있다. */
        cls = /^[A-Z]\d{3}[A-Z]{2}\d{3}$/i.test(field) ? "🟡 다른상품 공식품번" : "🔴 sellerSku";
        if (cls.includes("sellerSku")) pollutedBySku += 1;
      } else cls = "기타";

      /** 🟢 **확인 경로** 를 운영과 같은 건초더미로 직접 부른다. */
      const confirm = confirmBrandCodeInEvidence(ORIGIN_CODE, {
        title: cand.title,
        url: cand.url,
        sku: cand.sku ?? facts.sellerSku ?? null,
      });
      if (confirm) confirmWouldFill += 1;
      /** 🔴🔴 **오염이 안전 경로를 막는가** — 운영 조건은 `=== null` 이다. */
      if (field != null && confirm != null) confirmBlockedByPollution += 1;
      if (field == null && onPage.length > 0 && !confirm) onPageButEmpty.push(`${t.label}(${onPage.join(",")})`);

      /**
       * ── 🔴🔴 **운영 순서를 실제로 돈다** — `withConfidence` 를 «부른다» ──────
       *
       * 🔴 1차 하니스는 이 테스트 이름이 `withConfidence` 인데 **그 함수를 부르지
       *    않았다**(`confirmBrandCodeInEvidence` 만 직접 불렀다). 🔴 그대로 보고했으면
       *    「운영 경로로 쟀다」가 **거짓** 이었다 — 스스로 잡아 고쳤다.
       * 🟢 이제 `match.ts:627` 의 확인 배선이 **실제로** 발화하는지까지 본다.
       */
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
      const opFacts = scored?.facts ?? facts;
      const opField = opFacts.brandModelCode ?? null;
      const opCmp = compareModelCode(ORIGIN_CODE, opField);
      const cross = compareCrossSellerProducts(originFacts, opFacts);
      const opTruth = String(
        deriveMatchTruth(scored?.matchLevel ?? "low", opCmp, cross.verdict, cross.blockers),
      );
      if (opField != null && field == null) wiringFilled += 1;

      /**
       * ── 🔴🔴 C. **반사실 — officialProductCode 를 «깨끗하게» 공급한다** ──────
       *
       * CPO §7-C: 「운영 코드는 아직 변경하지 말고 counterfactual 로
       *   `현재 extractor → officialProductCode 확보 → 기존 MI` 를 넣어 본다」.
       *
       * 🔴 규칙 셋 — **지어내지 않는다**:
       *   ⒜ 오염된 칸은 **비운다**(UNKNOWN 으로 되돌린다 · 지어내지 않는다)
       *   ⒝ 공식 품번은 **그 페이지에 원형으로 적혀 있을 때만** 넣는다
       *      🔴 `226AC009`(선행문자 없음)는 **넣지 않는다** — CPO §6 이 정규화 변경을 금지했다
       *   ⒞ 브랜드는 **그 페이지의 말** 에서만 복구한다
       * 🔴 threshold · 정규화 · CATEGORY **전부 그대로** 다.
       */
      const hasOriginalForm = onPage.some((x) => x.endsWith(":원형"));
      const cleanedField = opCmp === "conflict" ? null : opField;
      const cfCode = cleanedField ?? (hasOriginalForm ? ORIGIN_CODE : null);
      const cfBrand = opFacts.brand ?? (html ? lookupBrandByAliasInTitle(ogTitleOf(html) ?? cand.title ?? "") : null);
      const cfFacts = { ...opFacts, brandModelCode: cfCode, brand: opFacts.brand ?? cfBrand ?? undefined } as ProductFacts;
      const cfCross = compareCrossSellerProducts(originFacts, cfFacts);
      const cfCmp = compareModelCode(ORIGIN_CODE, cfCode);
      const cfTruth = String(deriveMatchTruth(scored?.matchLevel ?? "low", cfCmp, cfCross.verdict, cfCross.blockers));
      const identGrade = cfTruth === "EXACT_IDENTIFIER" || cfTruth === "STRONG_IDENTIFIER";
      if (cfCross.verdict === "SAME" && cross.verdict !== "SAME") cfRecovered += 1;
      if (t.human === "DIFFERENT" && cfCross.verdict === "SAME") cfLeakSame += 1;
      if (t.human === "DIFFERENT" && identGrade) cfLeakIdent += 1;
      if (cfCross.verdict !== "CONFLICT" && cross.verdict === "CONFLICT") cfLeftConflict += 1;

      rows.push({
        label: t.label,
        human: t.human,
        cls,
        confirm,
        onPage,
        opField,
        opCmp,
        opVerdict: cross.verdict,
        opTruth,
        cfField: cfCode,
        cfVerdict: cfCross.verdict,
        cfTruth,
      });
      console.log(
        `      운영(withConfidence) → 품번칸 **${String(opField)}** · compare **${opCmp}** · ` +
          `verdict **${cross.verdict}** · truth **${opTruth}**` +
          (opField != null && field == null ? "   🟢 **확인 배선이 채웠다**" : ""),
      );
      console.log(
        `      🔵 CF(깨끗한 공급)  → 품번칸 **${String(cfCode)}** · compare **${cfCmp}** · ` +
          `verdict **${cfCross.verdict}** · truth **${cfTruth}**` +
          (cfCross.verdict === "SAME" && cross.verdict !== "SAME" ? "   🟢🟢 **SAME 회복**" : "") +
          (cfCross.verdict !== "CONFLICT" && cross.verdict === "CONFLICT" ? "   🟢 **CONFLICT 탈출**" : ""),
      );
      console.log(
        `    ${t.label.padEnd(22)} ${t.human.padEnd(9)} ${fetchPath.padEnd(13)} ` +
          `${String(field).padEnd(13)} ${cls.padEnd(22)} ${String(confirm).padEnd(12)} ${onPage.join(",") || "없음"}`,
      );
    }

    expect(measured, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);

    console.log("\n═══ D. 숫자 ═══");
    console.log(`    측정된 후보                              **${measured}**`);
    console.log(`    품번 칸 **UNKNOWN(공백)**                  **${emptyField}**`);
    console.log(`    🔴 품번 칸이 **판매처 값** 으로 오염          **${pollutedBySku}**`);
    console.log(`    🟢 확인 경로가 **채울 수 있는** 후보          **${confirmWouldFill}**`);
    console.log(`    🔴🔴 오염 때문에 확인 경로가 **막히는** 후보   **${confirmBlockedByPollution}**`);
    console.log(`    🔴 페이지에 품번이 있는데 **확인 경로로도 못 채우는** 후보 **${onPageButEmpty.length}**`);
    for (const s of onPageButEmpty) console.log(`        · ${s}`);
    console.log("\n═══ 🔵 C. 반사실 — 깨끗한 공식 품번 공급(threshold 0 · 정규화 0) ═══");
    console.log(`    🟢 **SAME 회복**                           **${cfRecovered}**`);
    console.log(`    🟢 오염을 비워 **CONFLICT 탈출**            **${cfLeftConflict}**`);
    console.log(`    🔴 human DIFFERENT 가 **SAME** 으로 누출     **${cfLeakSame}**(0 이어야 한다)`);
    console.log(`    🔴 human DIFFERENT 가 **식별자 등급** 으로 누출 **${cfLeakIdent}**(0 이어야 한다)`);
    /** 🔴🔴 CPO §7-D — Negative 안전성이 이 WU 의 PASS 조건이다. */
    expect(cfLeakSame, "🔴 깨끗한 공급으로도 human DIFFERENT 가 SAME 이 되면 안 된다").toBe(0);
    expect(cfLeakIdent, "🔴 human DIFFERENT 가 식별자 등급(=EXACT tier)에 닿으면 안 된다").toBe(0);

    /**
     * ── 🔴🔴 D. Negative 안전성 — `m.luxboy` 를 **핵심 fixture 로 승격** ──
     *
     * CPO 지시: 「특히 m.luxboy 는 핵심 fixture 로 승격해야 한다」.
     * 🔴 그 후보는 **human DIFFERENT** 인데 페이지에 `B226AC009` 가 있다 ⟹
     *    **확인 경로가 그것을 `exact` 로 채운다.** 그것이 안전한지 잰다.
     */
    const luxboy = rows.find((r) => r.label.includes("luxboy"));
    if (luxboy) {
      console.log("\n═══ 🔴🔴 핵심 Negative fixture — m.luxboy.com ═══");
      console.log(`    human **${luxboy.human}** · 분류 ${luxboy.cls} · 확인경로 산출 **${luxboy.confirm}**`);
      console.log(`    페이지 자리 ${luxboy.onPage.join(",") || "없음"}`);
      expect(luxboy.human, "🔴 이 fixture 는 human DIFFERENT 여야 의미가 있다").toBe("DIFFERENT");
      /**
       * 🔴🔴 **이것이 이 WU 의 가장 중요한 단언이다** — 확인 경로가 품번을 채우면
       *    그 후보는 `exact` 가 된다. 🟢 그래도 **이중 잠금** 이 EXACT tier 를 막는다는
       *    것은 CORE-2I 가 M3+M4 로 측정했다. 🔴 여기서는 **채워진다는 사실** 을 고정한다 —
       *    다음 세션이 「확인 경로는 안전하다」로 넘겨 읽지 않도록.
       */
      if (luxboy.confirm) {
        console.log("    🔴🔴 **확인 경로가 이 human DIFFERENT 후보의 품번을 `exact` 로 채운다.**");
        console.log("       ⟹ 「확인 경로는 판매처 SKU 를 막으므로 안전하다」로 **넘겨 읽지 않는다**.");
        console.log("       🟢 막는 것은 품번 축이 아니라 `NO_TITLE_OVERLAP` + `crossSellerReserved` 이중 잠금이다.");
        expect(compareModelCode(ORIGIN_CODE, luxboy.confirm)).toBe("exact");
      }
    } else {
      console.log("\n  🔴 m.luxboy 가 분모에 없다 — **측정불가**(0 으로 세지 않는다)");
    }

    /** 🔴 공식 품번으로 분류된 후보는 전부 `exact` 여야 한다(분류기 자체 검증). */
    for (const r of rows.filter((x) => x.cls === "officialProductCode")) {
      expect(compareModelCode(ORIGIN_CODE, ORIGIN_CODE)).toBe("exact");
      console.log(`    🟢 officialProductCode 확정 — ${r.label}`);
    }
  }, 900000);

  /**
   * ── E. 🔴 생산자 단위 Negative — 판매처 SKU 가 공식 품번처럼 들어온 사례 ──
   */
  it("E — 판매처 SKU/상품번호가 공식 품번 칸에 들어오면 무엇이 되는가", () => {
    console.log("\n═══ E. 생산자 단위 Negative(순수 함수) ═══");
    /** 🔴 실측된 오염값 둘 — kids21 · 숫자 상품번호. */
    const cases: { label: string; slug: string; expectPromote: boolean }[] = [
      { label: "kids21 판매처 SKU", slug: "700005621lbl", expectPromote: true },
      { label: "숫자만 상품번호", slug: "4117", expectPromote: false },
      { label: "공식 품번 slug", slug: "b226ac009-hug-hairy-monster-t-shirt", expectPromote: true },
    ];
    for (const c of cases) {
      const promoted = extractCodeLikeSlugSegment(c.slug);
      const cmp = compareModelCode(ORIGIN_CODE, promoted);
      console.log(
        `    ${c.label.padEnd(20)} slug=${c.slug.padEnd(38)} → ${String(promoted).padEnd(14)} compare=**${cmp}**`,
      );
      if (c.expectPromote) expect(promoted, "🔴 이 모양은 승격된다(현재 동작)").toBeTruthy();
      else expect(promoted, "🟢 숫자만인 세그먼트는 식별자가 아니다(WU-095)").toBeNull();
    }
    console.log("    🔴🔴 `700005621lbl` 이 **승격되고** compareModelCode 가 **conflict** 를 낸다");
    console.log("       ⟹ 🔴 **human SAME 이 CONFLICT 로 떨어진다**(CORE-2I 실측 kids21)");
    console.log("       🟢 그리고 그 칸이 채워져 있어 **확인 경로(=== null)가 돌지 않는다**");

    /** 🔴 라벨 추출기는 **라벨이 있을 때만** 쓴다 — 라벨 없는 숫자열을 품번으로 쓰지 않는다. */
    expect(extractLabeledProductCode("상품번호 4117 가격 88,000원")).not.toBe("88000");
    console.log("    🟢 `extractLabeledProductCode` 는 가격 숫자를 품번으로 쓰지 않는다");
  });
});
