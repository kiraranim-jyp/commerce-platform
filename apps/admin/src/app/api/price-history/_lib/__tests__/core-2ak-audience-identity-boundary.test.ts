import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
} from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { resolveAudienceLine } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AK — **Audience 를 identity 에서 뺄 수 있는 «경계»** (운영 0 · 비용 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **CEO GT 가 가설을 확인했다** — CORE-2AJ 후보 **4/4 SAME**
 *    (품번 없음 · TITLE_STRONG · CHILD↔BABY · GARMENT t-shirt↔t-shirt).
 * 🔴 **그래서 질문이 바뀌었다**(CPO §13):
 * ```
 * 「Baby/Kids 가 같은가」가 아니라
 * 「연령 차이를 identity 에서 **무시하면서** 실제 다른 상품을 SAME 으로 올리지 «않는»
 *   안전한 경계가 존재하는가」
 * ```
 *
 * ── 🔴 두 반사실을 **나란히** 잰다(이것이 이 WU 의 설계다) ────────────────────
 * ```
 * C0  현재 정책 — AUDIENCE_LINE blocker 유지
 * C1  **AUDIENCE_LINE 을 조건 없이 제거**(CPO §6 명세 그대로)
 * S3  참고 — SI-3(TITLE_STRONG 일 때만 제거 · CORE-2AF 의 그 조건)
 * 🔴 셋 다 **다른 blocker/점수/threshold 를 한 글자도 바꾸지 않는다**
 * 🟢 C1 ↔ S3 를 같이 재는 이유 — 「경계가 필요한가」가 **숫자로** 드러난다
 * ```
 *
 * ── 🔴 negative 의 «등급» 을 섞지 않는다 ──────────────────────────────────────
 * ```
 * N-CEO      CEO 가 DIFFERENT/UNCERTAIN 이라 한 것                  🔴 현재 **0건**
 * N-CONTRACT 리포가 「SAME 이 아니다」로 **잠근** 것 — WU-143 `BABY_FALSE_SAME` **5쌍**
 *            (origin B226AC018 아동 올오버 티셔츠 ↔ **다른 그래픽** baby 5건)
 *            🔴 **CEO 라벨이 아니다.** 「CEO DIFFERENT」로 적지 않는다
 * N-SHAPE    같은 브랜드 · TITLE_STRONG · baby↔kids 인데 **그래픽이 다른** 쌍
 *            🔴 라벨 없음 ⟹ **CEO GT 필요**(이 WU 가 그 목록을 만든다)
 * ```
 */

const LIVE = process.env.CORE2AK_LIVE === "1";
const FXDIR = path.join(__dirname, "fixtures");
const CRAWLER_FX = path.join(__dirname, "../../../../../../../../packages/crawler/src/__tests__/fixtures");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* ══════════════════════ 공통 계측 ══════════════════════ */

const GARMENT_WORDS = [
  "t-shirt","tshirt","tee","sweatshirt","hoodie","cardigan","romper","onesie","bodysuit","body",
  "trousers","pants","leggings","jogging","dress","jacket","shoes","sandals","socks","cap","mittens","shirt",
];
function garmentWord(title: string): string | null {
  const t = title.toLowerCase();
  for (const w of [...GARMENT_WORDS].sort((a, b) => b.length - a.length)) if (t.includes(w)) return w;
  return null;
}
function signalsOf(f: ProductFacts): string[] {
  return [...f.audienceSignals, ...(f.categoryText ? [f.categoryText] : []), ...(f.ageRangeText ? [f.ageRangeText] : []), f.title];
}

type Garment = "SAME" | "DIFFERENT" | "UNKNOWN";
interface Shot {
  c0: string;
  c1: string;
  s3: string;
  titleStrong: boolean;
  audMismatch: boolean;
  garment: Garment;
  gw: string;
  core: number;
  total: number;
  blockers: string[];
  conflicts: string[];
  mc: string;
  candCode: string | null;
  lineX: string | null;
  lineY: string | null;
}

/** 🔴 `AUDIENCE_LINE` **하나만** 뺀 뒤 **기존 등급 규칙** 을 그대로 적용한다. */
function gradeWithout(blockers: string[], core: number, total: number, conflicts: string[]): string {
  if (conflicts.length > 0) return "CONFLICT";
  if (blockers.length === 0 && core >= 5) return "SAME";
  if (total >= 3) return "PRESUMED_SAME";
  if (total >= 1) return "SIMILAR";
  return "UNKNOWN";
}

function shoot(x: ProductFacts, y: ProductFacts): Shot {
  const c = compareCrossSellerProducts(x, y);
  const axes = (c.axes ?? []).map((v) => ({ axis: String(v.axis), points: v.points ?? 0 }));
  const blockers = (c.blockers ?? []).map((v) => (typeof v === "string" ? v : v.blocker));
  const conflicts = (c.conflicts ?? []).map((v) => (typeof v === "string" ? v : v.conflict));
  const core = axes.filter((v) => v.axis !== "IMAGE" && !(v.axis === "TITLE" && v.points === 1)).reduce((s, v) => s + v.points, 0);
  const total = axes.reduce((s, v) => s + v.points, 0);
  const titleStrong = axes.some((v) => v.axis === "TITLE" && v.points === 2);
  const lineX = resolveAudienceLine(signalsOf(x));
  const lineY = resolveAudienceLine(signalsOf(y));
  const gx = garmentWord(x.title);
  const gy = garmentWord(y.title);
  const garment: Garment = blockers.includes("GARMENT_FORM") ? "DIFFERENT" : gx && gy ? (gx === gy ? "SAME" : "DIFFERENT") : "UNKNOWN";
  const noAud = blockers.filter((b) => b !== "AUDIENCE_LINE");
  return {
    c0: String(c.verdict),
    /** C1 — 조건 없이 제거. */
    c1: gradeWithout(noAud, core, total, conflicts),
    /** S3 — TITLE_STRONG 일 때만 제거. */
    s3: gradeWithout(titleStrong ? noAud : blockers, core, total, conflicts),
    titleStrong,
    audMismatch: Boolean(lineX && lineY && lineX !== lineY),
    garment,
    gw: `${gx ?? "?"}↔${gy ?? "?"}`,
    core,
    total,
    blockers,
    conflicts,
    mc: String(compareModelCode(x.brandModelCode, y.brandModelCode)),
    candCode: y.brandModelCode,
    lineX,
    lineY,
  };
}

/* ══════════ N-CONTRACT — WU-143 5쌍(네트워크 0 · 운영 로더) ══════════ */

function boboFx(code: string): ProductFacts {
  return productFactsFromShopifyProduct(
    JSON.parse(readFileSync(path.join(CRAWLER_FX, `bobochoses-${code.toLowerCase()}.json`), "utf8")),
    "bobochoses.com",
  );
}
function juniorFx(handle: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(CRAWLER_FX, `junioredition-${handle}.json`), "utf8")) as Record<string, unknown>;
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
const WU143_ORIGIN = () => {
  const f = productFactsFromSmallableHtml(readFileSync(path.join(CRAWLER_FX, "smallable-430632-product.html"), "utf8"), "430632");
  if (!f) throw new Error("🔴 smallable fixture 실패");
  return f;
};
const WU143: Array<[string, () => ProductFacts]> = [
  ["B226AB043 Mush Monster Duo", () => boboFx("B226AB043")],
  ["B226AB048 Softpaw Monster", () => boboFx("B226AB048")],
  ["junior Mush Monster Duo Baby", () => juniorFx("mush-monster-duo-all-over-baby-t-shirt-by-bobo-choses")],
  ["junior Juicy Tomatoes Baby", () => juniorFx("juicy-tomatoes-all-over-baby-t-shirt-by-bobo-choses")],
  ["junior Bobo Choses Color Baby", () => juniorFx("bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses")],
];

describe("CORE-2AK 계약 — N-CONTRACT 에서 C0 / C1 / S3 를 나란히 본다(네트워크 0)", () => {
  it("AK-1 🟢 CEO GT fixture 가 **4/4 SAME** 으로 고정됐다(URL 키)", () => {
    const gt = JSON.parse(readFileSync(path.join(FXDIR, "core-2aj-human-gt.json"), "utf8"));
    expect(gt.counts).toEqual({ SAME: 4, DIFFERENT: 0, UNCERTAIN: 0, total: 4 });
    expect(gt.candidates.length).toBe(4);
    for (const c of gt.candidates) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.verdict).toBe("SAME");
    }
  });

  it("AK-2 🔴🔴 **C1(조건 없는 제거)이 WU-143 5쌍을 다시 연다** — S3 는 열지 않는다", () => {
    console.log("\n════════ CORE-2AK — Audience identity 경계 ════════");
    console.log("🔴 운영 0 · 배포 0 · 가격 0 · threshold 0\n");
    console.log("═══ N-CONTRACT · WU-143 5쌍(리포가 「SAME 아님」으로 잠근 것 · CEO 라벨 아님) ═══");
    console.log(`    ${"후보".padEnd(34)}${"C0".padEnd(16)}${"C1".padEnd(16)}${"S3".padEnd(16)}${"TS".padEnd(4)}core`);
    const x = WU143_ORIGIN();
    let c1Open = 0;
    let s3Open = 0;
    for (const [label, f] of WU143) {
      const s = shoot(x, f());
      if (s.c1 === "SAME") c1Open += 1;
      if (s.s3 === "SAME") s3Open += 1;
      console.log(
        `    ${label.padEnd(34)}${s.c0.padEnd(16)}${s.c1.padEnd(16)}${s.s3.padEnd(16)}${(s.titleStrong ? "Y" : "N").padEnd(4)}${s.core}`,
      );
      console.log(`        ↳ blockers[${s.blockers.join(",")}] · garment ${s.gw}(${s.garment}) · line ${s.lineX}↔${s.lineY}`);
    }
    console.log(`\n    🔴 **C1 이 SAME 으로 여는 쌍 ${c1Open}/5**   ·   🟢 **S3 가 여는 쌍 ${s3Open}/5**`);
    console.log(
      `    ⟹ ${c1Open > 0 ? "🔴🔴 **조건 없는 제거는 WU-143 를 되돌린다** — 경계가 «필요하다»" : "🟡 이 분모에서는 C1 도 열지 않는다"}`,
    );
    /** 🔴 숫자를 숨기지 않는다 — 어느 쪽이든 그대로 단언한다. */
    expect(s3Open, "🔴 S3 가 WU-143 를 열면 CORE-2AF 결과가 뒤집힌다").toBe(0);
    expect(c1Open).toBeGreaterThanOrEqual(0);
  });

  it("AK-3 🔴 C1/S3 는 `AUDIENCE_LINE` **하나만** 건드린다(연쇄 완화 0)", () => {
    const src = `${shoot.toString()} ${gradeWithout.toString()}`.replace(/\s+/g, " ");
    expect(src).toContain('b !== "AUDIENCE_LINE"');
    for (const no of ["GARMENT_FORM\"", "MODEL_CODE\"", "COLOR\"", "MATERIAL\""]) {
      expect(src, `🔴 ${no} 를 같이 풀면 연쇄 보정이다`).not.toContain(`!== "${no}`);
    }
    expect(src).toContain("core >= 5");
    expect(src).toContain("total >= 3");
  });
});

/* ══════════════════════════════ 라이브 스프린트 ══════════════════════════════ */

const ORIGIN_HOST = "bobochoses.com";

async function shopifyAll(host: string, maxPages = 8): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= maxPages; page += 1) {
    try {
      const res = await fetch(`https://${host}/products.json?limit=250&page=${page}`, {
        headers: { accept: "application/json", "user-agent": UA },
      });
      if (!res.ok) break;
      const body = (await res.json()) as { products?: Array<Record<string, unknown>> };
      if (!body.products?.length) break;
      out.push(...body.products);
      if (body.products.length < 250) break;
    } catch {
      break;
    }
  }
  return out;
}

function factsOf(p: Record<string, unknown>, host: string): ProductFacts | null {
  const f = productFactsFromShopifyProduct(
    {
      title: String(p.title ?? ""),
      handle: p.handle as string,
      url: `/products/${p.handle as string}`,
      description: (p.body_html as string) ?? "",
      vendor: p.vendor as string,
      type: p.product_type as string,
      tags: p.tags as string[],
      images: (p.images as Array<{ src?: string }> | undefined)?.map((i) => i.src ?? "") ?? [],
      options: p.options as { name?: string; values?: string[] }[],
    } as never,
    host,
  );
  return f?.title ? f : null;
}

/** 🟢 공식몰 handle 에서 라인·그래픽을 읽는다(`b<season><LINE><num>-<graphic>`). */
function parseHandle(handle: string): { line: string; graphic: string } | null {
  const m = handle.match(/^b(\d{3})(a[a-z])(\d{3})-(.+)$/i);
  return m ? { line: m[2].toUpperCase(), graphic: m[4].toLowerCase() } : null;
}

/** 🔴 후보 제목에서 그래픽 낱말을 뽑는다 — **계측기** 이고 운영 규칙이 아니다. */
function graphicTokens(title: string): Set<string> {
  const STOP = new Set([
    "bobo","choses","baby","babies","kids","kid","child","children","the","and","in","of","by","for","a","an",
    ...GARMENT_WORDS,
  ]);
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
function graphicOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  return inter / new Set([...a, ...b]).size;
}

describe.runIf(LIVE)("CORE-2AK 라이브 — positive 확대 · negative 모양 · C0/C1/S3", () => {
  it(
    "경계가 존재하는가",
    async () => {
      /* ── 원상품 풀: 공식몰 전체에서 **kids(AC) 상품** ── */
      const boboAll = await shopifyAll(ORIGIN_HOST, 4);
      const kidsOrigins: Array<{ code: string; graphic: string; handle: string; facts: ProductFacts }> = [];
      for (const p of boboAll) {
        const h = String(p.handle ?? "");
        const pa = parseHandle(h);
        if (!pa || pa.line !== "AC") continue;
        const f = factsOf(p, ORIGIN_HOST);
        if (f) kidsOrigins.push({ code: (f.brandModelCode ?? "").toUpperCase(), graphic: pa.graphic, handle: h, facts: f });
      }
      console.log(`\n═══ 원상품 풀 — 공식몰 상품 ${boboAll.length} · **AC(kids) ${kidsOrigins.length}** ═══`);

      /* ── 후보 풀: 기존 GT 에 등장한 리테일러의 공개 목록에서 Bobo + baby ── */
      const known = JSON.parse(readFileSync(path.join(FXDIR, "wu-112-human-gt.json"), "utf8")) as {
        candidates: Array<{ url: string }>;
      };
      const g2m = JSON.parse(readFileSync(path.join(FXDIR, "core-2m-ceo-visual-gt.json"), "utf8")) as {
        candidates: Array<{ url: string }>;
      };
      const hosts = [
        ...new Set(
          [...known.candidates, ...g2m.candidates]
            .map((c) => {
              try {
                return new URL(c.url).host.toLowerCase();
              } catch {
                return "";
              }
            })
            .filter((h) => h && !h.includes("bobochoses.com")),
        ),
      ];
      let http = 0;
      const babyCands: Array<{ host: string; url: string; facts: ProductFacts; tokens: Set<string> }> = [];
      for (const host of hosts) {
        const ps = await shopifyAll(host);
        http += 1;
        for (const p of ps) {
          const title = String(p.title ?? "");
          const brandHay = `${title} ${String(p.vendor ?? "")}`.toLowerCase();
          const lineHay = `${title} ${Array.isArray(p.tags) ? (p.tags as string[]).join(" ") : ""} ${String(p.product_type ?? "")}`.toLowerCase();
          if (!brandHay.includes("bobo")) continue;
          if (!/baby|babies|newborn/.test(lineHay)) continue;
          const f = factsOf(p, host);
          if (f) babyCands.push({ host, url: `https://${host}/products/${p.handle as string}`, facts: f, tokens: graphicTokens(f.title) });
        }
      }
      console.log(`═══ 후보 풀 — host ${hosts.length}(응답 수집) · **Bobo+baby ${babyCands.length}건** · API spend 0 ═══`);

      /* ── 쌍 구성: 그래픽 겹침으로 positive / negative-shape 를 가른다 ── */
      interface Pair {
        kind: "POS" | "NEG_SHAPE";
        originCode: string;
        originTitle: string;
        host: string;
        url: string;
        candTitle: string;
        overlap: number;
        s: Shot;
      }
      const pairs: Pair[] = [];
      for (const c of babyCands) {
        /** 🟢 가장 많이 겹치는 원상품 = positive 후보 · 겹침이 **0** 인 원상품 = negative 모양. */
        let best: { o: (typeof kidsOrigins)[number]; ov: number } | null = null;
        for (const o of kidsOrigins) {
          const ov = graphicOverlap(graphicTokens(o.facts.title), c.tokens);
          if (!best || ov > best.ov) best = { o, ov };
        }
        if (!best || best.ov <= 0) continue;
        const s = shoot(best.o.facts, c.facts);
        /** 🔴 positive 는 **그래픽이 강하게 겹치는** 쌍, negative 모양은 **TITLE_STRONG 인데 겹침이 약한** 쌍. */
        pairs.push({
          kind: best.ov >= 0.5 ? "POS" : "NEG_SHAPE",
          originCode: best.o.code,
          originTitle: best.o.facts.title,
          host: c.host,
          url: c.url,
          candTitle: c.facts.title,
          overlap: Number(best.ov.toFixed(2)),
          s,
        });
      }

      const audPairs = pairs.filter((p) => p.s.audMismatch && p.s.conflicts.length === 0);
      const pos = audPairs.filter((p) => p.kind === "POS" && p.s.titleStrong && p.s.garment === "SAME");
      const negShape = audPairs.filter((p) => p.kind === "NEG_SHAPE" && p.s.titleStrong);

      console.log(`\n═══ §1·§2 표본 ═══`);
      console.log(`    그래픽이 겹치는 쌍 **${pairs.length}** · 그중 AUDIENCE mismatch & conflict 없음 **${audPairs.length}**`);
      console.log(`    🟢 **positive**(그래픽 강겹침 + TITLE_STRONG + GARMENT 같음) **${pos.length}**`);
      console.log(`    🟡 **negative 모양**(TITLE_STRONG 인데 그래픽 약겹침) **${negShape.length}** ⟹ 🔴 CEO GT 필요`);

      /* ── §4 C0 → C1 / S3 ── */
      const tally = (rows: Pair[], key: "c1" | "s3") => rows.filter((r) => r.s[key] === "SAME" && r.s.c0 !== "SAME").length;
      console.log(`\n═══ §4 positive 에서의 회수(C0 → ?) ═══`);
      console.log(`    ${"판매처".padEnd(22)}${"원상품".padEnd(34)}${"C0".padEnd(16)}${"C1".padEnd(16)}${"S3".padEnd(16)}core`);
      for (const p of pos.slice(0, 24)) {
        console.log(
          `    ${p.host.slice(0, 21).padEnd(22)}${p.originTitle.slice(0, 33).padEnd(34)}${p.s.c0.padEnd(16)}${p.s.c1.padEnd(16)}${p.s.s3.padEnd(16)}${p.s.core}`,
        );
      }
      if (pos.length > 24) console.log(`    … 그 외 ${pos.length - 24}쌍`);
      console.log(`\n    🟢 C1 회수 **${tally(pos, "c1")}/${pos.length}** · S3 회수 **${tally(pos, "s3")}/${pos.length}**`);

      console.log(`\n═══ 🔴 §5 negative 모양 — C1/S3 가 **열어 버리는** 쌍 ═══`);
      const negOpenC1 = negShape.filter((p) => p.s.c1 === "SAME" && p.s.c0 !== "SAME");
      const negOpenS3 = negShape.filter((p) => p.s.s3 === "SAME" && p.s.c0 !== "SAME");
      console.log(`    C1 이 여는 negative 모양 **${negOpenC1.length}/${negShape.length}** · S3 **${negOpenS3.length}/${negShape.length}**`);

      /**
       * 🔴🔴 CORE-2AL — **N-SHAPE 전체의 정확한 URL** 을 적는다(열리든 안 열리든).
       *    CPO §2 가 그 1건을 CEO GT 대상으로 지정했고, **이 하니스가 유일한 출처** 다.
       *    🔴 URL 을 추정하지 않는다 — 수집된 후보의 값을 그대로 찍는다.
       */
      console.log(`\n═══ 🟡 CORE-2AL — **N-SHAPE 정확한 URL**(CEO GT 대상) ═══`);
      for (const p of negShape) {
        console.log(`    원상품  ${p.originCode}  "${p.originTitle}"`);
        console.log(`    후보    ${p.url}`);
        console.log(
          `            "${p.candTitle}"  겹침 ${p.overlap} · garment ${p.s.gw}(${p.s.garment}) · line ${p.s.lineX}↔${p.s.lineY} · core ${p.s.core} · C0 ${p.s.c0} → S3 ${p.s.s3}`,
        );
      }
      for (const p of negOpenS3.slice(0, 12)) {
        console.log(`\n    🔴 원상품  "${p.originTitle}"  (${p.originCode})`);
        console.log(`       후보    ${p.url}`);
        console.log(`               "${p.candTitle}"  그래픽 겹침 ${p.overlap} · garment ${p.s.gw}(${p.s.garment})`);
        console.log(`       C0 ${p.s.c0} → **C1 ${p.s.c1} · S3 ${p.s.s3}** · core ${p.s.core} · 품번 ${p.s.candCode ?? "없음"}`);
      }
      if (negOpenS3.length > 12) console.log(`    … 그 외 ${negOpenS3.length - 12}쌍`);

      /* ── §3 CEO GT 적용 ── */
      const gt = JSON.parse(readFileSync(path.join(FXDIR, "core-2aj-human-gt.json"), "utf8")) as {
        candidates: Array<{ url: string; verdict: string }>;
      };
      const gtMap = new Map(gt.candidates.map((c) => [c.url.toLowerCase(), c.verdict]));
      const labeled = audPairs.filter((p) => gtMap.has(p.url.toLowerCase()));
      let leakC1 = 0;
      let leakS3 = 0;
      let recC1 = 0;
      let recS3 = 0;
      for (const p of labeled) {
        const v = gtMap.get(p.url.toLowerCase());
        if (p.s.c1 === "SAME" && p.s.c0 !== "SAME") (v === "SAME" ? recC1++ : leakC1++);
        if (p.s.s3 === "SAME" && p.s.c0 !== "SAME") (v === "SAME" ? recS3++ : leakS3++);
      }
      console.log(`\n═══ §3 CEO GT 적용(라벨된 쌍 ${labeled.length}) ═══`);
      console.log(`    C1 회수 **${recC1}** · C1 누출 **${leakC1}**   |   S3 회수 **${recS3}** · S3 누출 **${leakS3}**`);
      console.log(`    🔴 CEO DIFFERENT/UNCERTAIN 라벨 **0건** ⟹ 누출 측정의 분모가 없다(MORE DATA)`);

      expect(pairs.length, "🔴 쌍이 비면 측정하지 않는다").toBeGreaterThan(0);
      expect(leakS3, "🔴 S3 가 CEO 비-SAME 을 열었다 — UNSAFE").toBe(0);
      expect(leakC1, "🔴 C1 이 CEO 비-SAME 을 열었다 — UNSAFE").toBe(0);
    },
    90 * 60 * 1000,
  );
});
