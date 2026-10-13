/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-INTEGRATION-005 ⑥ — 아동복 + 테니스 E2E · OFF/ON 대조 · 비용 실측
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **DB 쓰기 0.** 읽기 전용 덤프만 쓴다(`mi-gemini-005-dump.mjs`).
 *    🔴 `upsertDomesticProductLink` 를 **부르지 않는다** — 이 하니스는 판정까지만 본다.
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). GEMINI_API_KEY 는 `scripts/.env` 에 있다.
 *
 * ── 🔴🔴 OFF/ON 을 «같은 입력» 으로 비교한다 ────────────────────────────
 *   OFF = 국내 후보만 (searchDomesticShops → withConfidence)
 *   ON  = 국내 후보 + Gemini 후보 (collectGeminiCandidatePool 을 **합쳐서** 같은
 *         judge 에 넣는다)
 *   🟢 판정기를 새로 만들지 않았다 — `withConfidence` 하나를 두 번 부른다.
 *   🔴 그래서 「ON 이 더 좋다」를 주장할 때 분모가 같다. 다른 상품을 비교하지 않는다.
 *
 * ── 🔴 scope 검증이 이 WU 의 선행 조건이다 (§3) ─────────────────────────
 *   아동복 상품에는 아동복 scope 샵 도메인이, 테니스 상품에는 테니스 scope 샵
 *   도메인이 `preferredDomains` 로 들어가야 한다. 🔴 「들어갔다」만 보지 않고
 *   **Gemini 가 실제로 어느 도메인을 돌려줬는지** 를 센다.
 *
 * ── 🔴 비용은 네 칸으로 «갈라» 적는다 (§10) ─────────────────────────────
 *   Gemini API 호출 / 토큰 / 우리 resolve / 우리 fetch.
 *   🔴 grounding 쿼리 수는 **측정 불가** 다 — `usageMetadata` 에 안 들어온다.
 *      0 으로 적지 않는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 표본 상한 — 실제 외부 호출이 돈다. 분모를 보고서에 그대로 적는다. */
const KIDS_N = 3;
const TENNIS_N = 2;

interface UrlRow { id: string; source_url: string; title: string; brand: string }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}

const tally = (xs: string[]): Record<string, number> => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return t;
};
const hostOf = (u: string): string => {
  try { return new URL(u).hostname.replace(/^www\./i, "").toLowerCase(); } catch { return "(bad-url)"; }
};

describe.skipIf(!LIVE)("🔴 MI-GEMINI-005 ⑥ — OFF/ON E2E", () => {
  it(
    "아동복 + 테니스 실상품에서 Gemini 합류가 verdict 와 비용을 어떻게 바꾸는가",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p} — scripts/mi-gemini-005-dump.mjs 먼저`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<{ id: string; canonicalProduct: unknown }[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<{ shopId: string; shopName: string; domain: string; status: string; candidates: Record<string, unknown>[] }[]>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget } = await import("../run-domestic-price-check");
      const { collectGeminiCandidatePool, normalizeCandidateUrl, GEMINI_VIRTUAL_SHOP_ID } =
        await import("../gemini-candidate-pool");

      /** 🔴 scope 는 **운영 함수** 로 가른다 — 내가 다시 구현하지 않는다. */
      const targetsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => isBatchSurveyTarget(s as never, scopes))
          .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /* 🔴🔴 1차 실행이 **무효** 였다 — scope 를 `"KIDS_CLOTHING"` 으로 **추측** 했고
       *    그 어휘는 DB 에 **없다**. 그래서 `scope 통과 샵 0` · `OFF 후보 0` 이 나왔고,
       *    「ON 추가 SAME 9」를 그 0 과 비교하면 **거짓 비교** 가 된다.
       *    🟢 실제 값은 DB 전수로 확인했다:
       *       KIDS_FASHION 11 · (빈 배열) 14 · FASHION_ACCESSORIES/KIDS_FASHION/
       *       WOMEN_FASHION 4 · KIDS_FASHION+KIDS_GOODS 3 · TENNIS 1 · GOLF 1
       *    🔴 이 트랙에서 **값/칸 이름을 추측해 틀린 것이 여섯 번째** 다. */
      const plan = [
        ...[...groups.kids, ...groups.kids2].slice(0, KIDS_N).map((r) => ({ row: r, scopes: ["KIDS_FASHION"] })),
        ...groups.tennis.slice(0, TENNIS_N).map((r) => ({ row: r, scopes: ["TENNIS"] })),
      ];

      const products: Record<string, unknown>[] = [];
      const cost = { geminiCalls: 0, inputTokens: 0, outputTokens: 0, thoughtsTokens: 0, totalTokens: 0, resolveCalls: 0, fetchCalls: 0 };
      const allOutcomes: string[] = [];
      const allFailures: string[] = [];
      let modelUsed: string | null = null;

      for (const { row, scopes } of plan) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) { products.push({ title: row.title, "🔴": "스냅샷 없음" }); continue; }

        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts,
        };

        const targets = targetsFor(scopes);
        const scopedDomains = targets.map((s) => s.domain);

        /** ── OFF — 현재 운영 경로 ─────────────────────────────────── */
        const domestic = await crawler.searchDomesticShops(
          query,
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );
        const domesticCands = domestic.flatMap((r) => r.candidates);
        const offScored = crawler.withConfidence(query, domesticCands);

        /** ── ON — Gemini 후보를 «합쳐서» 같은 judge 에 넣는다 ───────── */
        const existing = new Set<string>(domesticCands.map((c) => normalizeCandidateUrl(String(c.url))));
        const pool = await collectGeminiCandidatePool({
          dna: dna as never,
          scopedDomains,
          categoryScopes: scopes,
          maxCandidates: 3,
          targetUsable: 3,
          maxQueries: 2,
          existingNormalizedUrls: existing,
        });
        const geminiCands = pool.searchResult?.candidates ?? [];
        const onScored = crawler.withConfidence(query, [...domesticCands, ...geminiCands]);

        cost.geminiCalls += pool.metrics.geminiCalls;
        cost.inputTokens += pool.metrics.inputTokens;
        cost.outputTokens += pool.metrics.outputTokens;
        cost.thoughtsTokens += pool.metrics.thoughtsTokens;
        cost.totalTokens += pool.metrics.totalTokens;
        cost.resolveCalls += pool.metrics.resolveCalls;
        cost.fetchCalls += pool.metrics.fetchCalls;
        if (pool.metrics.model) modelUsed = pool.metrics.model;
        for (const [k, v] of Object.entries(pool.metrics.outcomes)) for (let i = 0; i < v; i += 1) allOutcomes.push(k);
        allFailures.push(...pool.metrics.failureDetails);

        /** 🔴 Gemini 후보만 떼어 verdict 를 본다 — 국내 후보 결과에 섞지 않는다. */
        const geminiUrls = new Set(geminiCands.map((c) => normalizeCandidateUrl(String(c.url))));
        const geminiScored = onScored.filter((c) => geminiUrls.has(normalizeCandidateUrl(String(c.url))));

        const vOf = (xs: Record<string, unknown>[]) => xs.map((c) => String(c.crossSellerVerdict ?? "(없음)"));

        products.push({
          brand: row.brand,
          title: row.title.slice(0, 56),
          scope: scopes,
          "scope 통과 샵": targets.length,
          "scopedDomains": scopedDomains,

          "OFF 후보": domesticCands.length,
          "OFF verdict": tally(vOf(offScored)),
          "OFF matchLevel": tally(offScored.map((c) => String(c.matchLevel))),

          "🔴 Gemini outcome": pool.metrics.outcomes,
          "🔴 Gemini 실패사유": pool.metrics.failureDetails,
          "Gemini 발견 URL": pool.metrics.discoveredUrls,
          "Gemini 상품페이지": pool.metrics.usableProductUrls,
          "Gemini MI 후보": pool.metrics.miEligibleCandidates,
          "Gemini 조기종료": pool.metrics.earlyStopped,
          "Gemini 쿼리 사용": pool.metrics.queriesUsed,

          "ON 후보": domesticCands.length + geminiCands.length,
          "🟢 Gemini 후보 verdict": tally(vOf(geminiScored)),
          "🟢 Gemini 후보 matchLevel": tally(geminiScored.map((c) => String(c.matchLevel))),
          /** 🔴 scope 가 실제로 먹었는가 — 돌려받은 도메인을 센다(가정 금지) */
          "🔴 Gemini 후보 도메인": geminiCands.map((c) => hostOf(String(c.url))),
          "🔴 등록부 도메인과 겹치는가": geminiCands
            .map((c) => hostOf(String(c.url)))
            .map((h) => scopedDomains.some((d) => h.includes(d.replace(/^www\./, "")) || d.includes(h))),

          "🟢 Gemini 후보가 저장되지 않는 근거": pool.searchResult ? `shopId=${pool.searchResult.shopId}` : "후보 0",
          "가상 샵 id 확인": pool.searchResult ? pool.searchResult.shopId === GEMINI_VIRTUAL_SHOP_ID : null,

          /** 🔴🔴 이 WU 의 핵심 숫자 — OFF 에 없던 SAME 급 판정이 ON 에서 생겼는가 */
          "🔴 OFF SAME/PRESUMED": vOf(offScored).filter((v) => v === "SAME" || v === "PRESUMED_SAME").length,
          "🟢 ON 추가 SAME/PRESUMED": vOf(geminiScored).filter((v) => v === "SAME" || v === "PRESUMED_SAME").length,
          "Gemini 후보 상세": geminiScored.map((c) => ({
            url: String(c.url).slice(0, 90),
            title: String(c.title ?? "").slice(0, 60),
            verdict: c.crossSellerVerdict ?? null,
            conf: c.confidence ?? null,
            reasons: (c.crossSellerReasons as string[] | undefined)?.slice(0, 6) ?? null,
            blockers: (c.crossSellerBlockers as unknown[] | undefined)?.length ?? null,
            conflicts: (c.crossSellerConflicts as unknown[] | undefined)?.length ?? null,
          })),
        });
      }

      const real = products.filter((p) => !p["🔴"]);
      const sumOf = (k: string) => real.reduce((a, p) => a + Number(p[k] ?? 0), 0);

      const report = {
        "🔴🔴 DISCLAIMER":
          `sample 상품 N=${real.length}(아동복 ${KIDS_N} · 테니스 ${TENNIS_N}). ` +
          "🔴 Production 배포 전이다 — Implemented / Not Production Verified. " +
          "🔴 DB 쓰기 0 · upsert 를 부르지 않았다. 🔴 497개 기준 비용 환산을 하지 않는다(CPO 폐기).",
        "① 모델": modelUsed,
        "② 🔴 비용 — 네 칸으로 갈라 적는다": {
          "Gemini API 호출": cost.geminiCalls,
          "🔴 grounding 쿼리": "측정 불가 — usageMetadata 에 들어오지 않는다(0 이 아니다)",
          "입력 토큰": cost.inputTokens,
          "출력 토큰": cost.outputTokens,
          "thoughts 토큰": cost.thoughtsTokens,
          "총 토큰": cost.totalTokens,
          "우리 서버 resolve": cost.resolveCalls,
          "우리 서버 fetch": cost.fetchCalls,
          [`상품당(N=${real.length})`]: real.length
            ? { gemini: +(cost.geminiCalls / real.length).toFixed(2), tokens: Math.round(cost.totalTokens / real.length), fetch: +(cost.fetchCalls / real.length).toFixed(2) }
            : "측정불가",
        },
        "③ outcome 집계 (🔴 0건 과 실패를 섞지 않는다)": tally(allOutcomes),
        "③-b 🔴 실패 «사유» (개수만 세면 원인을 못 가른다)": tally(allFailures),
        "④ 퍼널": {
          "Gemini 발견 URL": sumOf("Gemini 발견 URL"),
          "상품페이지로 해석": sumOf("Gemini 상품페이지"),
          "MI 후보 생성": sumOf("Gemini MI 후보"),
          "OFF 후보 합": sumOf("OFF 후보"),
          "ON 후보 합": sumOf("ON 후보"),
        },
        "⑤ 🔴🔴 핵심 — OFF 에 없던 판정이 생겼는가": {
          "OFF SAME/PRESUMED 합": sumOf("🔴 OFF SAME/PRESUMED"),
          "🟢 ON 추가 SAME/PRESUMED 합": sumOf("🟢 ON 추가 SAME/PRESUMED"),
          "효과가 난 상품 수": real.filter((p) => Number(p["🟢 ON 추가 SAME/PRESUMED"]) > 0).length,
        },
        "⑥ scope 검증": real.map((p) => ({
          brand: p.brand, scope: p.scope, "scope 통과 샵": p["scope 통과 샵"],
          "Gemini 후보 도메인": p["🔴 Gemini 후보 도메인"],
          "등록부와 겹침": p["🔴 등록부 도메인과 겹치는가"],
        })),
        "⑦ 저장 차단": {
          "가상 샵 id": GEMINI_VIRTUAL_SHOP_ID,
          확인: real.map((p) => p["가상 샵 id 확인"]),
          "🔴 upsertDomesticProductLink 호출": 0,
        },
        products,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      /* 🔴🔴 **덮어쓰지 않는다.** 1차 실행은 고정 파일명을 썼고, 재실행이 그것을
       *    덮어써서 **1·2차의 후보별 상세가 영구히 사라졌다**(남은 것은 터미널에
       *    찍힌 집계뿐). 실측은 한 번뿐인 외부 호출에 의존하므로 — 특히 이 WU 는
       *    3차에서 402 로 **더 이상 재현이 불가능해졌다** — 회차를 분리해 둔다. */
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `gemini-005-e2e-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `gemini-005-e2e-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${products.length}건 — 파일 참조)` }, null, 1));
      expect(real.length).toBeGreaterThan(0);
    },
    90 * 60 * 1000,
  );
});
