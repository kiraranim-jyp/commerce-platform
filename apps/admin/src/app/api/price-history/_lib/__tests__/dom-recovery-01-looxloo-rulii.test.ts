/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 Coverage WU — STEP 1·2: looxloo · rulii Recovery Funnel (§4 · §7)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다.
 * 🔴 **Production 을 한 글자도 바꾸지 않는다.** alias 는 «하니스 안에서만» 주입한다
 *    (`brand-alias.ts` 는 건드리지 않는다 — §21 「query expansion 선행 금지」).
 *
 * ── 🟢🟢 원인은 이미 특정됐다 (docs/DOMESTIC-COVERAGE-WU-STATE.md §3) ──────
 *   `brand-alias.ts` 한글 alias 가 3개뿐이다 —
 *     Pèpè Shoes→페페 · Emile et Ida→에밀에이다 · Konges Slojd Clothing→콩제슬래드
 *   그 파일 주석: 「3개 브랜드 모두 **원문 영문 검색 0건** → 한글 alias 검색 4~5건,
 *   오탐 0건 확인」 · 「목록에 없는 브랜드는 폴백을 시도하지 않는다」.
 *   🔴 `Bobo Choses`·`The Animals Observatory` 는 목록에 **없고** 그 둘이
 *      looxloo 커버 94 의 전부다(84+10).
 *
 * ── 이 파일이 재는 것 (§4-A~E) ────────────────────────────────────────────
 *   arm A  현재 Production query (영문) — 변경 없음
 *   arm B  한글 alias 주입 — 🔴 하니스 전용
 *   arm C  canonical field 조합 (brand+color / brand+material)
 *   각 arm → candidates → product page → readable → relevant → SAME → tier
 *
 * 🔴 CONTROL (§4-E): `foretforet` 를 같은 상품으로 같이 돌린다. 운영이 이미 링크
 *    32건을 만든 source 다. CONTROL 이 깨지면 **이 측정의 숫자를 쓰지 않는다.**
 * 🔴 판정은 운영 owner 가 한다 — `withConfidence` → `judgeDomesticCandidate`.
 *    하니스가 verdict 를 만들지 않는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct, buildCrossSellerSearchQueries, buildDomesticShopQuery,
  buildProductIdentityDna, productFactsFromIdentityDna,
} from "@commerce/shared";
import { fetchDomesticModelCode, searchDomesticShops, withConfidence } from "@commerce/crawler";
import { isBatchSurveyTarget, judgeDomesticCandidate } from "../run-domestic-price-check";
import { resolveMarketCategoryScopes } from "../../../domestic-price-sources/_lib/category-scope";
import type { CanonicalProduct } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/**
 * 🔴 **하니스 전용** 한글 표기. `brand-alias.ts` 에 등록하지 «않는다».
 *    그 파일의 등록 조건은 「실측으로 동일 브랜드 후보를 반환하는 것이 확인된 표기」인데,
 *    이 측정이 바로 그 확인이다. 🟢 Phase 7 이 「보보쇼즈」3/3·「타오」3/3(오탐 0)을
 *    이미 봤으므로 추론이 아니라 **관찰된 표기** 다.
 */
const HARNESS_ALIAS: Record<string, string> = {
  "Bobo Choses": "보보쇼즈",
  "The Animals Observatory": "타오",
};

interface SnapRow { id: string; title: string; workspace_id: string; cp: CanonicalProduct; links?: number }
interface SrcRow {
  id: string; name: string; domain: string; currency: string | null;
  collection_strategy: string | null; enabled: boolean; status: string;
  access_status: string | null; category_scope: string[] | null;
}

describe.skipIf(!LIVE)("🔴 DOM-RECOVERY-01 — looxloo·rulii 가 왜 회수하지 못하는가", () => {
  it(
    "arm A/B/C 를 운영 함수 사슬로 돌리고 CONTROL 로 검증한다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const sources = read<SrcRow[]>("cov-sources.json");
      const all = [...read<SnapRow[]>("cov-nolink.json"), ...read<SnapRow[]>("cov-withlink.json")];

      /** 🔴 대상 상품 — 브랜드별 1개씩(중복 접음). alias 유/무를 갈라 본다. */
      const pickByBrand = (b: string) => all.find((r) => (r.cp?.brand?.value ?? "").trim() === b);
      const TARGETS = [
        { brand: "Bobo Choses", aliasKnownToProd: false },
        { brand: "The Animals Observatory", aliasKnownToProd: false },
        { brand: "Pèpè Shoes", aliasKnownToProd: true },   // 🟢 CONTROL — alias 가 이미 있다
        { brand: "Emile et Ida", aliasKnownToProd: true },  // 🟢 CONTROL
      ].map((t) => ({ ...t, row: pickByBrand(t.brand) })).filter((t) => t.row);

      const SHOPS = ["looxloo.com", "rulii.co.kr", "foretforet.com"]; // 🔴 foretforet = CONTROL source
      const refsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => SHOPS.includes(s.domain) && s.collection_strategy === "AUTO_SCRAPE")
          .filter((s) => isBatchSurveyTarget(
            { enabled: s.enabled, status: s.status as never, accessStatus: s.access_status as never,
              categoryScope: s.category_scope ?? [] } as never, scopes))
          .map((s) => ({ id: s.id, name: s.name, domain: s.domain,
                         currency: s.currency ?? "KRW", collectionStrategy: s.collection_strategy ?? undefined }));

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let requests = 0; const t0 = Date.now();

      for (const t of TARGETS) {
        const product = backfillCanonicalProduct(t.row!.cp);
        const dna = buildProductIdentityDna(product);
        const scopes = resolveMarketCategoryScopes(product, null);
        const refs = refsFor(scopes);
        const facts = productFactsFromIdentityDna(dna);
        const prodTerms = buildCrossSellerSearchQueries(dna);
        const ko = HARNESS_ALIAS[t.brand];
        const core = dna.coreTitleTokens.slice(0, 3).join(" ");

        /** 🔴 arm 정의 — A 는 운영 그대로. B·C 는 searchTerms «만» 바꾼다. */
        const ARMS: { arm: string; terms: string[] }[] = [
          { arm: "A_PRODUCTION(영문, 변경없음)", terms: prodTerms },
          ...(ko ? [{ arm: `B_KO_ALIAS(${ko})`, terms: [ko, `${ko} ${core}`.trim()] }] : []),
          { arm: "C_CANONICAL(brand+color/material)", terms: [
            [t.brand, dna.color ?? ""].filter(Boolean).join(" "),
            [t.brand, dna.material ?? ""].filter(Boolean).join(" "),
          ].filter((s) => s.trim().length > 3) },
        ];

        for (const a of ARMS) {
          if (a.terms.length === 0) continue;
          const query = {
            title: dna.title ?? t.row!.title, brand: dna.brand.value || undefined,
            sourceUrl: dna.sourceUrl, sku: product.sku?.value || undefined,
            searchTerm: buildDomesticShopQuery(dna), searchTerms: a.terms, facts,
          } as Parameters<typeof searchDomesticShops>[0];
          const s0 = Date.now();
          const results = await searchDomesticShops(query, refs as never);
          requests += refs.length;
          for (const r of results) {
            let judged = 0, same = 0, likely = 0, tier: string | null = null, gate = "NO_CANDIDATES";
            const scored = r.status === "ok" && r.candidates.length > 0 ? withConfidence(query, r.candidates) : [];
            for (const c of scored) {
              if (!c.crossSellerVerdict) continue;
              judged++;
              if (c.crossSellerVerdict === "SAME") same++;
              else if (c.crossSellerVerdict === "PRESUMED_SAME") likely++;
            }
            if (scored.length > 0) {
              const j = await judgeDomesticCandidate({
                domain: r.domain, candidates: scored, sourceUrl: dna.sourceUrl,
                foreignModelCode: dna.brandModelCode ?? null, foreignColor: dna.color ?? null,
                fetchModelCode: async (u) => fetchDomesticModelCode(r.domain, u),
              });
              gate = j.kind === "DROPPED" ? `DROPPED(${j.gate})` : j.kind;
              if (j.kind === "JUDGED") {
                const mt = (j as unknown as { matchTruth: string; verified: boolean });
                tier = mt.matchTruth === "EXACT_IDENTIFIER" || mt.matchTruth === "STRONG_IDENTIFIER" ? "EXACT"
                     : mt.matchTruth === "TEXT_CONFIRMED" ? "COMPARISON"
                     : mt.matchTruth === "SIMILAR" ? "REFERENCE"
                     : mt.matchTruth === "CONFLICT" || mt.matchTruth === "INSUFFICIENT_EVIDENCE" ? "EXCLUDED"
                     : mt.verified ? "EXACT" : "COMPARISON";
              }
            }
            rows.push({
              brand: t.brand, aliasKnownToProd: t.aliasKnownToProd, arm: a.arm,
              shop: r.domain, isControlShop: r.domain === "foretforet.com",
              status: r.status, candidates: r.status === "ok" ? r.candidates.length : 0,
              judged, SAME: same, SAME_LIKELY: likely, gate, tier,
              topTitles: r.status === "ok" ? r.candidates.slice(0, 2).map((c) => c.title) : [],
              elapsedMs: Date.now() - s0, searchTerms: a.terms,
            });
          }
          // eslint-disable-next-line no-console
          console.log(`${t.brand.slice(0, 20).padEnd(21)} ${a.arm.slice(0, 26).padEnd(27)} ` +
            results.map((r) => `${r.domain.split(".")[0]}:${r.status === "ok" ? r.candidates.length : "ERR"}`).join(" "));
        }
      }

      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const sum = (xs: Row[], k: string) => xs.reduce((s, x) => s + (Number(x[k]) || 0), 0);
      const byArmShop = (arm: string, shop: string) => {
        const xs = rows.filter((r) => r.arm === arm && r.shop === shop);
        return { n: xs.length, candidates: sum(xs, "candidates"), judged: sum(xs, "judged"),
                 SAME: sum(xs, "SAME"), LIKELY: sum(xs, "SAME_LIKELY"),
                 gates: count(xs, (r) => String(r.gate)), tiers: count(xs.filter((r) => r.tier), (r) => String(r.tier)) };
      };
      const arms = [...new Set(rows.map((r) => String(r.arm)))];
      const shops = [...new Set(rows.map((r) => String(r.shop)))];

      /** 🔴 CONTROL 게이트 — foretforet 가 arm A 에서 후보를 내야 한다. */
      const controlA = rows.filter((r) => r.isControlShop && String(r.arm).startsWith("A_") && Number(r.candidates) > 0);
      const report = {
        scope: {
          note: `🔴 sample N=${TARGETS.length} 상품 × arm × shop. 전수가 아니다.`,
          "🔴 Production 미변경": "alias 는 하니스 전용. brand-alias.ts 를 건드리지 않았다.",
          aliasInProduction: "Pèpè Shoes→페페 · Emile et Ida→에밀에이다 · Konges Slojd Clothing→콩제슬래드",
          aliasMissingInProduction: Object.keys(HARNESS_ALIAS),
        },
        controlGate: {
          note: "🔴 CONTROL source(foretforet) 가 arm A 에서 후보를 내지 못하면 이 측정의 숫자를 쓰지 않는다.",
          controlRowsWithCandidates: controlA.length,
          passed: controlA.length > 0,
        },
        cost: { shopSearchRequests: requests, elapsedMs: Date.now() - t0 },
        matrix: Object.fromEntries(arms.map((a) => [a, Object.fromEntries(shops.map((s) => [s, byArmShop(a, s)]))])),
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domrec-looxloo-rulii.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThan(0);
    },
    180 * 60 * 1000,
  );
});
