/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Identity Facts 전달 경로 원인 규명 — color / titleTokens / brand
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · facts 함수 0 ·
 *    검색어 0 · DB 0 · Registry 0. 기본값 SKIP(`MI_P0_02_LIVE=1`).
 *
 * ── 🔴🔴 직전 WU 의 「null」 중 둘은 «내 하니스 결함» 이었다 ──────────────
 *   `ProductFacts`(product-facts.ts:652)의 실제 칸을 읽어 보니:
 *     🔴 `color` 라는 칸은 **없다** → 실제 이름은 **`colorText`**
 *     🔴 `titleTokens` 라는 칸도 **없다** → 실제 이름은 **`coreTitleTokens`**
 *   즉 직전 보고의 「color 전건 null · titleTokens 전건 null」은
 *   **없는 키를 읽어서 나온 undefined** 였다. 🔴 제품 결함이 아닐 수 있다.
 *   → 이 하니스는 **owner 타입의 칸 이름 그대로** 다시 잰다.
 *
 * ── 🟢 전이 함수는 «한 줄씩 그대로 옮긴다»(실측) ────────────────────────
 *   `productFactsFromIdentityDna`(product-identity-dna.ts:219) 전문:
 *     brand: dna.brand.value || null      colorText: dna.color
 *     coreTitleTokens: dna.coreTitleTokens  materialText: dna.material
 *     brandModelCode: dna.brandModelCode
 *   🟢 변환·가공이 **없다.** 그래서 「전이 실패」가 성립하려면 DNA 쪽이 비어
 *      있어야 한다 → **A(추출 실패)** 가 유력하다. 🔴 단 측정으로 확인한다.
 *
 * ── 측정 순서 (CPO §지시) ──────────────────────────────────────────────
 *   원본 canonicalProduct → buildProductIdentityDna → productFactsFromIdentityDna
 *   → withConfidence 에 전달된 facts
 *   네 지점에서 `color` · `coreTitleTokens` · `brand` · `brandModelCode` 를 찍는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 CPO 가 「동일 상품 1~2개」로 한정했다. 늘리지 않는다.
 *     하나는 brand 가 `AW26` 인 Bobo 공식, 하나는 brand 가 정상인 Smallable. */
const TARGETS = ["Boo Bo Choses T-shirt", "Astrid Organic Cotton"] as const;

interface UrlRow { id: string; source_url: string; title: string; brand: string; sku: string | null; color: string | null }

const show = (v: unknown): string => {
  if (v === undefined) return "🔴 undefined (칸 자체가 없다)";
  if (v === null) return "🔴 null";
  if (Array.isArray(v)) return v.length === 0 ? "🔴 [] (빈 배열)" : `🟢 [${v.length}] ${JSON.stringify(v).slice(0, 70)}`;
  if (typeof v === "object") return `🟢 ${JSON.stringify(v).slice(0, 90)}`;
  return v === "" ? '🔴 "" (빈 문자열)' : `🟢 ${JSON.stringify(v)}`;
};

describe.skipIf(!LIVE)("🔴 MI-FACTS-01 — facts 전달 경로 추적", () => {
  it(
    "원본 → DNA → productFacts → withConfidence 네 지점을 찍는다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<{ id: string; canonicalProduct: Record<string, unknown> }[]>("e2e-snapshots.json");
      const all = [...groups.kids, ...groups.kids2, ...groups.tennis];

      const { buildProductIdentityDna, backfillCanonicalProduct, productFactsFromIdentityDna } =
        (await import("@commerce/shared")) as unknown as {
          buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
          backfillCanonicalProduct: (p: unknown) => Record<string, unknown>;
          productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        };
      const { withConfidence } = (await import("@commerce/crawler")) as unknown as {
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
      };

      const out: Record<string, unknown>[] = [];
      for (const frag of TARGETS) {
        const row = all.find((r) => r.title.includes(frag));
        if (!row) throw new Error(`대상 없음: ${frag}`);
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) throw new Error(`스냅샷 본문 없음: ${frag}`);

        /* ① 원본 canonicalProduct */
        const raw = snap.canonicalProduct;
        const rawBrand = raw.brand as { value?: unknown; source?: unknown } | undefined;
        const rawColor = raw.color as { value?: unknown; source?: unknown } | undefined;
        const stage1 = {
          "brand.value": show(rawBrand?.value),
          "brand.source": show(rawBrand?.source),
          "brandResolution": show(raw.brandResolution),
          "color.value": show(rawColor?.value),
          "title": show(raw.title && (raw.title as { value?: unknown }).value),
          "sku.value": show((raw.sku as { value?: unknown } | undefined)?.value),
        };

        /* ①-b backfill 후 */
        const product = backfillCanonicalProduct(raw);
        const bfBrand = product.brand as { value?: unknown } | undefined;
        const bfColor = product.color as { value?: unknown } | undefined;
        const stage1b = {
          "brand.value": show(bfBrand?.value),
          "color.value": show(bfColor?.value),
        };

        /* ② Identity DNA */
        const dna = buildProductIdentityDna(product);
        const dnaBrand = dna.brand as { value?: unknown } | undefined;
        const stage2 = {
          "brand.value": show(dnaBrand?.value),
          /** 🔴 DNA 의 color 는 «문자열» 이다(ProductFacts.colorText 로 그대로 간다) */
          color: show(dna.color),
          coreTitleTokens: show(dna.coreTitleTokens),
          brandModelCode: show(dna.brandModelCode),
          material: show(dna.material),
          identifier: show(dna.identifier),
          "🔴 DNA 키 목록": Object.keys(dna).join(" "),
        };

        /* ③ productFacts */
        const facts = productFactsFromIdentityDna(dna);
        const stage3 = {
          brand: show(facts.brand),
          colorText: show(facts.colorText),
          coreTitleTokens: show(facts.coreTitleTokens),
          brandModelCode: show(facts.brandModelCode),
          materialText: show(facts.materialText),
          /** 🔴 직전 WU 가 읽었던 «없는» 키들 — undefined 가 나오는 것이 정상이다 */
          "🔴 (없는 칸) color": show(facts.color),
          "🔴 (없는 칸) titleTokens": show(facts.titleTokens),
        };

        /* ④ withConfidence 가 실제로 본 facts — query 쪽을 그대로 넣어 확인 */
        const query = { title: String(facts.title), brand: facts.brand ?? undefined, sourceUrl: facts.sourceUrl, facts };
        /** 🔴 후보를 하나 넣어 `match` 가 생기는지 본다. 후보 facts 는 «없게» 둔다
         *     — 운영에서 국내 후보는 facts 가 비는 경우가 있고, 그때
         *     withConfidence(match.ts:476)가 compareCrossSellerProducts 를
         *     **부르지 않는다**(query.facts && candidateFacts 조건). */
        const probeNoFacts = withConfidence(query, [{ title: row.title, url: row.source_url, shopId: "x", shopName: "probe" }]);
        /** 🟢 그리고 후보에 «같은» facts 를 넣으면 부르는지도 본다(대조군) */
        const probeWithFacts = withConfidence(query, [{ title: row.title, url: row.source_url, shopId: "y", shopName: "probe2", facts }]);
        /** 🔴🔴 `match` 라는 칸은 **없다.** match.ts:526-538 이 `cross` 를 네 칸으로
         *     **펼쳐서** 싣는다 — `crossSellerVerdict` · `crossSellerReasons` ·
         *     `crossSellerBlockers` · `crossSellerConflicts`.
         *     🔴 직전 WU 가 `c.match` 를 읽어 「axes 전건 비어 있다」고 보고했는데
         *        그것은 **없는 칸을 읽은 것** 이다. `axes` 는 아예 실리지 않는다
         *        (compareCrossSellerProducts 내부에만 있다). */
        const probe = (c: Record<string, unknown> | undefined) => ({
          crossSellerVerdict: show(c?.crossSellerVerdict),
          crossSellerReasons: show(c?.crossSellerReasons),
          crossSellerBlockers: show(c?.crossSellerBlockers),
          crossSellerConflicts: show(c?.crossSellerConflicts),
          matchLevel: show(c?.matchLevel),
          confidence: show(c?.confidence),
          "🔴 (없는 칸) match": show(c?.match),
        });
        const stage4 = {
          "후보 facts 없음": probe(probeNoFacts[0]),
          "후보 facts 있음": probe(probeWithFacts[0]),
        };

        out.push({ 대상: frag, 원상품: { title: row.title, url: row.source_url.slice(0, 90), dbBrand: row.brand, dbColor: row.color },
          "① canonicalProduct": stage1, "①-b backfill 후": stage1b,
          "② Identity DNA": stage2, "③ productFacts": stage3, "④ withConfidence": stage4 });
      }

      const report = {
        "🟢 DISCLAIMER": "조사 전용 · 코드 0 · DB 0. owner 타입의 «실제 칸 이름» 으로 다시 쟀다.",
        "🔴 직전 WU 정정": "ProductFacts 에 `color`·`titleTokens` 라는 칸은 **없다**. " +
          "실제 이름은 `colorText`·`coreTitleTokens` 다 — 직전 보고의 「전건 null」 중 그 둘은 " +
          "**내 하니스가 없는 키를 읽은 것** 이다.",
        "🟢 전이 함수는 가공이 없다": "productFactsFromIdentityDna(:219)는 DNA 칸을 한 줄씩 그대로 옮긴다 " +
          "(colorText: dna.color · coreTitleTokens: dna.coreTitleTokens · brand: dna.brand.value || null).",
        products: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "facts-trace.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 1));
      expect(out.length).toBe(2);
    },
    30 * 60 * 1000,
  );
});
