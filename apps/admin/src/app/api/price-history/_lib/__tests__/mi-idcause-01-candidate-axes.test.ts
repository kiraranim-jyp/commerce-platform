/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Identity 원인 규명 — 후보를 열어 «축별로» 분해한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용.** 코드 수정 0 · threshold 0 · scoring 0 · 검색어 변경 0 ·
 *    Registry 0 · DB 쓰기 0. 기본값 SKIP(`MI_P0_02_LIVE=1`).
 *
 * ── 🟢 복제하지 않는다 ──────────────────────────────────────────────────
 *   `withConfidence`(match.ts:476) 가 각 후보에 `match`(= `CrossSellerMatch`)를
 *   붙여 돌려준다. 그 안에 **축 분해가 이미 들어 있다**(cross-seller.ts:173):
 *     `axes[] {axis, points, detail}` · `conflicts[]` · `blockers[]` ·
 *     `identifierConfirmed` · `reasons[]`
 *   🔴 그래서 축 점수를 **다시 계산하지 않고 그대로 꺼낸다.** 복제하면 원본이
 *      바뀔 때 조용히 거짓이 된다(선행 WU 에서 같은 함정에 걸렸다).
 *
 * ── 🔴 「후보 0」과 「high 0」은 다른 문제다 (CPO 분리 지시) ──────────────
 *   후보 0        → Discovery 문제
 *   후보 있음+high 0 → Candidate quality / product facts / Identity 판단 문제
 *   🔴 이 하니스는 둘을 **다른 섹션** 에 적는다.
 *
 * ── 🔴 로컬 호출 함정 (선행 WU 에서 당했다) ──────────────────────────────
 *   `listDomesticPriceSources` 는 `SUPABASE_SERVICE_ROLE_KEY` 를 요구하고(헌장 §10)
 *   없으면 조용히 `null` → `return []` → **샵 0개** 가 된다. 그러면
 *   「후보 0 = 검색 실패」라는 틀린 결론이 난다. 🟢 같은 머지를 DB 로 재현해 덤프한다.
 *   owner 패키지는 **운영 import 블록을 베낀다**(run-domestic-price-check.ts:1-22).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 CPO 가 지정한 5건. 늘리거나 바꾸지 않는다. */
const TARGET_TITLE_FRAGMENTS = [
  "Pixel Abduction",            // B226AB069 — 후보 0
  "Boo Bo Choses T-shirt",      // B226AC002 — 후보 6 / high 0
  "All About Monsters T-shirt", // B226AC018 — 후보 5 / high 0
  "All About Monsters Washed",  // Smallable / Bobo — 후보 10 / high 0
  "Astrid Organic Cotton",      // Smallable / Louise Misha — 후보 17 / high 0
] as const;

interface UrlRow {
  id: string; source_url: string; title: string; brand: string;
  sku: string | null; color: string | null; amt: string | null; cur: string | null;
}
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}

describe.skipIf(!LIVE)("🔴 MI-IDCAUSE-01 — 후보 축 분해", () => {
  it(
    "5건의 실제 후보를 열어 축별 점수·충돌·차단을 그대로 기록한다",
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
      const targets = TARGET_TITLE_FRAGMENTS.map((frag) => {
        const row = all.find((r) => r.title.includes(frag));
        if (!row) throw new Error(`대상 상품을 못 찾음: ${frag}`);
        return { frag, row };
      });

      /** 🟢 owner 는 운영 import 블록 그대로 */
      const { searchDomesticShops, withConfidence } = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{
          shopName: string; domain: string; status: string; error?: string;
          candidates: Record<string, unknown>[];
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
      const toRef = (s: SourceRow) => ({
        id: s.id, name: s.name, domain: s.domain, currency: s.currency,
        collectionStrategy: s.collectionStrategy,
      });

      const out: Record<string, unknown>[] = [];
      for (const { frag, row } of targets) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) throw new Error(`스냅샷 본문 없음: ${frag}`);
        const product = backfillCanonicalProduct(snap.canonicalProduct);
        const dna = buildProductIdentityDna(product);
        const queryFacts = productFactsFromIdentityDna(dna);
        const searchTerms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String((dna as { title?: string }).title ?? row.title),
          brand: (dna as { brand?: { value?: string } }).brand?.value || undefined,
          sourceUrl: (dna as { sourceUrl?: string }).sourceUrl,
          sku: undefined,
          searchTerm: searchTerms[0] ?? row.title,
          searchTerms,
          facts: queryFacts,
        };

        /** 🔴 샵별 응답을 «그대로» 남긴다 — 후보 0 의 원인을 가르려면 필요하다 */
        const results = await searchDomesticShops(query, autoTargets.map(toRef));
        const perShop = results.map((r) => ({
          shop: r.shopName, domain: r.domain, status: r.status,
          error: r.error ?? null, candidateCount: r.candidates.length,
        }));
        const flat = results.flatMap((r) => r.candidates.map((c) => ({ ...c, _shop: r.shopName })));
        const scored = withConfidence(query, flat);

        /** 🟢 축 분해를 «그대로» 꺼낸다 (복제 계산 금지) */
        const candidates = scored
          .map((c) => {
            const m = c.match as {
              verdict?: string; identifierConfirmed?: boolean;
              axes?: { axis: string; points: number; detail: string }[];
              conflicts?: { conflict: string; detail: string }[];
              blockers?: { blocker: string; detail: string }[];
              reasons?: string[];
            } | null | undefined;
            const f = c.facts as Record<string, unknown> | null | undefined;
            return {
              shop: c._shop, matchLevel: c.matchLevel, confidence: c.confidence,
              title: String(c.title ?? "").slice(0, 70),
              url: String(c.url ?? "").slice(0, 110),
              price: c.price ?? null,
              matchReasons: (c.matchReasons as string[] | undefined)?.slice(0, 4) ?? [],
              /** 🔴 축별 — 이것이 이 WU 의 핵심 증거다 */
              verdict: m?.verdict ?? null,
              identifierConfirmed: m?.identifierConfirmed ?? null,
              axes: m?.axes?.map((a) => `${a.axis}+${a.points} (${a.detail.slice(0, 44)})`) ?? [],
              conflicts: m?.conflicts?.map((x) => `${x.conflict}: ${x.detail.slice(0, 44)}`) ?? [],
              blockers: m?.blockers?.map((x) => `${x.blocker}: ${x.detail.slice(0, 44)}`) ?? [],
              candidateFacts: f
                ? {
                    brand: f.brand ?? null, brandModelCode: f.brandModelCode ?? null,
                    color: f.color ?? null, material: f.material ?? null,
                  }
                : null,
            };
          })
          .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0));

        out.push({
          대상: frag,
          원상품: {
            title: row.title, url: row.source_url.slice(0, 100),
            brand: row.brand || null, sku: row.sku, color: row.color,
            price: `${row.cur} ${row.amt}`,
          },
          /** 🔴 원상품 facts — 「정보 부족」 분류의 근거 */
          queryFacts: {
            brand: queryFacts.brand ?? null,
            brandModelCode: queryFacts.brandModelCode ?? null,
            color: queryFacts.color ?? null,
            material: queryFacts.material ?? null,
            titleTokens: Array.isArray(queryFacts.titleTokens) ? (queryFacts.titleTokens as string[]).length : null,
          },
          searchTerms: searchTerms.slice(0, 3),
          perShop,
          candidateTotal: flat.length,
          matchLevels: (() => {
            const t: Record<string, number> = {};
            for (const c of candidates) t[String(c.matchLevel)] = (t[String(c.matchLevel)] ?? 0) + 1;
            return t;
          })(),
          /** 상위 6개만 — 전체는 파일에 */
          topCandidates: candidates.slice(0, 6),
          allCandidates: candidates,
        });
      }

      const report = {
        "🟢 DISCLAIMER": "조사 전용. 코드 수정 0 · threshold 0 · scoring 0 · 검색어 변경 0 · DB 쓰기 0. " +
          "🟢 축 분해는 withConfidence 가 붙인 match 객체에서 «그대로» 꺼냈다(복제 계산 0).",
        "🔴 분리 원칙": "「후보 0」(Discovery 문제)과 「후보 있음 + high 0」(candidate quality / " +
          "product facts / Identity 판단)을 **같은 문제로 취급하지 않는다**(CPO 지시).",
        searchedShops: autoTargets.map((s) => `${s.name}(${s.domain})`),
        products: out,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "idcause.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log(`\n🟢 샵 ${autoTargets.length}곳 · 대상 ${out.length}건 → idcause.json`);
      expect(out.length).toBe(5);
    },
    90 * 60 * 1000,
  );
});
