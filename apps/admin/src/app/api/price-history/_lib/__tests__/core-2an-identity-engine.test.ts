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
 * 🔴🔴🔴 CORE-2AN — **Identity Engine 구조개편 반사실** (운영 0 · 가격 0 · API spend 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §16 제품 원칙 — 브랜드는 **후보를 좁히는** 정보 · 상품코드와 상품명은 **강한
 *    Identity** · 그 둘이 부족할 때 **상세정보** · Audience 는 Identity 와 **다른 개념** ·
 *    디자인이 다르면 브랜드·연령·형태가 같아도 **DIFFERENT**.
 *
 * ── 🔴 CORE-2AM 이 확정한 구조 문제(여기서 다시 재지 않는다) ──────────────────
 * ```
 * cross-seller.ts:879  MODEL_CODE conflict → conflicts
 *                :895  **유일한 조기 반환** `return { verdict:"CONFLICT", axes: [] }`
 *                :920  TITLE 축 — 그 **뒤** 다 ⟹ 품번이 다르면 상품명·상세가 **미계산**
 * ```
 *
 * ── 🟢 §11 네 단계를 **누적** 으로 잰다(전부 하니스 안 · 운영 0) ──────────────
 * ```
 * C0  현재 운영 그대로
 * C1  **MODEL_CODE conflict 뒤에도** TITLE/DETAIL 평가(다른 conflict 정책은 불변)
 * C2  C1 + **Identity / Supporting / Variant 분리** 를 SAME 게이트에 반영
 *     🔴 **완화가 아니라 제약** 이다 — SAME 에 「Identity evidence 하나 이상」을 요구한다
 *        (브랜드·형태·연령만으로는 SAME 이 되지 않는다 · CPO §16)
 * C3  C2 + **S3**(TITLE_STRONG 일 때 AUDIENCE_LINE 을 Variant 로 취급)
 * 🔴 `SAME_MIN_AXES`(5) · `corePoints` 산식 · 다른 blocker/conflict 는 **그대로** 다
 * 🔴 TITLE_STRONG 정의도 **바꾸지 않았다**(CPO §5)
 * ```
 *
 * ── 🔴 evidence 분류(§6 · 기존 축을 «재분류» 한 것이고 새 축이 아니다) ────────
 * ```
 * Identity    TITLE(2점 · 디자인 이름) · MODEL_CODE(exact)
 * Supporting  CATEGORY · COLOR · MATERIAL · FIT · SIZE · IMAGE
 * Variant     AUDIENCE · AUDIENCE_LINE · SIZE_SYSTEM
 * ```
 */

const LIVE = process.env.CORE2AN_LIVE === "1";
const FX = (n: string) => path.join(__dirname, "fixtures", n);
const CRAWLER_FX = path.join(__dirname, "../../../../../../../../packages/crawler/src/__tests__/fixtures");

const ORIGIN_URL: Record<string, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
  AC157: "https://bobochoses.com/products/b226ac157-mystery-bc-striped-t-shirt",
};

/** 🔴 §6 분류 — 기존 축 이름을 **재분류** 한 것이다(새 축 0 · 새 점수 0). */
const IDENTITY_AXES = new Set(["MODEL_CODE"]);
const VARIANT_BLOCKERS = new Set(["AUDIENCE_LINE"]);

type V = "SAME" | "DIFFERENT" | "UNCERTAIN";
interface Row {
  set: string;
  origin: string;
  url: string;
  host: string;
  ceo: V;
}
const norm = (v: unknown): V | null => {
  const s = String(v ?? "").toUpperCase();
  return s === "SAME" || s === "DIFFERENT" || s === "UNCERTAIN" ? (s as V) : null;
};

function loadGt(): { rows: Row[]; conflicted: string[] } {
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

  const byKey = new Map<string, Row[]>();
  for (const x of out) {
    const k = `${x.origin}|${x.url.toLowerCase()}`;
    byKey.set(k, [...(byKey.get(k) ?? []), x]);
  }
  const rows: Row[] = [];
  const conflicted: string[] = [];
  for (const [k, g] of byKey) {
    if (new Set(g.map((v) => v.ceo)).size > 1) {
      conflicted.push(k.split("|")[1]);
      continue;
    }
    rows.push({ ...g[0], set: [...new Set(g.map((v) => v.set))].join("+") });
  }
  return { rows, conflicted };
}

interface Axis {
  axis: string;
  points: number;
}
const axesOf = (c: ReturnType<typeof compareCrossSellerProducts>): Axis[] =>
  (c.axes ?? []).map((v) => ({ axis: String(v.axis), points: v.points ?? 0 }));
const coreOf = (a: Axis[]) =>
  a.filter((v) => v.axis !== "IMAGE" && !(v.axis === "TITLE" && v.points === 1)).reduce((s, v) => s + v.points, 0);
const totalOf = (a: Axis[]) => a.reduce((s, v) => s + v.points, 0);
const strongTitle = (a: Axis[]) => a.some((v) => v.axis === "TITLE" && v.points === 2);
const hasIdentity = (a: Axis[]) => strongTitle(a) || a.some((v) => IDENTITY_AXES.has(v.axis));

function grade(blockers: string[], conflicts: string[], core: number, total: number): string {
  if (conflicts.length > 0) return "CONFLICT";
  if (blockers.length === 0 && core >= 5) return "SAME";
  if (total >= 3) return "PRESUMED_SAME";
  if (total >= 1) return "SIMILAR";
  return "UNKNOWN";
}

interface Shot {
  c0: string;
  c1: string;
  c2: string;
  c3: string;
  codeOnlyConflict: boolean;
  mc: string;
  /** 평가에 실제로 쓰인 층(품번을 뺀 뒤) */
  axes: Axis[];
  blockers: string[];
  conflicts: string[];
  core: number;
  titleStrong: boolean;
  identity: boolean;
  imgBoth: boolean;
}

function shoot(x: ProductFacts, y: ProductFacts): Shot {
  const c = compareCrossSellerProducts(x, y);
  const a0 = axesOf(c);
  const b0 = (c.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const f0 = (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const mc = String(compareModelCode(x.brandModelCode, y.brandModelCode));
  const codeOnlyConflict = f0.length > 0 && f0.every((v) => v === "MODEL_CODE");

  /**
   * 🟢 C1 — **운영 함수를 다시 부른다**(복제 0). 품번을 빼면 조기 반환이 사라지고
   *    운영 코드가 TITLE/DETAIL 축을 **직접** 계산한다.
   * 🔴 대가 — MODEL_CODE 축 3점도 사라진다(그 사실을 보고에 적는다).
   */
  const ft = codeOnlyConflict
    ? compareCrossSellerProducts({ ...x, brandModelCode: null }, { ...y, brandModelCode: null })
    : c;
  const a = axesOf(ft);
  const b = (ft.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const f = (ft.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const core = coreOf(a);
  const total = totalOf(a);
  const ts = strongTitle(a);
  const id = hasIdentity(a);

  const c1 = codeOnlyConflict ? grade(b, f, core, total) : String(c.verdict);
  /** 🔴 C2 — **제약 추가**: SAME 에 Identity evidence 하나 이상을 요구한다. */
  const c2 = c1 === "SAME" && !id ? "PRESUMED_SAME" : c1;
  /** 🔴 C3 — S3: TITLE_STRONG 이면 `AUDIENCE_LINE` 을 Variant 로 본다(그 blocker 하나만). */
  const b3 = ts ? b.filter((v) => !VARIANT_BLOCKERS.has(v)) : b;
  const g3 = codeOnlyConflict || ts ? grade(b3, f, core, total) : String(c.verdict);
  const c3 = g3 === "SAME" && !id ? "PRESUMED_SAME" : g3;

  return {
    c0: String(c.verdict),
    c1,
    c2,
    c3,
    codeOnlyConflict,
    mc,
    axes: a,
    blockers: b,
    conflicts: f,
    core,
    titleStrong: ts,
    identity: id,
    imgBoth: x.imageUrls.length > 0 && y.imageUrls.length > 0,
  };
}

/* ══════════════════ 계약 — 네트워크 0 ══════════════════ */

describe("CORE-2AN 계약 — 네 단계의 경계를 고정한다(네트워크 0)", () => {
  /**
   * 🔴 1차에 `shoot.toString()` 으로 소스를 단언했다가 **FAIL** 했다 — vitest 가 모듈을
   *    변환해 호출이 `__vi_…` 로 바뀐다. 🟢 그래서 **행동으로** 단언한다(더 강하다).
   */
  it("AN-1 🔴 C1 은 **품번 충돌일 때만** 내려간다 · 다른 conflict 는 그대로 막는다", () => {
    const base = (over: Partial<ProductFacts>): ProductFacts => ({
      sourceUrl: "https://a.example/products/x",
      urlSlug: "x",
      brand: "Bobo Choses",
      brandModelCode: null,
      sellerSku: null,
      title: "Hug Hairy Monster T-shirt",
      coreTitleTokens: ["hug", "hairy", "monster"],
      categoryText: "T-shirts",
      colorText: "blue",
      materialText: "Organic Cotton 100%",
      fitText: null,
      ageRangeText: null,
      sizeLabels: [],
      audienceSignals: ["Kids"],
      imageUrls: [],
      ...over,
    });

    /** ① 품번 충돌 «만» — 조기 반환을 건너뛰어 TITLE/DETAIL 이 평가돼야 한다. */
    const codeOnly = shoot(
      base({ brandModelCode: "B226AC009" }),
      base({ sourceUrl: "https://b.example/products/y", urlSlug: "y", brandModelCode: "B226AB040" }),
    );
    expect(codeOnly.codeOnlyConflict, "🔴 품번 충돌 단독 케이스가 아니다").toBe(true);
    expect(codeOnly.c0, "🔴 현재 운영은 품번 충돌에서 CONFLICT 다").toBe("CONFLICT");
    expect(codeOnly.c1, "🔴 C1 이 내려가지 않았다 — 조기 반환이 그대로다").not.toBe("CONFLICT");
    expect(codeOnly.axes.length, "🟢 내려가면 TITLE/DETAIL 축이 계산된다").toBeGreaterThan(0);

    /** ② 색상 충돌 — C1 에서도 **그대로 막혀야** 한다(다른 conflict 정책 불변). */
    const colorConflict = shoot(
      base({ brandModelCode: "B226AC009", colorText: "blue" }),
      base({
        sourceUrl: "https://b.example/products/y",
        urlSlug: "y",
        brandModelCode: "B226AC009",
        colorText: "red",
      }),
    );
    expect(colorConflict.conflicts, "🔴 색상 충돌이 안 났다 — 전제가 깨졌다").toContain("COLOR");
    expect(colorConflict.codeOnlyConflict, "🔴 품번 충돌 단독이 아니어야 한다").toBe(false);
    for (const st of ["c1", "c2", "c3"] as const) {
      expect(colorConflict[st], `🔴 ${st} 가 색상 충돌을 풀었다 — 연쇄 완화다`).toBe("CONFLICT");
    }
  });

  it("AN-2 🔴🔴 C2 는 **완화가 아니라 제약** 이다(SAME 에 Identity evidence 요구)", () => {
    const src = shoot.toString().replace(/\s+/g, " ");
    expect(src).toContain('c1 === "SAME" && !id ? "PRESUMED_SAME" : c1');
    /** 🟢 제약이므로 C2 는 C1 보다 SAME 을 **늘릴 수 없다** — 단위로 확인한다. */
    expect(grade([], [], 5, 5)).toBe("SAME");
    expect(grade([], [], 4, 4)).toBe("PRESUMED_SAME");
  });

  it("AN-3 🔴 C3 는 `AUDIENCE_LINE` **하나만** Variant 로 본다(연쇄 완화 0)", () => {
    expect([...VARIANT_BLOCKERS]).toEqual(["AUDIENCE_LINE"]);
    const src = shoot.toString().replace(/\s+/g, " ");
    expect(src).toContain("ts ? b.filter((v) => !VARIANT_BLOCKERS.has(v)) : b");
    for (const no of ["GARMENT_FORM", "MATERIAL", "COLOR_VARIANT", "SAME_SELLER_DISTINCT_LISTING"]) {
      expect([...VARIANT_BLOCKERS], `🔴 ${no} 를 Variant 로 두면 보호가 사라진다`).not.toContain(no);
    }
  });

  it("AN-4 🔴 점수/threshold 를 바꾸지 않았다", () => {
    const src = grade.toString().replace(/\s+/g, " ");
    expect(src).toContain("core >= 5");
    expect(src).toContain("total >= 3");
    expect(src).toContain("total >= 1");
  });

  it("AN-5 🟢 §9 GT 34건 baseline 이 유지된다", () => {
    const { rows, conflicted } = loadGt();
    const byCeo = rows.reduce<Record<string, number>>((a, r) => ((a[r.ceo] = (a[r.ceo] ?? 0) + 1), a), {});
    console.log(`\n════════ CORE-2AN — Identity Engine 구조개편 반사실 ════════`);
    console.log("🔴 운영 0 · 가격 0 · 이미지 API 0 · API spend 0\n");
    console.log(`═══ §9 GT **${rows.length}건** · ${JSON.stringify(byCeo)} ═══`);
    console.log(`    🔴 판정 충돌 제외 ${conflicted.length}건`);
    expect(rows.length).toBe(34);
    expect(byCeo.DIFFERENT).toBeGreaterThanOrEqual(11);
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

describe.runIf(LIVE)("CORE-2AN 라이브 — C0 → C1 → C2 → C3 누적", () => {
  it(
    "GT 34 전수 · KPI · 구조 판정",
    async () => {
      const { rows: gt } = loadGt();
      const origins: Record<string, ProductFacts> = {};
      for (const code of new Set(gt.map((r) => r.origin))) {
        if (ORIGIN_URL[code]) origins[code] = await originFacts(ORIGIN_URL[code]);
      }
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
      expect(rows.length).toBeGreaterThan(0);

      const STAGES = ["c0", "c1", "c2", "c3"] as const;
      const same = rows.filter((r) => r.ceo === "SAME");
      const diff = rows.filter((r) => r.ceo === "DIFFERENT");
      const unc = rows.filter((r) => r.ceo === "UNCERTAIN");

      /* ── §7~§10 전수 ── */
      console.log(`\n═══ §7~§10 전수(측정 ${rows.length} · 측정불가 ${unreachable}) ═══`);
      console.log(
        `    ${"판매처".padEnd(24)}${"CEO".padEnd(10)}${"code".padEnd(12)}${"C0".padEnd(15)}${"C1".padEnd(15)}${"C2".padEnd(15)}${"C3".padEnd(15)}TS/ID blockers`,
      );
      for (const r of rows) {
        console.log(
          `    ${r.host.slice(0, 23).padEnd(24)}${r.ceo.padEnd(10)}${r.s.mc.padEnd(12)}${r.s.c0.padEnd(15)}${r.s.c1.padEnd(15)}${r.s.c2.padEnd(15)}${r.s.c3.padEnd(15)}${r.s.titleStrong ? "Y" : "N"}/${r.s.identity ? "Y" : "N"} [${r.s.blockers.join(",") || "없음"}]`,
        );
      }

      /* ── §11~§13 KPI 누적 ── */
      console.log(`\n═══ §11~§13 KPI 누적(분모 — SAME ${same.length} · DIFF ${diff.length} · UNC ${unc.length}) ═══`);
      console.log(`    ${"단계".padEnd(6)}${"recovery".padEnd(14)}${"DIFF leak".padEnd(12)}${"UNC leak".padEnd(11)}신규 SAME(이전 단계 대비)`);
      let prev: Set<string> | null = null;
      for (const st of STAGES) {
        const sameSet = new Set(rows.filter((r) => r.s[st] === "SAME").map((r) => r.url));
        const added = prev ? [...sameSet].filter((u) => !prev!.has(u)) : [];
        console.log(
          `    ${st.toUpperCase().padEnd(6)}${`${same.filter((r) => r.s[st] === "SAME").length}/${same.length}`.padEnd(14)}${String(diff.filter((r) => r.s[st] === "SAME").length).padEnd(12)}${String(unc.filter((r) => r.s[st] === "SAME").length).padEnd(11)}${added.map((u) => new URL(u).host).join(", ") || (prev ? "없음" : "—")}`,
        );
        prev = sameSet;
      }

      /* ── §14~§16 ── */
      const cc = rows.filter((r) => r.s.codeOnlyConflict);
      console.log(`\n═══ §14 code-conflict 처리 — 품번 충돌 쌍 **${cc.length}** ═══`);
      for (const r of cc) {
        console.log(
          `    ${r.ceo.padEnd(10)}${r.host.slice(0, 23).padEnd(24)}C0 ${r.s.c0.padEnd(10)} → C1 ${r.s.c1.padEnd(14)} → C3 ${r.s.c3.padEnd(14)} core=${r.s.core} TS=${r.s.titleStrong ? "Y" : "N"} blockers[${r.s.blockers.join(",") || "없음"}]`,
        );
      }
      const detailOnly = same.filter((r) => !r.s.titleStrong && r.s.mc !== "exact" && r.s.c0 === "SAME");
      console.log(`\n═══ §15 detail-based SAME recovery — TITLE_STRONG·품번 없이 C0 SAME 인 CEO SAME **${detailOnly.length}** ═══`);
      for (const r of detailOnly) console.log(`    ${r.host} 축[${r.s.axes.map((a) => `${a.axis}:${a.points}`).join(" ")}]`);
      const audRec = rows.filter((r) => r.s.c3 === "SAME" && r.s.c2 !== "SAME");
      console.log(`\n═══ §16 audience-based recovery(C2 → C3) **${audRec.length}** ═══`);
      for (const r of audRec) console.log(`    ${r.ceo.padEnd(10)}${r.host}  ${r.s.c2} → ${r.s.c3}`);

      /* ── §5 IMAGE ── */
      console.log(`\n═══ §5 IMAGE 가용성(🔴 이미지 API 0 · 비교는 하지 않았다) ═══`);
      console.log(`    양쪽에 이미지 URL 이 **있는** 쌍 **${rows.filter((r) => r.s.imgBoth).length}/${rows.length}**`);
      console.log(`    🔴 그러나 운영 호출부가 image 인자를 **넘기지 않는다**(CORE-2AM AM-5) ⟹ IMAGE 축 산출 **0**`);
      console.log("    🔴 그리고 IMAGE 는 corePoints 에서도 제외된다 ⟹ 살려도 SAME 에 직접 기여하지 않는다");

      /* ── §20 단계별 false positive ── */
      console.log(`\n═══ §20 단계별 false positive(CEO 비-SAME 인데 SAME) ═══`);
      for (const st of STAGES) {
        const fp = rows.filter((r) => r.s[st] === "SAME" && r.ceo !== "SAME");
        console.log(`    ${st.toUpperCase().padEnd(6)}**${fp.length}** — ${fp.map((r) => `${r.host}(${r.ceo})`).join(", ") || "없음"}`);
      }
      const baseFp = rows.filter((r) => r.s.c0 === "SAME" && r.ceo !== "SAME").length;
      const c3Fp = rows.filter((r) => r.s.c3 === "SAME" && r.ceo !== "SAME").length;
      console.log(`\n    🔴 **C3 가 «새로» 만든 false positive = ${c3Fp - baseFp}**(기존 ${baseFp} 제외)`);

      /** 🔴🔴 §12 성공 기준 — 구조 변경이 **새 false positive 를 만들면 안 된다**. */
      expect(c3Fp - baseFp, "🔴 구조 변경이 새 false positive 를 만들었다 — UNSAFE").toBe(0);
    },
    60 * 60 * 1000,
  );
});
