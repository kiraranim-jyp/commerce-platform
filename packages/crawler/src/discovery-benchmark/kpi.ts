import { normalizeForDedupe } from "./candidate-pool";
import type { BenchmarkCandidateResult, GroundTruthEntry, JobGroundTruth, LaneResult } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-LONGSPRINT-P1 §11 — KPI 계산기
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **이 파일의 가장 중요한 성질: 못 재는 것을 0 으로 적지 않는다.**
 *
 *     분모가 0            →  null   («비율이 0» 이 아니다)
 *     Ground Truth UNKNOWN →  null   (§9: recall 계산에서 제외)
 *
 *    0 으로 적으면 「측정했더니 0%」와 「측정할 수 없었다」가 같은 값이 되고,
 *    그 혼동이 이 스프린트가 반복해서 잡아 온 사고의 모양이다
 *    (0건을 「없음」으로 쓰지 않는다).
 */

/** 🔴 null 은 «측정 불가» 다. 0 과 구별된다. */
export interface Ratio {
  value: number;
  numerator: number;
  denominator: number;
}

export function ratio(numerator: number, denominator: number): Ratio | null {
  if (denominator <= 0) return null;
  return { value: numerator / denominator, numerator, denominator };
}

function sameKey(url: string): string {
  return normalizeForDedupe(url);
}

/** MI 가 「동일상품 가격에 쓴다」고 본 티어. 🔴 기존 어휘를 그대로 쓴다. */
const EXACT_TIER = "EXACT";
/** 기존 Identity 어휘 중 「유사상품 참고」 자리. */
const SIMILAR_TRUTH = "SIMILAR";

export interface JobKpi {
  jobKey: string;
  lane: string;
  groundTruthState: JobGroundTruth["state"];
  /** A. Discovery Recall — 국내/해외를 «갈라» 낸다(§7). */
  discoveryRecallDomestic: Ratio | null;
  discoveryRecallOverseas: Ratio | null;
  /** B. MI SAME Recall — 발견한 GT SAME 중 MI 가 EXACT 로 확정한 비율. */
  miSameRecall: Ratio | null;
  /** C. SAME Precision — 🔴 이 지표가 떨어지면 작업 실패다(§19 안전조건). */
  samePrecision: Ratio | null;
  /** D. SIMILAR Precision. */
  similarPrecision: Ratio | null;
  /** E. Irrelevant Candidate Rate — 후보 중 GT 가 UNRELATED 인 비율. */
  irrelevantRate: Ratio | null;
  /** G. Crawl Success — 크롤 «시도» 중 성공 비율. 시도 안 한 것은 분모에서 뺀다. */
  crawlSuccess: Ratio | null;
  /** H. Verified Price Success. */
  priceVerified: Ratio | null;
  /** F. 「없음」과 「못 찾음」을 가를 수 있는가. */
  noMatchVerdict: "NO_MATCH_CONFIRMED" | "SEARCH_INSUFFICIENT" | "FOUND_SAME" | "UNKNOWN";
}

function gtByUrl(gt: JobGroundTruth): Map<string, GroundTruthEntry> {
  const m = new Map<string, GroundTruthEntry>();
  for (const e of gt.entries) m.set(sameKey(e.url), e);
  return m;
}

/** 후보가 실제로 «발견» 됐다고 볼 수 있는가 — 분류가 무엇이든 URL 이 풀에 들어왔으면 발견이다.
 *  🔴 크롤 실패를 「발견 못 함」으로 적지 않는다. 그게 §13 분리의 핵심이다. */
function discoveredUrls(candidates: BenchmarkCandidateResult[]): Set<string> {
  return new Set(candidates.map((c) => sameKey(c.resolved.searchUrl)).concat(candidates.map((c) => sameKey(c.resolved.finalUrl))));
}

export function computeJobKpi(lane: LaneResult, gt: JobGroundTruth): JobKpi {
  const base: JobKpi = {
    jobKey: lane.jobKey,
    lane: lane.lane,
    groundTruthState: gt.state,
    discoveryRecallDomestic: null,
    discoveryRecallOverseas: null,
    miSameRecall: null,
    samePrecision: null,
    similarPrecision: null,
    irrelevantRate: null,
    crawlSuccess: null,
    priceVerified: null,
    noMatchVerdict: "UNKNOWN",
  };

  const candidates = lane.candidates;

  /* ── G·H 는 Ground Truth 가 없어도 잴 수 있다 ── */
  const attempted = candidates.filter((c) => c.crawlAttempted);
  base.crawlSuccess = ratio(attempted.filter((c) => c.crawlOk).length, attempted.length);
  const priceChecked = candidates.filter((c) => c.priceVerified !== null);
  base.priceVerified = ratio(priceChecked.filter((c) => c.priceVerified === true).length, priceChecked.length);

  /* ── 🔴 아래부터는 Ground Truth 가 있어야 한다 ── */
  if (gt.state === "UNKNOWN") {
    // §9 — UNKNOWN 이면 recall/precision 을 «계산하지 않는다». null 로 남긴다.
    return base;
  }

  const gtMap = gtByUrl(gt);
  const found = discoveredUrls(candidates);

  const gtSame = gt.entries.filter((e) => e.verdict === "SAME");
  const gtSameDomestic = gtSame.filter((e) => e.market === "DOMESTIC");
  const gtSameOverseas = gtSame.filter((e) => e.market === "OVERSEAS");

  base.discoveryRecallDomestic = ratio(
    gtSameDomestic.filter((e) => found.has(sameKey(e.url))).length,
    gtSameDomestic.length,
  );
  base.discoveryRecallOverseas = ratio(
    gtSameOverseas.filter((e) => found.has(sameKey(e.url))).length,
    gtSameOverseas.length,
  );

  // B — 발견한 GT SAME 중 MI 가 EXACT 로 세운 것.
  const foundGtSame = gtSame.filter((e) => found.has(sameKey(e.url)));
  const foundGtSameExact = foundGtSame.filter((e) =>
    candidates.some(
      (c) =>
        (sameKey(c.resolved.searchUrl) === sameKey(e.url) || sameKey(c.resolved.finalUrl) === sameKey(e.url)) &&
        c.priceTier === EXACT_TIER,
    ),
  );
  base.miSameRecall = ratio(foundGtSameExact.length, foundGtSame.length);

  // C — MI 가 EXACT 로 본 것 중 GT 가 SAME 인 비율. 🔴 GT 에 없는 후보는 분모에서
  //     «뺀다» — 모르는 것을 오답으로 세면 Precision 이 거짓으로 낮아진다.
  const miExact = candidates.filter((c) => c.priceTier === EXACT_TIER);
  const miExactJudged = miExact.filter((c) => gtMap.has(sameKey(c.resolved.finalUrl)) || gtMap.has(sameKey(c.resolved.searchUrl)));
  const miExactCorrect = miExactJudged.filter((c) => {
    const e = gtMap.get(sameKey(c.resolved.finalUrl)) ?? gtMap.get(sameKey(c.resolved.searchUrl));
    return e?.verdict === "SAME";
  });
  base.samePrecision = ratio(miExactCorrect.length, miExactJudged.length);

  // D — MI 가 SIMILAR 로 본 것 중 GT 가 SIMILAR(또는 SAME)인 비율.
  const miSimilar = candidates.filter((c) => c.matchTruth === SIMILAR_TRUTH);
  const miSimilarJudged = miSimilar.filter((c) => gtMap.has(sameKey(c.resolved.finalUrl)) || gtMap.has(sameKey(c.resolved.searchUrl)));
  const miSimilarRelevant = miSimilarJudged.filter((c) => {
    const e = gtMap.get(sameKey(c.resolved.finalUrl)) ?? gtMap.get(sameKey(c.resolved.searchUrl));
    return e?.verdict === "SIMILAR" || e?.verdict === "SAME";
  });
  base.similarPrecision = ratio(miSimilarRelevant.length, miSimilarJudged.length);

  // E — 후보 중 GT 가 UNRELATED 인 비율(GT 에 있는 것만 분모).
  const judged = candidates.filter((c) => gtMap.has(sameKey(c.resolved.finalUrl)) || gtMap.has(sameKey(c.resolved.searchUrl)));
  const unrelated = judged.filter((c) => {
    const e = gtMap.get(sameKey(c.resolved.finalUrl)) ?? gtMap.get(sameKey(c.resolved.searchUrl));
    return e?.verdict === "UNRELATED";
  });
  base.irrelevantRate = ratio(unrelated.length, judged.length);

  /* ── F — 「없음」인가 「못 찾음」인가 ── */
  if (candidates.some((c) => c.priceTier === EXACT_TIER)) base.noMatchVerdict = "FOUND_SAME";
  else if (gt.state === "CONFIRMED_NO_MATCH") base.noMatchVerdict = "NO_MATCH_CONFIRMED";
  else if (gtSame.length > 0) base.noMatchVerdict = "SEARCH_INSUFFICIENT"; // GT 에 SAME 이 있는데 못 세웠다
  else base.noMatchVerdict = "UNKNOWN";

  return base;
}

/** 🔴 표를 만들 때 null 은 빈칸으로 둔다 — 0 으로 렌더링하지 않는다. */
export function renderRatio(r: Ratio | null): string {
  if (r === null) return "—";
  return `${(r.value * 100).toFixed(0)}% (${r.numerator}/${r.denominator})`;
}
