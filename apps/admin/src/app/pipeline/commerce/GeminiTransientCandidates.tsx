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
 * 🔴 `GeminiTransientEvidence`(run-domestic-price-check.ts)의 **화면이 읽는 칸만**
 *    옮긴 모양이다. 🔴 서버 타입을 직접 import 하지 않는다 — 이 파일은 클라이언트
 *    컴포넌트이고 그쪽은 서버 모듈(DB 클라이언트)을 끌고 온다.
 * 🔴 칸 이름은 서버 타입과 **글자 그대로** 같게 둔다(매핑 코드를 만들지 않는다).
 */
export interface GeminiTransientRow {
  domain: string;
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

export interface GeminiTransientCandidatesProps {
  /** 🔴 `null`/빈 배열이면 **구역을 아예 렌더하지 않는다**(flag OFF 가 그 상태다). */
  evidence?: GeminiTransientRow[] | null;
}

export function GeminiTransientCandidates({ evidence }: GeminiTransientCandidatesProps): JSX.Element | null {
  if (!evidence || evidence.length === 0) return null;

  return (
    <section data-testid="gemini-transient" className="mt-3 rounded-md border border-border bg-surface/40 p-2">
      <p className="text-[11px] font-medium text-text-secondary">
        🔎 웹 검색 후보 {evidence.length}건
      </p>
      {/* 🔴 두 문구는 CPO 가 지정한 고정 문장이다 — 요약하거나 바꾸지 않는다. */}
      <p className="mt-0.5 text-[11px] text-text-tertiary">{TRANSIENT_NOTICE}</p>
      <p className="text-[11px] text-text-tertiary">{TRANSIENT_SCOPE_NOTICE}</p>

      <ul className="mt-2 space-y-2">
        {evidence.map((row) => {
          const market = marketText(row.market);
          const verdict = row.crossSellerVerdict ?? row.matchTruth ?? null;
          const reasons = (row.matchReasons ?? []).slice(0, 3);
          const blockers = [...(row.crossSellerBlockers ?? []), ...(row.crossSellerConflicts ?? [])].slice(0, 2);
          return (
            <li key={row.discoveredUrl} className="rounded border border-border/60 p-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {/* 🟢 판정 — 서버가 낸 값을 그대로 적는다(화면이 새 판정을 만들지 않는다). */}
                <span data-testid="gt-verdict" className="text-[11px] font-medium text-text-primary">
                  {verdict ?? "판정 미확인"}
                </span>
                {/* 🔴 시장은 확인된 경우에만 — UNKNOWN 이면 이 뱃지가 «없다». */}
                {market && (
                  <span data-testid="gt-market" className="rounded bg-surface px-1 text-[10px] text-text-secondary">
                    {market}
                  </span>
                )}
                {/* 🔴 통화 그대로 · 환산 없음 */}
                <span data-testid="gt-price" className="text-[11px] text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              <a
                data-testid="gt-url"
                href={row.discoveredUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 block truncate text-[11px] text-text-tertiary underline"
              >
                {row.domain}
              </a>
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
