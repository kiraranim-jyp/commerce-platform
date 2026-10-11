/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 Coverage WU — STEP 1b: CONTROL = 운영 `expectedTier` 재현 게이트
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. Production 을 바꾸지 않는다.
 *
 * ── 🔴🔴 왜 이 파일이 필요한가 (STEP 1 의 결함) ───────────────────────────
 *   STEP 1 의 `controlGate` 는 **「후보를 냈다」만** 봤고 통과했다. 그런데 DB 에서
 *   운영이 «실제로» tier 를 만든 (상품 × 샵) 을 꺼내 보니 내 표본이 틀렸다:
 *
 *     운영 정답                                          STEP 1 이 쓴 것
 *     Stamp Bloom Denim Pants → bobochoses.com EXACT     같은 상품인데
 *       🔴 bobochoses 는 등록부 disabled → refs 에 «없었다»
 *     PèPè Lulu T Bar «Vernice Nero» → foretforet EXACT  🔴 PèPè «Nevada Tobacco»
 *       verified=true · vision 98~100                        = 다른 색상
 *
 *   → 「SAME 0」은 **정답이 없는 조합** 에서 나온 숫자였다. 제품 결함이 아니다.
 *
 * ── 🟢 이 파일의 게이트 (CPO 확정) ────────────────────────────────────────
 *   「후보가 나왔다」와 「운영 결과가 재현됐다」를 **절대 같은 것으로 취급하지 않는다.**
 *   통과 조건은 **`tier === expectedTier`** 다.
 *   🔴 통과하지 못하면 looxloo/rulii 숫자를 유효 숫자로 승격하지 않는다.
 *
 * ── 🔴 측정 전용 override 하나 ────────────────────────────────────────────
 *   `bobochoses.com` 은 등록부에서 `enabled=false` 다. 운영 링크 32건은 켜져 있던
 *   과거에 생성됐다. **그 샵을 refs 에 넣는 것은 측정 전용 결정** 이고 등록부를
 *   바꾸지 않는다. 결과에 `registryEnabled` 를 같이 적어 구분한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct, buildCrossSellerSearchQueries, buildDomesticShopQuery,
  buildProductIdentityDna, productFactsFromIdentityDna,
} from "@commerce/shared";
import { fetchDomesticModelCode, searchDomesticShops, withConfidence } from "@commerce/crawler";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import type { CanonicalProduct } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface Ctrl {
  domain: string; snapshotId: string; snapshotTitle: string; matchedTitle: string;
  externalUrl: string; expectedTier: string; matchTruth: string | null; verified: boolean;
  crossSellerVerdict: string | null; visionScore: number | null; cp: CanonicalProduct;
}
interface SrcRow {
  id: string; name: string; domain: string; currency: string | null;
  collection_strategy: string | null; enabled: boolean; status: string;
}

/** 🔴 `priceTierFromLink` 와 같은 분기. 아래 테스트가 표를 고정한다. */
const tierOf = (mt: string | null, verified: boolean): string =>
  mt === "EXACT_IDENTIFIER" || mt === "STRONG_IDENTIFIER" ? "EXACT"
  : mt === "TEXT_CONFIRMED" ? "COMPARISON" : mt === "SIMILAR" ? "REFERENCE"
  : mt === "CONFLICT" || mt === "INSUFFICIENT_EVIDENCE" ? "EXCLUDED" : verified ? "EXACT" : "COMPARISON";

describe.skipIf(!LIVE)("🔴 DOM-RECOVERY-02 — CONTROL: 운영 tier 재현 게이트", () => {
  it(
    "ctrl-targets 13건에 arm A 를 돌려 expectedTier 가 재현되는지 «만» 본다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const ctrls = read<Ctrl[]>("ctrl-targets.json");
      const sources = read<SrcRow[]>("cov-sources.json");

      /** 🔴 (상품, 샵) 중복을 접는다 — ctrl 13건에 같은 쌍이 여러 행 있다. */
      const seen = new Set<string>();
      const targets = ctrls.filter((c) => {
        const k = `${c.snapshotId}|${c.domain}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let requests = 0; const t0 = Date.now();

      for (const c of targets) {
        const product = backfillCanonicalProduct(c.cp);
        const dna = buildProductIdentityDna(product);
        /**
         * 🔴 **정답 링크의 샵을 반드시 포함한다.** STEP 1 이 bobochoses(disabled)를
         *    빼서 정답 없는 조합이 됐다. 🔴 등록부는 바꾸지 않고 refs 만 만든다.
         */
        const src = sources.find((s) => s.domain === c.domain);
        if (!src) { rows.push({ ...pick(c), error: "등록부에 그 도메인이 없다" }); continue; }
        const refs = [{ id: src.id, name: src.name, domain: src.domain,
                        currency: src.currency ?? "KRW",
                        collectionStrategy: src.collection_strategy ?? undefined }];
        const query = {
          title: dna.title ?? c.snapshotTitle, brand: dna.brand.value || undefined,
          sourceUrl: dna.sourceUrl, sku: product.sku?.value || undefined,
          searchTerm: buildDomesticShopQuery(dna),
          searchTerms: buildCrossSellerSearchQueries(dna),
          facts: productFactsFromIdentityDna(dna),
        } as Parameters<typeof searchDomesticShops>[0];

        const results = await searchDomesticShops(query, refs as never);
        requests += refs.length;
        const r = results[0];
        let candidates = 0, judged = 0, gate = "NO_RESULT", gotTier: string | null = null;
        let matchedTitleFound = false;
        let nowConfidence: Record<string, unknown>[] = [];
        let top0: Record<string, unknown> | null = null;
        if (r?.status === "ok") {
          candidates = r.candidates.length;
          /** 🔴 운영이 고른 그 후보가 «회수 목록에 있는가» — tier 와 별개 축이다. */
          const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
          matchedTitleFound = r.candidates.some((x) => norm(x.title).includes(norm(c.matchedTitle).slice(0, 14)));
          const scored = r.candidates.length > 0 ? withConfidence(query, r.candidates) : [];
          judged = scored.filter((x) => x.crossSellerVerdict).length;
          /**
           * 🔴🔴 STEP 2b — 회귀 여부의 직접 증거.
           *   deuxbebe 과거 링크는 `conf=0.72 · REVIEW_REQUIRED` 였고, 가드의
           *   `matchLevel !== "low"` 조건이 열려 통과했다. 지금은 떨어지므로
           *   **confidence 가 내려갔는지** 를 찍어 과거값과 대조한다.
           *   🔴 가드도 confidence 계산도 바꾸지 않는다 — 기록만 한다.
           */
          nowConfidence = scored.map((x) => ({
            title: String(x.title).slice(0, 48),
            confidence: typeof x.confidence === "number" ? Number(x.confidence.toFixed(3)) : null,
            matchLevel: x.matchLevel ?? null,
            crossSellerVerdict: x.crossSellerVerdict ?? null,
            matchReasons: (x.matchReasons ?? []).slice(0, 4),
          }));
          top0 = nowConfidence[0] ?? null;
          if (scored.length > 0) {
            const j = await judgeDomesticCandidate({
              domain: r.domain, candidates: scored, sourceUrl: dna.sourceUrl,
              foreignModelCode: dna.brandModelCode ?? null, foreignColor: dna.color ?? null,
              fetchModelCode: async (u) => fetchDomesticModelCode(r.domain, u),
            });
            gate = j.kind === "DROPPED" ? `DROPPED(${j.gate})` : j.kind;
            if (j.kind === "JUDGED") {
              const mt = j as unknown as { matchTruth: string; verified: boolean };
              gotTier = tierOf(mt.matchTruth, mt.verified);
            }
          } else gate = "NO_CANDIDATES";
        } else gate = `SEARCH_${r?.status ?? "NONE"}`;

        rows.push({
          ...pick(c), registryEnabled: src.enabled, registryStatus: src.status,
          collectionStrategy: src.collection_strategy,
          candidates, judged, gate, gotTier,
          /** 🟢 게이트 — 「후보가 나왔다」가 아니라 «tier 가 같다» */
          tierReproduced: gotTier !== null && gotTier === c.expectedTier,
          matchedTitleFoundInCandidates: matchedTitleFound,
          topTitles: r?.status === "ok" ? r.candidates.slice(0, 2).map((x) => x.title) : [],
          searchTerms: query.searchTerms,
          /** 🔴🔴 STEP 2b — 가드가 보는 `candidates[0].matchLevel` 과 현재 confidence */
          guardSeesTop0: top0,
          nowConfidence,
        });
        // eslint-disable-next-line no-console
        console.log(`${c.domain.padEnd(18)} exp=${c.expectedTier.padEnd(10)} got=${String(gotTier).padEnd(10)} ` +
          `${gotTier === c.expectedTier ? "🟢재현" : "🔴불일치"} cand=${String(candidates).padStart(2)} ` +
          `정답후보회수=${matchedTitleFound} gate=${gate}`);
      }

      const pass = rows.filter((r) => r.tierReproduced).length;
      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const report = {
        scope: {
          note: `🔴 CONTROL sample N=${targets.length} (상품×샵 중복 접음, ctrl-targets ${ctrls.length}행)`,
          gateRule: "🔴 통과 조건은 tier === expectedTier. 「후보가 나왔다」는 통과가 아니다.",
          measurementOverride: "🔴 bobochoses.com 은 등록부 disabled 지만 refs 에 넣었다(측정 전용). 등록부 미변경.",
        },
        gate: {
          targets: targets.length, tierReproduced: pass,
          passed: pass > 0,
          "🔴 해석": pass === 0
            ? "CONTROL 전부 불일치 — 하니스가 운영을 재현하지 못한다. looxloo/rulii 숫자를 승격하지 않는다."
            : `${pass}/${targets.length} 재현. 재현된 샵의 숫자만 유효로 승격한다.`,
        },
        byDomain: count(rows, (r) => `${r.domain} exp=${r.expectedTier} → got=${r.gotTier}`),
        byGate: count(rows, (r) => String(r.gate)),
        matchedTitleRecovery: {
          note: "🔴 tier 와 «별개» 축 — 운영이 고른 그 후보를 회수하기는 했는가",
          found: rows.filter((r) => r.matchedTitleFoundInCandidates).length, of: rows.length,
        },
        /** 🔴🔴 STEP 2b — 회귀 판정용. 과거 deuxbebe 링크는 conf=0.72 였다. */
        regressionProbe: {
          note: "🔴 가드 조건 `candidates[0].matchLevel !== \"low\"` 가 열리는지가 전부다.",
          historicalDeuxbebe: { confidence: 0.72, matchType: "REVIEW_REQUIRED", createdRange: "2026-08-29 ~ 2026-10-08" },
          nowTop0ByDomain: rows.map((x) => ({
            domain: x.domain, expectedTier: x.expectedTier, gotTier: x.gotTier,
            top0: x.guardSeesTop0,
          })),
        },
        cost: { shopSearchRequests: requests, elapsedMs: Date.now() - t0 },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domrec-control-tier.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBe(targets.length);
    },
    180 * 60 * 1000,
  );

  /** 🔴 tier 분기표를 owner 와 같게 고정한다(복제했으므로). */
  it("tierOf 표가 priceTierFromLink 와 같다", () => {
    expect(tierOf("EXACT_IDENTIFIER", false)).toBe("EXACT");
    expect(tierOf("STRONG_IDENTIFIER", false)).toBe("EXACT");
    expect(tierOf("TEXT_CONFIRMED", false)).toBe("COMPARISON");
    expect(tierOf("SIMILAR", false)).toBe("REFERENCE");
    expect(tierOf("CONFLICT", false)).toBe("EXCLUDED");
    expect(tierOf("INSUFFICIENT_EVIDENCE", false)).toBe("EXCLUDED");
    expect(tierOf(null, true)).toBe("EXACT");
    expect(tierOf(null, false)).toBe("COMPARISON");
  });
});

function pick(c: Ctrl) {
  return {
    domain: c.domain, snapshotTitle: c.snapshotTitle.slice(0, 64), matchedTitle: c.matchedTitle.slice(0, 64),
    expectedTier: c.expectedTier, expectedMatchTruth: c.matchTruth, expectedVerified: c.verified,
    expectedCrossSeller: c.crossSellerVerdict, expectedVision: c.visionScore,
  };
}
