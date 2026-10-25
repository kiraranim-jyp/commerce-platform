import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
} from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AF — **AUDIENCE_LINE 조건부 완화 «안전성»** (READ-ONLY · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **질문 하나만 답한다**(CPO §0):
 * ```
 * WU-143 에서 false SAME 13건을 만들었던 사례들이, 「**강한 식별 증거가 있을 때만**
 * AUDIENCE_LINE 을 무시」하는 조건에서도 **다시 SAME 으로 열리는가?**
 * ```
 * 🔴 운영 blocker 를 **제거하지 않는다** · threshold 0 · 8축 0 · 전역 완화 **실험 대상 아님**.
 *
 * ── 🟢 STEP 1 — fixture 복원 = **A (완전 복원)** ────────────────────────────────
 * ```
 * 「false SAME 13건」은 **상품 13개가 아니다** — `cross-seller-matching.test.ts:493` 의
 * `BABY_FALSE_SAME` **5쌍** 에서 난 **계약 실패 13건** 이다(그 파일이 같은 5쌍을
 * verdict · 방향대칭 · 사이즈제거 · suggest 변형으로 여러 번 단언한다).
 * 🟢 fixture 는 **실제 응답 원문** 이 디스크에 있다(`packages/crawler/src/__tests__/fixtures`).
 * 🔴 **추정으로 재구성하지 않았다** — 같은 로더(운영 export 함수)로 읽는다.
 * ```
 * 원상품  SMALLABLE_430632 (= Bobo **B226AC018** · 아동 올오버 티셔츠)
 * 후보 5  🔴 **전부 다른 그래픽 · BABY 라인** —
 *        B226AB043(Mush Monster Duo) · B226AB048(Softpaw Monster) ·
 *        junior/mush-monster-duo · junior/juicy-tomatoes · junior/bobo-choses-color
 * 🟢 정답 대조군 1 — 430632 ↔ **B226AC018**(이 측정에서 SAME 을 유지해야 한다)
 *
 * ── 🔴 STEP 2 — 「강한 식별 증거」를 **측정 전에** 고정한다(CPO §7) ────────────
 * ```
 * SI-1  compareModelCode(x.brandModelCode, y.brandModelCode) === "exact"   기존 함수
 * SI-2  cross.identifierConfirmed === true                                 기존 **반환 필드**
 *       (= modelCode exact **또는** slugCarriesCode · cross-seller.ts:909)
 * SI-3  TITLE 축 points === 2  (= STRONG_TITLE_OVERLAP 0.5 달성 · 기존 임계값)
 * ```
 * 🔴 **셋을 미리 적어 두고 각각 독립 측정** 한다 — 결과를 보고 정의를 바꾸지 않는다.
 * 🔴 새 축·새 점수·새 가중치를 **만들지 않았다**.
 */

const LIVE = process.env.CORE2AF_LIVE === "1";
const FIXTURES = path.join(
  __dirname,
  "../../../../../../../../packages/crawler/src/__tests__/fixtures",
);

/* ── fixture 로더 — 🟢 운영 export 함수를 그대로 쓴다(로직 복제 0) ── */
function smallable(file: string, productId: string): ProductFacts {
  const f = productFactsFromSmallableHtml(readFileSync(path.join(FIXTURES, file), "utf8"), productId);
  if (!f) throw new Error(`🔴 smallable fixture 를 읽지 못했다: ${file}`);
  return f;
}
function bobo(code: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8"));
  return productFactsFromShopifyProduct(raw, "bobochoses.com");
}
function junior(handle: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, `junioredition-${handle}.json`), "utf8")) as Record<
    string,
    unknown
  >;
  return productFactsFromShopifyProduct(
    {
      title: raw.title as string,
      handle: raw.handle as string,
      url: `/products/${raw.handle as string}`,
      description: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
      images: raw.images as string[],
    } as never,
    "junioredition.com",
  );
}

const ORIGIN_143 = () => smallable("smallable-430632-product.html", "430632");

/** 🔴 WU-143 의 그 5쌍 — 라벨까지 그대로 옮긴다(분모를 바꾸지 않는다). */
const BABY_FALSE_SAME: Array<[string, () => ProductFacts]> = [
  ["bobochoses B226AB043 Mush Monster Duo (3M~24M)", () => bobo("B226AB043")],
  ["bobochoses B226AB048 Softpaw Monster (3M~24M)", () => bobo("B226AB048")],
  ["junioredition Mush Monster Duo All Over Baby", () => junior("mush-monster-duo-all-over-baby-t-shirt-by-bobo-choses")],
  ["junioredition Juicy Tomatoes All Over Baby", () => junior("juicy-tomatoes-all-over-baby-t-shirt-by-bobo-choses")],
  ["junioredition Bobo Choses Color All Over Baby", () => junior("bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses")],
];

type SI = "SI1_MODEL_CODE_EXACT" | "SI2_IDENTIFIER_CONFIRMED" | "SI3_TITLE_STRONG";

interface Shot {
  verdict: string;
  blockers: string[];
  conflicts: string[];
  axes: Array<{ axis: string; points: number }>;
  total: number;
  core: number;
  identifierConfirmed: boolean;
  modelCode: string;
  si: Record<SI, boolean>;
}

function shoot(x: ProductFacts, y: ProductFacts): Shot {
  const c = compareCrossSellerProducts(x, y);
  const axes = (c.axes ?? []).map((a) => ({ axis: String(a.axis), points: a.points ?? 0 }));
  const modelCode = String(compareModelCode(x.brandModelCode, y.brandModelCode));
  const titleStrong = axes.some((a) => a.axis === "TITLE" && a.points === 2);
  return {
    verdict: String(c.verdict),
    blockers: (c.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
    conflicts: (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict)),
    axes,
    total: axes.reduce((s, a) => s + a.points, 0),
    /** 🟢 CORE-2AD 에서 고정한 운영 산식(IMAGE · TITLE 1점 제외). */
    core: axes.filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1)).reduce((s, a) => s + a.points, 0),
    identifierConfirmed: Boolean(c.identifierConfirmed),
    modelCode,
    si: {
      SI1_MODEL_CODE_EXACT: modelCode === "exact",
      SI2_IDENTIFIER_CONFIRMED: Boolean(c.identifierConfirmed),
      SI3_TITLE_STRONG: titleStrong,
    },
  };
}

/**
 * 🔴 **조건부 완화 가정**(하니스 안에서만) — `AUDIENCE_LINE` «하나만» 비차단으로 둔다.
 * 🔴 다른 blocker · conflict · 점수는 **그대로** 다. `SAME_MIN_AXES`(5) 와
 *    `corePoints` 산식도 **그대로** 쓴다.
 */
function counterfactual(s: Shot, si: SI): string {
  if (s.conflicts.length > 0) return "CONFLICT";
  const relax = s.si[si] && s.blockers.includes("AUDIENCE_LINE");
  const blockers = relax ? s.blockers.filter((b) => b !== "AUDIENCE_LINE") : s.blockers;
  if (blockers.length === 0 && s.core >= 5) return "SAME";
  if (s.total >= 3) return "PRESUMED_SAME";
  if (s.total >= 1) return "SIMILAR";
  return "UNKNOWN";
}

const SI_LIST: SI[] = ["SI1_MODEL_CODE_EXACT", "SI2_IDENTIFIER_CONFIRMED", "SI3_TITLE_STRONG"];

/* ══════════════ STEP 3/4 — WU-143 분모(네트워크 0 · CI 상주) ══════════════ */

describe("CORE-2AF — WU-143 false SAME 분모에서 조건부 완화 안전성(네트워크 0)", () => {
  it("AF-1 🟢 STEP 1 — fixture **5/5 복원** 되고 정답 대조군도 읽힌다", () => {
    expect(ORIGIN_143().title.length).toBeGreaterThan(0);
    for (const [label, f] of BABY_FALSE_SAME) {
      expect(f().title.length, `🔴 ${label} fixture 를 읽지 못했다 — 분모가 깨지면 측정하지 않는다`).toBeGreaterThan(0);
    }
    expect(bobo("B226AC018").title.length).toBeGreaterThan(0);
  });

  it("AF-2 🔴 baseline — 5쌍이 **AUDIENCE_LINE 으로** 막히고 SAME 이 아니다(WU-143 사실 재현)", () => {
    for (const [label, f] of BABY_FALSE_SAME) {
      const s = shoot(ORIGIN_143(), f());
      expect(s.verdict, `🔴 ${label} 이 baseline 에서 SAME 이다 — 분모가 바뀌었다`).not.toBe("SAME");
      expect(s.blockers, `🔴 ${label} 에 AUDIENCE_LINE 이 없다 — WU-143 분모가 아니다`).toContain("AUDIENCE_LINE");
    }
  });

  it("AF-3 🟢 정답 대조군 430632 ↔ B226AC018 은 baseline 에서 **SAME** 이다", () => {
    const s = shoot(ORIGIN_143(), bobo("B226AC018"));
    expect(s.verdict, "🔴 정답 쌍이 깨졌다 — 이 측정의 기준선이 무효다").toBe("SAME");
  });

  it("AF-4 🔴🔴 **조건부 완화 — 세 정의 각각에서 false SAME 재발 여부**", () => {
    console.log("\n════════ CORE-2AF — WU-143 분모(5쌍) 조건부 완화 ════════");
    console.log("🔴 운영 변경 0 · AUDIENCE_LINE 제거 0 · threshold 0\n");
    console.log(
      `    ${"후보".padEnd(46)}${"baseline".padEnd(16)}${"total/core".padEnd(12)}${"modelCode".padEnd(13)}${"idConf".padEnd(8)}${"TITLE2".padEnd(8)}`,
    );
    const shots = BABY_FALSE_SAME.map(([label, f]) => [label, shoot(ORIGIN_143(), f())] as const);
    for (const [label, s] of shots) {
      console.log(
        `    ${label.padEnd(46)}${s.verdict.padEnd(16)}${`${s.total}/${s.core}`.padEnd(12)}${s.modelCode.padEnd(13)}${String(s.identifierConfirmed).padEnd(8)}${String(s.si.SI3_TITLE_STRONG).padEnd(8)}`,
      );
      console.log(`        ↳ 축[${s.axes.map((a) => `${a.axis}:${a.points}`).join(" ") || "없음"}] · blockers[${s.blockers.join(",")}]`);
    }

    const reopened: Record<SI, string[]> = {
      SI1_MODEL_CODE_EXACT: [],
      SI2_IDENTIFIER_CONFIRMED: [],
      SI3_TITLE_STRONG: [],
    };
    console.log("\n    ── 조건부 완화 결과(false SAME 재발 = SAME 으로 열림) ──");
    for (const si of SI_LIST) {
      for (const [label, s] of shots) {
        if (counterfactual(s, si) === "SAME") reopened[si].push(label);
      }
      console.log(`    ${si.padEnd(26)}재발 **${reopened[si].length}/5**  ${reopened[si].join(" · ") || ""}`);
      /** 🟢 정답 쌍은 어느 조건에서도 SAME 을 유지해야 한다. */
      expect(counterfactual(shoot(ORIGIN_143(), bobo("B226AC018")), si), `🔴 ${si} 에서 정답 쌍이 깨졌다`).toBe("SAME");
    }

    /** 🔴🔴 CPO §9 FAIL 조건 — 재발이 있으면 그 정의는 **폐기** 다. 숫자를 그대로 남긴다. */
    const safe = SI_LIST.filter((si) => reopened[si].length === 0);
    console.log(`\n    🟢 재발 0 인 정의 — ${safe.join(", ") || "**없음**"}`);
    console.log(`    🔴 재발이 있는 정의 — ${SI_LIST.filter((si) => reopened[si].length > 0).join(", ") || "없음"}`);
    expect(SI_LIST.length).toBe(3);
  });
});

/* ══════════════ GT 10 — CEO SAME 회수 + negative leakage(라이브) ══════════════ */

const ORIGIN_GT = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";
const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/core-2m-ceo-visual-gt.json"), "utf8"),
) as { candidates: Array<{ domain: string; url: string; calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN" }> };

describe.runIf(LIVE)("CORE-2AF 라이브 — GT 10 회수/누출(READ-ONLY)", () => {
  it(
    "CEO SAME 회수 · DIFFERENT/UNCERTAIN leakage",
    async () => {
      const ex = await shopifySiteStrategy.extract(ORIGIN_GT);
      expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
      let dna = buildProductIdentityDna(
        buildCanonicalProduct(ORIGIN_GT, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
      );
      if (!dna.brand.value) {
        const h = await fetchPlainHtml(ORIGIN_GT);
        const site = h ? extractSiteBrandName(h) : null;
        if (site?.value) {
          dna = buildProductIdentityDna(
            buildCanonicalProduct(
              ORIGIN_GT,
              { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
              {} as Record<string, ProductDataSource>,
              [],
            ),
          );
        }
      }
      expect(dna.brand.value, "🔴 원상품 brand 가 비면 측정 열화 — 거부").toBeTruthy();
      const originFacts = productFactsFromIdentityDna(dna);

      const rows: Array<{ domain: string; ceo: string; s: Shot }> = [];
      for (const g of GT.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    🔴 ${g.domain} 측정불가(${r.status})`);
          continue;
        }
        rows.push({ domain: g.domain, ceo: g.calibrationLabel, s: shoot(originFacts, r.candidate.facts) });
      }
      expect(rows.length, "🔴 후보를 하나도 읽지 못했다 — 측정불가").toBe(GT.candidates.length);

      /** 🔴 replicationGate — 복제 verdict 가 운영 verdict 를 전건 재현해야 한다. */
      const predict = (s: Shot) =>
        s.conflicts.length > 0
          ? "CONFLICT"
          : s.blockers.length === 0 && s.core >= 5
            ? "SAME"
            : s.total >= 3
              ? "PRESUMED_SAME"
              : s.total >= 1
                ? "SIMILAR"
                : "UNKNOWN";
      const mm = rows.filter((r) => predict(r.s) !== r.s.verdict);
      console.log(`\n═══ 🔴 replicationGate — mismatch **${mm.length}/${rows.length}** ═══`);
      for (const m of mm) console.log(`    🔴 ${m.domain}: 복제 ${predict(m.s)} ↔ 운영 ${m.s.verdict}`);
      expect(mm.length, "🔴🔴 복제식이 운영을 재현하지 못한다 — 숫자를 쓰지 않는다").toBe(0);

      console.log("\n═══ GT 10 — 조건부 완화 회수/누출 ═══");
      const ceoSame = rows.filter((r) => r.ceo === "SAME").length;
      for (const si of SI_LIST) {
        let rec = 0;
        let dLeak = 0;
        let uLeak = 0;
        const moved: string[] = [];
        for (const r of rows) {
          const cf = counterfactual(r.s, si);
          if (cf !== r.s.verdict) moved.push(`${r.domain}:${r.s.verdict}→${cf}`);
          if (cf === "SAME") {
            if (r.ceo === "SAME") rec += 1;
            if (r.ceo === "DIFFERENT") dLeak += 1;
            if (r.ceo === "UNCERTAIN") uLeak += 1;
          }
        }
        console.log(
          `    ${si.padEnd(26)}recovery **${rec}/${ceoSame}** · DIFF leak **${dLeak}** · UNC leak **${uLeak}**  ${moved.join(" · ") || "변화 0"}`,
        );
        expect(dLeak, `🔴 ${si} 에서 DIFFERENT 누출 — 즉시 STOP`).toBe(0);
        expect(uLeak, `🔴 ${si} 에서 UNCERTAIN 누출 — 즉시 STOP`).toBe(0);
      }

      console.log("\n═══ negative control ═══");
      for (const d of ["parkette.ca", "bornyesterdaykids.com"]) {
        const r = rows.find((x) => x.domain === d);
        console.log(`    ${d.padEnd(22)}${r?.ceo.padEnd(10)}${r?.s.verdict} · conflicts[${r?.s.conflicts.join(",")}]`);
      }
    },
    20 * 60 * 1000,
  );
});
