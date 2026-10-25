"use client";

import {
  OVERSEAS_REFERENCE_NOTE,
  OVERSEAS_REFERENCE_SCOPE,
  OVERSEAS_REFERENCE_TITLE,
  buildOverseasReference,
  type OverseasPriceSummary,
} from "./overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-049 — **해외 참고가격** 표시 (표현만 한다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 판단도 계산도 하지 않는다. `buildOverseasReference` 가 만든 문자열을 그린다.
 * 🔴 값이 없으면 **아무것도 렌더하지 않는다** — 빈 구역을 만들지 않는다.
 * 🔴🔴 구역 머리에 **「참고용 · 판매판정 미반영」** 을 항상 적는다. 이 문장이
 *    사라지면 셀러가 이 숫자를 확정 가격으로 읽는다(WU-022/028 과 같은 원칙).
 */
/**
 * 🔴🔴 WU-056 — **국내 축도 같은 블록으로 그린다. 새 컴포넌트를 만들지 않았다.**
 *
 * 집계 모양(통화별 최저가 · 판매처 수 · 등급)이 국내/해외에서 **동일** 하고,
 * `buildOverseasReference` 는 통화에 대해 **중립** 이다(환산 0 · 기호 변환 0).
 * 🟢 그래서 **문구 네 개만 주입구로 열었다.** 기본값은 WU-049 의 상수 그대로이므로
 *    기존 호출부와 계약 17건은 **한 줄도 바뀌지 않는다**.
 * 🔴 국내/해외의 «의미» 는 호출부가 문구로 구분한다 — 이 컴포넌트는 판단하지 않는다.
 */
export function OverseasReferencePrice({
  summary,
  title = OVERSEAS_REFERENCE_TITLE,
  note = OVERSEAS_REFERENCE_NOTE,
  scope = OVERSEAS_REFERENCE_SCOPE,
  /** 🔴 WU-056-R1 — 기존 「🌐 글로벌 시장 가격」과 **아이콘이 겹치면 안 된다**(§5 계약). */
  icon = "🧾",
  testId = "overseas-reference",
  amountTestId = "overseas-lowest",
  /**
   * 🔴 CORE-2T §4 — 국내는 「**확인** N곳」 · 해외는 「**판매처** N곳」이다.
   *    🟢 기본값을 주지 않는다 — owner(`buildOverseasReference`)가 해외의 기존 말을
   *       기본값으로 들고 있어서, 안 넘기면 **해외 동작이 그대로** 다(§9).
   */
  sellerCountLabel,
  /**
   * 🔴 CORE-2U-A §5 — 국내는 등급 분포(「유사상품 1」)를 **끈다**. 🟢 기본값을 주지
   *    않는다 — owner 가 `true` 를 기본으로 들고 있어서 **해외는 그대로** 다(§9).
   */
  showTierNote,
  /**
   * 🔴🔴 CORE-2U-A §1·§4 — 금액 **바로 아래** 에 서는 「확정이 아니다」 한 줄.
   *    🔴 이 컴포넌트는 그 **상태를 판단하지 않는다** — 호출부가 넘긴 문장을 그릴 뿐이다.
   */
  statusLine,
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AO-R2 — **첫 화면에서는 «제목 + 금액 + 건수» 셋만 그린다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO(2026-10-26): 「첫 화면 = **판단** · 상세 화면 = **근거**」.
   *    `note`·`scope`·`statusLine`·`unknownMarketNote` 는 전부 **근거 문장** 이라
   *    상세로 간다. 🔴 **지우지 않는다** — 호출부가 `variant="DETAIL"` 로 같은
   *    문장들을 그대로 그린다(그래서 이 컴포넌트에서 삭제 0).
   * 🟢 `compact` 일 때 금액을 **크게** 키운다 — CEO 가 요구한 「가격 숫자를 가장 크게」.
   * 🔴 통화를 **기호로 바꾸지 않는다**(ISO 그대로) — `₩` 금지 계약 6건이 유효하다.
   */
  compact = false,
  /** 🔴 `compact` 의 반대편 — 금액을 **빼고** 근거 문장만 그린다(중복 금지). */
  evidenceOnly = false,
}: {
  summary?: OverseasPriceSummary | null;
  title?: string;
  note?: string;
  scope?: string;
  icon?: string;
  testId?: string;
  amountTestId?: string;
  sellerCountLabel?: string;
  showTierNote?: boolean;
  statusLine?: string | null;
  compact?: boolean;
  evidenceOnly?: boolean;
}) {
  const view = buildOverseasReference(summary, { sellerCountLabel, showTierNote });
  if (!view) return null;

  return (
    <section
      data-testid={testId}
      className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">{icon} {title}</span>
        {view.tierNote && <span className="text-xs text-muted-foreground">{view.tierNote}</span>}
      </div>

      {!evidenceOnly && (
        <ul className="mt-2 space-y-1">
          {view.lines.map((l) => (
            <li key={l.currency} className="flex flex-wrap items-baseline gap-x-2">
              {/* 🔴 통화를 기호로 바꾸지 않는다 — ISO 코드 그대로 적어야 통화를 잃지 않는다. */}
              <span
                data-testid={amountTestId}
                className={
                  compact
                    ? "text-lg font-semibold tabular-nums text-text-primary"
                    : "font-medium tabular-nums"
                }
              >
                {l.lowest}
              </span>
              <span className="text-xs text-muted-foreground">{l.scope}</span>
            </li>
          ))}
        </ul>
      )}
      {/**
       * 🔴 1차(`compact`)는 **금액까지** 다 — 아래 근거 문장들은 `＋ 상세정보 보기`
       *    안에서 **같은 컴포넌트가 `evidenceOnly` 로** 그린다(삭제 0 · 중복 0).
       */}
      {!compact && (
        <>
          {/**
           * 🔴🔴🔴 CORE-2U-A §1·§4 — **가격과 「확정 여부」를 나란히 둔다.**
           *    🔴 상태를 **판단하지 않는다** — 호출부가 SAME 유무를 보고 넘긴다.
           *    🔴🔴 **CORE-2AO-R2 에서 이 줄이 상세로 내려갔다** — 1차에서 금액 바로
           *       아래에 두던 배치였는데, 1차가 「금액 셋」으로 좁아지면서 근거 축 전체가
           *       같이 내려갔다. 🟢 금액과 **같은 접힘 안** 에 있어 순서 의미는 유지된다.
           */}
          {statusLine && (
            <p data-testid="reference-status" className="mt-2 text-xs font-medium text-text-secondary">
              {statusLine}
            </p>
          )}

          <p className="mt-2 text-xs text-muted-foreground">{note}</p>
          {/* 🔴🔴 이 두 문장은 지우지 않는다(테스트가 잠근다). */}
          <p className="text-xs text-muted-foreground">{scope}</p>
          {view.unknownMarketNote && (
            <p className="text-xs text-muted-foreground">{view.unknownMarketNote}</p>
          )}
        </>
      )}
    </section>
  );
}
