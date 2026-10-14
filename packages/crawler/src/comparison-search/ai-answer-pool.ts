import { extractCandidateUrlsFromAiAnswer, type AiUrlDropReason } from "./ai-answer-urls";
import { withConfidence } from "./match";
import { factsFromProductUrl, type ProductUrlFactsResult, type ProductUrlFactsStatus } from "./product-url-facts";
import { isSelfReferenceCandidate } from "./self-reference";
import type { ComparisonCandidate, ComparisonQuery } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017-2 — 붙여넣은 AI 답변을 **기존 MI 입력** 으로 바꾼다 (AI/API 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 를 믿지 않는다.** 입력 텍스트에서 쓰는 것은 **URL 하나** 이고,
 *    「동일상품입니다」·confidence·가격·최저가·판매처 같은 AI 의 주장은 이 모듈을
 *    **지나가지 못한다**(그 칸이 반환 타입에 아예 없다). 동일상품 여부는 뒤의
 *    기존 체인이 **실제 페이지를 열어** 정한다:
 * ```
 * extractCandidateUrlsFromAiAnswer(017-1)   ← URL 만 꺼낸다 · HTTP 0
 *   → factsFromProductUrl(url)              ← 페이지를 열어 사실을 읽는다
 *   → withConfidence(query, candidates[])   ← **배열 단위 정확히 1회**
 *   → 기존 MI(judgeDomesticCandidate / 판매판정)
 * ```
 *
 * 🔴 **새 판정 규칙도 새 상태 어휘도 만들지 않는다.** 제외 사유는 기존 두 어휘
 *    (`AiUrlDropReason`(017-1) + `ProductUrlFactsStatus`(기존))만 쓴다.
 *
 * ── 🔴 `withConfidence` 를 «배열 단위로 한 번» 부르는 이유 ───────────────────
 *    그 함수는 마지막에 `confidence` 내림차순으로 **정렬** 한다(match.ts:553).
 *    후보마다 1개짜리 배열로 부르면 점수는 같아도 **순서가 붙여넣은 순서** 로
 *    남는다. 🔴 그 순서를 **기존 소비자가 계약으로 쓴다** —
 *    `selectCandidatesForDetailConfirmation`(price-confirmation.ts:17)이
 *    「이미 정렬된 배열」을 전제한다. 그래서 여기서 한 번만 부른다.
 *
 * ── 🔴 비용은 코드가 직접 보고한다 ─────────────────────────────────────────
 *    `httpCalls` 는 `factsFromProductUrl` 이 돌려주는 실제 요청 수를 합친 값이다
 *    (product-url-facts.ts:66 의 원칙 그대로 — 밖에서 fetch 를 계측하면 하니스마다
 *    숫자가 달라진다). 🔴 AI/외부 검색 API 호출은 **0** 이다 — 사람이 답변을
 *    붙여넣었으므로 이 모듈은 provider 를 부르지 않는다.
 */

/** 🔴 제외된 URL 과 이유. **새 enum 을 만들지 않았다** — 기존 두 어휘의 합집합이다. */
export interface AiAnswerPoolDrop {
  url: string;
  reason: AiUrlDropReason | ProductUrlFactsStatus;
}

export interface AiAnswerPoolInput {
  /** 사람이 붙여넣은 AI 답변 전문. */
  text: string;
  /**
   * 기존 MI query 를 **그대로** 쓴다. 🔴 새 query 생성 방식을 만들지 않는다 —
   * `withConfidence` 가 먹는 모양이 이것이고, 자기참조 기준도 여기 `sourceUrl` 이다
   * (run-domestic-price-check.ts:960 이 쓰는 그 값).
   */
  query: ComparisonQuery;
  /**
   * 🔴 페이지를 열어 볼 URL 수 상한. **임의 상한을 코드에 박지 않는다** — 호출부가
   *    준다(gemini-candidate-pool.ts §9 와 같은 규약). 상한을 넘은 URL 은 조용히
   *    버리지 않고 `notFetchedOverLimit` 에 남긴다.
   */
  maxUrls: number;
  /**
   * 🟢 테스트/측정용 주입구. 기본값이 **운영 함수** 다 — 하니스가 운영과 다른
   *    경로를 타지 않게 기본을 운영으로 두는 것이 이 저장소의 방식이다
   *    (`judgeDomesticCandidate` 의 `fetchModelCode` 와 같은 모양).
   */
  fetchFacts?: (url: string) => Promise<ProductUrlFactsResult>;
}

export interface AiAnswerPoolResult {
  /**
   * 🟢 `withConfidence` 가 낸 **그 배열 그대로** — confidence 내림차순이고, 점수·
   *    matchLevel·crossSellerVerdict 가 이미 붙어 있다.
   * 🔴 이 모듈은 그 값을 **다시 계산하지 않는다**(복제 금지).
   */
  candidates: ComparisonCandidate[];
  /** 🔴 제외된 것 전부 + 이유. 화면이 그대로 보여줄 수 있다. */
  dropped: AiAnswerPoolDrop[];
  /** 텍스트에서 발견한 URL 총수(중복 포함) — 분모. */
  foundCount: number;
  /** 입력 경계(017-1)를 통과해 **열어 볼 자격** 이 생긴 URL 수. */
  extractedUrlCount: number;
  /** 🔴 `maxUrls` 때문에 **열어 보지 않은** URL. 「상품이 없다」가 아니다. */
  notFetchedOverLimit: string[];
  /** 🔴 실제로 쓴 HTTP 요청 수(= 각 `factsFromProductUrl` 의 `httpCalls` 합). */
  httpCalls: number;
}

/**
 * 붙여넣은 AI 답변 → 점수가 매겨진 후보 배열.
 *
 * 🔴 **throw 하지 않는다.** 후보 하나의 실패가 나머지를 죽이지 않는다
 *    (gemini-candidate-pool.ts:302-305 와 같은 격리 패턴).
 */
export async function collectAiAnswerCandidatePool(input: AiAnswerPoolInput): Promise<AiAnswerPoolResult> {
  const fetchFacts = input.fetchFacts ?? factsFromProductUrl;
  const originUrl = input.query.sourceUrl ?? null;

  /* ① 입력 경계 — 017-1 의 순수 함수. HTTP 0. 여기서 제외된 것도 이유가 남는다. */
  const extraction = extractCandidateUrlsFromAiAnswer(input.text, originUrl);
  const dropped: AiAnswerPoolDrop[] = extraction.dropped.map((d) => ({ url: d.url, reason: d.reason }));

  const targets = extraction.urls.slice(0, Math.max(0, input.maxUrls));
  const notFetchedOverLimit = extraction.urls.slice(targets.length);

  /* ② URL 별로 페이지를 **실제로 열어** 사실을 읽는다. */
  const collected: ComparisonCandidate[] = [];
  const seenDedupeKeys = new Set<string>();
  let httpCalls = 0;

  for (const url of targets) {
    let facts: ProductUrlFactsResult;
    try {
      facts = await fetchFacts(url);
    } catch {
      /* 🔴 예외는 「상품이 없다」가 아니라 **접근 실패/판단 불가** 다. */
      dropped.push({ url, reason: "UNREACHABLE" });
      continue;
    }
    httpCalls += facts.httpCalls;

    if (facts.status !== "OK" || !facts.candidate) {
      /* 🔴 상태를 **그 함수가 낸 값으로** 적는다 — 「상품 페이지가 아니다」와
       *    「접근 실패」와 「사실을 못 읽었다」를 한 칸에 뭉치지 않는다.
       * 🔴 `status === "OK"` 인데 candidate 가 없는 모양은 그 함수 계약에 없지만,
       *    그때 「사실이 없다」로 적는 것이 유일하게 정직한 선택이다. */
      dropped.push({ url, reason: facts.status === "OK" ? "NO_FACTS" : facts.status });
      continue;
    }

    /* 🔴 정규화 **뒤** 에 자기참조가 드러나는 경우가 있다 — `toCrawlerUrl` 이
     *    로케일·목록 경로를 떼면서 원본과 같은 listing 이 된다(008A 로 닫힌
     *    `/collections/<c>/products/X` 케이스). 🟢 같은 판정 함수를 다시 쓴다. */
    if (originUrl && isSelfReferenceCandidate(originUrl, facts.candidate.url)) {
      dropped.push({ url, reason: "SELF_REFERENCE" });
      continue;
    }

    /* 🔴 서로 다른 입력 URL 이 **같은 상품** 으로 정규화될 수 있다(로케일/목록 경유).
     *    그대로 두면 MI 가 같은 상품을 두 후보로 센다. 🟢 키는 그 함수가 낸
     *    `dedupeKey` 를 쓴다 — 새 정규화기를 만들지 않는다. */
    const key = facts.dedupeKey ?? facts.candidate.url;
    if (seenDedupeKeys.has(key)) {
      dropped.push({ url, reason: "DUPLICATE" });
      continue;
    }
    seenDedupeKeys.add(key);

    collected.push(facts.candidate);
  }

  /* ③ 🔴 **배열 단위 정확히 1회.** 점수·정렬·cross-seller 판정의 owner 는 이 함수다.
   *    🔴 `priceStatus` 도 그 함수가 다시 정한다(derivePriceStatus · match.ts:463) —
   *       여기서 되돌리지 않는다. 가격을 쓸 수 있는지는 기존 가격 게이트가 판단한다. */
  const candidates = collected.length > 0 ? withConfidence(input.query, collected) : [];

  return {
    candidates,
    dropped,
    foundCount: extraction.foundCount,
    extractedUrlCount: extraction.urls.length,
    notFetchedOverLimit,
    httpCalls,
  };
}
