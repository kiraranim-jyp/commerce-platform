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
export function OverseasReferencePrice({ summary }: { summary?: OverseasPriceSummary | null }) {
  const view = buildOverseasReference(summary);
  if (!view) return null;

  return (
    <section
      data-testid="overseas-reference"
      className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium">🌐 {OVERSEAS_REFERENCE_TITLE}</span>
        {view.tierNote && <span className="text-xs text-muted-foreground">{view.tierNote}</span>}
      </div>

      <ul className="mt-2 space-y-1">
        {view.lines.map((l) => (
          <li key={l.currency} className="flex flex-wrap items-baseline gap-x-2">
            {/* 🔴 통화를 기호로 바꾸지 않는다 — ISO 코드 그대로 적어야 통화를 잃지 않는다. */}
            <span data-testid="overseas-lowest" className="font-medium tabular-nums">
              {l.lowest}
            </span>
            <span className="text-xs text-muted-foreground">{l.scope}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">{OVERSEAS_REFERENCE_NOTE}</p>
      {/* 🔴🔴 이 두 문장은 지우지 않는다(테스트가 잠근다). */}
      <p className="text-xs text-muted-foreground">{OVERSEAS_REFERENCE_SCOPE}</p>
      {view.unknownMarketNote && (
        <p className="text-xs text-muted-foreground">{view.unknownMarketNote}</p>
      )}
    </section>
  );
}
