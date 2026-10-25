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
import { productFactsFromSmallableHtml } from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AM — **Identity 판단 순서 전수점검** (운영 0 · 가격 0 · Audience 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §17 — 「동일성은 점수를 많이 쌓아 만드는 것이 아니라 **강한 Identity 부터**
 *    확인하고 부족할 때 다음으로 내려가는 방식」. 즉 **BRAND → CODE → TITLE → DETAIL**.
 *
 * ── 🔴🔴 코드 추적이 확정한 사실(§7·§9 문제 A) ────────────────────────────────
 * ```
 * `compareCrossSellerProducts` 의 **유일한 조기 반환** 은 `conflicts.length > 0` 이고
 * 그때 **`axes: []`** 를 돌려준다(cross-seller.ts:895-905).
 * 🔴 그리고 `MODEL_CODE conflict` 는 그 **앞**(:879-881)에서 conflicts 에 들어간다.
 * ⟹ **품번이 다르면 TITLE/DETAIL 축이 «계산조차» 되지 않는다.**
 * 🔴 그런데 CEO GT 는 `b226ab040`(품번 다름)을 **SAME** 이라 했다
 *    ⟹ 현재 구조에서 그 판정은 **구조적으로 도달 불가능** 하다.
 * ```
 *
 * ── 🟢 그래서 C1 을 이렇게 둔다(점수·threshold 변경 **0**) ────────────────────
 * ```
 * C0  현재 운영 그대로
 * C1  **품번 충돌일 때만** 조기 반환을 건너뛰고 TITLE/DETAIL 로 내려간다.
 *     🔴 그리고 SAME 에 닿으려면 **TITLE_STRONG(디자인 이름 일치)** 을 요구한다
 *        (CEO 가 「프린트를 보면 전혀 다름」으로 DIFFERENT 를 가른 그 축이다).
 *     🔴 `SAME_MIN_AXES`(5) · `corePoints` 산식 · 다른 blocker · Audience 는 **그대로**.
 * 🟢 구현 방법 — **운영 함수를 다시 부른다**(복제 0):
 *    양쪽 `brandModelCode` 를 `null` 로 둔 facts 로 `compareCrossSellerProducts` 를 호출하면
 *    품번 충돌이 사라져 **운영 코드가 TITLE/DETAIL 축을 직접 계산** 한다.
 *    🔴 그 대가로 MODEL_CODE 축 3점도 같이 사라진다 — **그 사실을 보고에 적는다**.
 * ```
 * 🔴 §10 Audience **고정** · §11 가격 **검증만** · §12 운영 matcher 변경 **0**.
 */

const LIVE = process.env.CORE2AM_LIVE === "1";
const FX = (n: string) => path.join(__dirname, "fixtures", n);
const CRAWLER_FX = path.join(__dirname, "../../../../../../../../packages/crawler/src/__tests__/fixtures");

const ORIGIN_URL: Record<string, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
  AC157: "https://bobochoses.com/products/b226ac157-mystery-bc-striped-t-shirt",
};

type V = "SAME" | "DIFFERENT" | "UNCERTAIN";
interface Row {
  set: string;
  origin: string;
  url: string;
  host: string;
  ceo: V;
}

function norm(v: unknown): V | null {
  const s = String(v ?? "").toUpperCase();
  return s === "SAME" || s === "DIFFERENT" || s === "UNCERTAIN" ? (s as V) : null;
}

/** 🟢 §13 — GT 를 **한 하니스** 에 모은다(최소 23건). 🔴 판정 충돌 URL 은 뺀다. */
function loadGt(): Row[] {
  const out: Row[] = [];
  const add = (set: string, origin: string, url: unknown, ceo: unknown) => {
    const v = norm(ceo);
    if (!v || typeof url !== "string" || !/^https?:/.test(url)) return;
    out.push({ set, origin, url, host: new URL(url).host, ceo: v });
  };
  const r = (f: string) => JSON.parse(readFileSync(FX(f), "utf8"));

  for (const c of r("wu-112-human-gt.json").candidates) add("wu-112", c.originCode, c.url, c.verdict);
  const g2m = r("core-2m-ceo-visual-gt.json");
  for (const c of g2m.candidates) add("core-2m", g2m.originCode, c.url, c.calibrationLabel);
  for (const c of r("core-2aj-human-gt.json").candidates) add("core-2aj", c.originCode, c.url, c.verdict);
  for (const c of r("core-2al-human-gt.json").candidates) add("core-2al", c.origin, c.url, c.verdict);

  /** 🔴 같은 URL 에 다른 판정이 있으면 **측정에서 뺀다**(CTO 가 고르지 않는다). */
  const byKey = new Map<string, Row[]>();
  for (const x of out) byKey.set(`${x.origin}|${x.url.toLowerCase()}`, [...(byKey.get(`${x.origin}|${x.url.toLowerCase()}`) ?? []), x]);
  const usable: Row[] = [];
  const conflicted: string[] = [];
  for (const [k, g] of byKey) {
    if (new Set(g.map((v) => v.ceo)).size > 1) {
      conflicted.push(k.split("|")[1]);
      continue;
    }
    usable.push({ ...g[0], set: [...new Set(g.map((v) => v.set))].join("+") });
  }
  (usable as Row[] & { conflicted?: string[] }).conflicted = conflicted;
  return usable;
}

interface Shot {
  c0: string;
  c1: string;
  path: "NO_CODE_CONFLICT" | "CODE_CONFLICT_FALLTHROUGH";
  mc: string;
  titleStrong: boolean;
  core: number;
  total: number;
  blockers: string[];
  conflicts: string[];
  /** C1 경로에서 **품번을 뺀 뒤** 본 값 */
  ftTitleStrong: boolean;
  ftCore: number;
  ftBlockers: string[];
  ftConflicts: string[];
}

function grade(blockers: string[], conflicts: string[], core: number, total: number): string {
  if (conflicts.length > 0) return "CONFLICT";
  if (blockers.length === 0 && core >= 5) return "SAME";
  if (total >= 3) return "PRESUMED_SAME";
  if (total >= 1) return "SIMILAR";
  return "UNKNOWN";
}
const axesOf = (c: ReturnType<typeof compareCrossSellerProducts>) =>
  (c.axes ?? []).map((v) => ({ axis: String(v.axis), points: v.points ?? 0 }));
const coreOf = (a: Array<{ axis: string; points: number }>) =>
  a.filter((v) => v.axis !== "IMAGE" && !(v.axis === "TITLE" && v.points === 1)).reduce((s, v) => s + v.points, 0);
const strongTitle = (a: Array<{ axis: string; points: number }>) => a.some((v) => v.axis === "TITLE" && v.points === 2);

function shoot(x: ProductFacts, y: ProductFacts): Shot {
  const c = compareCrossSellerProducts(x, y);
  const a = axesOf(c);
  const blockers = (c.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const conflicts = (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const mc = String(compareModelCode(x.brandModelCode, y.brandModelCode));
  const codeOnlyConflict = conflicts.length > 0 && conflicts.every((v) => v === "MODEL_CODE");

  /**
   * 🟢 **운영 함수를 다시 부른다** — 품번을 빼면 조기 반환이 사라지고
   *    운영 코드가 TITLE/DETAIL 축을 **직접** 계산한다(복제 0).
   */
  const ft = compareCrossSellerProducts({ ...x, brandModelCode: null }, { ...y, brandModelCode: null });
  const fa = axesOf(ft);
  const ftBlockers = (ft.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const ftConflicts = (ft.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const ftTitleStrong = strongTitle(fa);
  const ftCore = coreOf(fa);

  /** 🔴 C1 — **품번 충돌일 때만** 내려간다. 그 외는 C0 그대로. */
  let c1: string;
  if (!codeOnlyConflict) {
    c1 = String(c.verdict);
  } else if (ftConflicts.length > 0) {
    c1 = "CONFLICT";
  } else if (ftTitleStrong) {
    c1 = grade(ftBlockers, [], ftCore, fa.reduce((s, v) => s + v.points, 0));
  } else {
    /** 🔴 디자인 이름이 안 맞으면 SAME 으로 올리지 않는다 — CEO 가 가른 그 축이다. */
    c1 = "CONFLICT";
  }

  return {
    c0: String(c.verdict),
    c1,
    path: codeOnlyConflict ? "CODE_CONFLICT_FALLTHROUGH" : "NO_CODE_CONFLICT",
    mc,
    titleStrong: strongTitle(a),
    core: coreOf(a),
    total: a.reduce((s, v) => s + v.points, 0),
    blockers,
    conflicts,
    ftTitleStrong,
    ftCore,
    ftBlockers,
    ftConflicts,
  };
}

/* ══════════════════ 계약 — 네트워크 0 ══════════════════ */

const CROSS_FLAT = readFileSync(
  path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/cross-seller.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")
  .replace(/\s+/g, " ");

describe("CORE-2AM 계약 — Identity 순서와 조기 반환을 바이트로 고정한다(네트워크 0)", () => {
  it("AM-1 🔴🔴 **유일한 조기 반환은 conflicts 이고 `axes: []` 를 돌려준다**", () => {
    expect(CROSS_FLAT).toContain('if (conflicts.length > 0) { return { verdict: "CONFLICT", axes: [],');
  });

  it("AM-2 🔴🔴 `MODEL_CODE conflict` 가 **그 조기 반환 앞** 에 있다(문제 A)", () => {
    const iCode = CROSS_FLAT.indexOf('conflicts.push({ conflict: "MODEL_CODE"');
    const iRet = CROSS_FLAT.indexOf("if (conflicts.length > 0) { return");
    expect(iCode).toBeGreaterThan(-1);
    expect(iRet).toBeGreaterThan(-1);
    expect(iCode, "🔴 품번 충돌이 조기 반환 뒤로 가면 이 WU 의 전제가 바뀐다").toBeLessThan(iRet);
  });

  it("AM-3 🔴 TITLE 축은 **조기 반환 뒤** 에 계산된다 ⟹ 품번 충돌 시 미계산", () => {
    const iRet = CROSS_FLAT.indexOf("if (conflicts.length > 0) { return");
    const iTitle = CROSS_FLAT.indexOf('axes.push({ axis: "TITLE"');
    expect(iTitle).toBeGreaterThan(iRet);
  });

  it("AM-4 🟢 BRAND 는 **축을 만들지 않는다** — 게이트와 blocker 뿐이다", () => {
    expect(CROSS_FLAT, "🔴 BRAND 축이 생기면 「브랜드만으로 SAME」 위험이 생긴다").not.toContain('axes.push({ axis: "BRAND"');
    expect(CROSS_FLAT).toContain('blockers.push({ blocker: "BRAND_MISMATCH"');
    expect(CROSS_FLAT).toContain('blockers.push({ blocker: "BRAND_UNCONFIRMED"');
    expect(CROSS_FLAT).toContain("if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return \"SAME\";");
  });

  it("AM-5 🔴 IMAGE 축은 **운영에서 비어 있다** — corePoints 에서도 빠진다", () => {
    expect(CROSS_FLAT).toContain('axes.push({ axis: "IMAGE"');
    expect(CROSS_FLAT).toContain('axis.axis !== "IMAGE"');
    /** 🔴 운영 호출부가 image 인자를 **넘기지 않는다**(match.ts) ⟹ 항상 undefined. */
    const MATCH_FLAT = readFileSync(
      path.join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search/match.ts"),
      "utf8",
    ).replace(/\s+/g, " ");
    expect(MATCH_FLAT).toContain("compareCrossSellerProducts(queryFacts, candidateFacts)");
    expect(MATCH_FLAT, "🔴 image 인자가 생기면 IMAGE 축이 살아난다 — 다시 측정한다").not.toContain(
      "compareCrossSellerProducts(queryFacts, candidateFacts, image",
    );
  });

  it("AM-6 🔴 C1 은 **품번 충돌일 때만** 내려가고 점수/threshold 를 바꾸지 않는다", () => {
    const src = `${shoot.toString()} ${grade.toString()}`.replace(/\s+/g, " ");
    expect(src).toContain("codeOnlyConflict");
    expect(src).toContain("core >= 5");
    expect(src).toContain("total >= 3");
    /** 🔴 Audience 를 건드리지 않는다(§10). */
    expect(src, "🔴 Audience 를 풀면 이 WU 의 범위를 넘는다").not.toContain("AUDIENCE_LINE");
  });

  it("AM-7 🟢 §13 GT 가 **23건 이상** 한 하니스에 모였다", () => {
    const gt = loadGt();
    const bySet = gt.reduce<Record<string, number>>((a, r) => ((a[r.set] = (a[r.set] ?? 0) + 1), a), {});
    const byCeo = gt.reduce<Record<string, number>>((a, r) => ((a[r.ceo] = (a[r.ceo] ?? 0) + 1), a), {});
    console.log(`\n════════ CORE-2AM — Identity 판단 순서 ════════`);
    console.log(`🔴 운영 0 · 가격 0 · Audience 고정 · API spend 0\n`);
    console.log(`═══ §13 GT 합집합 **${gt.length}건** ═══`);
    console.log(`    출처 ${JSON.stringify(bySet)}`);
    console.log(`    CEO  ${JSON.stringify(byCeo)}`);
    console.log(`    🔴 판정 충돌 제외 — ${((gt as never as { conflicted: string[] }).conflicted ?? []).join(", ") || "없음"}`);
    expect(gt.length).toBeGreaterThanOrEqual(23);
    expect(byCeo.DIFFERENT, "🔴 CEO DIFFERENT 분모가 없으면 leakage 를 못 잰다").toBeGreaterThan(0);
  });
});

/* ══════════════════════════ 라이브 ══════════════════════════ */

async function originFacts(url: string): Promise<ProductFacts> {
  const ex = await shopifySiteStrategy.extract(url);
  if (!ex?.productData) throw new Error(`🔴 원상품 추출 실패: ${url}`);
  let dna = buildProductIdentityDna(
    buildCanonicalProduct(url, ex.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
  );
  if (!dna.brand.value) {
    const h = await fetchPlainHtml(url);
    const site = h ? extractSiteBrandName(h) : null;
    if (site?.value) {
      dna = buildProductIdentityDna(
        buildCanonicalProduct(
          url,
          { ...(ex.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        ),
      );
    }
  }
  if (!dna.brand.value) throw new Error(`🔴 brand 공백 — 측정 거부: ${url}`);
  return productFactsFromIdentityDna(dna);
}

describe.runIf(LIVE)("CORE-2AM 라이브 — C0 ↔ C1(Identity priority) 전수", () => {
  it(
    "GT 23+ · KPI 전수",
    async () => {
      const gt = loadGt();
      const origins: Record<string, ProductFacts> = {};
      for (const code of new Set(gt.map((r) => r.origin))) {
        if (!ORIGIN_URL[code]) continue;
        origins[code] = await originFacts(ORIGIN_URL[code]);
      }
      /** 🔴 CORE-2AL 의 `SM430632` 원상품은 Smallable 이고 **fixture 로만** 읽는다(품번 null). */
      const sm = productFactsFromSmallableHtml(
        readFileSync(path.join(CRAWLER_FX, "smallable-430632-product.html"), "utf8"),
        "430632",
      );
      if (sm) origins.SM430632 = sm;

      interface R extends Row {
        s: Shot;
      }
      const rows: R[] = [];
      let unreachable = 0;
      for (const g of gt) {
        const o = origins[g.origin];
        if (!o) continue;
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          unreachable += 1;
          continue;
        }
        rows.push({ ...g, s: shoot(o, r.candidate.facts) });
      }
      expect(rows.length, "🔴 표본이 비면 측정하지 않는다").toBeGreaterThan(0);

      /* ── §9~§11 전수표 ── */
      console.log(`\n═══ §9 GT 결과 전수(측정 ${rows.length} · 측정불가 ${unreachable}) ═══`);
      console.log(
        `    ${"판매처".padEnd(24)}${"원".padEnd(10)}${"CEO".padEnd(10)}${"code".padEnd(12)}${"C0".padEnd(16)}${"C1".padEnd(16)}${"경로".padEnd(26)}TS/ftTS`,
      );
      for (const r of rows) {
        console.log(
          `    ${r.host.slice(0, 23).padEnd(24)}${r.origin.slice(-6).padEnd(10)}${r.ceo.padEnd(10)}${r.s.mc.padEnd(12)}${r.s.c0.padEnd(16)}${r.s.c1.padEnd(16)}${r.s.path.padEnd(26)}${r.s.titleStrong ? "Y" : "N"}/${r.s.ftTitleStrong ? "Y" : "N"}`,
        );
      }

      /* ── §12~§18 KPI ── */
      const ceoSame = rows.filter((r) => r.ceo === "SAME");
      const ceoDiff = rows.filter((r) => r.ceo === "DIFFERENT");
      const ceoUnc = rows.filter((r) => r.ceo === "UNCERTAIN");
      const kpi = (key: "c0" | "c1") => ({
        rec: ceoSame.filter((r) => r.s[key] === "SAME").length,
        dLeak: ceoDiff.filter((r) => r.s[key] === "SAME").length,
        uLeak: ceoUnc.filter((r) => r.s[key] === "SAME").length,
      });
      const k0 = kpi("c0");
      const k1 = kpi("c1");
      console.log(`\n═══ §12~§14 KPI ═══`);
      console.log(`    분모 — CEO SAME ${ceoSame.length} · DIFFERENT ${ceoDiff.length} · UNCERTAIN ${ceoUnc.length}`);
      console.log(`    C0  recovery **${k0.rec}/${ceoSame.length}** · DIFF leak **${k0.dLeak}** · UNC leak **${k0.uLeak}**`);
      console.log(`    C1  recovery **${k1.rec}/${ceoSame.length}** · DIFF leak **${k1.dLeak}** · UNC leak **${k1.uLeak}**`);

      const codeConflictRows = rows.filter((r) => r.s.path === "CODE_CONFLICT_FALLTHROUGH");
      const ccRec = codeConflictRows.filter((r) => r.ceo === "SAME" && r.s.c1 === "SAME" && r.s.c0 !== "SAME");
      const ccLeak = codeConflictRows.filter((r) => r.ceo !== "SAME" && r.s.c1 === "SAME" && r.s.c0 !== "SAME");
      console.log(`\n═══ §15 code conflict recovery ═══`);
      console.log(`    품번 충돌 쌍 **${codeConflictRows.length}** · C1 회수 **${ccRec.length}** · C1 누출 **${ccLeak.length}**`);
      for (const r of codeConflictRows) {
        console.log(
          `    ${r.ceo.padEnd(10)}${r.host.slice(0, 23).padEnd(24)}C0 ${r.s.c0.padEnd(10)} → C1 ${r.s.c1.padEnd(14)} ftTS=${r.s.ftTitleStrong ? "Y" : "N"} ftCore=${r.s.ftCore} ftBlockers[${r.s.ftBlockers.join(",") || "없음"}] ftConflicts[${r.s.ftConflicts.join(",") || "없음"}]`,
        );
      }

      const titleRec = ceoSame.filter((r) => r.s.mc === "unavailable" && r.s.c0 === "SAME" && r.s.titleStrong).length;
      console.log(`\n═══ §16 title recovery — 품번 없는데 C0 가 SAME 인 CEO SAME **${titleRec}** ═══`);
      const detailOnly = ceoSame.filter((r) => !r.s.titleStrong && r.s.c0 === "SAME").length;
      console.log(`═══ §17 detail recovery — TITLE_STRONG 없이 C0 가 SAME 인 CEO SAME **${detailOnly}** ═══`);

      console.log(`\n═══ 🔴 §14 audience-only false positive(참고 · CORE-2AK 재인용) ═══`);
      console.log(`    C1(audience 전역 제거)는 WU-143 를 **4/5** 열었다 — 이 WU 에서 다시 재지 않는다`);

      /**
       * 🔴🔴 **baseline 과 C1 유발을 섞지 않는다**(CORE-2AG 에서 같은 실수를 했다).
       *    `C0` 에 이미 있는 오포함은 **이 WU 와 무관** 하다.
       */
      const baselineWrong = rows.filter((r) => r.s.c0 === "SAME" && r.ceo !== "SAME");
      const c1Induced = rows.filter((r) => r.s.c1 === "SAME" && r.s.c0 !== "SAME" && r.ceo !== "SAME");
      const c1Recovered = rows.filter((r) => r.s.c1 === "SAME" && r.s.c0 !== "SAME" && r.ceo === "SAME");
      console.log(`\n═══ 🔴 지표 분리(baseline ↔ C1 유발) ═══`);
      console.log(
        `    기존 baseline 오포함 **${baselineWrong.length}** — ${baselineWrong.map((r) => `${r.host}(${r.ceo})`).join(", ") || "없음"}  🔴 이 WU 와 무관`,
      );
      console.log(`    🟢 **C1 이 만든 회수 ${c1Recovered.length}** · 🔴 **C1 이 만든 누출 ${c1Induced.length}**`);
      expect(c1Induced.length, "🔴 C1 이 CEO 비-SAME 을 새로 열었다 — 구조 변경 불가").toBe(0);
    },
    60 * 60 * 1000,
  );
});
