import { mergeResolved, poolDiscovered } from "./candidate-pool";
import { generateQueries, unaskedQueryIds } from "./query-generator";
import { isCrawlable, resolveCandidate, type PageProbe } from "./url-resolver";
import type {
  BenchmarkCandidateResult,
  CrawlerAdapter,
  DiscoveredUrl,
  DiscoveryProvider,
  FailureStage,
  JobFixture,
  LaneResult,
  MiAdapter,
  ResolvedCandidate,
} from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-LONGSPRINT-P1 — Benchmark Harness
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 한 Lane × 한 JOB 을 끝까지 돌린다:
 *
 *     Query → Discovery → Pool/Dedup → URL Resolver → Crawler → 기존 MI
 *
 * 🔴 **이 하니스는 판정을 하지 않는다.** 크롤러도 MI 도 주입받은 것을 부르고,
 *    돌아온 값을 «그대로» 적는다. 하니스가 판정을 흉내 내면 벤치마크가 기존
 *    시스템이 아니라 내 구현을 재게 된다(이번 스프린트에서 그 함정에 한 번 빠졌다).
 *
 * 🔴 **동일 URL 을 Lane 마다 다시 크롤링하지 않는다**(지시서 §9). 그래서 crawl 은
 *    merge 가 끝난 뒤 «중복 제거된 후보» 에만 한 번씩 돈다. 호출 수 비교가
 *    왜곡되지 않게 하는 유일한 방법이다.
 */

export interface HarnessDeps {
  probe: PageProbe;
  crawler: CrawlerAdapter;
  mi: MiAdapter;
}

/** §13 — 이 후보가 «어디서» 떨어졌는가. 🔴 통과했으면 null 이다. */
function classifyFailure(
  resolved: ResolvedCandidate,
  crawlAttempted: boolean,
  crawlOk: boolean,
  matchTruth: string | null,
  priceVerified: boolean | null,
): FailureStage | null {
  switch (resolved.classification) {
    case "NOT_FOUND":
      return "SEARCH_URL_INVALID";
    case "LISTING_PAGE":
      // 🔴 실패가 아니라 «보류» 다. 그래도 건수를 센다 — 조용히 버리지 않는다.
      return "LISTING_PAGE_HELD";
    case "UNKNOWN_PAGE":
      return "SEARCH_RESULT_NO_URL";
    case "UNUSABLE":
      return resolved.steps.includes("REDIRECTED") ? "SEARCH_REDIRECT_FAILURE" : "OTHER";
    case "PRODUCT_PAGE":
      break;
  }
  if (!crawlAttempted) return "OTHER";
  if (!crawlOk) return "CRAWLER_MISS";
  if (matchTruth === null) return "PARSER_MISS";
  // 🔴 CONFLICT·INSUFFICIENT_EVIDENCE 는 «MI 가 일을 한» 결과다. 그 사실로 적는다.
  if (matchTruth === "CONFLICT" || matchTruth === "INSUFFICIENT_EVIDENCE") return "IDENTITY_REJECTION";
  if (priceVerified === false) return "PRICE_VERIFICATION_FAILURE";
  return null;
}

export async function runLane(
  laneLabel: string,
  job: JobFixture,
  providers: DiscoveryProvider[],
  deps: HarnessDeps,
): Promise<LaneResult> {
  const cost = { searchCalls: 0, probeCalls: 0, crawlCalls: 0, miCalls: 0 };
  const queries = generateQueries(job.identity);

  /* ── ① Discovery — provider 는 «URL 만» 돌려준다 ── */
  const discovered: DiscoveredUrl[] = [];
  for (const provider of providers) {
    for (const query of queries) {
      cost.searchCalls += 1;
      try {
        discovered.push(...(await provider.discover(job.identity, query)));
      } catch {
        // 🔴 provider 실패를 「결과 0건」과 섞지 않는다 — searchCalls 는 이미 셌고,
        //    이 Lane 의 discoveredCount 가 0 이면 아래 KPI 가 그것을 본다.
      }
    }
  }

  /* ── ② Pool / 1차 중복 제거 ── */
  const pooled = poolDiscovered(discovered);

  /* ── ③ URL Resolver ── */
  const resolvedRaw: ResolvedCandidate[] = [];
  for (const p of pooled) {
    cost.probeCalls += 1;
    resolvedRaw.push(await resolveCandidate(p.url, p.provenance, deps.probe));
  }
  const resolved = mergeResolved(resolvedRaw);

  /* ── ④ Crawler → ⑤ 기존 MI ── */
  const candidates: BenchmarkCandidateResult[] = [];
  for (const r of resolved) {
    let crawlAttempted = false;
    let crawlOk = false;
    let crawlReason: string | null = null;
    let matchTruth: string | null = null;
    let priceTier: string | null = null;
    let priceVerified: boolean | null = null;

    // 🔴 LISTING_PAGE 는 여기서 걸러진다. 크롤러에 «넘기지 않는다»(P1.1 §2).
    if (isCrawlable(r) && r.crawlerUrl !== null) {
      crawlAttempted = true;
      cost.crawlCalls += 1;
      const crawl = await deps.crawler.crawl(r.crawlerUrl);
      crawlOk = crawl.ok;
      crawlReason = crawl.reason;
      if (crawl.ok && crawl.facts !== null) {
        cost.miCalls += 1;
        matchTruth = await deps.mi.identify(job.identity, crawl.facts);
        priceTier = deps.mi.priceTier(matchTruth, false);
        // 가격 「검증됨」의 정의는 기존 게이트가 갖는다 — 하니스가 정하지 않는다.
        priceVerified = priceTier === "EXACT" || priceTier === "COMPARISON" ? true : false;
      }
    }

    candidates.push({
      resolved: r,
      crawlAttempted,
      crawlOk,
      crawlReason,
      matchTruth,
      priceTier,
      priceVerified,
      failureStage: classifyFailure(r, crawlAttempted, crawlOk, matchTruth, priceVerified),
    });
  }

  return {
    lane: laneLabel,
    jobKey: job.jobKey,
    queriesAsked: queries.map((q) => q.id),
    queriesUnasked: unaskedQueryIds(job.identity),
    discoveredCount: discovered.length,
    candidates,
    cost,
  };
}

/** §13 집계 — 🔴 분류별 «건수» 를 그대로 낸다. 합쳐서 요약하지 않는다. */
export function tallyFailures(lane: LaneResult): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const c of lane.candidates) {
    const key = c.failureStage ?? "PASSED";
    tally[key] = (tally[key] ?? 0) + 1;
  }
  return tally;
}
