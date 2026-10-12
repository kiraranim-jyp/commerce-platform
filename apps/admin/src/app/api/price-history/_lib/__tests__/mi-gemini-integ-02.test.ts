/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-INTEGRATION-VALIDATION-002
 * 실상품 5개 × Gemini 후보 → 기존 MI 검증 owner → SAME «재현성» 측정
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 전용 · 코드 변경 0.** threshold 0 · scoring 0 · Identity 0 · UI 0 ·
 *    배포 0 · DB 쓰기 0. 기본값 SKIP(`MI_P0_02_LIVE=1`).
 * 🔴🔴 **COUNTERFACTUAL** — Gemini Discovery 는 운영 호출부가 **없다**(선행 WU
 *    전수 확정 · 경로 D). 이 숫자는 「운영 Discovery 성능」이 **아니다.**
 *
 * ── 🟢 owner 체인 (전부 기존 것 · 임의 호출로 결과를 만들지 않는다) ─────
 *   ① 쿼리     `generateQueries(identity)`            discovery-benchmark
 *   ② 발견     `createGoogleDiscoveryProvider({...}).discover(identity, query)`
 *              🔴 인자 **둘** 이다(메모 gemini-discovery-… 가 적어 둔 함정)
 *   ③ 해석     `resolveCandidate(searchUrl, provenance, probe)`  url-resolver.ts:52
 *              🔴 **반드시** 통과시킨다 — Gemini URL 은 vertexaisearch 리다이렉트다.
 *                 건너뛰면 전부 UNKNOWN_PAGE 로 버려져 「후보 0」이라는 거짓 결론이 난다
 *   ④ 후보화   `factsFromProductUrl(url)`  product-url-facts.ts:125
 *   ⑤ 판정     `withConfidence(query, [candidate])`   match.ts:476
 *              → `crossSellerVerdict` / `Reasons` / `Blockers` / `Conflicts`
 *                🔴 `match` 칸은 **없다**
 *
 * ── 🔴 집계 규칙 (CPO 지시) ────────────────────────────────────────────
 *   SAME · PRESUMED_SAME · SIMILAR · UNKNOWN · CONFLICT · **Fetch 실패** 를
 *   **서로 다른 칸**으로 센다. 🔴 Fetch 실패를 「SAME 실패」로 집계하지 않는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 상품당 후보 상한 — 비용을 묶는다(CPO 「2~3개」). */
const MAX_CANDIDATES_PER_PRODUCT = 3;

interface ProductRow {
  id: string; source_url: string; title: string; brand: string;
  color: string | null; sku: string | null; amt: string | null; cur: string | null;
  canonicalProduct: Record<string, unknown>;
}

type Verdict = "SAME" | "PRESUMED_SAME" | "SIMILAR" | "UNKNOWN" | "CONFLICT";
type Bucket = Verdict | "FETCH_FAIL" | "NOT_PRODUCT_PAGE" | "DISCOVERY_EMPTY" | "DISCOVERY_ERROR";

describe.skipIf(!LIVE)("🔴 MI-GEMINI-INTEG-02 — SAME 재현성", () => {
  it(
    "상품 5개 × Gemini 후보를 기존 MI owner 로 통과시켜 verdict 를 집계한다",
    async () => {
      const p = path.join(OUT_DIR, "g5-products.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const products = JSON.parse(readFileSync(p, "utf8")) as ProductRow[];

      /** 🟢 owner — 운영 import 블록 기준(패키지를 추측하지 않는다) */
      const { factsFromProductUrl, withConfidence } = (await import("@commerce/crawler")) as unknown as {
        factsFromProductUrl: (url: string) => Promise<{ status: string; crawlerUrl: string | null; candidate: Record<string, unknown> | null; httpCalls: number; fetchPath: string }>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
      };
      const { buildProductIdentityDna, backfillCanonicalProduct, buildCrossSellerSearchQueries, productFactsFromIdentityDna } =
        (await import("@commerce/shared")) as unknown as {
          buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
          backfillCanonicalProduct: (p: unknown) => unknown;
          buildCrossSellerSearchQueries: (dna: unknown) => string[];
          productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        };
      /** 🔴 discovery-benchmark 는 배럴이 re-export 하지 «않는다» — 깊은 경로다 */
      const { createGoogleDiscoveryProvider, googleDiscoveryReadiness } = await import(
        "@commerce/crawler/src/discovery-benchmark/google-discovery"
      );
      const { generateQueries } = await import("@commerce/crawler/src/discovery-benchmark/query-generator");
      const { resolveCandidate } = await import("@commerce/crawler/src/discovery-benchmark/url-resolver");
      /** 🔴🔴 `PageProbe` 를 손으로 만들면 안 된다 — 실제 타입은
       *     `(url) => Promise<{status, finalUrl, canonicalUrl}>` 이고 **리다이렉트를
       *     따라가야** 한다. 처음에 `{finalUrl: u, status: 200}` 을 돌려주는 probe 를
       *     손수 만들었고, 그러면 finalUrl 이 vertexaisearch 리다이렉트 URL 그대로라
       *     **12/12 가 UNKNOWN_PAGE** 로 찍혔다(= 거짓 「후보 못 씀」 결론).
       *     🟢 리포에 실제 HTTP 구현이 이미 있다 — `createLivePageProbe`. */
      const { createLivePageProbe } = await import("@commerce/crawler/src/discovery-benchmark/live-page-probe");

      const readiness = googleDiscoveryReadiness();
      const rows: Record<string, unknown>[] = [];
      let geminiCalls = 0, resolveCalls = 0, fetchCalls = 0;

      for (const pr of products) {
        const product = backfillCanonicalProduct(pr.canonicalProduct);
        const dna = buildProductIdentityDna(product);
        const qFacts = productFactsFromIdentityDna(dna);
        const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
        const miQuery = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? pr.title, searchTerms: terms, facts: qFacts,
        };

        /** ① identity — 🔴 DB 값에서 «그대로» 만든다(지어내지 않는다) */
        const host = (() => { try { return new URL(pr.source_url).hostname.replace(/^www\./, ""); } catch { return null; } })();
        const identity = {
          brand: pr.brand || null,
          productName: pr.title.split("|")[0]?.trim() || pr.title,
          productType: (qFacts.categoryText as string | null)?.split(">").pop()?.trim() ?? null,
          genderAge: null, color: pr.color, size: null, season: null,
          productCode: (qFacts.brandModelCode as string | null) ?? null,
          sourceUrl: pr.source_url, sourceSite: host, sourceCountry: null, market: null,
        };

        /** ② Gemini 발견 */
        let discovered: { url: string; title?: string | null }[] = [];
        let discoveryOutcome: "OK" | "EMPTY" | "ERROR" = "OK";
        let discoveryDetail: string | null = null;
        try {
          const queries = generateQueries(identity as never);
          const q = queries[0];
          if (!q) throw new Error("쿼리 생성 0건");
          const provider = createGoogleDiscoveryProvider({});
          geminiCalls += 1;
          discovered = (await provider.discover(identity as never, q)) as never;
          if (discovered.length === 0) discoveryOutcome = "EMPTY";
        } catch (e) {
          discoveryOutcome = "ERROR";
          discoveryDetail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        }

        /** ③ resolveCandidate → ④ factsFromProductUrl → ⑤ withConfidence */
        const cands: Record<string, unknown>[] = [];
        for (const d of discovered.slice(0, MAX_CANDIDATES_PER_PRODUCT)) {
          let bucket: Bucket = "NOT_PRODUCT_PAGE";
          let finalUrl: string | null = null, cls: string | null = null;
          let verdictInfo: Record<string, unknown> | null = null;
          try {
            resolveCalls += 1;
            const probe = createLivePageProbe({ onResult: () => { fetchCalls += 1; } });
            const res = await resolveCandidate(d.url, [d as never], probe);
            finalUrl = res.finalUrl ?? null; cls = res.classification ?? null;
            const target = res.crawlerUrl ?? res.finalUrl;
            if (target && res.classification === "PRODUCT_PAGE") {
              fetchCalls += 1;
              const f = await factsFromProductUrl(target);
              if (f.status !== "OK" || !f.candidate) {
                bucket = "FETCH_FAIL";
                verdictInfo = { fetchStatus: f.status, fetchPath: f.fetchPath };
              } else {
                const scored = withConfidence(miQuery, [f.candidate]);
                const s0 = scored[0];
                const v = (s0?.crossSellerVerdict as Verdict | undefined) ?? "UNKNOWN";
                bucket = v;
                verdictInfo = {
                  candidateTitle: String(s0?.title ?? "").slice(0, 56),
                  matchLevel: s0?.matchLevel, confidence: s0?.confidence,
                  crossSellerVerdict: v,
                  reasons: (s0?.crossSellerReasons as string[] | undefined)?.slice(0, 5) ?? [],
                  blockers: (s0?.crossSellerBlockers as unknown[] | undefined)?.length ?? 0,
                  conflicts: (s0?.crossSellerConflicts as unknown[] | undefined)?.length ?? 0,
                };
              }
            }
          } catch (e) {
            bucket = "FETCH_FAIL";
            verdictInfo = { error: e instanceof Error ? e.message : String(e) };
          }
          cands.push({
            geminiUrl: d.url.slice(0, 80), geminiTitle: d.title ?? null,
            finalUrl: finalUrl?.slice(0, 90) ?? null, classification: cls,
            bucket, ...verdictInfo,
          });
        }

        rows.push({
          brand: pr.brand, title: pr.title.slice(0, 44), color: pr.color,
          originFacts: { brand: qFacts.brand, brandModelCode: qFacts.brandModelCode, colorText: qFacts.colorText, tokens: (qFacts.coreTitleTokens as string[] | undefined)?.length ?? 0 },
          discovery: { outcome: discoveryOutcome, detail: discoveryDetail, found: discovered.length },
          candidates: cands,
        });
      }

      /** 🔴 버킷을 «서로 다른 칸» 으로 센다. Fetch 실패를 SAME 실패로 섞지 않는다. */
      const buckets: Record<string, number> = {};
      for (const r of rows) for (const c of r.candidates as Record<string, unknown>[]) {
        const b = String(c.bucket); buckets[b] = (buckets[b] ?? 0) + 1;
      }
      const prodOutcome: Record<string, number> = {};
      for (const r of rows) {
        const cs = r.candidates as Record<string, unknown>[];
        const key = cs.some((c) => c.bucket === "SAME") ? "SAME 1건 이상"
          : cs.some((c) => c.bucket === "PRESUMED_SAME") ? "PRESUMED_SAME 까지"
          : cs.length === 0 ? "후보 0" : "SAME/PRESUMED 없음";
        prodOutcome[key] = (prodOutcome[key] ?? 0) + 1;
      }

      const report = {
        "🔴🔴 DISCLAIMER": "COUNTERFACTUAL / NON-PRODUCTION DISCOVERY MEASUREMENT — " +
          "Gemini Discovery 에는 운영 호출부가 없다(선행 WU 전수 확정). 이 숫자는 운영 성능이 아니다. " +
          "🟢 MI 검증 쪽은 기존 owner 를 그대로 썼다. 코드 변경 0 · DB 쓰기 0 · 배포 0.",
        readiness,
        "🔴 sample": `상품 N=${rows.length} · 상품당 후보 상한 ${MAX_CANDIDATES_PER_PRODUCT}`,
        비용: { geminiCalls, resolveCalls, fetchCalls },
        "후보 단위 집계 (🔴 Fetch 실패를 SAME 실패로 섞지 않는다)": buckets,
        "상품 단위 결과": prodOutcome,
        products: rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "gemini-integ.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${rows.length}건 — 파일 참조)` }, null, 1));
      expect(rows.length).toBeGreaterThanOrEqual(3);
    },
    120 * 60 * 1000,
  );
});
