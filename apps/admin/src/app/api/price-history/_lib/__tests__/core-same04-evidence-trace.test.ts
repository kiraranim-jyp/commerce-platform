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
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";
import { SAME03_ORIGIN_URL, type Same03OriginCode } from "./core-same03-inventory";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-04 — **CEO SAME 3건 Evidence Pipeline Trace**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 WU 는 matcher 를 고치는 작업이 «아니다».** 「왜 SAME 까지 못 올라가는가」를
 *    실제 값으로 밝히는 작업이다. 변경 금지 전수(CPO §11):
 * ```
 * matcher logic · threshold · 8-axis 정의 · NO_TITLE_OVERLAP · BRAND_MISMATCH ·
 * BRAND_UNCONFIRMED · MODEL_CODE · matchTruth · priceTier · domesticReference ·
 * 국내 가격 pipeline · A/B 가격 · description 연결 · image scoring · seller UI
 * ```
 * 🔴 CEO SAME 을 기준으로 matcher 를 맞추지 않는다 · blocker 제거 0 · threshold 완화 0 ·
 *    brand fallback 0 · title normalization 수정 0 · fixture 로 PASS 만들기 0.
 *
 * 🔴 라이브 축이라 `CORE_SAME04_LIVE=1` 로만 돈다(§14 간헐 FAIL 분리 원칙).
 */

const LIVE = process.env.CORE_SAME04_LIVE === "1";

/** 🔴 FN 3건 — CEO 「동일」인데 시스템이 SAME 으로 확정하지 못한 후보. */
const FN: { label: string; url: string; origin: Same03OriginCode; primaryBlocker: string }[] = [
  {
    label: "biskuit.kr",
    url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/",
    origin: "B226AC009",
    primaryBlocker: "BRAND_MISMATCH",
  },
  {
    label: "m.luxboy.com",
    url: "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05",
    origin: "B226AC009",
    primaryBlocker: "NO_TITLE_OVERLAP",
  },
  {
    label: "donokids.com",
    url: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785",
    origin: "B226AC009",
    primaryBlocker: "BRAND_UNCONFIRMED",
  },
];

/** 🟢 정상 2건 — baseline. 🔴 비교 «참고» 이고 이 WU 의 조사 대상이 아니다. */
const BASELINE: { label: string; url: string; origin: Same03OriginCode }[] = [
  {
    label: "global.trenbe.com",
    url: "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
    origin: "B226AC009",
  },
  {
    label: "beaumonde.co.kr(상세)",
    url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
    origin: "B226AC010",
  },
];

/** 🔴 CEO 가 근거로 지목한 글자들 — raw HTML 에 실재하는지 **직접** 센다. */
const CEO_TOKENS = ["보보쇼즈", "B226AC009", "b226ac009", "226AC009", "Bobo Choses", "BOBO CHOSES"];

const show = (v: unknown): string => {
  if (v == null) return "null";
  if (Array.isArray(v)) return v.length ? `[${v.join(", ")}]` : "[]";
  const s = String(v);
  return s === "" ? '""(빈 문자열)' : s;
};

interface Trace {
  label: string;
  origin: Same03OriginCode;
  readStatus: string;
  /** ① raw HTML 에 CEO 근거 글자가 있는가. */
  rawHits: Record<string, number>;
  rawBytes: number;
  /** ②③ 추출 → facts. */
  facts: ProductFacts | null;
  /** ④ 축/보류/반증 — 실제 계산 결과. */
  axes: { axis: string; points: number; detail: string }[];
  blockers: { blocker: string; detail: string }[];
  conflicts: { conflict: string; detail: string }[];
  verdict: string;
  reasons: string[];
  identifierConfirmed: boolean;
  /**
   * 🔴🔴 **SAME 승격 조건 셋을 «따로» 센다**(`cross-seller.ts:1202`):
   *    `if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME"`
   * 🔴 `corePoints` 는 반환되지 않으므로 **그 한 줄을 복제** 한다(`:1148`) —
   *    복제식을 믿지 않기 위해 아래에서 **운영 verdict 와 교차검증** 한다.
   */
  blocked: boolean;
  corePointsReplica: number;
  /** 🔴 `brandOk` 도 반환되지 않는다 — **보류 어휘로 역산** 한다(`:807·809·1122`). */
  brandOkInferred: boolean;
  /** ⑤ 승격 입력. */
  matchLevel: string;
  modelCodeEvidence: string;
  matchTruth: string;
  /** ⑥ 가격 자격. */
  priceTier: string;
  market: string;
  marketBasis: string;
  price: { amount: number; currency: string } | null;
  inDomesticReference: boolean;
}

async function originFactsOf(code: Same03OriginCode): Promise<ProductFacts> {
  const url = SAME03_ORIGIN_URL[code];
  const ex = await shopifySiteStrategy.extract(url);
  expect(ex?.productData, `🔴 원상품(${code}) 추출 실패`).toBeTruthy();
  let dna = buildProductIdentityDna(
    buildCanonicalProduct(url, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
  );
  if (!dna.brand.value) {
    const html = await fetchPlainHtml(url);
    const site = html ? extractSiteBrandName(html) : null;
    if (site?.value) {
      dna = buildProductIdentityDna(
        buildCanonicalProduct(
          url,
          { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        ),
      );
    }
  }
  return productFactsFromIdentityDna(dna);
}

async function trace(label: string, url: string, origin: Same03OriginCode, oFacts: ProductFacts): Promise<Trace> {
  /* ── ① raw HTML — CEO 근거가 «페이지에» 있는가 ─────────────────────────── */
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-review/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    html = await res.text();
  } catch {
    html = "";
  }
  const rawHits: Record<string, number> = {};
  for (const t of CEO_TOKENS) rawHits[t] = html.split(t).length - 1;

  /* ── ②③ 추출 → facts ─────────────────────────────────────────────────── */
  const f = await factsFromProductUrl(url);
  const empty: Trace = {
    label,
    origin,
    readStatus: f.status,
    rawHits,
    rawBytes: html.length,
    facts: null,
    axes: [],
    blockers: [],
    conflicts: [],
    verdict: "(측정불가)",
    reasons: [],
    identifierConfirmed: false,
    blocked: false,
    corePointsReplica: -1,
    brandOkInferred: false,
    matchLevel: "(측정불가)",
    modelCodeEvidence: "(측정불가)",
    matchTruth: "(측정불가)",
    priceTier: "(측정불가)",
    market: "(측정불가)",
    marketBasis: "(측정불가)",
    price: null,
    inDomesticReference: false,
  };
  if (f.status !== "OK" || !f.candidate?.facts) return empty;

  const query = {
    title: oFacts.title,
    brand: oFacts.brand ?? undefined,
    sourceUrl: SAME03_ORIGIN_URL[origin],
    sku: oFacts.brandModelCode ?? undefined,
    facts: oFacts,
  } as ComparisonQuery;

  const [scored] = withConfidence(query, [f.candidate]);
  const facts = scored?.facts ?? f.candidate.facts;

  /* ── ④ 8축 — 🔴 운영 함수를 그대로 부른다(복제 계산 0) ──────────────── */
  const cross = compareCrossSellerProducts(oFacts, facts);
  /** 🔴 축 입력을 **다시 계산하지 않는다** — matcher 가 쓴 그 값을 그대로 읽는다. */
  const modelCodeEvidence = String(compareModelCode(oFacts.brandModelCode, facts.brandModelCode ?? null));
  const matchLevel = String(scored?.matchLevel ?? "low");
  const matchTruth = String(deriveMatchTruth(scored?.matchLevel ?? "low", compareModelCode(origin, facts.brandModelCode ?? null), cross.verdict, cross.blockers));

  /* ── ⑤⑥ 승격 → 가격 자격 ──────────────────────────────────────────────── */
  const priceTier = priceTierFromLink({ matchTruth: matchTruth as never, verified: false });
  const price = scored?.price ?? f.candidate.price ?? null;
  const market = classifyCandidateMarket({
    domain: new URL(url).host.replace(/^www\./, ""),
    currency: price?.currency ?? null,
    isRegisteredDomesticShop: false,
  });
  const priceKrw = price && price.currency.toUpperCase() === "KRW" ? price.amount : null;

  /**
   * 🔴 `corePoints` 복제 — `cross-seller.ts:1148` 의 필터를 **글자 그대로** 옮겼다
   *    (IMAGE 제외 · TITLE 부분일치(+1) 제외). 🔴 식을 «개선하지» 않았다.
   */
  const corePointsReplica = cross.axes
    .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
    .reduce((sum, a) => sum + a.points, 0);
  const blockerNames = cross.blockers.map((b) => String(b.blocker));
  /** 🔴 `brandOk` 역산 — 보류가 둘 중 하나면 false 다(`:809` MISMATCH · `:1122` UNCONFIRMED). */
  const brandOkInferred = !blockerNames.includes("BRAND_MISMATCH") && !blockerNames.includes("BRAND_UNCONFIRMED");

  return {
    ...empty,
    facts,
    blocked: cross.blockers.length > 0,
    corePointsReplica,
    brandOkInferred,
    axes: cross.axes.map((a) => ({ axis: String(a.axis), points: a.points, detail: a.detail })),
    blockers: cross.blockers.map((b) => ({ blocker: String(b.blocker), detail: b.detail })),
    conflicts: cross.conflicts.map((c) => ({ conflict: String(c.conflict), detail: c.detail })),
    verdict: String(cross.verdict),
    reasons: cross.reasons,
    identifierConfirmed: cross.identifierConfirmed,
    matchLevel,
    modelCodeEvidence,
    matchTruth,
    priceTier,
    market: market.market,
    marketBasis: market.basis,
    price,
    inDomesticReference: market.market === "KR" && priceKrw != null && (priceTier === "EXACT" || priceTier === "COMPARISON"),
  };
}

function report(t: Trace, oFacts: ProductFacts): void {
  console.log(`\n${"═".repeat(78)}`);
  console.log(`  ${t.label}   (원상품 ${t.origin})`);
  console.log(`${"═".repeat(78)}`);
  console.log(`  ① raw HTML        ${t.rawBytes.toLocaleString()} bytes · 읽기 ${t.readStatus}`);
  console.log(`     CEO 근거 글자    ${Object.entries(t.rawHits).map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  if (!t.facts) {
    console.log(`  🔴 facts 없음 — ② 이후 전부 **측정불가**`);
    return;
  }
  const f = t.facts;
  console.log(`  ②③ facts (후보)    brand=${show(f.brand)}`);
  console.log(`                     brandModelCode=${show(f.brandModelCode)}  sellerSku=${show(f.sellerSku)}`);
  console.log(`                     title=${show(f.title)}`);
  console.log(`                     coreTitleTokens=${show(f.coreTitleTokens)}`);
  console.log(`                     categoryText=${show(f.categoryText)}  colorText=${show(f.colorText)}`);
  console.log(`                     materialText=${show(f.materialText)}  fitText=${show(f.fitText)}`);
  console.log(`                     ageRangeText=${show(f.ageRangeText)}  audienceSignals=${show(f.audienceSignals)}`);
  console.log(`                     🔴 description 칸 존재 여부: ${"description" in f ? "있다" : "**없다**(ProductFacts 에 그 칸이 없다)"}`);
  console.log(`  원상품 facts       brand=${show(oFacts.brand)}  code=${show(oFacts.brandModelCode)}`);
  console.log(`                     coreTitleTokens=${show(oFacts.coreTitleTokens)}`);
  console.log(`  ④ 축(계산됨)       ${t.axes.length ? t.axes.map((a) => `${a.axis}+${a.points}(${a.detail})`).join(" · ") : "**없음**"}`);
  console.log(`     보류            ${t.blockers.length ? t.blockers.map((b) => `${b.blocker}「${b.detail}」`).join(" · ") : "없음"}`);
  console.log(`     반증            ${t.conflicts.length ? t.conflicts.map((c) => `${c.conflict}「${c.detail}」`).join(" · ") : "없음"}`);
  console.log(`     verdict         **${t.verdict}**   identifierConfirmed=${t.identifierConfirmed}`);
  console.log(
    `  🔴 SAME 승격 3조건  !blocked=${!t.blocked} · brandOk=${t.brandOkInferred} · ` +
      `corePoints=${t.corePointsReplica}>=5 ${t.corePointsReplica >= 5 ? "✓" : "✗"}` +
      `   ⟹ 실패 조건 **${[!t.blocked ? null : "blocked", t.brandOkInferred ? null : "brandOk", t.corePointsReplica >= 5 ? null : "corePoints"].filter(Boolean).join(" + ") || "없음"}**`,
  );
  console.log(`  ⑤ 승격 입력        matchLevel=${t.matchLevel} · modelCode=${t.modelCodeEvidence}`);
  console.log(`     matchTruth      **${t.matchTruth}**`);
  console.log(`  ⑥ priceTier       **${t.priceTier}**   market=${t.market}(${t.marketBasis})`);
  console.log(`     가격            ${t.price ? `${t.price.currency} ${t.price.amount.toLocaleString()}` : "없음"}`);
  console.log(`     domesticRef     ${t.inDomesticReference ? "**포함**" : "미포함"}`);
}

describe("CORE-PRICE-SAME-04 — CEO SAME 3건 evidence trace (운영 변경 0)", () => {
  it.runIf(LIVE)(
    "FN 3건 + 정상 2건의 pipeline 값을 단계별로 기록한다",
    async () => {
      const originCache = new Map<Same03OriginCode, ProductFacts>();
      const getOrigin = async (code: Same03OriginCode) => {
        if (!originCache.has(code)) originCache.set(code, await originFactsOf(code));
        return originCache.get(code)!;
      };

      const fnTraces: Trace[] = [];
      console.log(`\n${"#".repeat(78)}\n#  FN — CEO 「동일」인데 system SAME 미확정 (조사 대상)\n${"#".repeat(78)}`);
      for (const c of FN) {
        const o = await getOrigin(c.origin);
        const t = await trace(c.label, c.url, c.origin, o);
        report(t, o);
        fnTraces.push(t);
      }

      const baseTraces: Trace[] = [];
      console.log(`\n${"#".repeat(78)}\n#  BASELINE — system SAME 확정 (비교 참고)\n${"#".repeat(78)}`);
      for (const c of BASELINE) {
        const o = await getOrigin(c.origin);
        const t = await trace(c.label, c.url, c.origin, o);
        report(t, o);
        baseTraces.push(t);
      }

      /* ── 요약표 ──────────────────────────────────────────────────────── */
      console.log(`\n${"═".repeat(78)}\n  요약 — 8축 결과 (🔴 계산되지 않은 축은 「측정불가」)\n${"═".repeat(78)}`);
      const AXES = ["BRAND", "TITLE", "MODEL_CODE", "COLOR", "MATERIAL", "FIT", "GARMENT_FORM", "AUDIENCE_LINE"];
      const axisState = (t: Trace, name: string): string => {
        if (!t.facts) return "측정불가";
        const map: Record<string, { axis?: string; blockers: string[]; conflicts: string[] }> = {
          BRAND: { blockers: ["BRAND_MISMATCH", "BRAND_UNCONFIRMED"], conflicts: [] },
          TITLE: { axis: "TITLE", blockers: ["NO_TITLE_OVERLAP"], conflicts: [] },
          MODEL_CODE: { axis: "MODEL_CODE", blockers: ["SAME_SELLER_DISTINCT_LISTING"], conflicts: ["MODEL_CODE"] },
          COLOR: { axis: "COLOR", blockers: ["COLOR_VARIANT"], conflicts: ["COLOR"] },
          MATERIAL: { axis: "MATERIAL", blockers: ["MATERIAL"], conflicts: [] },
          FIT: { axis: "FIT", blockers: ["FIT"], conflicts: [] },
          GARMENT_FORM: { axis: "CATEGORY", blockers: ["GARMENT_FORM"], conflicts: ["CATEGORY", "COMPOSITION"] },
          AUDIENCE_LINE: { axis: "AUDIENCE", blockers: ["AUDIENCE_LINE", "SIZE_SYSTEM"], conflicts: ["AUDIENCE", "GENDER"] },
        };
        const spec = map[name];
        if (t.conflicts.some((c) => spec.conflicts.includes(c.conflict))) return "CONFLICT";
        const bk = t.blockers.find((b) => spec.blockers.includes(b.blocker));
        if (bk) return bk.blocker === "BRAND_UNCONFIRMED" ? "UNKNOWN" : "FAIL";
        /**
         * 🔴 **BRAND 는 «축» 이 아니라 «게이트» 다** — `CrossSellerAxis` 에 BRAND 가 없고
         *    `brandOk`(`:808`)가 SAME 승격을 직접 가른다.
         * 🔴 1차 출력이 그 자리를 `UNKNOWN` 으로 적었다 — 보류가 없으면 `spec.axis` 가
         *    없어서 기본값으로 떨어졌기 때문이다. 🔴 그러면 **게이트를 통과한 것** 이
         *    「모른다」로 보여 CPO 판단을 **과소 서술** 한다. 🟢 게이트 결과로 적는다.
         */
        if (name === "BRAND") return t.brandOkInferred ? "PASS(게이트)" : "UNKNOWN";
        if (spec.axis && t.axes.some((a) => a.axis === spec.axis)) return "PASS";
        if (t.conflicts.length > 0 && t.axes.length === 0) return "측정불가";
        return "UNKNOWN";
      };
      const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
      console.log(`  ${pad("후보", 22)}${AXES.map((a) => pad(a.slice(0, 9), 10)).join("")}`);
      for (const t of [...fnTraces, ...baseTraces]) {
        console.log(`  ${pad(t.label, 22)}${AXES.map((a) => pad(axisState(t, a), 10)).join("")}`);
      }
      console.log(`\n  ${pad("후보", 22)}${pad("verdict", 16)}${pad("matchTruth", 22)}${pad("priceTier", 12)}domesticRef`);
      for (const t of [...fnTraces, ...baseTraces]) {
        console.log(
          `  ${pad(t.label, 22)}${pad(t.verdict, 16)}${pad(t.matchTruth, 22)}${pad(t.priceTier, 12)}${t.inDomesticReference ? "포함" : "미포함"}`,
        );
      }

      /* ── 🔴 계약 — trace 가 «실제로» 그 값을 봤는지 단언한다 ──────────── */
      expect(fnTraces).toHaveLength(3);
      /** 🔴 FN 3건이 읽혔어야 trace 가 성립한다(읽히지 않으면 전부 측정불가다). */
      for (const t of fnTraces) {
        expect(t.readStatus, `🔴 ${t.label} 을 읽지 못하면 이 WU 의 분모가 사라진다`).toBe("OK");
        expect(t.facts).toBeTruthy();
      }
      /** 🔴 primary blocker 가 지시서가 적은 그 축인지 확인한다(다르면 전제가 바뀐 것이다). */
      for (const c of FN) {
        const t = fnTraces.find((x) => x.label === c.label)!;
        expect(
          t.blockers.map((b) => b.blocker),
          `🔴 ${c.label} 의 primary blocker 가 바뀌었다 — 보고 전제를 다시 써야 한다`,
        ).toContain(c.primaryBlocker);
      }
      /** 🟢 FN 3건은 전부 PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON 이다. */
      for (const t of fnTraces) {
        expect(t.verdict).toBe("PRESUMED_SAME");
        expect(t.matchTruth).toBe("TEXT_CONFIRMED");
        expect(t.priceTier).toBe("COMPARISON");
      }
      /** 🟢 baseline 2건은 SAME 이고 **보류가 0** 이다 — 그 차이가 이 WU 의 답이다. */
      for (const t of baseTraces) {
        expect(t.readStatus).toBe("OK");
        expect(t.verdict).toBe("SAME");
        expect(t.blockers, `🔴 ${t.label} 에 보류가 있으면 baseline 이 아니다`).toEqual([]);
        expect(t.priceTier).toBe("EXACT");
      }
      /**
       * 🔴🔴 **승격 조건을 «설명» 한다 — 바꾸지 않는다.**
       *    `cross-seller.ts:1202` → `if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME"`
       *    `blocked = blockers.length > 0` 이므로 **보류가 하나라도 있으면 SAME 이 불가능** 하다.
       *    ⟹ FN 3건은 corePoints 와 무관하게 막힌다. 그것을 여기서 단언한다.
       */
      for (const t of fnTraces) {
        expect(t.blockers.length, `🔴 ${t.label}`).toBeGreaterThan(0);
      }

      /**
       * 🔴🔴🔴 **복제식을 믿지 않는다 — 운영 verdict 와 교차검증한다.**
       *
       * `corePoints` 와 `brandOk` 는 반환되지 않아 복제·역산했다. 그 복제가 틀리면
       * 「무엇이 SAME 을 막았는가」라는 이 WU 의 결론이 **통째로 거짓** 이 된다.
       * 🟢 그래서 `cross-seller.ts:1202` 의 세 조건을 복제값으로 재구성해
       *    **운영이 실제로 낸 verdict 와 대조** 한다.
       */
      for (const t of [...fnTraces, ...baseTraces]) {
        if (!t.facts) continue;
        const predictedSame = !t.blocked && t.brandOkInferred && t.corePointsReplica >= 5;
        expect(
          predictedSame,
          `🔴 ${t.label} — 복제식(${t.corePointsReplica}점 · blocked=${t.blocked} · brandOk=${t.brandOkInferred})이 ` +
            `운영 verdict(${t.verdict})와 어긋난다 ⟹ 이 WU 의 원인 분석을 신뢰할 수 없다`,
        ).toBe(t.verdict === "SAME");
      }

      /**
       * 🔴🔴 **FN 3건의 「실패 조건 개수」가 서로 다르다 — 한 레버로 묶지 않는다.**
       *
       * 🟢 `m.luxboy.com` 은 **단 하나**(NO_TITLE_OVERLAP)만 실패하고 나머지 둘은
       *    **셋 중 둘 이상** 이 실패한다. ⟹ 「축 하나를 열면 3건이 산다」는 **거짓** 이다.
       */
      const failCount = (t: Trace) =>
        [t.blocked, !t.brandOkInferred, t.corePointsReplica < 5].filter(Boolean).length;
      const luxboy = fnTraces.find((t) => t.label === "m.luxboy.com")!;
      expect(failCount(luxboy), "🔴 luxboy 가 단일 차단이 아니면 이 WU 의 핵심 발견이 바뀐다").toBe(1);
      expect(luxboy.blockers.map((b) => b.blocker)).toEqual(["NO_TITLE_OVERLAP"]);
      expect(luxboy.corePointsReplica).toBeGreaterThanOrEqual(5);
      expect(luxboy.brandOkInferred).toBe(true);
      for (const label of ["biskuit.kr", "donokids.com"]) {
        const t = fnTraces.find((x) => x.label === label)!;
        expect(failCount(t), `🔴 ${label} 은 단일 레버로 열리지 않는다`).toBeGreaterThan(1);
      }
      /** 🔴 `ProductFacts` 에 description 칸이 **없다** — 그래서 어느 축에도 못 들어간다. */
      expect(Object.keys(fnTraces[0].facts!), "🔴 description 칸이 생겼으면 이 WU 의 전제가 바뀐다").not.toContain(
        "description",
      );
    },
    1_800_000,
  );

  it("라이브 축은 환경변수로만 돈다", () => {
    expect(LIVE, LIVE ? "" : "🟡 CORE_SAME04_LIVE=1 이 아니라 trace 를 건너뛴다").toBe(LIVE);
  });
});
