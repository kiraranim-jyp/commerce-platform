/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-005 VALIDATION-CLOSE ①④ — `judgeDomesticCandidate` 까지 «운영 경로»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **직전 하니스가 한 단계 짧았다.** `withConfidence` 까지만 불러서
 *    「추가 SAME/PRESUMED 4」를 냈고, 그것은 **운영 판정 결과가 아니었다**.
 *    운영은 그 뒤에 `judgeDomesticCandidate`(게이트 + `fetchDomesticModelCode`
 *    + `selectDomesticCandidate`)가 **더 있다**. §5-B 가 이 트랙에서 이미 한 번
 *    잡은 함정을 다시 밟았고, CPO 가 그 숫자를 KPI 에서 폐기했다.
 *
 * 🟢 이 하니스는 운영 루프(run-domestic-price-check.ts)를 그대로 흉내낸다:
 *      searchDomesticShops → (내부 withConfidence) → **샵별** judgeDomesticCandidate
 *      → JUDGED.matchTruth / verified → **priceTierFromLink 를 «호출»**
 *    🔴 tier 를 복제 계산하지 않는다(헌장 §12).
 *
 * ── 🔴🔴 §5-B CONTROL — 「후보가 나왔다」는 통과 조건이 «아니다» ───────────
 *   통과 조건은 **운영이 낸 그 값이 재현된다** 다:
 *     `matchTruth === 운영 match_truth` && `verified === 운영 verified`
 *   🔴 CONTROL 이 실패하면 아래 OFF/ON 숫자를 전략 판단에 쓰지 않는다.
 *   🔴 실패를 곧바로 하니스 결함으로 단정하지 않고 순서대로 가른다 —
 *      **호출 경로 → 설정 상태 → 입력 → Production 결과.**
 *   🟢 `bobochoses.com` 링크는 **구조적 재현 불가** 로 미리 분리한다 — 그 샵은
 *      등록부에서 disabled 라 재검색에서 아예 안 뒤진다(헌장 §12 · 선행 WU 가
 *      같은 이유로 CONTROL 2건을 날렸고 「하니스 결함이 아니었다」고 기록됐다).
 *
 * 🔴 **DB 쓰기 0** — `upsertDomesticProductLink` 를 부르지 않는다.
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🟢 재현 가능한 CONTROL 샵 — 실제로 검색되는 AUTO 샵만. */
const REPRODUCIBLE_CONTROL_DOMAINS = ["deuxbebe.com", "foretforet.com", "littleluna.co.kr"];

interface UrlRow { id: string; source_url: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown; description: string | null }
interface LinkRow {
  snapshot_id: string; domain: string; shop_name: string;
  match_truth: string | null; verified: boolean; match_type: string | null;
  cross_seller_verdict: string | null; external_url: string; matched_title: string | null;
}
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}
interface RawResult {
  shopId: string; shopName: string; domain: string; status: string;
  candidates: Record<string, unknown>[]; error?: string;
}
interface Judged {
  domain: string; shopId: string; kind: string; gate: string | null;
  matchTruth: string | null; verified: boolean | null; tier: string | null;
  verdict: string | null; title: string | null; url: string | null;
}

const tally = (xs: string[]): Record<string, number> => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return t;
};

describe.skipIf(!LIVE)("🔴 MI-GEMINI-005 VALIDATION-CLOSE — 운영 판정 경로", () => {
  it(
    "CONTROL 로 경로를 잠근 뒤 OFF/ON 을 judgeDomesticCandidate 까지 비교한다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p} — scripts/mi-gemini-005-dump.mjs 먼저`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<SnapRow[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      const links = read<LinkRow[]>("e2e-links.json");

      /** 🔴 owner 패키지를 추측하지 않는다 — 운영 파일의 import 블록을 베꼈다. */
      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<RawResult[]>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
        extractForeignModelCode: (d: string | undefined) => string | null;
        fetchDomesticModelCode: (domain: string, url: string) => Promise<string | null>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget, judgeDomesticCandidate } = await import("../run-domestic-price-check");
      const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
      const { collectGeminiCandidatePool, normalizeCandidateUrl, GEMINI_VIRTUAL_SHOP_ID } =
        await import("../gemini-candidate-pool");

      const targetsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => isBatchSurveyTarget(s as never, scopes))
          .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      /** 🔴 scope 어휘는 **DB 에서 확인한 값** 이다 — `KIDS_CLOTHING` 은 없다. */
      const plan = [
        ...(groups.control ?? []).map((r) => ({ row: r, scopes: ["KIDS_FASHION"], control: true })),
        ...[...groups.kids, ...groups.kids2].slice(0, 2).map((r) => ({ row: r, scopes: ["KIDS_FASHION"], control: false })),
        ...groups.tennis.slice(0, 2).map((r) => ({ row: r, scopes: ["TENNIS"], control: false })),
      ];

      /** 🟢 운영 루프와 **같은 순서·같은 인자** 로 샵별 판정을 돌린다. */
      const judgeAll = async (
        results: RawResult[],
        sourceUrl: string | undefined,
        foreignModelCode: string | null,
        foreignColor: string | null,
        counters: { fetch: number },
      ): Promise<Judged[]> => {
        const out: Judged[] = [];
        for (const result of results) {
          if (result.status !== "ok") continue;
          const judgement = await judgeDomesticCandidate({
            domain: result.domain,
            candidates: result.candidates as never,
            sourceUrl,
            foreignModelCode,
            foreignColor,
            fetchModelCode: (url: string) => {
              counters.fetch += 1;
              return crawler.fetchDomesticModelCode(result.domain, url);
            },
          });
          const base = { domain: result.domain, shopId: result.shopId };
          if (judgement.kind === "NO_CANDIDATES") {
            out.push({ ...base, kind: "NO_CANDIDATES", gate: null, matchTruth: null, verified: null, tier: null, verdict: null, title: null, url: null });
            continue;
          }
          if (judgement.kind === "DROPPED") {
            const c = judgement.observed.candidate as unknown as Record<string, unknown>;
            out.push({
              ...base, kind: "DROPPED", gate: judgement.gate, matchTruth: null, verified: null, tier: null,
              verdict: (c.crossSellerVerdict as string | undefined) ?? null,
              title: (c.title as string | undefined) ?? null,
              url: (c.url as string | undefined) ?? null,
            });
            continue;
          }
          const best = judgement.best as unknown as Record<string, unknown>;
          out.push({
            ...base, kind: "JUDGED", gate: null,
            matchTruth: judgement.matchTruth,
            verified: judgement.verified,
            /** 🔴 복제 계산하지 않는다 — owner 를 «호출» 한다. */
            tier: priceTierFromLink({ matchTruth: judgement.matchTruth, verified: judgement.verified } as never),
            verdict: (best.crossSellerVerdict as string | undefined) ?? null,
            title: (best.title as string | undefined) ?? null,
            url: (best.url as string | undefined) ?? null,
          });
        }
        return out;
      };

      const products: Record<string, unknown>[] = [];
      const controlRows: Record<string, unknown>[] = [];
      const cost = { geminiCalls: 0, inputTokens: 0, outputTokens: 0, thoughtsTokens: 0, totalTokens: 0, resolveCalls: 0, fetchCalls: 0, domesticDetailFetch: 0 };
      const allOutcomes: string[] = [];
      const allFailures: string[] = [];
      let modelUsed: string | null = null;

      for (const { row, scopes, control } of plan) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) { products.push({ title: row.title, "🔴": "스냅샷 없음" }); continue; }

        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts,
        };
        /** 🔴 운영과 **같은 식** — description 을 먼저 보고 없을 때만 dna 로 간다. */
        const foreignModelCode =
          crawler.extractForeignModelCode(snap.description ?? undefined) ?? (dna.brandModelCode as string | null);
        const foreignColor = (dna.color as string | null) ?? null;

        const targets = targetsFor(scopes);
        const scopedDomains = targets.map((s) => s.domain);
        const counters = { fetch: 0 };

        /** ── OFF — 현재 운영 경로 «전체» ─────────────────────────── */
        const domestic = await crawler.searchDomesticShops(
          query,
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );
        const offJudged = await judgeAll(domestic, query.sourceUrl as string | undefined, foreignModelCode, foreignColor, counters);

        /** ── CONTROL — 🔴 「운영이 낸 그 값」을 재현하는가 ─────────── */
        if (control) {
          for (const link of links.filter((l) => l.snapshot_id === row.id)) {
            const reproducible = REPRODUCIBLE_CONTROL_DOMAINS.includes(link.domain);
            const mine = offJudged.find((j) => j.domain === link.domain);
            controlRows.push({
              상품: row.title.slice(0, 40),
              샵: link.domain,
              "🔴 재현 가능한 샵인가": reproducible,
              "운영 match_truth": link.match_truth,
              "내 match_truth": mine?.matchTruth ?? null,
              "운영 verified": link.verified,
              "내 verified": mine?.verified ?? null,
              "내 kind": mine?.kind ?? "(그 샵이 결과를 내지 않았다)",
              "운영 tier": priceTierFromLink({ matchTruth: link.match_truth, verified: link.verified } as never),
              "내 tier": mine?.tier ?? null,
              "내 gate": mine?.gate ?? null,
              "내가 고른 후보": mine?.title ?? null,
              "운영이 고른 후보": link.matched_title,
              "운영 URL": link.external_url,
              "내 URL": mine?.url ?? null,
              "🔴🔴 CONTROL PASS": reproducible
                ? mine?.matchTruth === link.match_truth && mine?.verified === link.verified
                : "구조적 재현 불가(샵 disabled) — 실패로 세지 않는다",
            });
          }
        }

        /** ── ON — Gemini 후보를 «점수 매겨» 합류시킨 뒤 같은 판정 ── */
        const existing = new Set<string>(
          domestic.flatMap((r) => r.candidates.map((c) => normalizeCandidateUrl(String(c.url)))),
        );
        const pool = await collectGeminiCandidatePool({
          dna: dna as never, scopedDomains, categoryScopes: scopes,
          maxCandidates: 3, targetUsable: 3, maxQueries: 2, existingNormalizedUrls: existing,
        });
        /** 🟢 운영 배선과 **같은 한 줄** — 점수 없이 넘기면 게이트가 틀린 값을 읽는다. */
        const geminiResults = pool.searchResults.map(
          (r) => ({ ...r, candidates: crawler.withConfidence(query, r.candidates) }) as unknown as RawResult,
        );
        const geminiJudged = await judgeAll(geminiResults, query.sourceUrl as string | undefined, foreignModelCode, foreignColor, counters);

        cost.geminiCalls += pool.metrics.geminiCalls;
        cost.inputTokens += pool.metrics.inputTokens;
        cost.outputTokens += pool.metrics.outputTokens;
        cost.thoughtsTokens += pool.metrics.thoughtsTokens;
        cost.totalTokens += pool.metrics.totalTokens;
        cost.resolveCalls += pool.metrics.resolveCalls;
        cost.fetchCalls += pool.metrics.fetchCalls;
        cost.domesticDetailFetch += counters.fetch;
        if (pool.metrics.model) modelUsed = pool.metrics.model;
        for (const [k, v] of Object.entries(pool.metrics.outcomes)) for (let i = 0; i < v; i += 1) allOutcomes.push(k);
        allFailures.push(...pool.metrics.failureDetails);

        const exactish = (xs: Judged[]) => xs.filter((j) => j.tier === "EXACT").length;
        products.push({
          CONTROL: control,
          brand: row.brand, title: row.title.slice(0, 50), scope: scopes,
          "scope 통과 샵": targets.length,
          foreignModelCode, foreignColor,

          "OFF 판정 kind": tally(offJudged.map((j) => j.kind)),
          "OFF matchTruth": tally(offJudged.map((j) => j.matchTruth ?? "(없음)")),
          "OFF tier": tally(offJudged.map((j) => j.tier ?? "(없음)")),
          "🟢 OFF EXACT 샵 수": exactish(offJudged),
          /** 🔴 **게이트 이름을 찍는다.** 1차 CONTROL 에서 1건이 DROPPED 로 났는데
           *     어느 게이트인지 출력에 없어 원인을 가를 수 없었다 — 「DROPPED」는
           *     원인이 아니라 결과다(§5-B: 호출경로→설정→입력→결과 순으로 가른다). */
          "🔴 OFF 판정 상세": offJudged,

          "🔴 Gemini outcome": pool.metrics.outcomes,
          "🔴 Gemini 실패사유": pool.metrics.failureDetails.slice(0, 2),
          "Gemini host 그룹": pool.searchResults.map((r) => r.domain),
          "Gemini MI 후보": pool.metrics.miEligibleCandidates,

          "🟢🟢 ON Gemini 판정 kind": tally(geminiJudged.map((j) => j.kind)),
          "🟢🟢 ON Gemini matchTruth": tally(geminiJudged.map((j) => j.matchTruth ?? "(없음)")),
          "🟢🟢 ON Gemini tier": tally(geminiJudged.map((j) => j.tier ?? "(없음)")),
          "🔴 ON 추가 EXACT": exactish(geminiJudged),
          "Gemini 판정 상세": geminiJudged,

          "가상 shopId 유지": geminiResults.every((r) => r.shopId === GEMINI_VIRTUAL_SHOP_ID),
          "국내 상세 fetch": counters.fetch,
        });
      }

      const real = products.filter((p) => !p["🔴"]);
      const sumOf = (k: string) => real.reduce((a, p) => a + Number(p[k] ?? 0), 0);
      const reproducible = controlRows.filter((c) => c["🔴 재현 가능한 샵인가"] === true);
      const controlPass = reproducible.filter((c) => c["🔴🔴 CONTROL PASS"] === true).length;

      const report = {
        "🔴🔴 DISCLAIMER":
          `sample 상품 N=${real.length} (CONTROL ${plan.filter((p) => p.control).length} · 아동복 2 · 테니스 2). ` +
          "🔴 DB 쓰기 0 · upsert 호출 0. 🔴 497개 환산 금지. " +
          "🔴 Implemented / Not Production Verified.",
        "①🔴🔴 §5-B CONTROL — 「운영이 낸 그 값」 재현": {
          "운영 링크 전체": controlRows.length,
          "재현 가능한 샵의 링크": reproducible.length,
          "🟢 재현 PASS": `${controlPass}/${reproducible.length}`,
          "🔴 구조적 재현 불가(샵 disabled)": controlRows.length - reproducible.length,
          상세: controlRows,
        },
        "② 모델": modelUsed,
        "③ 🔴 비용 — 칸을 섞지 않는다": {
          "Gemini API 호출": cost.geminiCalls,
          "🔴 grounding 쿼리": "측정 불가 — usageMetadata 에 들어오지 않는다(0 이 아니다)",
          "입력 토큰": cost.inputTokens, "출력 토큰": cost.outputTokens,
          "thoughts 토큰": cost.thoughtsTokens, "총 토큰": cost.totalTokens,
          "우리 resolve": cost.resolveCalls,
          "우리 fetch(Gemini 후보 확보)": cost.fetchCalls,
          "🔴 국내 상세 fetch(판정 중 품번 확인)": cost.domesticDetailFetch,
        },
        "④ Gemini outcome (🔴 0건 과 실패를 섞지 않는다)": tally(allOutcomes),
        "④-b 🔴 실패 사유": tally(allFailures),
        "⑤ 🔴🔴 판정 결과 — judgeDomesticCandidate 기준": {
          "OFF EXACT 샵 합": sumOf("🟢 OFF EXACT 샵 수"),
          "ON 추가 EXACT 합": sumOf("🔴 ON 추가 EXACT"),
          "Gemini MI 후보 합": sumOf("Gemini MI 후보"),
          "🔴 주의":
            "이 숫자는 withConfidence 단계의 crossSellerVerdict 가 아니라 " +
            "judgeDomesticCandidate 의 matchTruth/verified → priceTierFromLink 산출이다.",
        },
        "⑥ 저장 차단": {
          "가상 샵 id": GEMINI_VIRTUAL_SHOP_ID,
          "모든 Gemini 결과가 가상 shopId 를 유지": real.map((p) => p["가상 shopId 유지"]),
          "🔴 upsertDomesticProductLink 호출": 0,
        },
        products,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      /* 🔴 **덮어쓰지 않는다** — 고정 파일명을 써서 1·2차 상세를 영구히 잃었다. */
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `vclose-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `vclose-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${products.length}건 — vclose-${seq}.json)` }, null, 1));

      expect(real.length).toBeGreaterThan(0);
      /** 🔴 재현 가능한 CONTROL 이 하나도 없으면 측정이 성립하지 않는다 — 공짜 통과 방지. */
      expect(reproducible.length).toBeGreaterThan(0);
    },
    90 * 60 * 1000,
  );
});
