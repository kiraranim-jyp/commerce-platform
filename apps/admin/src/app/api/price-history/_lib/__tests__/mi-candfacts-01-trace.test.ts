/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 후보 facts 생성 경로 원인 규명 — A/B/C/D/E 중 하나로 확정한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · 검색어 0 · Registry 0 · DB 0.
 *    기본값 SKIP(`MI_P0_02_LIVE=1`).
 *
 * ── 🟢 CPO 지시대로 «타입 → 생성 owner → 운영 호출부» 순서로 먼저 확인했다 ──
 *   ① 타입   `ComparisonCandidate`(types.ts:4) 의 실제 칸:
 *              `facts?: ProductFacts`                      :81
 *              `crossSellerVerdict?: SAME|PRESUMED_SAME|SIMILAR|UNKNOWN|CONFLICT`  :85
 *              `crossSellerReasons?: string[]`              :87
 *              `crossSellerBlockers?: {blocker}[]`          :95
 *              `crossSellerConflicts?: {conflict}[]`        :109
 *            🔴 `match` 칸은 **없다**(직전 WU 에서 확정).
 *   ② 생성   각 샵 **어댑터가 직접** 만든다 — `productFactsFromListing(...)`:
 *              looxloo.ts:181 · foretforet.ts:369 · deuxbebe.ts:192 ·
 *              rulii.ts:210 · littleluna.ts:112 · chocoel.ts:133 · childrensalon.ts:77
 *   ③ 주입   `withConfidence`(match.ts:509-518)가 `facts: candidateFacts` 로 다시 싣고,
 *            :524-538 이 `cross` 를 네 칸으로 펼친다.
 *
 * ── 🔴🔴 직전 WU 의 단서 — facts 는 «이미 있었다» ───────────────────────
 *   직전 덤프에 `candidateFacts: {"brand":"BOBO CHOSES", …}` 가 찍혀 있었다.
 *   🔴 그런데 나는 그 옆에서 `c.match` 를 읽어 「판정에 도달조차 못 했다」고 썼다.
 *   → 🟢 이 하니스는 **올바른 칸(`crossSellerVerdict` 등)** 으로 다시 잰다.
 *      가설: **E(정상) 또는 D** 이고 A/B/C 가 아니다. 🔴 단 측정으로 확정한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 후보가 «실제로 나온» 상품만 쓴다 — 후보 0 인 것은 이 WU 의 질문이 아니다. */
const TARGETS = ["Boo Bo Choses T-shirt", "Astrid Organic Cotton"] as const;

interface UrlRow { id: string; source_url: string; title: string; brand: string }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}
const show = (v: unknown): string => {
  if (v === undefined) return "🔴 undefined(칸 없음)";
  if (v === null) return "🔴 null";
  if (Array.isArray(v)) return v.length === 0 ? "🔴 []" : `🟢 [${v.length}]`;
  if (typeof v === "object") return `🟢 {${Object.keys(v as object).length}칸}`;
  return v === "" ? '🔴 ""' : `🟢 ${JSON.stringify(v)}`;
};

describe.skipIf(!LIVE)("🔴 MI-CANDFACTS-01 — 후보 facts 경로", () => {
  it(
    "실제 운영 검색으로 후보 facts 와 crossSeller* 를 단계별로 찍는다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<{ id: string; canonicalProduct: unknown }[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      const all = [...groups.kids, ...groups.kids2, ...groups.tennis];

      const { searchDomesticShops, withConfidence } = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{
          shopName: string; status: string; candidates: Record<string, unknown>[];
        }[]>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
      };
      const { buildProductIdentityDna, backfillCanonicalProduct, buildCrossSellerSearchQueries, productFactsFromIdentityDna } =
        (await import("@commerce/shared")) as unknown as {
          buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
          backfillCanonicalProduct: (p: unknown) => unknown;
          buildCrossSellerSearchQueries: (dna: unknown) => string[];
          productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      const autoTargets = sources
        .filter((s) => isBatchSurveyTarget(s as never, null))
        .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      const out: Record<string, unknown>[] = [];
      for (const frag of TARGETS) {
        const row = all.find((r) => r.title.includes(frag))!;
        const snap = snaps.find((x) => x.id === row.id)!;
        const dna = buildProductIdentityDna(backfillCanonicalProduct(snap.canonicalProduct));
        const facts = productFactsFromIdentityDna(dna);
        const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(facts.title), brand: facts.brand ?? undefined, sourceUrl: facts.sourceUrl,
          sku: undefined, searchTerm: terms[0] ?? row.title, searchTerms: terms, facts,
        };

        /* ── 단계 ① 검색 결과 / ② candidate 생성 / ③ facts 생성 (어댑터 안에서 동시) ── */
        const results = await searchDomesticShops(query, autoTargets.map((s) => ({
          id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy,
        })));
        /** 🔴 스프레드 뒤 타입이 `{_shop}` 으로 좁혀져 TS2339 가 났다 — 명시한다.
         *     (메모 explicit-return-types-for-union-returns 와 같은 함정이다) */
        const raw: (Record<string, unknown> & { _shop: string })[] = results.flatMap((r) =>
          r.candidates.map((c) => ({ ...c, _shop: r.shopName })),
        );
        const rawStage = raw.map((c) => {
          const f = c.facts as Record<string, unknown> | undefined;
          return {
            shop: c._shop, title: String(c.title ?? "").slice(0, 46),
            "facts 존재": show(c.facts),
            "facts.brand": show(f?.brand),
            "facts.brandModelCode": show(f?.brandModelCode),
            "facts.colorText": show(f?.colorText),
            "facts.coreTitleTokens": show(f?.coreTitleTokens),
            "facts.materialText": show(f?.materialText),
            "facts 키 수": f ? Object.keys(f).length : 0,
          };
        });

        /* ── 단계 ④ 주입 / ⑤ withConfidence 직전·직후 ── */
        const scored = withConfidence(query, raw) as (Record<string, unknown> & { _shop?: string })[];
        const scoredStage = scored.map((c) => {
          const f = c.facts as Record<string, unknown> | undefined;
          return {
            shop: c._shop, title: String(c.title ?? "").slice(0, 46),
            matchLevel: show(c.matchLevel), confidence: show(c.confidence),
            "facts 유지": show(c.facts),
            "facts.brandModelCode(주입 후)": show(f?.brandModelCode),
            /** 🔴🔴 여기가 핵심 — 올바른 칸으로 읽는다 */
            crossSellerVerdict: show(c.crossSellerVerdict),
            crossSellerReasons: show(c.crossSellerReasons),
            crossSellerBlockers: show(c.crossSellerBlockers),
            crossSellerConflicts: show(c.crossSellerConflicts),
            matchTruth: show(c.matchTruth),
          };
        });

        const withFacts = raw.filter((c) => !!c.facts).length;
        const withVerdict = scored.filter((c) => c.crossSellerVerdict !== undefined).length;
        out.push({
          대상: frag, 원상품brand: row.brand, 검색어: terms.slice(0, 2),
          "🔴 queryFacts.brandModelCode": show(facts.brandModelCode),
          단계표: {
            "① 검색 결과": `후보 ${raw.length}`,
            "② candidate 생성": `${raw.length} (어댑터가 생성)`,
            "③ facts 생성": `${withFacts}/${raw.length} 🔴 어댑터가 productFactsFromListing 으로 만든다`,
            "④ facts 주입(withConfidence 후)": `${scored.filter((c) => !!c.facts).length}/${scored.length}`,
            "⑤ crossSellerVerdict 생성": `${withVerdict}/${scored.length}`,
          },
          verdictTally: (() => {
            const t: Record<string, number> = {};
            for (const c of scored) t[String(c.crossSellerVerdict)] = (t[String(c.crossSellerVerdict)] ?? 0) + 1;
            return t;
          })(),
          rawStage: rawStage.slice(0, 4),
          scoredStage: scoredStage.slice(0, 4),
        });
      }

      const report = {
        "🟢 DISCLAIMER": "조사 전용 · 코드 0 · DB 0. 🟢 타입 → 생성 owner → 운영 호출부 순서로 확인한 뒤 " +
          "**올바른 칸 이름**(crossSellerVerdict/Reasons/Blockers/Conflicts · colorText · coreTitleTokens)으로 쟀다.",
        "🟢 후보 facts 생성 owner": "각 샵 어댑터가 productFactsFromListing 으로 **직접** 만든다 — " +
          "looxloo:181 · foretforet:369 · deuxbebe:192 · rulii:210 · littleluna:112 · chocoel:133",
        products: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "candfacts.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 1));
      expect(out.length).toBe(2);
    },
    60 * 60 * 1000,
  );
});
