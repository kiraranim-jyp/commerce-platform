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
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2N — **Identity / Price Comparability Evidence Calibration**(측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「목표는 threshold 를 낮추거나 CONFLICT 를 제거하는 것이
 * **아니다**. 네 축을 **분리해서 측정** 한다 — ① 상품 브랜드 vs 판매처 브랜드
 * ② 상품 품번 vs 실제 상품 동일성 ③ 상품 유형의 동일성 판단
 * ④ 상품 동일성 vs 가격 비교 가능성」 · 「**counterfactual / harness / fixture
 * 측정만 수행한다**」.
 *
 * 🔴 운영 코드 변경 **0** — CONFLICT 제거 0 · threshold 0 · `SAME_MIN_AXES` 0 ·
 *    품번 가중치 0 · exact identifier 승격 0 · `NO_TITLE_OVERLAP` 0 ·
 *    `crossSellerReserved` 0 · brand extractor 0 · product model 0 ·
 *    code normalization 0 · body evidence 운영 반영 0 · 검색 0 · 가격 0 · UI 0 ·
 *    외부 API 0 · Gemini/OpenAI/Naver 0 · 비용 0.
 *
 * 🔴 **분류기는 이 하니스 안에만 있다** — 운영에 넣지 않았다. 그래서 각 분류의
 *    «근거 신호» 를 같이 출력한다(분류를 믿지 말고 신호를 보라는 뜻이다).
 */

const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const ORIGIN_CODE = "B226AC009";

interface GtCand {
  domain: string;
  url: string;
  ceoUiLabel: string;
  calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN";
  ceoBasis: string;
}
interface Gt {
  candidates: GtCand[];
  labelPolicy: { mapping: Record<string, string>; ceoUiLabel: string[]; calibrationLabel: string[] };
  historicalConflicts: { domain: string; priorVerdict: string; currentVerdict: string; note: string }[];
}

const loadGt = (): Gt =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8")) as Gt;

const norm = (v: unknown): string => {
  const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
  return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
};
const tokens = (v: unknown): string[] => {
  const s = Array.isArray(v) ? v.join(" ") : String(v ?? "");
  return s.toLowerCase().split(/[^a-z0-9가-힣]+/).filter((w) => w.length >= 2);
};
const visible = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

describe("CORE-2N — Identity / Price Comparability Calibration (운영 변경 0)", () => {
  /* ═══ 1. GT integrity ════════════════════════════════════════════════ */
  it("GT — 라벨 두 칸이 분리되고 historical conflict 가 보존돼 있다", () => {
    const gt = loadGt();
    console.log("\n═══ 1. GT integrity ═══");
    expect(gt.candidates.length).toBe(10);
    expect(new Set(gt.candidates.map((c) => c.url)).size, "🔴 URL 키가 고유해야 한다").toBe(10);

    /** 🔴 CEO UI 에는 「다름」이 **없었다** — 그 사실을 정책으로 잠근다(CPO §1). */
    expect(gt.labelPolicy.ceoUiLabel).toEqual(["동일", "유사", "판단불가"]);
    expect(gt.labelPolicy.ceoUiLabel, "🔴 UI 에 「다름」이 있었던 것처럼 적지 않는다").not.toContain("다름");
    expect(gt.labelPolicy.mapping).toEqual({ 동일: "SAME", 유사: "DIFFERENT", 판단불가: "UNCERTAIN" });

    /** 🔴 매핑이 **전건** 정책대로 적용됐는지 기계 검증한다(손으로 적은 값을 믿지 않는다). */
    for (const c of gt.candidates) {
      expect(gt.labelPolicy.mapping[c.ceoUiLabel], c.domain).toBe(c.calibrationLabel);
    }
    const n = (v: string) => gt.candidates.filter((c) => c.calibrationLabel === v).length;
    console.log(`    ceoUiLabel  동일 8 · 유사 1 · 판단불가 1`);
    console.log(`    calibration SAME **${n("SAME")}** · DIFFERENT **${n("DIFFERENT")}** · UNCERTAIN **${n("UNCERTAIN")}**`);
    expect([n("SAME"), n("DIFFERENT"), n("UNCERTAIN")]).toEqual([8, 1, 1]);
    /** 🔴 parkette 는 UI 「유사」인데 calibration DIFFERENT — 그 분리가 이 WU 의 전제다. */
    const pk = gt.candidates.find((c) => c.domain === "parkette.ca")!;
    expect([pk.ceoUiLabel, pk.calibrationLabel]).toEqual(["유사", "DIFFERENT"]);
    console.log("    🟢 parkette — ceoUiLabel **유사** ↔ calibrationLabel **DIFFERENT**(CPO 확정)");

    /* ═══ 2. Historical conflict ═════════════════════════════════════ */
    console.log("\n═══ 2. Historical conflict(삭제하지 않고 보존) ═══");
    expect(gt.historicalConflicts.length).toBe(2);
    for (const h of gt.historicalConflicts) {
      console.log(`    ${h.domain.padEnd(24)} WU-112 **${h.priorVerdict}** → 현재 **${h.currentVerdict}**`);
      expect(h.note.length, `🔴 ${h.domain} 사유가 비었다`).toBeGreaterThan(10);
    }
    /** 🔴 현재 GT 는 **최신 판정** 을 쓴다 — 과거 값이 GT 를 덮지 않는다. */
    const lux = gt.candidates.find((c) => c.domain === "m.luxboy.com")!;
    expect(lux.calibrationLabel, "🔴 현재 GT 는 SAME 이다(과거 DIFFERENT 가 덮지 않는다)").toBe("SAME");
    console.log("    🟢 현재 GT 는 최신 판정 · 과거 판정은 historicalConflicts 에 **보존**");
  });

  /* ═══ N1~N5 + KPI ═══════════════════════════════════════════════════ */
  it("N1~N5 — 네 축을 분리해 측정하고 K1~K8 을 낸다", async () => {
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
    let dna = buildProductIdentityDna(
      buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
    );
    if (!dna.brand.value) {
      const h = await fetchPlainHtml(ORIGIN);
      const sb = h ? extractSiteBrandName(h) : null;
      if (sb?.value) {
        dna = buildProductIdentityDna(
          buildCanonicalProduct(
            ORIGIN,
            { ...(ex!.productData as ExtractedProductData), siteBrandName: sb.value } as ExtractedProductData,
            {} as Record<string, ProductDataSource>,
            [],
          ),
        );
      }
    }
    const originFacts = productFactsFromIdentityDna(dna);
    expect(dna.brand.value).toBeTruthy();
    expect(dna.brandModelCode).toBe(ORIGIN_CODE);
    const PRODUCT_BRAND = dna.brand.value;

    const gt = loadGt();
    const query = {
      title: ex!.productData!.title ?? "",
      brand: PRODUCT_BRAND || undefined,
      sourceUrl: ORIGIN,
      sku: dna.brandModelCode ?? undefined,
      facts: originFacts,
    } as ComparisonQuery;

    const judge = (facts: ProductFacts, level: "low" | "very_high") => {
      const cmp = compareModelCode(ORIGIN_CODE, facts.brandModelCode ?? null);
      const cross = compareCrossSellerProducts(originFacts, facts);
      const truth = String(deriveMatchTruth(level, cmp, cross.verdict, cross.blockers));
      return { cmp, verdict: cross.verdict, truth, axes: cross.axes.map((a) => a.axis) };
    };

    interface Row {
      g: GtCand;
      facts: ProductFacts;
      level: "low" | "very_high";
      base: ReturnType<typeof judge>;
      /** N1 */ brandProv: string;
      brandSignal: string;
      n1: ReturnType<typeof judge> | null;
      /** N2 */ codeClass: string;
      /** N3 */ typeOrigin: string;
      typeCand: string;
      kwOverlap: string;
      /** N4 */ priceElig: string;
      priceSignal: string;
      /** N5 */ l1Have: number;
      l1Right: number;
      l2Have: number;
      l2Right: number;
      l3Have: number;
    }
    const rows: Row[] = [];
    let unreachable = 0;

    for (const g of gt.candidates) {
      const f = await factsFromProductUrl(g.url);
      if (f.status !== "OK" || !f.candidate?.facts) {
        unreachable += 1;
        console.log(`    ${g.domain.padEnd(24)} 🔴 ${f.status} — 측정불가`);
        continue;
      }
      const [scored] = withConfidence(query, [f.candidate]);
      const facts = scored?.facts ?? f.candidate.facts;
      const level = (scored?.matchLevel ?? "low") as "low" | "very_high";
      let html = "";
      try {
        const r = await fetch(g.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
          signal: AbortSignal.timeout(30000),
        });
        html = await r.text();
      } catch {
        html = "";
      }
      const body = visible(html);
      const base = judge(facts, level);

      /* ── N1 Brand provenance ─────────────────────────────────────── */
      const siteBrand = html ? extractSiteBrandName(html)?.value ?? null : null;
      const aliasBrand = lookupBrandByAliasInTitle(
        [facts.title, (facts.coreTitleTokens ?? []).join(" "), body.slice(0, 2000)].join(" "),
      );
      /**
       * ── 🔴🔴 **1차 분류기가 약했고 그것이 측정을 틀리게 했다** ────────────
       *
       * 1차는 `SELLER_BRAND` 를 **`extractSiteBrandName` 과의 일치** 로만 봤다. 그런데
       * 그 함수는 `og:site_name` == JSON-LD `Organization.name` **둘이 같을 때만** 값을
       * 낸다(WU-134 설계) ⟹ `biskuit`(`brand=비스킷`)이 **`UNKNOWN` 으로 떨어졌고
       * K2 가 **0** 이 나왔다. 🔴 그대로 보고했으면 「판매처 브랜드 오염이 없다」는
       * **거짓 결론** 이었다 — CEO 가 직접 「brand 칸은 판매처 이름(비스킷)」이라 적었다.
       *
       * 🟢 그래서 축을 바꿨다 — 「**그 칸이 상품 브랜드인가**」를 묻는다:
       * ```
       * PRODUCT_BRAND      brand 칸 == 원상품 브랜드 (또는 alias 가 찾은 상품 브랜드)
       * NOT_PRODUCT_BRAND  🔴 brand 칸이 있고, **그 페이지에서 상품 브랜드가 발견되는데**
       *                    brand 칸은 그것이 «아니다» ⟹ 그 칸은 상품 브랜드가 아니다
       * UNKNOWN            brand 칸이 없거나, 상품 브랜드를 그 페이지에서 못 찾았다
       * ```
       * 🔴 「**판매처 이름인지**」는 **단정하지 않는다** — 음역(`biskuit.kr` ↔ 「비스킷」)
       *    규칙은 WU-078 이 「생산 로직에 넣지 않는다」로 닫았다. 🟢 `og:site_name` 과
       *    같을 때만 「판매처명 확인」을 덧붙이고, 그 외는 **「상품 브랜드 아님」까지만** 적는다.
       */
      const brandFoundOnPage = aliasBrand ?? (norm(body).includes(norm(PRODUCT_BRAND)) ? PRODUCT_BRAND : null);
      let brandProv: string;
      let brandSignal: string;
      if (!facts.brand) {
        brandProv = "UNKNOWN";
        brandSignal = "brand 칸 없음";
      } else if (norm(facts.brand) === norm(PRODUCT_BRAND) || norm(aliasBrand) === norm(facts.brand)) {
        brandProv = "PRODUCT_BRAND";
        brandSignal = `brand=${facts.brand}`;
      } else if (brandFoundOnPage) {
        brandProv = "🔴 NOT_PRODUCT_BRAND";
        const isSite = siteBrand && norm(facts.brand) === norm(siteBrand);
        brandSignal = `brand=${facts.brand} · 페이지엔 ${brandFoundOnPage} 있음${isSite ? " · 판매처명 확인" : ""}`;
      } else {
        brandProv = "UNKNOWN";
        brandSignal = `brand=${facts.brand} · 페이지에서 상품 브랜드 못 찾음`;
      }
      /** 🟢 N1 CF — **상품 브랜드로 바꿔** 넣는다. 🔴 지어내지 않고 **그 페이지에서 찾은 값** 만 쓴다. */
      const n1 =
        brandProv.includes("NOT_PRODUCT_BRAND") && brandFoundOnPage
          ? judge({ ...facts, brand: brandFoundOnPage } as ProductFacts, level)
          : null;

      /* ── N2 Product code ─────────────────────────────────────────── */
      const field = facts.brandModelCode ?? null;
      const sharesPrefix = !!field && field.slice(0, 4).toUpperCase() === ORIGIN_CODE.slice(0, 4);
      const codeClass =
        field == null
          ? "CODE_ABSENT"
          : base.cmp === "exact"
            ? "EXACT_OFFICIAL_CODE"
            : sharesPrefix
              ? "🔴 DIFFERENT_OFFICIAL_LOOKING_CODE"
              : "🔴 SELLER_SKU";

      /* ── N3 Product type ─────────────────────────────────────────── */
      const oTok = tokens([originFacts.title, originFacts.coreTitleTokens]);
      const cTok = tokens([facts.title, facts.coreTitleTokens]);
      const shared = oTok.filter((t) => cTok.includes(t));
      const kwOverlap = `${shared.length}/${new Set(oTok).size}`;

      /* ── N4 Identity vs Price comparability ──────────────────────── */
      /**
       * 🔴🔴 **이 분류기는 하니스 안에만 있다** — 운영에 넣지 않았다.
       *    그래서 **근거 신호를 같이 출력** 한다(분류를 믿지 말고 신호를 보라).
       * 🔴 「세트」는 그 페이지가 **스스로 적은 말** 로만 본다 — 지어내지 않는다.
       */
      const setWords = ["set", "세트", "pants", "바지", "팬츠", "overall", "2pcs", "2-piece"];
      const hit = setWords.filter((w) => norm(facts.title).includes(norm(w)) || tokens(facts.title).includes(w));
      const priceElig = hit.length > 0 ? "🔴 NOT_ELIGIBLE" : base.verdict === "SAME" ? "ELIGIBLE" : "🟡 CAUTION";
      const priceSignal = hit.length ? `상품명에 「${hit.join("·")}」` : "세트 신호 없음";

      /* ── N5 Evidence level — 🔴 보유와 «정확도» 를 가른다 ────────── */
      const l1 = [
        { k: "브랜드", have: !!facts.brand, right: brandProv === "PRODUCT_BRAND" },
        { k: "품번", have: !!field, right: base.cmp === "exact" },
        { k: "상품명", have: !!facts.title, right: shared.length >= 2 },
        { k: "유형", have: !!facts.categoryText, right: norm(facts.categoryText) === norm(originFacts.categoryText) },
        { k: "핵심어", have: (facts.coreTitleTokens ?? []).length > 0, right: shared.length >= 2 },
        { k: "대표이미지", have: (facts.imageUrls ?? []).length > 0, right: (facts.imageUrls ?? []).length > 0 },
      ];
      const l2 = [
        { k: "색상", have: !!facts.colorText, right: norm(facts.colorText) === norm(originFacts.colorText) },
        { k: "소재", have: !!facts.materialText, right: norm(facts.materialText) === norm(originFacts.materialText) },
        { k: "핏", have: !!facts.fitText, right: norm(facts.fitText) === norm(originFacts.fitText) },
        { k: "대상", have: !!facts.ageRangeText, right: norm(facts.ageRangeText) === norm(originFacts.ageRangeText) },
        { k: "상세설명", have: body.length > 200, right: norm(body).includes(norm(ORIGIN_CODE)) },
      ];
      /** L3 — 세트/옵션/기타. 🔴 수집 칸이 없는 것은 **없음** 으로 센다(지어내지 않는다). */
      const l3 = [
        { k: "세트/구성", have: hit.length > 0 },
        { k: "옵션(사이즈)", have: (facts.sizeLabels ?? []).length > 0 },
        { k: "추가이미지", have: (facts.imageUrls ?? []).length > 1 },
      ];

      rows.push({
        g,
        facts,
        level,
        base,
        brandProv,
        brandSignal,
        n1,
        codeClass,
        typeOrigin: originFacts.categoryText ?? "없음",
        typeCand: facts.categoryText ?? "없음",
        kwOverlap,
        priceElig,
        priceSignal,
        l1Have: l1.filter((x) => x.have).length,
        l1Right: l1.filter((x) => x.have && x.right).length,
        l2Have: l2.filter((x) => x.have).length,
        l2Right: l2.filter((x) => x.have && x.right).length,
        l3Have: l3.filter((x) => x.have).length,
      });
    }
    expect(rows.length, "🔴 측정 대상이 비면 보고하지 않는다").toBeGreaterThan(0);

    const gap = (r: Row, j: ReturnType<typeof judge>): string => {
      const ident = j.truth === "EXACT_IDENTIFIER" || j.truth === "STRONG_IDENTIFIER";
      const c = r.g.calibrationLabel;
      if (c === "SAME" && j.verdict === "SAME" && ident) return "🟢 일치";
      if (c === "SAME" && j.verdict === "CONFLICT") return "🔴🔴 품번 과대평가";
      if (c === "SAME") return "🔴 판단등급 부족";
      if (c === "DIFFERENT") return j.verdict === "SAME" ? "🔴🔴 오포함" : "🟢 방향 안전";
      return "🟡 가격 비교 별도";
    };

    /* ═══ 3. N1 ══════════════════════════════════════════════════════ */
    console.log("\n═══ 3. N1 Brand provenance ═══");
    console.log("    판매처                  provenance          신호                                     CF(상품브랜드로)");
    for (const r of rows) {
      console.log(
        `    ${r.g.domain.padEnd(22)} ${r.brandProv.padEnd(19)} ${r.brandSignal.slice(0, 40).padEnd(40)} ` +
          (r.n1 ? `${r.n1.verdict}/${r.n1.truth} (base ${r.base.verdict})` : "—"),
      );
    }
    const sellerBrand = rows.filter((r) => r.brandProv.includes("NOT_PRODUCT_BRAND"));
    const n1Gain = rows.filter((r) => r.n1 && gap(r, r.n1) !== gap(r, r.base)).length;
    console.log(`\n    🔴 brand 칸이 **상품 브랜드가 아닌** 사례 **${sellerBrand.length}**`);
    for (const r of sellerBrand) console.log(`        · ${r.g.domain} — ${r.brandSignal}`);
    console.log(`    🟢 상품 브랜드로 바꿨을 때 GAP 이 **변한** 사례 **${n1Gain}**`);

    /* ═══ 4. N2 ══════════════════════════════════════════════════════ */
    console.log("\n═══ 4. N2 Product code conflict ═══");
    const byCode = new Map<string, Row[]>();
    for (const r of rows) byCode.set(r.codeClass, [...(byCode.get(r.codeClass) ?? []), r]);
    for (const [k, v] of byCode) {
      const ceoSame = v.filter((r) => r.g.calibrationLabel === "SAME").length;
      const miSame = v.filter((r) => r.base.verdict === "SAME").length;
      console.log(`    ${k.padEnd(36)} n=${v.length} · CEO SAME **${ceoSame}** · MI SAME **${miSame}**`);
      for (const r of v) console.log(`        · ${r.g.domain.padEnd(22)} ${String(r.facts.brandModelCode)} → ${r.base.verdict}`);
    }
    const codeRecallLoss = rows.filter(
      (r) => r.g.calibrationLabel === "SAME" && r.codeClass.includes("DIFFERENT_OFFICIAL_LOOKING"),
    );
    console.log(`\n    🔴🔴 **K3 Code Conflict Recall Loss** = **${codeRecallLoss.length}**`);
    for (const r of codeRecallLoss) console.log(`        · ${r.g.domain} ${r.facts.brandModelCode} — CEO SAME 인데 ${r.base.verdict}`);
    const skuPollution = rows.filter((r) => r.codeClass.includes("SELLER_SKU"));
    console.log(`    🟢 **K4 Seller SKU Pollution** = **${skuPollution.length}**(CORE-2K 이후)`);
    const absent = rows.filter((r) => r.codeClass === "CODE_ABSENT");
    console.log(
      `    🟡 품번 없는 ${absent.length}건의 보완 — CEO SAME **${absent.filter((r) => r.g.calibrationLabel === "SAME").length}** ·` +
        ` MI 확정 SAME **${absent.filter((r) => r.base.verdict === "SAME").length}**`,
    );

    /* ═══ 5. N3 ══════════════════════════════════════════════════════ */
    console.log("\n═══ 5. N3 Product type ═══");
    const pk = rows.find((r) => r.g.domain === "parkette.ca");
    if (pk) {
      console.log(`    parkette.ca — 유형 원본 **${pk.typeOrigin}** ↔ 후보 **${pk.typeCand}**`);
      console.log(`      제목 핵심어 겹침 **${pk.kwOverlap}** · MI **${pk.base.verdict}/${pk.base.truth}**`);
      console.log(`      선 축 ${JSON.stringify(pk.base.axes)}`);
      console.log(
        `      ⟹ ${pk.base.verdict !== "SAME" ? "🟢 **겹침이 높아도 DIFFERENT 방향을 지킨다**" : "🔴🔴 오포함"}`,
      );
      expect(pk.base.verdict, "🔴🔴 CEO DIFFERENT 가 SAME 이 되면 안 된다").not.toBe("SAME");
    } else console.log("    🔴 parkette 측정불가");
    const typeSame = rows.filter((r) => norm(r.typeCand) === norm(rows[0]?.typeOrigin));
    console.log(`    🔴 유형 칸이 원본과 **같은** 후보 **${typeSame.length} / ${rows.length}** — 분모가 작다`);

    /* ═══ 6. N4 ══════════════════════════════════════════════════════ */
    console.log("\n═══ 6. N4 Identity vs Price comparability ═══");
    console.log("    판매처                  IDENTITY(MI)        PRICE_COMPARABILITY   신호");
    for (const r of rows) {
      console.log(
        `    ${r.g.domain.padEnd(22)} ${`${r.base.verdict}`.padEnd(19)} ${r.priceElig.padEnd(21)} ${r.priceSignal}`,
      );
    }
    const by = rows.find((r) => r.g.domain === "bornyesterdaykids.com");
    if (by) {
      console.log(
        `\n    🟡 bornyesterdaykids — CEO **UNCERTAIN** · IDENTITY **${by.base.verdict}** · PRICE **${by.priceElig}**`,
      );
      console.log(`       신호 ${by.priceSignal}`);
      expect(by.priceElig, "🔴 세트 후보가 가격 근거로 쓰일 수 있다고 분류되면 안 된다").toContain("NOT_ELIGIBLE");
      console.log("       ⟹ 🟢 **상품 동일성과 가격 비교 가능성이 실제로 갈린다**(K6 성립)");
    }

    /* ═══ 7. N5 ══════════════════════════════════════════════════════ */
    console.log("\n═══ 7. N5 Evidence level — 🔴 보유 ↔ 정확도를 가른다 ═══");
    console.log("    판매처                  L1 보유/정확  L2 보유/정확  L3 보유  GAP");
    for (const r of rows) {
      console.log(
        `    ${r.g.domain.padEnd(22)} ${`${r.l1Have}/6 · ${r.l1Right}/6`.padEnd(13)} ` +
          `${`${r.l2Have}/5 · ${r.l2Right}/5`.padEnd(13)} ${`${r.l3Have}/3`.padEnd(8)} ${gap(r, r.base)}`,
      );
    }
    const l1Only = rows.filter((r) => r.l1Right >= 3);
    console.log(`\n    🔴 **K7 Evidence-Level Gain** — L1 «정확한» 칸이 3 이상인 후보 **${l1Only.length}**`);
    console.log(
      `       그중 MI 가 확정 SAME **${l1Only.filter((r) => gap(r, r.base) === "🟢 일치").length}**` +
        ` ⟹ 🔴 **L1 정보가 많다고 MI 가 확정하지는 않는다**`,
    );
    const l2Gain = rows.filter((r) => r.l2Right > 0 && gap(r, r.base) !== "🟢 일치").length;
    console.log(`       L2 에 «정확한» 칸이 있는데도 GAP 이 남은 후보 **${l2Gain}**`);
    console.log("       🔴 **L2·L3 을 운영에 넣는 counterfactual 은 돌리지 않았다**(CPO body evidence 금지)");

    /* ═══ 8. KPI ═════════════════════════════════════════════════════ */
    const cnt = (k: string) => rows.filter((r) => gap(r, r.base).includes(k)).length;
    console.log("\n═══ 8. KPI ═══");
    console.log(`    K1 CEO-GT GAP            일치 **${cnt("일치")}** · 판단등급 부족 **${cnt("판단등급")}** ·` +
      ` 품번 과대평가 **${cnt("품번 과대평가")}** · 방향 안전 **${cnt("방향 안전")}** · 가격 별도 **${cnt("가격 비교")}**`);
    console.log(`    K2 Brand Provenance Gap  **${sellerBrand.length}**`);
    console.log(`    K3 Code Recall Loss      **${codeRecallLoss.length}**`);
    console.log(`    K4 Seller SKU Pollution  **${skuPollution.length}**`);
    console.log(`    K5 Type Discrimination   ${pk ? (pk.base.verdict !== "SAME" ? "🟢 작동" : "🔴 실패") : "측정불가"}`);
    console.log(`    K6 Identity/Price 분리    ${by ? (by.priceElig.includes("NOT_ELIGIBLE") ? "🟢 성립" : "🔴 미성립") : "측정불가"}`);
    console.log(`    K7 Evidence-Level Gain   L1 정확 ≥3 **${l1Only.length}** · 그중 확정 **${l1Only.filter((r) => gap(r, r.base) === "🟢 일치").length}**`);
    console.log(`    K8 DIFFERENT Leakage     **${cnt("오포함")}** 🔴 **분모 = 1**(parkette 하나) — 강한 안전성 증거로 쓰지 않는다`);
    console.log(`    측정불가                  **${unreachable}**`);

    /** 🔴🔴 안전 단언 — CEO DIFFERENT 가 SAME 으로 새면 FAIL. */
    expect(cnt("오포함"), "🔴 CEO DIFFERENT 가 SAME 으로 누출").toBe(0);
    /** 🟢 CORE-2K 의 효과가 유지되는지(판매처 SKU 오염 0). */
    expect(skuPollution.length, "🔴 CORE-2K 이후 seller SKU 오염은 0 이어야 한다").toBe(0);
  }, 900000);
});
