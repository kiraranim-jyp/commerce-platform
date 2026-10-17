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
}: {
  summary?: OverseasPriceSummary | null;
  title?: string;
  note?: string;
  scope?: string;
  icon?: string;
  testId?: string;
  amountTestId?: string;
}) {
  const view = buildOverseasReference(summary);
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

      <ul className="mt-2 space-y-1">
        {view.lines.map((l) => (
          <li key={l.currency} className="flex flex-wrap items-baseline gap-x-2">
            {/* 🔴 통화를 기호로 바꾸지 않는다 — ISO 코드 그대로 적어야 통화를 잃지 않는다. */}
            <span data-testid={amountTestId} className="font-medium tabular-nums">
              {l.lowest}
            </span>
            <span className="text-xs text-muted-foreground">{l.scope}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
      {/* 🔴🔴 이 두 문장은 지우지 않는다(테스트가 잠근다). */}
      <p className="text-xs text-muted-foreground">{scope}</p>
      {view.unknownMarketNote && (
        <p className="text-xs text-muted-foreground">{view.unknownMarketNote}</p>
      )}
    </section>
  );
}
