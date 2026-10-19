/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-022 — **Gemini 웹 검색 후보** 를 «이번 확인에만» 보여주는 구역
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 별 구역인가 — 기존 후보 카드(`CandidateCard`)는 `domestic_product_links`
 * (**DB 테이블**)를 읽는다. Gemini 후보는 그 테이블에 **절대 저장하지 않는다**
 * (저장 차단 불변식). 그래서 같은 목록에 섞을 수 없고, 섞으면 「저장된 후보」처럼
 * 읽힌다. 🔴 **데이터의 수명이 다르면 구역도 달라야 한다.**
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 (WU-022 §4) ────────────────────────────
 * ```
 * ❌ 통화 환산 · 해외 가격 집계 · 국내 최저가 반영 · 판매판정 반영
 * ❌ DB 저장 · 링크 승격(「동일상품 확인」 버튼을 달지 않는다)
 * ❌ 시장을 추측해서 「국내/해외」로 적기 — UNKNOWN 은 UNKNOWN 으로 둔다
 * ```
 * 🟢 **표시만 한다.** 서버가 이미 낸 값을 옮기고, 없는 값은 「미확인」으로 적는다.
 */
import type { JSX } from "react";
/**
 * 🔴🔴 WU-028 — 매칭 등급의 **말(label)** 은 이 파일이 owner 다(`MATCHING-UNIFY-1`).
 *    국내/해외 화면이 각자 라벨 맵을 들고 있다가 같은 판정이 화면마다 다르게 보였던
 *    사고를 고친 자리다. 🔴 그래서 여기서 `crossSellerVerdict` 원문(`PRESUMED_SAME`)을
 *    그대로 찍지 않고 **그 owner 가 정한 말** 을 쓴다 — 새 어휘를 만들지 않는다.
 */
import { domesticMatchDisplay, tierDisplay, type MatchDisplayTier } from "./match-display";
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";

/**
 * 🔴 `GeminiTransientEvidence`(run-domestic-price-check.ts)의 **화면이 읽는 칸만**
 *    옮긴 모양이다. 🔴 서버 타입을 직접 import 하지 않는다 — 이 파일은 클라이언트
 *    컴포넌트이고 그쪽은 서버 모듈(DB 클라이언트)을 끌고 온다.
 * 🔴 칸 이름은 서버 타입과 **글자 그대로** 같게 둔다(매핑 코드를 만들지 않는다).
 */
export interface GeminiTransientRow {
  domain: string;
  /** 🔴 WU-028 — 판매처만으로는 「무엇이 그 가격인가」를 말할 수 없다. */
  title?: string | null;
  /** 🔴 WU-028 — 이 후보가 **어디서 왔는가**. 행에서도 출처가 보여야 한다. */
  source?: "GEMINI_DISCOVERY" | "SELLER_URL" | null;
  /** 🔴 WU-028 — 가격 «신뢰도». 숫자 옆에 이것이 없으면 가격이 확정처럼 읽힌다. */
  priceStatus?: string | null;
  discoveredUrl: string;
  /** 🟢 교차판매처 판정. 서버가 낸 값 그대로(SAME / PRESUMED_SAME / SIMILAR / …). */
  crossSellerVerdict?: string | null;
  matchTruth?: string | null;
  priceTier?: string | null;
  confidence?: number | null;
  matchReasons?: string[];
  crossSellerBlockers?: string[];
  crossSellerConflicts?: string[];
  priceAmount?: number | null;
  priceCurrency?: string | null;
  /** 🔴 시장 분류. `KR` / `OVERSEAS` / `UNKNOWN` — WU-020 의 `classifyCandidateMarket` 산출. */
  market?: string | null;
  basis?: string | null;
}

/** 🟢 구역 머리 문구 — CPO 가 글자로 지정했다(WU-022 §3). 바꾸지 않는다. */
export const TRANSIENT_NOTICE = "이번 확인에만 쓰이고 저장되지 않습니다.";
export const TRANSIENT_SCOPE_NOTICE =
  "이 후보 정보는 국내 최저가 및 판매판정에 영향을 주지 않습니다.";

/** 🔴 가격이 없을 때 적는 말. 「0원」·「-」로 적지 않는다. */
export const PRICE_UNKNOWN_TEXT = "가격 미확인";

/**
 * 🔴 시장은 **확인된 경우에만** 적는다. `UNKNOWN`·없음은 **아무 말도 하지 않는다**
 *    (「국내」로도 「해외」로도 적지 않는다 — WU-020 §4 와 같은 규칙).
 */
export function marketText(market: string | null | undefined): string | null {
  if (market === "KR") return "국내";
  if (market === "OVERSEAS") return "해외";
  return null;
}

/** 🟢 가격은 **통화를 그대로** 붙여 적는다. 🔴 환산하지 않는다. */
export function priceText(row: GeminiTransientRow): string {
  if (row.priceAmount == null || !row.priceCurrency) return PRICE_UNKNOWN_TEXT;
  return `${row.priceCurrency} ${row.priceAmount.toLocaleString("ko-KR")}`;
}

/** 🔴 WU-028 — 행에 붙는 **출처** 배지. 입력부와 결과부를 잇는 유일한 표시다. */
export const SOURCE_LABEL: Record<"GEMINI_DISCOVERY" | "SELLER_URL", string> = {
  SELLER_URL: "직접 입력",
  GEMINI_DISCOVERY: "웹 검색",
};

/**
 * 🔴🔴 WU-028 — **가격 숫자 옆에 「이 가격이 어디까지 확인된 것인가」를 붙인다.**
 *
 * 왜: Production 화면에 `KRW 117,000` 이 떴는데 판매판정은 「국내 동일상품 가격을
 * 확인하지 못했습니다」였다. 둘 다 맞는 말인데 **같은 화면에서 모순처럼 읽힌다**
 * (CPO 화면 검토 ③·④). 원인은 가격의 **검증 상태** 가 화면에 없기 때문이다.
 *
 * 🔴 **정책을 바꾸지 않는다.** `UNVERIFIED_SEARCH` 를 verified 로 승격하지 않고,
 *    집계/판정에 넣지도 않는다 — 바꾸는 것은 **말** 뿐이다.
 * 🔴 내부 enum 을 그대로 노출하지 않는다. 모르는 값은 **지어내지 않고** null 이다.
 */
export function priceConfidenceText(row: GeminiTransientRow): string | null {
  if (row.priceAmount == null || !row.priceCurrency) return null;
  if (row.priceStatus === "VERIFIED_CURRENT") return "상세 페이지에서 확인한 가격 · 판매판정 미반영";
  if (row.priceStatus === "UNVERIFIED_SEARCH") return "판매처 표시가 · 상세 검증 전 · 판매판정 미반영";
  if (row.priceStatus === "PRICE_UNAVAILABLE") return "가격을 확인하지 못했습니다";
  return "판매판정 미반영";
}

/**
 * 🔴 WU-028 — 판정 배지. **라벨 owner(`domesticMatchDisplay`)를 그대로 부른다.**
 * 🟢 `matchTruth` 가 그 함수의 입력이다. 없으면(판정 전) **지어내지 않고** null.
 */
export function verdictDisplay(row: GeminiTransientRow): { icon: string; label: string; note: string } | null {
  if (row.matchTruth) {
    const d = domesticMatchDisplay(row.matchTruth as MatchTruth);
    return { icon: d.icon, label: d.label, note: d.note };
  }
  /**
   * 🔴 `matchTruth` 가 없을 때 **정보를 잃지 않는다.** 교차판매처 판정값
   *    (`SAME`/`PRESUMED_SAME`/…)은 `MatchDisplayTier` 와 **같은 어휘** 라 같은
   *    owner(`tierDisplay`)가 그대로 말로 바꿔 준다 — 새 매핑을 만들지 않는다.
   */
  const verdict = row.crossSellerVerdict;
  if (verdict && (DISPLAYABLE_VERDICTS as readonly string[]).includes(verdict)) {
    const d = tierDisplay(verdict as MatchDisplayTier);
    return { icon: d.icon, label: d.label, note: d.note };
  }
  return null;
}

/** 🔴 `MatchDisplayTier` 와 글자가 같은 값만 넘긴다 — 모르는 값은 지어내지 않는다. */
const DISPLAYABLE_VERDICTS = ["SAME", "SAME_MODEL_OPTION_DIFF", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"] as const;

/** 🟢 기본 머리 문구 — Gemini 웹 검색 경로의 것이다(WU-022 에서 CPO 가 지정). */
export const WEB_SEARCH_HEADING = "🔎 웹 검색 후보";
/**
 * 🔴🔴 WU-024 — **출처가 다르면 머리 문구도 달라야 한다.** 셀러가 직접 넣은 URL 을
 *    「웹 검색 후보」로 적으면 거짓이다(§7 출처 보존). 구역을 가르는 이유가 그것이다.
 */
export const SUPPLIED_URL_HEADING = "🔗 직접 입력한 후보";
/**
 * 🔴🔴 WU-081 — **국내 후보 검토 구역.** 해외 축 제목과 **의미가 겹치지 않게** 짓는다.
 * ```
 * 🇰🇷 국내 참고가격            (WU-056 · 금액 «집계»)
 * 🧾 해외 동일상품 참고가격     (WU-056-R1 · 금액 «집계»)
 * 🔎 웹 검색 후보 / 🔗 직접 입력한 후보  (WU-022/024 · 후보 «행»)
 * ✅ 아래가 이번에 추가되는 것 — 후보 «행» 이고 **검토** 를 위한 자리다
 * ```
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 「후보」 이고 판단은 사람이 한다.
 */
export const DOMESTIC_REVIEW_HEADING = "🇰🇷 국내 후보 검토";
/** 🔴 후보가 0건일 때의 문구 — **판정 의미를 부여하지 않는다**(§11). */
export const DOMESTIC_REVIEW_EMPTY = "국내 비교 후보가 없습니다.";
/**
 * 🔴 입력칸 안내문. **두 가지를 반드시 말한다** — ⒜ 이번 확인에만 쓰이고 저장되지
 *    않는다 ⒝ 동일상품 판정은 **우리가** 한다(셀러가 「동일상품」이라고 선언하는
 *    칸이 아니다). ⒝ 가 빠지면 셀러가 URL 을 넣는 행위를 「동일상품 확인」으로 읽는다.
 */
/**
 * 🔴🔴 WU-091 §5(CPO 지시 2026-10-19) — **첫 문장을 더했다.**
 *    CEO 육안 테스트에서 이 칸이 **주된 후보 탐색 방법처럼** 보였고, 같은 원상품
 *    URL 을 **다시 넣어야 하는 것처럼** 읽혔다. 그래서 **언제 쓰는 칸인지** 를 먼저 말한다.
 * 🔴 뒤의 두 문장은 **지우지 않았다** — WU-024/081 의 안전 계약이다
 *    (⒜ 저장하지 않는다 ⒝ 동일상품 판정은 **우리가** 한다).
 */
export const SUPPLIED_URL_INPUT_NOTICE =
  "자동으로 찾은 후보 외에 특정 판매처 상품을 직접 확인할 때 사용합니다. 등록된 판매처 밖의 상품도 비교할 수 있습니다. 이번 확인에만 쓰이고 저장되지 않으며, 동일상품 여부는 저장된 판매처와 같은 기준으로 다시 판정합니다.";

/** 🔴 WU-091 §5 — 접힌 보조 기능의 제목. **「비교할 판매처 상품 URL」이 아니다** —
 *  그 말은 이 칸을 «해야 하는 일» 처럼 읽히게 했다. */
export const SUPPLIED_URL_INPUT_SUMMARY = "+ 다른 판매처 URL 직접 확인";

export interface GeminiTransientCandidatesProps {
  /** 🔴 `null`/빈 배열이면 **구역을 아예 렌더하지 않는다**(flag OFF 가 그 상태다). */
  evidence?: GeminiTransientRow[] | null;
  /**
   * 🔴 머리 문구. 기본은 웹 검색 경로다. 🔴 **판정 문구가 아니다** — 이 값이 바뀌어도
   *    아래 두 고정 안내문과 판정 표시는 한 글자도 바뀌지 않는다.
   */
  heading?: string;
  /** 🟢 두 구역이 같은 화면에 설 수 있으므로 테스트 훅도 가른다. */
  testId?: string;
  /**
   * 🔴🔴 WU-081 — **사람 검토(CEO)**. 기본은 `undefined` 라 기존 두 구역은
   *    **한 픽셀도 바뀌지 않는다**(버튼이 아예 렌더되지 않는다).
   *
   * 🔴 **자동 판정과 같은 칸을 쓰지 않는다.** `row.crossSellerVerdict`(시스템)과
   *    `review[url]`(사람)은 **별개 상태** 이고 서로 덮어쓰지 않는다 —
   *    `systemVerdict = SIMILAR` 과 `humanReview = SAME` 이 **공존** 한다.
   * 🔴 이 값은 MI 판정 · 가격 · 알림 · 판매판정 · 등록 payload 에 **들어가지 않는다.**
   */
  review?: Record<string, HumanReview>;
  onReview?: (url: string, verdict: HumanReview) => void;
}

/** 🔴 사람 검토 값 — 시스템 verdict 어휘(`SAME`/`PRESUMED_SAME`/…)와 **다른 타입** 이다. */
export type HumanReview = "SAME" | "DIFFERENT";

/** 🟢 사람 검토 «결과» 문구 — 시스템 판정 라벨(`tierDisplay`)과 섞지 않는다. */
const HUMAN_REVIEW_LABEL: Record<HumanReview, string> = {
  SAME: "✅ 동일상품",
  DIFFERENT: "❌ 다른 상품",
};

export function GeminiTransientCandidates({
  evidence,
  heading = WEB_SEARCH_HEADING,
  testId = "gemini-transient",
  review,
  onReview,
}: GeminiTransientCandidatesProps): JSX.Element | null {
  if (!evidence || evidence.length === 0) return null;

  return (
    <section data-testid={testId} className="mt-3 rounded-md border border-border bg-surface/40 p-2">
      <p className="text-[11px] font-medium text-text-secondary">
        {heading} {evidence.length}건
      </p>
      {/* 🔴 두 문구는 CPO 가 지정한 고정 문장이다 — 요약하거나 바꾸지 않는다. */}
      <p className="mt-0.5 text-[11px] text-text-tertiary">{TRANSIENT_NOTICE}</p>
      <p className="text-[11px] text-text-tertiary">{TRANSIENT_SCOPE_NOTICE}</p>

      <ul className="mt-2 space-y-2">
        {evidence.map((row) => {
          const market = marketText(row.market);
          const verdict = verdictDisplay(row);
          const confidence = priceConfidenceText(row);
          const reasons = (row.matchReasons ?? []).slice(0, 3);
          const blockers = [...(row.crossSellerBlockers ?? []), ...(row.crossSellerConflicts ?? [])].slice(0, 2);
          return (
            <li key={row.discoveredUrl} className="rounded border border-border/60 p-2">
              {/* 🔴🔴 WU-028 — 한 줄: **출처 · 판정 · 시장**. 출처가 행에 있어야
                  「내가 넣은 판매처가 처리된 결과」임이 결과부에서 바로 읽힌다. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {row.source && (
                  <span
                    data-testid="gt-source"
                    className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary"
                  >
                    {SOURCE_LABEL[row.source]}
                  </span>
                )}
                {/* 🟢 판정 — **라벨 owner 가 정한 말**. 내부 enum 을 노출하지 않는다. */}
                <span data-testid="gt-verdict" className="text-[11px] font-medium text-text-primary">
                  {verdict ? `${verdict.icon} ${verdict.label}` : "판정 미확인"}
                </span>
                {/* 🔴 시장은 확인된 경우에만 — UNKNOWN 이면 이 뱃지가 «없다». */}
                {market && (
                  <span data-testid="gt-market" className="rounded bg-surface px-1 text-[10px] text-text-secondary">
                    {market}
                  </span>
                )}
              </div>
              {/* 🔴 WU-028 — **무엇이** 그 가격인지. domain 만 있을 때는 링크를 열어야 알았다. */}
              {row.title && (
                <p data-testid="gt-title" className="mt-1 truncate text-[11px] text-text-primary">
                  {row.title}
                </p>
              )}
              {/* 🔴 WU-028 — **판매처와 가격을 같은 줄에** 둔다(흩어지면 연결이 끊긴다). */}
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <a
                  data-testid="gt-url"
                  href={row.discoveredUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {row.domain}
                </a>
                {/* 🔴 통화 그대로 · 환산 없음 */}
                <span data-testid="gt-price" className="shrink-0 text-[11px] font-medium text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              {/* 🔴🔴 WU-028 — 가격 **바로 아래** 에 신뢰도와 미반영 사실을 적는다.
                  이것이 「가격은 있는데 왜 판매판정엔 없나」를 그 자리에서 답한다. */}
              {confidence && (
                <p data-testid="gt-price-confidence" className="text-[11px] text-text-tertiary">
                  {confidence}
                </p>
              )}
              {/* 🟢 판정의 한 줄 근거도 owner 가 들고 있다 — 화면이 새로 쓰지 않는다. */}
              {verdict && (
                <p data-testid="gt-verdict-note" className="mt-0.5 text-[11px] text-text-tertiary">
                  {verdict.note}
                </p>
              )}
              {/* 🔴 근거 없이 판정만 보여주지 않는다(기존 정책 N-4.11 STEP2 와 같은 원칙). */}
              {reasons.length > 0 && (
                <p data-testid="gt-reasons" className="mt-1 text-[11px] text-text-tertiary">
                  {reasons.join(" · ")}
                </p>
              )}
              {blockers.length > 0 && (
                <p data-testid="gt-blockers" className="mt-0.5 text-[11px] text-text-tertiary">
                  보류 근거: {blockers.join(" · ")}
                </p>
              )}
              {/**
               * 🔴🔴 WU-081 — **사람 검토.** `onReview` 가 없으면 이 블록은 **렌더되지 않는다**
               *    (기존 두 구역이 그 상태다 — 한 픽셀도 바뀌지 않는다).
               * 🔴 위의 `gt-verdict`(시스템 판정)를 **덮지 않는다.** 둘이 같은 행에 **공존** 한다.
               */}
              {onReview && (
                <div data-testid="gt-human-review" className="mt-1 flex items-center gap-2 border-t border-border/40 pt-1">
                  <span className="text-[11px] text-text-tertiary">CEO 검토</span>
                  <button
                    type="button"
                    data-testid="gt-review-same"
                    onClick={() => onReview(row.discoveredUrl, "SAME")}
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-text-primary hover:bg-surface"
                  >
                    동일상품
                  </button>
                  <button
                    type="button"
                    data-testid="gt-review-different"
                    onClick={() => onReview(row.discoveredUrl, "DIFFERENT")}
                    className="rounded border border-border px-1.5 py-0.5 text-[11px] text-text-primary hover:bg-surface"
                  >
                    다른 상품
                  </button>
                  {review?.[row.discoveredUrl] && (
                    <span data-testid="gt-review-result" className="text-[11px] font-medium text-text-primary">
                      검토 결과: {HUMAN_REVIEW_LABEL[review[row.discoveredUrl]]}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
