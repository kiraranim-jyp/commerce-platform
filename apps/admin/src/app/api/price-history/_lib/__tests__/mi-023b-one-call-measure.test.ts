/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-023 **B** — Gemini **정확히 1 call** 실측 (Production flag 는 건드리지 않는다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 실제 돈을 쓴다.** 그래서 안전장치를 코드로 박았다:
 * ```
 * 상품 **1개**(id 하드코딩) · maxQueries **1** · maxCandidates **3** · targetUsable **3**
 * 🔴 재시도 0 · grounding 재호출 0 · 루프 0
 * 🔴 `geminiCalls > 1` 이면 **즉시 실패** 로 단언한다(사후에라도 드러나게)
 * 🔴 기본 SKIP — `MI_P0_02_ONE_CALL=1` 일 때만 돈다(`MI_P0_02_LIVE` 와 **다른 키**).
 *    기존 LIVE 하니스와 같은 키를 쓰면 회귀에서 같이 돌아 돈이 샌다.
 * ```
 *
 * 🔴 **Production flag 를 바꾸지 않는다.** 로컬에서 `collectGeminiCandidatePool` 을
 *    **운영 블록과 같은 인자로** 직접 부른다 — 운영이 그 함수에 넘기는 값과 1:1 이다
 *    (run-domestic-price-check.ts:895-903). flag 는 그 호출 «앞» 의 게이트일 뿐이다.
 *
 * 🔴 **잔액/원화 비용은 이 파일이 보고하지 않는다** — CTO 가 Billing 을 읽을 수 없다
 *    (헌장 §10). 토큰·grounding·호출 수만 실측하고 금액은 **CPO 가 AI Studio 에서** 읽는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ENABLED = process.env.MI_P0_02_ONE_CALL === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 상품 **하나** 다. WU-014/018 감사에서 `L1_MODEL_CODE`(품번 기반 Primary)로 확인된 건. */
const TARGET_SNAPSHOT_ID = "0084e0ce-42c2-41b2-a7b2-c8813f43da63";

interface SnapRow { id: string; canonicalProduct: unknown }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}

const read = <T>(f: string): T => {
  const p = path.join(OUT_DIR, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

describe.skipIf(!ENABLED)("🔴🔴 WU-023B — Gemini 1 call 실측", () => {
  it(
    "운영과 같은 인자로 정확히 1회 부르고 §11 계측표를 채운다",
    async () => {
      const snaps = read<SnapRow[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      const snap = snaps.find((s) => s.id === TARGET_SNAPSHOT_ID);
      expect(snap, `대상 스냅샷이 덤프에 없다: ${TARGET_SNAPSHOT_ID}`).toBeTruthy();

      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
      };
      const { collectGeminiCandidatePool } = await import("../gemini-candidate-pool");
      const { isBatchSurveyTarget, judgeDomesticCandidate } = await import("../run-domestic-price-check");
      const crawler = (await import("@commerce/crawler")) as unknown as {
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
        isSelfReferenceCandidate: (origin: string, url: string) => boolean;
      };
      const sharedFacts = (await import("@commerce/shared")) as unknown as {
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
      };

      const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap!.canonicalProduct));
      const categoryScopes = ["KIDS_FASHION"];
      /** 🟢 운영과 같은 머지 — scope 통과 + 자동수집 가능한 샵의 도메인만 넘긴다. */
      const scopedDomains = sources
        .filter((s) => isBatchSurveyTarget(s as never, categoryScopes))
        .map((s) => s.domain);

      /** 🔴🔴 운영 호출부(run-domestic-price-check.ts:895-903)와 **같은 인자** 다. */
      const pool = await collectGeminiCandidatePool({
        dna: dna as never,
        scopedDomains,
        categoryScopes,
        maxCandidates: 3,
        targetUsable: 3,
        maxQueries: 1,
        existingNormalizedUrls: new Set<string>(),
      });
      const m = pool.metrics;

      /** 🔴🔴 **1 call 을 넘겼으면 그 사실이 보고서에 남아야 한다.** */
      expect(m.geminiCalls, "🔴 1 call 을 초과했다 — 상한이 깨졌다").toBeLessThanOrEqual(1);
      expect(m.queriesUsed).toBeLessThanOrEqual(1);

      /* ── 받은 후보를 **운영 판정 경로** 로 그대로 돌린다(추가 Gemini 0) ── */
      const qFacts = sharedFacts.productFactsFromIdentityDna(dna);
      const terms = sharedFacts.buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: String(qFacts.title),
        brand: qFacts.brand ?? undefined,
        sourceUrl: qFacts.sourceUrl,
        searchTerm: terms[0] ?? "",
        searchTerms: terms,
        facts: qFacts,
      };

      const verdicts: Record<string, number> = {};
      const judged: Record<string, unknown>[] = [];
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter(
          (c) => !crawler.isSelfReferenceCandidate(String(query.sourceUrl), c.url),
        );
        const scored = crawler.withConfidence(query, notSelf as never[]);
        const j = await judgeDomesticCandidate({
          domain: r.domain,
          candidates: scored as never,
          sourceUrl: String(query.sourceUrl),
          foreignModelCode: (dna.brandModelCode as string | null) ?? null,
          foreignColor: (dna.color as string | null) ?? null,
          /** 🔴 상세 품번 fetch 를 **하지 않는다** — 이 측정의 비용 축을 늘리지 않는다. */
          fetchModelCode: async () => null,
        } as never);
        const kind = (j as { kind: string }).kind;
        if (kind === "JUDGED") {
          /** 🔴 `DomesticJudgement` 는 판별 union 이라 직접 단언이 겹치지 않는다(TS2352).
           *     `unknown` 을 한 번 거쳐 읽는다 — 값을 바꾸지 않는다. */
          const best = (j as unknown as { best: Record<string, unknown> }).best;
          const v = String(best.crossSellerVerdict ?? best.matchTruth ?? "(없음)");
          verdicts[v] = (verdicts[v] ?? 0) + 1;
          judged.push({
            domain: r.domain,
            url: best.url,
            verdict: best.crossSellerVerdict ?? null,
            matchTruth: best.matchTruth ?? null,
            confidence: best.confidence ?? null,
            price: best.price ?? null,
            priceStatus: best.priceStatus ?? null,
          });
        } else {
          verdicts[kind] = (verdicts[kind] ?? 0) + 1;
          judged.push({ domain: r.domain, kind, gate: (j as { gate?: string }).gate ?? null });
        }
      }

      const report = {
        "🔴🔴 DISCLAIMER":
          "WU-023 **B** — Production flag 를 건드리지 않고 **로컬에서 운영과 같은 함수·같은 인자** 로 " +
          "`collectGeminiCandidatePool` 을 **1회** 불렀다(run-domestic-price-check.ts:895-903 과 1:1). " +
          "🔴 상품 **1개** · maxQueries 1 · 후보 cap 3 · 재시도 0 · 루프 0. " +
          "🔴🔴 **원화 비용/잔액은 이 보고서에 없다** — CTO 는 Billing 을 읽을 수 없다. " +
          "토큰·grounding·호출 수만 실측값이고 **금액은 CPO 가 AI Studio 에서 읽는다.**",
        "① 대상": { snapshotId: TARGET_SNAPSHOT_ID, scope: categoryScopes[0], "scope 통과 샵": scopedDomains.length },
        "②🔴🔴 §11 계측 (실측값 · 추정 0)": {
          "Gemini API calls": m.geminiCalls,
          Products: 1,
          "Calls / product": m.geminiCalls,
          "Input tokens": m.inputTokens,
          "Output tokens": m.outputTokens,
          "Thoughts tokens": m.thoughtsTokens,
          "Total tokens": m.totalTokens,
          "Grounding queries": m.groundingQueries,
          "Discovered URLs": m.discoveredUrls,
          "Usable product URLs": m.usableProductUrls,
          "MI candidates": m.miEligibleCandidates,
          model: m.model,
          "queriesUsed": m.queriesUsed,
          "resolve calls": m.resolveCalls,
          "fetch calls (🔴 Gemini 아님)": m.fetchCalls,
          outcomes: m.outcomes,
          earlyStopped: m.earlyStopped,
          failureDetails: m.failureDetails,
        },
        "③ Primary Query (실제로 보낸 것)": {
          level: m.primaryQueryLevel,
          tokenCount: m.primaryQueryTokenCount,
          text: m.primaryQuery,
        },
        "④🔴 Grounding query 실제 문자열": m.groundingQueryTexts,
        "⑤ MI 판정 분포": verdicts,
        "⑥ 후보별": judged,
        "⑦🔴 적지 않은 것": [
          "🔴 원화 비용 · 잔액 차이 — CTO 가 읽을 수 없다(CPO 가 AI Studio 에서 확인).",
          "🔴 이 숫자는 **상품 1개** 값이다. 전수로 환산하지 않는다.",
          "🔴 Production 실행이 아니다 — 같은 코드 경로를 로컬에서 불렀다.",
        ],
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `onecall023-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `onecall023-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 1));

      expect(m.geminiCalls).toBe(1);
    },
    20 * 60 * 1000,
  );
});
