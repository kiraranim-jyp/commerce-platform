/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-DETERMINISTIC-GATE-RATE-017 — 게이트 적중률 측정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini API 호출 0.** 🔴 단 **「무료」가 아니다**(CPO 명시) —
 *    `searchDomesticShops` 는 국내 판매처에 **실제 HTTP** 를 보낸다.
 *    그래서 이 WU 는 「비용 0」이 아니라 **「Gemini 비용 0」** 으로 적는다.
 *    국내 HTTP 량을 같이 센다.
 *
 * 🔴 재는 것 하나:
 * ```
 * 전체 대상 → deterministic very_high → Gemini 필요
 * ```
 * WU-016 의 게이트(`matchLevel === "very_high"`)가 실제 표본에서
 * **몇 %의 상품을 Gemini 호출 «전» 에 걸러내는가.**
 *
 * 🔴 threshold 를 바꾸지 않는다. 🔴 DB 쓰기 0. 기본값 SKIP(`MI_P0_02_LIVE=1`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface UrlRow { id: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown; description: string | null }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}
interface RawResult { shopId: string; shopName: string; domain: string; status: string; candidates: Record<string, unknown>[]; error?: string }

const tally = (xs: string[]): Record<string, number> => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return t;
};
const pct = (n: number, d: number) => (d === 0 ? null : `${((n / d) * 100).toFixed(1)}%`);

describe.skipIf(!LIVE)("🔴 MI-017 — deterministic 게이트 적중률 (Gemini 호출 0)", () => {
  it(
    "국내 검색만 돌려 very_high 비율을 센다 — Gemini 를 몇 %에서 안 부를 수 있는가",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<SnapRow[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<RawResult[]>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");

      const targetsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => isBatchSurveyTarget(s as never, scopes))
          .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /** 🟢 정화된 덤프 전수를 쓴다 — 아동 + 테니스(초기 서비스 범위). */
      const seen = new Set<string>();
      const kids = [...(groups.control ?? []), ...groups.kids, ...groups.kids2]
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      const plan = [
        ...kids.map((row) => ({ row, scope: "KIDS_FASHION" })),
        ...groups.tennis.map((row) => ({ row, scope: "TENNIS" })),
      ];

      const rows: Record<string, unknown>[] = [];
      let shopRequests = 0;
      let shopErrors = 0;

      for (const { row, scope } of plan) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) continue;
        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts,
        };
        const targets = targetsFor([scope]);

        const results = await crawler.searchDomesticShops(
          query,
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );
        shopRequests += results.length;
        shopErrors += results.filter((r) => r.status === "error").length;

        const ok = results.filter((r) => r.status === "ok");
        const cands = ok.flatMap((r) => r.candidates);
        const levels = cands.map((c) => String(c.matchLevel ?? "(없음)"));

        /** 🟢 WU-016 의 게이트와 **같은 술어** 다 — 복제 계산이 아니라 같은 조건이다. */
        const deterministicHit = ok.some((r) => r.candidates.some((c) => c.matchLevel === "very_high"));

        rows.push({
          scope,
          brand: row.brand,
          title: row.title.slice(0, 44),
          "scope 통과 샵": targets.length,
          "응답 샵": results.length,
          "오류 샵": results.filter((r) => r.status === "error").length,
          "후보 수": cands.length,
          "matchLevel 분포": tally(levels),
          "🔴🔴 deterministic very_high": deterministicHit,
          "🟢 Gemini 호출 필요": !deterministicHit,
        });
      }

      const kidsRows = rows.filter((r) => r.scope === "KIDS_FASHION");
      const tennisRows = rows.filter((r) => r.scope === "TENNIS");
      const hit = (xs: Record<string, unknown>[]) => xs.filter((r) => r["🔴🔴 deterministic very_high"]).length;
      const noCand = (xs: Record<string, unknown>[]) => xs.filter((r) => Number(r["후보 수"]) === 0).length;

      const report = {
        "🔴🔴 DISCLAIMER":
          `sample 상품 N=${rows.length}(아동 ${kidsRows.length} · 테니스 ${tennisRows.length}). ` +
          "🔴 **Gemini API 호출 0** — 그러나 «무료가 아니다». `searchDomesticShops` 가 " +
          "국내 판매처에 실제 HTTP 를 보낸다. 🔴 threshold 변경 0 · DB 쓰기 0.",
        "①🔴🔴 게이트 적중률 — Gemini 를 몇 %에서 «안» 부를 수 있는가": {
          "전체 상품": rows.length,
          "deterministic very_high": hit(rows),
          "적중률": pct(hit(rows), rows.length),
          "🟢 Gemini 호출 필요": rows.length - hit(rows),
          "호출 필요 비율": pct(rows.length - hit(rows), rows.length),
        },
        "② 카테고리별": {
          아동: {
            상품: kidsRows.length,
            "very_high": hit(kidsRows),
            적중률: pct(hit(kidsRows), kidsRows.length),
            "🔴 후보 0 인 상품": noCand(kidsRows),
          },
          테니스: {
            상품: tennisRows.length,
            "very_high": hit(tennisRows),
            적중률: pct(hit(tennisRows), tennisRows.length),
            "🔴 후보 0 인 상품": noCand(tennisRows),
          },
        },
        "③ matchLevel 전체 분포(후보 단위)": tally(rows.flatMap((r) => Object.entries(r["matchLevel 분포"] as Record<string, number>).flatMap(([k, v]) => Array.from({ length: v }, () => k)))),
        "④🔴 국내 HTTP 비용 — Gemini 와 «다른 축» 이다": {
          "샵 검색 요청(결과 단위)": shopRequests,
          "오류 응답": shopErrors,
          "상품당 샵 요청": rows.length ? +(shopRequests / rows.length).toFixed(2) : null,
          "🔴 Gemini 호출": 0,
          "🔴 주의": "이 숫자는 국내 판매처 HTTP 다. Gemini 비용과 합산하지 않는다.",
        },
        "⑤🔴 해석 한계": [
          "🔴 적중률은 **이 표본** 의 값이다 — 운영 전수(498 상품)의 값이 아니다.",
          "🔴 very_high 가 «옳은» 매칭인지는 이 WU 가 보지 않았다(게이트 발화 여부만 센다).",
          "🔴 후보 0 인 상품은 게이트가 발화하지 않으므로 「Gemini 필요」로 세어진다 — " +
            "그러나 그 상품은 Gemini 를 불러도 국내 후보가 없을 수 있다(미측정).",
          "🔴 테니스는 scope 샵이 1곳뿐이라 구조적으로 적중률이 낮다(선행 WU 확정).",
        ],
        products: rows,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `gate017-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `gate017-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${rows.length}건 — gate017-${seq}.json)` }, null, 1));

      expect(rows.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
