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
import { productFactsFromShopifyProduct } from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna, resolveAudienceLine } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AJ — **Retailer Evidence & SAME Safety Sprint** (운영 0 · API spend 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **질문 하나**(CPO §1): 「**품번이 없는 리테일러 후보** 에서 TITLE_STRONG +
 *    AUDIENCE_LINE mismatch 가 날 때, AUDIENCE_LINE 을 비차단으로 완화하면
 *    CEO DIFFERENT/UNCERTAIN 이 SAME 으로 **오판되는가**」.
 *
 * ── 🔴 CORE-2AI 가 확정한 전제(다시 재지 않는다) ────────────────────────────────
 * ```
 * 공식몰 AB/AC 같은그래픽 **108/108 MODEL_CODE conflict** ⟹ 조기 반환 ⟹ TITLE 축 미계산
 * ⟹ SI-3 은 **품번이 없는 후보** 에서만 발화한다. 그래서 이 WU 는 그 영역만 본다.
 * ```
 *
 * ── 🟢 §5 무비용 경로만 쓴다 ───────────────────────────────────────────────────
 * ```
 * Phase A  기존 GT/fixture 의 **후보 URL 재활용**(라벨 유무 무관)
 * Phase B  그 GT 에 **이미 등장한 리테일러 도메인** 의 **공개 Shopify 목록**(`/products.json`)
 * 🔴 도메인을 **지어내지 않는다** — 기존 후보 URL 의 host 에서 뽑는다
 * 🔴 Gemini 0 · OpenAI 0 · 유료 search 0 · 새 검색 인프라 0 · API key 0
 * ```
 *
 * ── 🔴 §6 필터 F1~F5 ─────────────────────────────────────────────────────────
 * ```
 * F1 후보 품번 없음(또는 MODEL_CODE conflict 가 나지 않음)
 * F2 TITLE_STRONG(TITLE 축 2점)
 * F3 AUDIENCE_LINE mismatch
 * F4 GARMENT **실제 같음** — 🔴 「blocker 없음」 ≠ 「같음」. 양쪽에서 옷낱말이 읽혀야 한다
 * F5 CEO 가 판단 가능(제목·URL 제공)
 * ```
 * 🔴 CTO 는 SAME/DIFFERENT 를 **대신 정하지 않는다**(§7 · §16).
 */

const LIVE = process.env.CORE2AJ_LIVE === "1";
const FXDIR = path.join(__dirname, "fixtures");

/** 🔴 원상품 URL — 리포에 실재하는 문자열(CORE-2AG/2AH 와 같은 값 · 추측 0). */
const ORIGINS: Record<string, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
};

/* ══════════════════════ 기존 후보 URL / 도메인 수집 ══════════════════════ */

interface Known {
  url: string;
  host: string;
  ceo: "SAME" | "DIFFERENT" | "UNCERTAIN" | null;
  origin: string | null;
  source: string;
}

function norm(v: unknown): Known["ceo"] {
  const s = String(v ?? "").toUpperCase();
  return s === "SAME" || s === "DIFFERENT" || s === "UNCERTAIN" ? (s as Known["ceo"]) : null;
}

/** 🟢 Phase A — 기존 GT/fixture 에서 **후보 URL 과 host 를 전수** 뽑는다(라벨 유무 무관). */
function collectKnown(): Known[] {
  const out: Known[] = [];
  const add = (source: string, origin: string | null, url: unknown, ceo: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
    let host = "";
    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      return;
    }
    out.push({ url, host, ceo: norm(ceo), origin, source });
  };
  const read = (f: string) => JSON.parse(readFileSync(path.join(FXDIR, f), "utf8"));

  const g112 = read("wu-112-human-gt.json");
  for (const c of g112.candidates) add("wu-112", c.originCode, c.url, c.verdict);
  const g2m = read("core-2m-ceo-visual-gt.json");
  for (const c of g2m.candidates) add("core-2m", g2m.originCode, c.url, c.calibrationLabel);
  for (const c of g2m.historicalConflicts ?? []) add("core-2m-conflict", g2m.originCode, c.url, null);
  const g125 = read("wu-125-human-gt.json");
  for (const c of g125.candidates) add("wu-125", c.origin, c.url, c.human);
  const g111 = read("wu-111-human-gt.json");
  for (const c of g111.candidates) add("wu-111", c.originCode, c.url, c.humanVerdict ?? c.human ?? c.verdict);
  const g116 = read("wu-116-human-gt.json");
  for (const c of g116.candidates) add("wu-116", c.originCode, c.url, c.humanVerdict ?? c.human ?? c.verdict);
  return out;
}

/* ══════════════════════ 공통 계측기 ══════════════════════ */

const GARMENT_WORDS = [
  "t-shirt",
  "tshirt",
  "tee",
  "sweatshirt",
  "hoodie",
  "cardigan",
  "romper",
  "onesie",
  "bodysuit",
  "body",
  "trousers",
  "pants",
  "leggings",
  "dress",
  "jacket",
  "shoes",
  "sandals",
  "socks",
  "cap",
  "shirt",
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
  baseline: string;
  cf: string;
  titleStrong: boolean;
  audMismatch: boolean;
  garment: Garment;
  garmentWords: string;
  core: number;
  total: number;
  blockers: string[];
  conflicts: string[];
  modelCode: string;
  candCode: string | null;
  lineX: string | null;
  lineY: string | null;
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
  /** 🔴 SI-3 — AUDIENCE_LINE «하나만» 비차단. 점수·다른 blocker·conflict 는 그대로. */
  const relaxed = titleStrong && blockers.includes("AUDIENCE_LINE") ? blockers.filter((v) => v !== "AUDIENCE_LINE") : blockers;
  const cf =
    conflicts.length > 0
      ? "CONFLICT"
      : relaxed.length === 0 && core >= 5
        ? "SAME"
        : total >= 3
          ? "PRESUMED_SAME"
          : total >= 1
            ? "SIMILAR"
            : "UNKNOWN";
  return {
    baseline: String(c.verdict),
    cf,
    titleStrong,
    audMismatch: Boolean(lineX && lineY && lineX !== lineY),
    garment,
    garmentWords: `${gx ?? "?"}↔${gy ?? "?"}`,
    core,
    total,
    blockers,
    conflicts,
    modelCode: String(compareModelCode(x.brandModelCode, y.brandModelCode)),
    candCode: y.brandModelCode,
    lineX,
    lineY,
  };
}

/* ══════════════════════ 계약 — 네트워크 0 ══════════════════════ */

describe("CORE-2AJ 계약 — 전제·필터·비용 경계를 고정한다(네트워크 0)", () => {
  it("AJ-1 🟢 Phase A — 기존 GT 에서 후보 URL/host 를 전수 뽑는다(도메인 추측 0)", () => {
    const known = collectKnown();
    const hosts = [...new Set(known.map((k) => k.host))].sort();
    console.log(`\n════════ CORE-2AJ — Retailer Evidence & SAME Safety ════════`);
    console.log("🔴 운영 0 · 배포 0 · API spend 0 · Gemini/OpenAI 0\n");
    console.log(`═══ §1 Phase A — 기존 후보 URL **${known.length}** · host **${hosts.length}** ═══`);
    console.log(`    ${hosts.join(" · ")}`);
    expect(known.length).toBeGreaterThan(40);
    expect(hosts.length).toBeGreaterThan(10);
  });

  it("AJ-2 🔴 F4 — GARMENT 는 세 상태다(「blocker 없음」을 «같음» 으로 쓰지 않는다)", () => {
    const src = shoot.toString().replace(/\s+/g, " ");
    expect(src).toContain('blockers.includes("GARMENT_FORM") ? "DIFFERENT"');
    expect(src, "🔴 UNKNOWN 이 사라지면 직접 반례 분모가 거짓이 된다").toContain('"UNKNOWN"');
  });

  it("AJ-3 🔴 SI-3 은 **AUDIENCE_LINE 하나만** 비차단한다(연쇄 완화 금지 · CPO §10)", () => {
    const src = shoot.toString().replace(/\s+/g, " ");
    expect(src).toContain('v !== "AUDIENCE_LINE"');
    expect(src, "🔴 GARMENT_FORM 을 조건으로 더하면 그것이 연쇄 보정이다").not.toContain('v !== "GARMENT_FORM"');
    expect(src).toContain("core >= 5");
  });

  it("AJ-4 🔴 CEO 라벨을 **만들지 않는다**(측정 함수에 판정 생성 0)", () => {
    const src = `${shoot.toString()} ${collectKnown.toString()}`;
    expect(src).not.toContain("humanVerdict =");
    expect(src).not.toContain("ceoVerdict");
  });
});

/* ══════════════════════════════ 라이브 스프린트 ══════════════════════════════ */

async function originFactsOf(url: string): Promise<ProductFacts> {
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
  if (!dna.brand.value) throw new Error(`🔴 원상품 brand 공백 — 측정 거부: ${url}`);
  return productFactsFromIdentityDna(dna);
}

describe.runIf(LIVE)("CORE-2AJ 라이브 — Phase A/B · 필터 · coverage · CEO GT 목록", () => {
  it(
    "품번 없는 리테일러 영역에서 SI-3 를 끝까지 본다",
    async () => {
      const origins: Record<string, ProductFacts> = {};
      for (const [c, u] of Object.entries(ORIGINS)) origins[c] = await originFactsOf(u);
      for (const [c, f] of Object.entries(origins)) {
        console.log(`    원상품 ${c}  line=${resolveAudienceLine(signalsOf(f))}  garment=${garmentWord(f.title)}  "${f.title}"`);
      }

      const known = collectKnown();
      const hosts = [...new Set(known.map((k) => k.host))];

      /* ── Phase B — 그 host 들의 공개 Shopify 목록(무비용) ── */
      console.log(`\n═══ §2 Phase B — 공개 Shopify 목록(무비용) ═══`);
      let httpCalls = 0;
      interface Cand {
        host: string;
        url: string;
        facts: ProductFacts;
        from: "A" | "B";
        ceo: Known["ceo"];
      }
      const cands: Cand[] = [];
      const shopifyHosts: string[] = [];
      for (const host of hosts) {
        /** 🔴 공식몰은 이 질문의 대상이 아니다(품번이 양쪽에 있어 선차단 · CORE-2AI). */
        if (host.includes("bobochoses.com")) continue;
        /**
         * 🔴🔴 **1차에 `limit=250` 한 장만 받아 표본을 과소 수집했다.**
         *    리테일러 카탈로그는 250개를 넘는다 ⟹ Bobo baby 상품이 뒤 페이지에 있으면 못 본다.
         * 🟢 페이지를 끝까지(최대 8장) 넘긴다 — 공개 endpoint 이고 **비용 0** 이다.
         */
        let products: Array<Record<string, unknown>> = [];
        for (let page = 1; page <= 8; page += 1) {
          try {
            const res = await fetch(`https://${host}/products.json?limit=250&page=${page}`, {
              headers: { accept: "application/json" },
            });
            httpCalls += 1;
            if (!res.ok) break;
            const body = (await res.json()) as { products?: Array<Record<string, unknown>> };
            if (!body.products?.length) break;
            products.push(...body.products);
            if (body.products.length < 250) break;
          } catch {
            /* 🔴 Shopify 가 아니거나 막힌 host — 그대로 넘어간다(비용 0). */
            break;
          }
        }
        if (products.length === 0) continue;
        shopifyHosts.push(`${host}(${products.length})`);
        for (const p of products) {
          const title = String(p.title ?? "");
          const vendor = String(p.vendor ?? "");
          const tags = Array.isArray(p.tags) ? (p.tags as string[]).join(" ") : String(p.tags ?? "");
          const type = String(p.product_type ?? "");
          const t = title.toLowerCase();
          /**
           * 🔴🔴 **1차 필터가 제목만 봐서 표본을 놓쳤다** — 리테일러는 브랜드를 보통
           *    `vendor` 에 넣고 라인은 `tags`/`product_type` 에 넣는다.
           * 🟢 그래서 **브랜드는 title ∪ vendor** · **baby 표기는 title ∪ tags ∪ type** 에서 본다.
           * 🔴 값을 **지어내지 않는다** — 목록이 준 칸만 읽는다.
           */
          const brandHay = `${t} ${vendor.toLowerCase()}`;
          const lineHay = `${t} ${tags.toLowerCase()} ${type.toLowerCase()}`;
          if (!brandHay.includes("bobo")) continue;
          if (!/baby|babies|newborn/.test(lineHay)) continue;
          const facts = productFactsFromShopifyProduct(
            {
              title,
              handle: p.handle as string,
              url: `/products/${p.handle as string}`,
              description: (p.body_html as string) ?? "",
              vendor: p.vendor as string,
              type: p.product_type as string,
              tags: p.tags as string[],
              options: p.options as { name?: string; values?: string[] }[],
              images: (p.images as Array<{ src?: string }> | undefined)?.map((i) => i.src ?? "") ?? [],
            } as never,
            host,
          );
          if (facts?.title) cands.push({ host, url: `https://${host}/products/${p.handle as string}`, facts, from: "B", ceo: null });
        }
      }
      console.log(`    HTTP **${httpCalls}회** · API spend **0** · Shopify 응답 host ${shopifyHosts.length}`);
      console.log(`    ${shopifyHosts.join(" · ") || "없음"}`);
      console.log(`    🟢 Bobo + baby 표기 상품 **${cands.length}건**`);

      /* ── Phase A — 기존 후보 URL 도 같이 측정(라벨 포함) ── */
      const seen = new Set(cands.map((c) => c.url.toLowerCase()));
      let aUnreachable = 0;
      for (const k of known) {
        if (k.host.includes("bobochoses.com")) continue;
        if (seen.has(k.url.toLowerCase())) continue;
        const r = await factsFromProductUrl(k.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          aUnreachable += 1;
          continue;
        }
        seen.add(k.url.toLowerCase());
        cands.push({ host: k.host, url: k.url, facts: r.candidate.facts, from: "A", ceo: k.ceo });
      }
      console.log(`\n    Phase A 측정 가능 ${cands.filter((c) => c.from === "A").length} · 측정불가 ${aUnreachable}`);

      /* ── 모든 (원상품 × 후보) 측정 ── */
      interface Row extends Cand {
        origin: string;
        s: Shot;
      }
      const rows: Row[] = [];
      for (const c of cands) for (const [code, f] of Object.entries(origins)) rows.push({ ...c, origin: code, s: shoot(f, c.facts) });

      /* ── §7 activation coverage ── */
      const codePresent = rows.filter((r) => r.s.candCode != null).length;
      const earlyMC = rows.filter((r) => r.s.conflicts.includes("MODEL_CODE")).length;
      const reach = rows.filter((r) => r.s.conflicts.length === 0 && r.s.titleStrong && r.s.audMismatch).length;
      const changed = rows.filter((r) => r.s.cf !== r.s.baseline);
      console.log(`\n═══ §7 SI-3 activation coverage ═══`);
      console.log(`    전체 (원상품×후보) 쌍 **${rows.length}**`);
      console.log(`    후보 품번 있음 ${codePresent} · 없음 **${rows.length - codePresent}**`);
      console.log(`    MODEL_CODE conflict 로 조기 종료 **${earlyMC}**`);
      console.log(`    SI-3 도달(①②, conflict 없음) **${reach}**`);
      console.log(`    실제 verdict 변화 **${changed.length}** — ${changed.map((c) => `${c.host}:${c.s.baseline}→${c.s.cf}`).join(" · ") || "0건"}`);
      console.log(`    ⟹ 발화율 **${((reach / Math.max(1, rows.length)) * 100).toFixed(1)}%** (쌍 기준)`);

      /* ── §3 필터 F1~F4 ── */
      const f1 = rows.filter((r) => !r.s.conflicts.includes("MODEL_CODE"));
      const f2 = f1.filter((r) => r.s.titleStrong);
      const f3 = f2.filter((r) => r.s.audMismatch);
      const f4 = f3.filter((r) => r.s.garment === "SAME");
      console.log(`\n═══ §3 필터 ═══`);
      console.log(`    F1 MODEL_CODE conflict 아님   **${f1.length}**`);
      console.log(`    F2 TITLE_STRONG               **${f2.length}**`);
      console.log(`    F3 AUDIENCE mismatch          **${f3.length}**`);
      console.log(`    F4 GARMENT **실제 같음**        **${f4.length}**   (UNKNOWN ${f3.filter((r) => r.s.garment === "UNKNOWN").length} · DIFFERENT ${f3.filter((r) => r.s.garment === "DIFFERENT").length})`);

      /* ── §4 CEO GT / §6 leakage ── */
      const labeled = f4.filter((r) => r.ceo != null);
      const unlabeled = f4.filter((r) => r.ceo == null);
      let si3Rec = 0;
      let si3Leak = 0;
      const baseWrong: string[] = [];
      const direct: Row[] = [];
      for (const r of f4) {
        if (r.s.baseline === "SAME" && r.ceo && r.ceo !== "SAME") baseWrong.push(`${r.host}(${r.ceo})`);
        if (r.s.cf === "SAME" && r.s.baseline !== "SAME") {
          if (r.ceo === "SAME") si3Rec += 1;
          else if (r.ceo) {
            si3Leak += 1;
            direct.push(r);
          }
        }
      }
      console.log(`\n═══ §4 CEO GT (F4 분모 ${f4.length}) ═══`);
      console.log(
        `    라벨 있음 **${labeled.length}** — SAME ${labeled.filter((r) => r.ceo === "SAME").length} · DIFFERENT ${labeled.filter((r) => r.ceo === "DIFFERENT").length} · UNCERTAIN ${labeled.filter((r) => r.ceo === "UNCERTAIN").length}`,
      );
      console.log(`    🟡 라벨 **없음 ${unlabeled.length}** ⟹ **CEO GT 필요**`);

      console.log(`\n═══ §6 SI-3 counterfactual (라벨된 분모) ═══`);
      console.log(`    🟢 SI-3 회수 **${si3Rec}** · 🔴 SI-3 누출 **${si3Leak}**`);
      console.log(`    🔴 기존 baseline 오포함 ${baseWrong.length} — ${baseWrong.join(", ") || "없음"}(이 WU 와 무관)`);
      console.log(`    🔴 **직접 반례 ${direct.length}건**`);
      for (const d of direct) console.log(`       🔴 ${d.host} CEO=${d.ceo} ${d.s.baseline}→${d.s.cf} core=${d.s.core}`);

      /* ── §7 CEO 제출 목록(한 번에) ── */
      console.log(`\n═══ 🟡 **CEO GT 제출 목록**(CTO 는 라벨하지 않는다) ═══`);
      if (unlabeled.length === 0) console.log("    없음");
      for (const [i, r] of unlabeled.entries()) {
        console.log(`\n    [${i + 1}]`);
        console.log(`    원상품  ${ORIGINS[r.origin]}`);
        console.log(`            "${origins[r.origin].title}"  audience=${r.s.lineX}  garment=${r.s.garmentWords.split("↔")[0]}`);
        console.log(`    후보    ${r.url}`);
        console.log(`            "${r.facts.title}"  audience=${r.s.lineY}  garment=${r.s.garmentWords.split("↔")[1]}`);
        console.log(
          `    비교    품번 ${r.s.candCode ?? "**없음**"} · TITLE_STRONG Y · AUDIENCE ${r.s.lineX}↔${r.s.lineY} · GARMENT 같음 · core ${r.s.core}`,
        );
        console.log(`    왜 반례 후보  baseline ${r.s.baseline} → **SI-3 ${r.s.cf}** (SI-3 가 ${r.s.cf === "SAME" ? "**열어 버린다**" : "열지 않는다"})`);
      }

      /** 🔴🔴 CPO §10 — 직접 반례가 있으면 **UNSAFE** 다. 조건을 덧대지 않는다. */
      expect(rows.length, "🔴 표본이 비면 측정하지 않는다").toBeGreaterThan(0);
      if (si3Leak > 0) console.log(`\n    🔴🔴 **DIRECT COUNTEREXAMPLE FOUND — SI-3 UNSAFE**`);
    },
    60 * 60 * 1000,
  );
});
