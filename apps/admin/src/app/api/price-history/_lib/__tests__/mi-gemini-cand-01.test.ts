/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-CANDIDATE-001 — Gemini 가 찾은 «정답 후보» 를 MI 가 SAME 으로 보는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · Discovery 0 · UI 0 · 배포 0.
 *    기본값 SKIP(`MI_P0_02_LIVE=1`). 🔴 DB 쓰기 0(SELECT 만) · 검색 재실행 0.
 *
 * ── 🟢 운영 owner 경로 (§3 — 임의 호출로 결과를 «만들지» 않는다) ─────────
 *   임의 상품 URL → 후보  `factsFromProductUrl(url)`  product-url-facts.ts:125
 *     그 파일 주석이 명시한다 — 「기존 MI 가 그대로 먹는 모양.
 *     `withConfidence(query, [candidate])` 로 넘긴다」(:57)
 *   원본 facts            `buildProductIdentityDna` → `productFactsFromIdentityDna`
 *                         (둘 다 **@commerce/shared** — 운영 import 블록 기준)
 *   판정                  `withConfidence(query, candidates)`  match.ts:476
 *   🔴 결과 칸은 `crossSellerVerdict` / `crossSellerReasons` /
 *      `crossSellerBlockers` / `crossSellerConflicts` 다. `match` 칸은 **없다**.
 *
 * ── 🔴🔴 지시서의 색상 모순을 그대로 기록한다 (추측으로 고치지 않는다) ──
 *   지시서 §1 은 「Smallable — 정확한 **Pale Pink** 상품 페이지」를 1순위로 적었다.
 *   🔴 그런데 함께 준 URL 은 `…baby-pants-**navy-blue**-louis-louise-441172` 다.
 *   → 🟢 URL 을 **그대로** 쓰되(§1 「Gemini 가 실제로 찾아온 URL 그대로」),
 *      그 후보는 **다른 색상** 임을 표에 명시한다. 🔴 navy 를 pink 로 바꿔
 *      부르지 않는다 — 그렇게 하면 「다른 색상을 SAME 으로」가 된다.
 *   🟢 원본은 DB 에 실재한다 — `Holly Hearts Ribbed Velvet Baby Pants | Pale Pink`
 *      (brand Louis Louise · color Pink · sku AAA1847110 · EUR 69).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 CPO 가 준 URL «그대로». 검색을 다시 하지 않는다. */
const GEMINI_CANDIDATES = [
  {
    store: "Smallable",
    url: "https://www.smallable.com/en/product/holly-hearts-ribbed-velvet-baby-pants-navy-blue-louis-louise-441172",
    "🔴 지시서가 적은 색": "Pale Pink",
    "🔴 URL 이 가리키는 색": "navy-blue",
    "🔴 색상 일치": false,
  },
  {
    store: "Hive Boutiques",
    url: "https://hiveboutiques.com/products/louis-louise-holly-trouser",
    "🔴 지시서가 적은 색": "Powder Pink",
    "🔴 URL 이 가리키는 색": "(URL 에 색 없음 · 상품명 Holly Trouser)",
    "🔴 색상 일치": null,
  },
  {
    store: "Dinossi",
    url: "https://www.dinossi.us/products/louis-louise-holly-hearts-fitilli-kadife-bebek-pantolon-acik-pudra-pembe",
    "🔴 지시서가 적은 색": "Powder Pink",
    "🔴 URL 이 가리키는 색": "acik pudra pembe(=연분홍, 터키어)",
    "🔴 색상 일치": true,
  },
] as const;

interface SnapRow { id: string; source_url: string; title: string; brand: string; color: string | null; sku: string | null; amt: string | null; cur: string | null }

const show = (v: unknown): string => {
  if (v === undefined) return "🔴 undefined(칸 없음)";
  if (v === null) return "🔴 null";
  if (Array.isArray(v)) return v.length === 0 ? "🔴 []" : `🟢 ${JSON.stringify(v).slice(0, 200)}`;
  if (typeof v === "object") return `🟢 ${JSON.stringify(v).slice(0, 160)}`;
  return v === "" ? '🔴 ""' : `🟢 ${JSON.stringify(v)}`;
};

describe.skipIf(!LIVE)("🔴 MI-GEMINI-CANDIDATE-001", () => {
  it(
    "Gemini 후보 URL 3개를 운영 owner 경로로 넣어 Identity 판정을 기록한다",
    async () => {
      const p = path.join(OUT_DIR, "ll-snaps.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const snaps = JSON.parse(readFileSync(p, "utf8")) as SnapRow[];
      /** 🔴 Pale Pink 원본만 고른다. 추측하지 않고 color/sku 로 고정한다. */
      const origin = snaps.find((s) => s.sku === "AAA1847110");
      if (!origin) throw new Error("원본(AAA1847110)을 못 찾음");

      /** 🟢 owner 는 운영 import 블록 기준 */
      const { factsFromProductUrl, withConfidence } = (await import("@commerce/crawler")) as unknown as {
        factsFromProductUrl: (url: string) => Promise<{
          status: string; crawlerUrl: string | null; dedupeKey: string | null;
          candidate: Record<string, unknown> | null; httpCalls: number; fetchPath: string;
        }>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
      };
      const { buildProductIdentityDna, backfillCanonicalProduct, buildCrossSellerSearchQueries, productFactsFromIdentityDna } =
        (await import("@commerce/shared")) as unknown as {
          buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
          backfillCanonicalProduct: (p: unknown) => unknown;
          buildCrossSellerSearchQueries: (dna: unknown) => string[];
          productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        };

      /* ══ Step 1 — 원본 ProductFacts (운영이 실제로 Identity 에 넘기는 값) ══ */
      const snapFull = JSON.parse(readFileSync(path.join(OUT_DIR, "ll-origin-snapshot.json"), "utf8")) as { canonicalProduct: unknown };
      const dna = buildProductIdentityDna(backfillCanonicalProduct(snapFull.canonicalProduct));
      const qFacts = productFactsFromIdentityDna(dna);
      const originFacts = {
        brand: show(qFacts.brand), brandModelCode: show(qFacts.brandModelCode),
        coreTitleTokens: show(qFacts.coreTitleTokens), colorText: show(qFacts.colorText),
        materialText: show(qFacts.materialText), categoryText: show(qFacts.categoryText),
        sellerSku: show(qFacts.sellerSku), title: show(qFacts.title),
        sizeLabels: show(qFacts.sizeLabels), audienceSignals: show(qFacts.audienceSignals),
        "🔴 facts 키 전부": Object.keys(qFacts).join(" "),
      };
      const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
        searchTerm: terms[0] ?? origin.title, searchTerms: terms, facts: qFacts,
      };

      /* ══ Step 2~5 — 후보 URL 을 운영 owner 로 넣는다 ══ */
      const rows: Record<string, unknown>[] = [];
      for (const g of GEMINI_CANDIDATES) {
        const r = await factsFromProductUrl(g.url).catch((e) => ({
          status: `🔴 THREW: ${e instanceof Error ? e.message : String(e)}`,
          crawlerUrl: null, dedupeKey: null, candidate: null, httpCalls: 0, fetchPath: "NONE",
        }));
        const cand = r.candidate;
        const cf = cand?.facts as Record<string, unknown> | undefined;

        /** Step 4/5 — 운영과 «같이» withConfidence 에 넘긴다 */
        const scored = cand ? withConfidence(query, [cand]) : [];
        const s0 = scored[0];
        const sf = s0?.facts as Record<string, unknown> | undefined;

        rows.push({
          store: g.store, url: g.url.slice(0, 100),
          "🔴 지시서가 적은 색": g["🔴 지시서가 적은 색"],
          "🔴 URL 이 가리키는 색": g["🔴 URL 이 가리키는 색"],
          "🔴 색상 일치(지시서 ↔ URL)": g["🔴 색상 일치"],
          /* Step 2 — fetch */
          fetch: { status: r.status, fetchPath: r.fetchPath, httpCalls: r.httpCalls, crawlerUrl: r.crawlerUrl?.slice(0, 90) ?? null },
          /* Step 3 — 후보 facts */
          candidateFacts: cf ? {
            brand: show(cf.brand), brandModelCode: show(cf.brandModelCode),
            coreTitleTokens: show(cf.coreTitleTokens), colorText: show(cf.colorText),
            materialText: show(cf.materialText), categoryText: show(cf.categoryText),
            sellerSku: show(cf.sellerSku), title: show(cf.title),
          } : "🔴 facts 없음",
          candidateTitle: cand ? String(cand.title ?? "").slice(0, 70) : null,
          candidatePrice: cand ? show(cand.price) : null,
          /* Step 4 — 전달 확인(withConfidence 전/후 facts 가 유지되는가) */
          "facts 전달": { before: show(cf), after: show(sf), "키 수 before": cf ? Object.keys(cf).length : 0, "키 수 after": sf ? Object.keys(sf).length : 0 },
          /* Step 5 — Identity */
          identity: s0 ? {
            matchLevel: show(s0.matchLevel), confidence: show(s0.confidence),
            crossSellerVerdict: show(s0.crossSellerVerdict),
            crossSellerReasons: show(s0.crossSellerReasons),
            crossSellerBlockers: show(s0.crossSellerBlockers),
            crossSellerConflicts: show(s0.crossSellerConflicts),
            matchReasons: show(s0.matchReasons),
          } : "🔴 후보가 없어 판정 불가",
        });
      }

      const report = {
        "🟢 DISCLAIMER": "조사 전용 · 코드 0 · DB 쓰기 0 · 검색 재실행 0 · 배포 0. " +
          "운영 owner(factsFromProductUrl → withConfidence)를 그대로 썼다.",
        "🔴🔴 지시서 모순 기록": "§1 은 「Smallable — 정확한 Pale Pink 페이지」를 1순위로 적었으나 " +
          "함께 준 URL 은 navy-blue 다. 🟢 URL 을 그대로 쓰되 색상 불일치를 표에 명시했다. " +
          "🔴 navy 를 pink 로 바꿔 부르지 않았다.",
        원본: { title: origin.title, url: origin.source_url, brand: origin.brand, color: origin.color, sku: origin.sku, price: `${origin.cur} ${origin.amt}` },
        "Step 1 원본 ProductFacts": originFacts,
        검색어: terms.slice(0, 3),
        "Step 2~5 후보별": rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "gemini-cand.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 1));
      expect(rows.length).toBe(3);
    },
    60 * 60 * 1000,
  );
});
